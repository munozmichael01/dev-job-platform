import { useState, useCallback, useRef, useEffect } from 'react';
import { normalizeKeyset, dedupeById, buildKeysetUrl, type KeysetApi } from '../lib/api/normalizeKeyset';
import { useAuth } from '@/contexts/AuthContext';

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
 * HOOK DE KEYSET PAGINATION CON AUTENTICACIÓN JWT
 * Versión autenticada del hook original que usa fetchWithAuth
 */
export function useKeysetPaginationAuth(options: KeysetPaginationOptions) {
  const { limit = 20, baseUrl, initialParams = {} } = options;
  const { fetchWithAuth } = useAuth();
  
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
  const timestampRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const cursorHistoryRef = useRef<Array<{ lastCreatedAt?: string; lastId?: number } | null>>([null]);
  const currentPageRef = useRef<number>(1);

  // Sincronizar params actuales
  useEffect(() => {
    paramsRef.current = initialParams;
  }, [initialParams]);

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
    cursorHistoryRef.current = [null];
    currentPageRef.current = 1;

    try {
      // Construir URL sin cursor (primera página)
      const params = { ...paramsRef.current, ...additionalParams, limit };
      const url = buildKeysetUrl(baseUrl, params, null);
      
      console.log('🔄 Keyset Auth: Reset - fetching first page:', url);
      
      // ✅ USAR fetchWithAuth en lugar de fetch directo
      // TEMPORAL: Removido signal para evitar AbortError prematuros
      const response = await fetchWithAuth(url, {
        // signal: abortControllerRef.current?.signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const rawData: KeysetApi = await response.json();
      console.log('📦 Keyset Auth: Reset raw response:', rawData);
      
      // Normalizar respuesta
      const { items, hasMore, next, total } = normalizeKeyset(rawData, limit);
      console.log('✨ Keyset Auth: Reset normalized:', { items: items.length, hasMore, next, total });
      
      // Actualizar refs ANTES del setState
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
      
      console.log(`✅ Keyset Auth: Reset complete - ${items.length} items, hasMore: ${hasMore}`);
      
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error('❌ Keyset Auth: Reset error:', error);
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
  }, [baseUrl, limit, fetchWithAuth]);

  /**
   * Función auxiliar para derivar cursor del último item
   */
  const deriveCursorFromLastItem = useCallback((items: any[]): { lastCreatedAt?: string; lastId?: number } | null => {
    if (!items || items.length === 0) return null;
    
    const last = items[items.length - 1];
    if (!last) return null;
    
    const lastCreatedAt = last.CreatedAt || last.createdAt || last.publishDate || null;
    const lastId = (last.id ?? last.Id ?? null);
    
    return lastCreatedAt && (lastId !== null && lastId !== undefined) ? { lastCreatedAt, lastId } : null;
  }, []);

  /**
   * Función auxiliar para fetch con retry y backoff - AUTENTICADO
   */
  const fetchWithRetry = useCallback(async (url: string, maxRetries: number = 2): Promise<Response> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        abortControllerRef.current = controller;
        
        // ✅ USAR fetchWithAuth en lugar de fetch directo
        // TEMPORAL: Removido signal para evitar AbortError prematuros
        const response = await fetchWithAuth(url, {
          // signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 408) {
          throw new Error(`HTTP 408: Request Timeout (attempt ${attempt + 1})`);
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        retryCountRef.current = 0;
        return response;
        
      } catch (error: any) {
        lastError = error;
        
        if ((error.name === 'AbortError' || error.message.includes('408')) && attempt < maxRetries) {
          const backoffDelay = attempt === 0 ? 500 : 1000 + Math.random() * 500;
          console.log(`⏳ Auth Retry ${attempt + 1}/${maxRetries} after ${backoffDelay}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }, [fetchWithAuth]);

  /**
   * Cargar más elementos (append) - AUTENTICADO
   */
  const loadMore = useCallback(async (additionalParams: Record<string, any> = {}) => {
    const now = Date.now();
    
    if (loadingRef.current || !hasMoreRef.current) {
      console.log('🚫 Keyset Auth: LoadMore skipped - loading:', loadingRef.current, 'hasMore:', hasMoreRef.current);
      return;
    }
    
    if (now - timestampRef.current < 150) {
      console.log('🚫 Keyset Auth: LoadMore throttled, too soon');
      return;
    }
    timestampRef.current = now;
    
    let finalCursor = cursorRef.current;
    
    if (finalCursor !== null) {
      const hasValidCreatedAt = finalCursor.lastCreatedAt && finalCursor.lastCreatedAt.trim() !== '';
      const hasValidId = finalCursor.lastId !== undefined && finalCursor.lastId !== null;
      
      if (!hasValidCreatedAt || !hasValidId) {
        const derivedCursor = deriveCursorFromLastItem(state.items);
        
        if (derivedCursor) {
          finalCursor = derivedCursor;
          cursorRef.current = finalCursor;
        } else {
          hasMoreRef.current = false;
          setState(prev => ({ ...prev, cursor: null }));
          return;
        }
      }
    }
    
    loadingRef.current = true;
    
    setState(prev => ({
      ...prev,
      isLoadingMore: true,
      error: null,
    }));

    try {
      const params = { ...paramsRef.current, ...additionalParams, limit };
      const url = buildKeysetUrl(baseUrl, params, finalCursor);
      
      console.log('🔄 Keyset Auth: LoadMore URL:', url);
      
      const response = await fetchWithRetry(url, 2);
      const rawData: KeysetApi = await response.json();
      
      // Normalizar respuesta
      const { items: newItems, hasMore, next, total } = normalizeKeyset(rawData, limit);
      
      // Actualizar refs ANTES del setState
      hasMoreRef.current = hasMore;
      cursorRef.current = next;
      
      setState(prev => ({
        ...prev,
        items: newItems, // Para paginación tradicional: reemplazar página actual
        isLoadingMore: false,
        error: null,
        total,
        cursor: next,
      }));
      
      // Guardar cursor en historia para navegación anterior
      if (next && !cursorHistoryRef.current.some(c => 
        c?.lastCreatedAt === next.lastCreatedAt && c?.lastId === next.lastId
      )) {
        cursorHistoryRef.current.push(next);
        currentPageRef.current++;
      }
      
      console.log(`✅ Keyset Auth: Página cargada con ${newItems.length} items, hasMore: ${hasMore}`);
      
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      console.error('❌ Keyset Auth: LoadMore error:', error);
      
      const isTimeoutError = error.message.includes('408') || error.message.includes('timeout');
      const errorMessage = isTimeoutError 
        ? 'Timeout al cargar más datos. Los servidores están ocupados.'
        : error.message || 'Error loading more data';
      
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: errorMessage,
      }));
      
    } finally {
      loadingRef.current = false;
    }
  }, [baseUrl, limit, fetchWithRetry, deriveCursorFromLastItem, state.items]);

  /**
   * Cargar página anterior - AUTENTICADO
   */
  const loadPrevious = useCallback(async () => {
    if (loadingRef.current || currentPageRef.current <= 1) {
      return;
    }
    
    currentPageRef.current--;
    const previousCursor = cursorHistoryRef.current[currentPageRef.current - 1];
    cursorRef.current = previousCursor;
    
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
      
      hasMoreRef.current = true;
      cursorRef.current = next;
      
      setState(prev => ({
        ...prev,
        items: newItems,
        isLoadingMore: false,
        error: null,
        total,
        cursor: next,
      }));
      
    } catch (error: any) {
      console.error('❌ Keyset Auth: Error cargando página anterior:', error);
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: error.message || 'Error loading previous page',
      }));
      
      currentPageRef.current++;
      cursorRef.current = cursorHistoryRef.current[currentPageRef.current - 1];
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
    hasMore: hasMoreRef.current,
    error: state.error,
    total: state.total,
    
    // Metadatos útiles
    totalLoaded: state.items.length,
    cursor: state.cursor,
    currentPage: currentPageRef.current,
    canGoPrevious: currentPageRef.current > 1,
    
    // Acciones
    loadMore,
    loadPrevious,
    retry,
    reset,
  };
}

export default useKeysetPaginationAuth;

