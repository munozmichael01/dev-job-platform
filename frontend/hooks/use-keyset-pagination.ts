import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeKeyset, dedupeById, buildKeysetUrl, type KeysetApi } from '../lib/api/normalizeKeyset';

interface KeysetPaginationState {
  items: any[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  total: number;
  cursor: { lastCreatedAt?: string; lastId?: number } | null;
}

interface KeysetPaginationOptions {
  limit?: number;
  baseUrl: string;
  initialParams?: Record<string, any>;
}

/**
 * HOOK DE KEYSET PAGINATION REFACTORIZADO - 100% DEFENSIVO
 * 
 * Beneficios:
 * - Performance constante independiente de la profundidad
 * - Refs defensivos para evitar stale closures
 * - Adaptador universal para cualquier formato de respuesta
 * - Deduplicación automática por ID
 * - Sin modificaciones de backend requeridas
 * 
 * @param options - Configuración del hook
 */
export function useKeysetPagination(options: KeysetPaginationOptions) {
  const { limit = 20, baseUrl, initialParams = {} } = options;
  
  const [state, setState] = useState<KeysetPaginationState>({
    items: [],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    total: 0,
    cursor: null,
  });

  // Refs defensivos para evitar stale closures
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const cursorRef = useRef<{ lastCreatedAt?: string; lastId?: number } | null>(null);
  const paramsRef = useRef(initialParams);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timestampRef = useRef<number>(0); // Para throttle
  const retryCountRef = useRef<number>(0); // Contador de reintentos
  const cursorHistoryRef = useRef<Array<{ lastCreatedAt?: string; lastId?: number } | null>>([null]); // Stack para "anterior"
  const currentPageRef = useRef<number>(1); // Página actual

  // Sincronizar params actuales
  useEffect(() => {
    paramsRef.current = initialParams;
  }, [initialParams]);

  // NOTA: fetchData removido - fetch inline en reset/loadMore según spec

  /**
   * Reset y cargar primera página
   */
  const reset = useCallback(async (additionalParams: Record<string, any> = {}) => {
    if (loadingRef.current) return;
    
    // Cancelar request anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    loadingRef.current = true;
    
    // Reset estado
    setState({
      items: [],
      isLoading: true,
      isLoadingMore: false,
      error: null,
      total: 0,
      cursor: null,
    });
    
    // Reset refs
    hasMoreRef.current = true;
    cursorRef.current = null;
    cursorHistoryRef.current = [null]; // Reset historia
    currentPageRef.current = 1;

    try {
      // Construir URL sin cursor (primera página)
      const params = { ...paramsRef.current, ...additionalParams, limit };
      const url = buildKeysetUrl(baseUrl, params, null); // cursor = null para primera página
      
      console.log('🔄 Keyset: Reset - fetching first page:', url);
      
      const response = await fetch(url, {
        signal: abortControllerRef.current?.signal,
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const rawData: KeysetApi = await response.json();
      console.log('📦 Keyset: Reset raw response:', rawData);
      console.log('🔍 RESET RAW DEBUG - Items recibidos:', rawData.items?.length || rawData.data?.length || 0);
      console.log('🔍 RESET RAW DEBUG - Primeros 3 IDs:', (rawData.items || rawData.data || []).slice(0, 3).map(item => `${item.id || item.Id}:${item.title}`));
      
      // Normalizar respuesta
      const { items, hasMore, next, total } = normalizeKeyset(rawData, limit);
      console.log('🔍 RESET NORMALIZED DEBUG - Items normalizados:', items.length);
      console.log('🔍 RESET NORMALIZED DEBUG - Primeros 3 IDs normalizados:', items.slice(0, 3).map(item => `${item.id || item.Id}:${item.title}`));
      console.log('✨ Keyset: Reset normalized:', { items: items.length, hasMore, next, total });
      
      // Actualizar refs ANTES del setState para sincronización inmediata
      hasMoreRef.current = hasMore;
      cursorRef.current = next;
      
      setState({
        items,
        isLoading: false,
        isLoadingMore: false,
        error: null,
        total,
        cursor: next,
      });
      
      console.log(`✅ Keyset: Reset complete - ${items.length} items, hasMore: ${hasMore}`);
      console.log('🔄 Reset refs:', { hasMoreRef: hasMoreRef.current, cursorRef: cursorRef.current });
      
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error('❌ Keyset: Reset error:', error);
      setState({
        items: [],
        isLoading: false,
        isLoadingMore: false,
        error: error.message || 'Error loading data',
        total: 0,
        cursor: null,
      });
      
      hasMoreRef.current = false;
      cursorRef.current = null;
    } finally {
      loadingRef.current = false;
    }
  }, [baseUrl, limit]); // Remover fetchData dependency

  /**
   * Función auxiliar para derivar cursor del último item
   */
  const deriveCursorFromLastItem = useCallback((items: any[]): { lastCreatedAt?: string; lastId?: number } | null => {
    if (!items || items.length === 0) return null;
    
    const last = items[items.length - 1];
    if (!last) return null;
    
    const lastCreatedAt = last.CreatedAt || last.createdAt || last.publishDate || null;
    const lastId = (last.id ?? last.Id ?? null);
    
    console.log('📝 Deriving cursor from last item:', { lastCreatedAt, lastId, item: last });
    
    return lastCreatedAt && (lastId !== null && lastId !== undefined) ? { lastCreatedAt, lastId } : null;
  }, []);

  /**
   * Función auxiliar para fetch con retry y backoff
   */
  const fetchWithRetry = useCallback(async (url: string, maxRetries: number = 2): Promise<Response> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Timeout de 20s
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        abortControllerRef.current = controller;
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
        });
        
        clearTimeout(timeoutId);
        
        // Si es 408, continúa con retry
        if (response.status === 408) {
          throw new Error(`HTTP 408: Request Timeout (attempt ${attempt + 1})`);
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        retryCountRef.current = 0; // Reset contador en éxito
        return response;
        
      } catch (error: any) {
        lastError = error;
        
        // Si es AbortError del timeout o 408, reintenta
        if ((error.name === 'AbortError' || error.message.includes('408')) && attempt < maxRetries) {
          const backoffDelay = attempt === 0 ? 500 : 1000 + Math.random() * 500; // 500ms, luego 1000-1500ms con jitter
          console.log(`⏳ Retry ${attempt + 1}/${maxRetries} after ${backoffDelay}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }, []);

  /**
   * Cargar más elementos (append) - BLINDADO
   */
  const loadMore = useCallback(async (additionalParams: Record<string, any> = {}) => {
    const now = Date.now();
    
    // SPEC: Sale si loadingRef.current o !hasMoreRef.current
    if (loadingRef.current || !hasMoreRef.current) {
      console.log('🚫 Keyset: LoadMore skipped - loading:', loadingRef.current, 'hasMore:', hasMoreRef.current);
      return;
    }
    
    // Throttle: Evita llamadas <150ms desde el último intento
    if (now - timestampRef.current < 150) {
      console.log('🚫 Keyset: LoadMore throttled, too soon');
      return;
    }
    timestampRef.current = now;
    
    // 1) VALIDACIÓN DE CURSOR antes de buildUrl
    let finalCursor = cursorRef.current;
    console.log('🔍 CURSOR DEBUG: cursorRef.current =', finalCursor);
    console.log('🔍 CURSOR DEBUG: state.cursor =', state.cursor);
    
    if (finalCursor !== null) {
      // Validar que tenga ambos campos válidos
      const hasValidCreatedAt = finalCursor.lastCreatedAt && finalCursor.lastCreatedAt.trim() !== '';
      const hasValidId = finalCursor.lastId !== undefined && finalCursor.lastId !== null;
      
      console.log('🔍 CURSOR VALIDATION:', {
        hasValidCreatedAt,
        hasValidId,
        lastCreatedAt: finalCursor.lastCreatedAt,
        lastId: finalCursor.lastId
      });
      
      if (!hasValidCreatedAt || !hasValidId) {
        console.log('⚠️ Cursor incompleto, derivando del último item:', finalCursor);
        console.log('🔍 state.items para derivar:', state.items.length, 'items');
        
        // a) Derivar cursor del último item de state.items
        const derivedCursor = deriveCursorFromLastItem(state.items);
        console.log('🔍 Cursor derivado:', derivedCursor);
        
        if (derivedCursor) {
          finalCursor = derivedCursor;
          cursorRef.current = finalCursor; // Actualizar ref
          console.log('✅ Cursor actualizado a derivado:', finalCursor);
        } else {
          // b) Si tras derivar sigue incompleto ⇒ set hasMore=false y return
          console.log('🚫 No se pudo derivar cursor válido, terminando paginación');
          hasMoreRef.current = false;
          setState(prev => ({ ...prev, cursor: null }));
          return;
        }
      }
    } else {
      console.log('🔍 CURSOR DEBUG: finalCursor es null, primera página');
    }
    
    // Log obligatorio: "Final cursor used"
    console.log('🎯 Final cursor used:', {
      lastCreatedAt: finalCursor?.lastCreatedAt || 'null',
      lastId: finalCursor?.lastId ?? 'null'
    });
    
    loadingRef.current = true;
    
    setState(prev => ({
      ...prev,
      isLoadingMore: true,
      error: null,
    }));

    try {
      // 2) URL con cursor SIEMPRE completo - buildUrl solo añadirá si existen los dos
      const params = { ...paramsRef.current, ...additionalParams, limit };
      console.log('🔍 PARAMS PARA BUILDURL:', params);
      console.log('🔍 FINAL CURSOR PARA BUILDURL:', finalCursor);
      
      const url = buildKeysetUrl(baseUrl, params, finalCursor);
      console.log('🔍 URL GENERADA:', url);
      
      // 7) Telemetría mínima
      const pageIndex = Math.floor(state.items.length / limit) + 1;
      console.log('📊 Telemetría:', {
        pageIndex,
        hasMoreRef: hasMoreRef.current,
        cursorRef: finalCursor,
        itemsLength: state.items.length,
        url
      });
      
      // 4) Fetch con retry y timeout
      const response = await fetchWithRetry(url, 2);
      
      const rawData: KeysetApi = await response.json();
      console.log('📦 Keyset: Raw response:', rawData);
      console.log('🔍 RAW DATA DEBUG - Items recibidos:', rawData.items?.length || rawData.data?.length || 0);
      console.log('🔍 RAW DATA DEBUG - Primeros 3 IDs:', (rawData.items || rawData.data || []).slice(0, 3).map(item => `${item.id || item.Id}:${item.title}`));
      
      // Normalizar respuesta
      const { items: newItems, hasMore, next, total } = normalizeKeyset(rawData, limit);
      console.log('🔍 NORMALIZED DEBUG - Items normalizados:', newItems.length);
      console.log('🔍 NORMALIZED DEBUG - Primeros 3 IDs normalizados:', newItems.slice(0, 3).map(item => `${item.id || item.Id}:${item.title}`));
      
      // 7) Telemetría: firstId/lastId de la tanda nueva
      const firstId = newItems.length > 0 ? (newItems[0].id ?? newItems[0].Id) : 'none';
      const lastId = newItems.length > 0 ? (newItems[newItems.length - 1].id ?? newItems[newItems.length - 1].Id) : 'none';
      console.log('📊 New batch:', { items: newItems.length, firstId, lastId, hasMore, next, total });
      
      // SPEC: sincroniza las refs ANTES del setState para acceso inmediato
      hasMoreRef.current = hasMore;
      cursorRef.current = next;
      
      setState(prev => {
        // DEBUG: State antes de actualizar
        console.log('🔍 REACT STATE DEBUG - Estado ANTES:', {
          itemsCount: prev.items.length,
          primerosIDs: prev.items.slice(0, 3).map(item => `${item.id || item.Id}:${item.title}`),
          cursor: prev.cursor
        });
        
        const newState = {
          ...prev,
          items: newItems, // Reemplazar, no agregar
          isLoadingMore: false,
          error: null,
          total,
          cursor: next,
        };
        
        // DEBUG: State después de actualizar
        console.log('🔍 REACT STATE DEBUG - Estado DESPUÉS:', {
          itemsCount: newState.items.length,
          primerosIDs: newState.items.slice(0, 3).map(item => `${item.id || item.Id}:${item.title}`),
          cursor: newState.cursor
        });
        
        console.log('📊 Page loaded:', { items: newItems.length, hasMore, total });
        
        return newState;
      });
      
      // Guardar cursor en historia para "anterior"
      if (next) {
        cursorHistoryRef.current.push(next);
        currentPageRef.current++;
        console.log(`📖 Historia guardada - Página ${currentPageRef.current}, Historia: ${cursorHistoryRef.current.length}`);
      }
      
      console.log(`✅ Keyset: Página cargada con ${newItems.length} items, hasMore: ${hasMore}`);
      
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error('❌ Keyset: LoadMore error after retries:', error);
      
      // 4) Si tras 2 reintentos falla, error no bloqueante
      const isTimeoutError = error.message.includes('408') || error.message.includes('timeout');
      const errorMessage = isTimeoutError 
        ? 'Timeout al cargar más datos. Los servidores están ocupados.'
        : error.message || 'Error loading more data';
      
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: errorMessage,
      }));
      
      // 5) NO borrar cursorRef.current en error (conservarlo para retry)
      
    } finally {
      // 5) Liberación de locks en error - SIEMPRE
      loadingRef.current = false;
      
      // Reanudar observación con cool-down de 300ms
      setTimeout(() => {
        if (hasMoreRef.current && !loadingRef.current) {
          console.log('🔄 Reanudando observación tras cool-down');
          // El IntersectionObserver se maneja en use-infinite-scroll
        }
      }, 300);
    }
  }, [baseUrl, limit]); // Remover fetchData dependency

  /**
   * Cargar página anterior - usa cursor history
   */
  const loadPrevious = useCallback(async () => {
    if (loadingRef.current || cursorHistoryRef.current.length <= 1) {
      console.log('🚫 LoadPrevious: No hay página anterior o ya cargando');
      return;
    }
    
    // Remover cursor actual y usar el anterior
    cursorHistoryRef.current.pop(); // Remover cursor actual
    currentPageRef.current--;
    
    const previousCursor = cursorHistoryRef.current[cursorHistoryRef.current.length - 1];
    cursorRef.current = previousCursor;
    
    console.log(`⬅️ Cargando página anterior ${currentPageRef.current}, cursor:`, previousCursor);
    
    loadingRef.current = true;
    setState(prev => ({
      ...prev,
      isLoadingMore: true,
      error: null,
    }));

    try {
      const params = { ...paramsRef.current, limit };
      const url = buildKeysetUrl(baseUrl, params, previousCursor);
      
      const response = await fetchWithRetry(url, 2);
      const rawData: KeysetApi = await response.json();
      const { items: newItems, hasMore, next, total } = normalizeKeyset(rawData, limit);
      
      hasMoreRef.current = true; // Siempre hay "siguiente" al ir hacia atrás
      cursorRef.current = next;
      
      setState(prev => ({
        ...prev,
        items: newItems,
        isLoadingMore: false,
        error: null,
        total,
        cursor: next,
      }));
      
      console.log(`✅ Página anterior cargada: ${newItems.length} items`);
      
    } catch (error: any) {
      console.error('❌ Error cargando página anterior:', error);
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: error.message || 'Error loading previous page',
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [baseUrl, limit, fetchWithRetry]);

  /**
   * Retry en caso de error
   */
  const retry = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
    if (state.items.length === 0) {
      reset();
    } else {
      loadMore();
    }
  }, [reset, loadMore, state.items.length]);

  // Cleanup en desmontaje
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Estado
    items: state.items,
    isLoading: state.isLoading,
    isLoadingMore: state.isLoadingMore,
    hasMore: hasMoreRef.current, // SPEC: usar ref para valor más actual
    error: state.error,
    total: state.total,
    
    // Metadatos útiles
    totalLoaded: state.items.length,
    cursor: state.cursor, // También disponible en state para debug
    currentPage: currentPageRef.current,
    canGoPrevious: cursorHistoryRef.current.length > 1,
    
    // Acciones
    loadMore,
    loadPrevious,
    retry,
    reset,
  };
}

export default useKeysetPagination;
