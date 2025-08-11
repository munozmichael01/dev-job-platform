/**
 * Adaptador de respuesta para keyset pagination
 * Normaliza diferentes formatos de respuesta del backend sin modificar endpoints
 */

export type KeysetApi = {
  items?: any[];
  data?: any[];
  hasMore?: boolean;
  total?: number;
  next?: { lastCreatedAt?: string; lastId?: number } | null;
  pagination?: { hasMore?: boolean; total?: number; lastCreatedAt?: string; lastId?: number } | null;
  cursor?: { lastCreatedAt?: string; lastId?: number } | null;
  count?: number;
  // Campos adicionales que el backend podría devolver
  success?: boolean;
  message?: string;
  queryTime?: string;
  // otras variantes comunes
  stats?: { total?: number } | null;
  meta?: { total?: number } | null;
};

export type NormalizedKeyset = {
  items: any[];
  hasMore: boolean;
  next: { lastCreatedAt?: string; lastId?: number } | null;
  total: number;
};

/**
 * Normaliza la respuesta del backend a un formato consistente
 * @param res - Respuesta cruda del backend
 * @param limit - Límite usado para inferir hasMore
 * @returns Respuesta normalizada
 */
// Helpers
type Cursor = { lastCreatedAt?: string; lastId?: number } | null;

const coalesce = <T,>(...vals: Array<T | undefined | null>): T | null => {
  const v = vals.find((x) => x !== undefined && x !== null);
  return (v as T | undefined) ?? null;
};

const lastFromItems = (items: any[], limit: number): Cursor => {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (limit && items.length < limit) return null;
  const last = items[items.length - 1];
  if (!last) return null;
  const lastCreatedAt =
    last?.CreatedAt ?? last?.createdAt ?? last?.publishDate ?? last?.date ?? null;
  const lastId =
    (typeof last?.id !== 'undefined' ? last.id : undefined) ??
    (typeof last?.Id !== 'undefined' ? last.Id : undefined) ??
    null;
  return lastCreatedAt || lastId ? { lastCreatedAt, lastId } : null;
};

// Accept either a number (limit) or options object
export function normalizeKeyset(
  res: KeysetApi,
  arg: number | { limit: number; prevTotal?: number }
): NormalizedKeyset {
  const { limit, prevTotal } =
    typeof arg === 'number' ? { limit: arg, prevTotal: 0 } : arg;

  const items = res.items ?? res.data ?? [];

  // hasMore en keyset no depende del total
  const hasMore = Boolean(
    res.hasMore ?? res.pagination?.hasMore ?? (limit ? items.length === limit : items.length > 0)
  );

  // next por prioridad y solo si es válido
  const nextFromRes: Cursor =
    res.next && (res.next.lastCreatedAt || typeof res.next.lastId !== 'undefined')
      ? res.next
      : null;

  const nextFromPag: Cursor =
    res.pagination && (res.pagination.lastCreatedAt || typeof res.pagination.lastId !== 'undefined')
      ? { lastCreatedAt: res.pagination.lastCreatedAt, lastId: res.pagination.lastId }
      : null;

  const next: Cursor = coalesce(nextFromRes, nextFromPag) ?? lastFromItems(items, limit);

  // total como mejor esfuerzo; nunca bloquea hasMore
  const total =
    coalesce<number>(
      res.total,
      res.pagination?.total,
      res.count,
      res.stats?.total,
      res.meta?.total
    ) ?? Math.max(items.length, prevTotal ?? 0);

  return { items, hasMore, next, total };
}

/**
 * Deduplica array por ID - BLINDADO
 * @param items - Array de items con id o Id
 * @returns Array sin duplicados
 */
export function dedupeById<T extends { id?: any; Id?: any }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const id = item.id ?? item.Id;
    // 6) Normalizar a String para comparación consistente
    const normalizedId = String(id);
    
    if (id && seen.has(normalizedId)) {
      return false;
    }
    if (id) {
      seen.add(normalizedId);
    }
    return true;
  });
}

/**
 * Construye URL con parámetros de keyset
 * @param baseUrl - URL base
 * @param params - Parámetros existentes
 * @param cursor - Cursor para siguiente página
 * @returns URL completa
 */
export function buildKeysetUrl(
  baseUrl: string, 
  params: Record<string, any>, 
  cursor?: { lastCreatedAt?: string; lastId?: number } | null
): string {
  console.log('🔍 BUILDKEYSETURL: Entrada -', { baseUrl, params, cursor });
  
  const url = new URL(baseUrl, window.location.origin);
  
  // Agregar parámetros existentes
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      console.log('🔍 BUILDKEYSETURL: Agregando param', key, '=', value);
      url.searchParams.append(key, String(value));
    }
  });
  
  // 2) Agregar cursor campos individualmente si existen
  const hasCreatedAt = cursor && cursor.lastCreatedAt && cursor.lastCreatedAt.trim() !== '';
  const hasId = cursor && (cursor.lastId !== undefined && cursor.lastId !== null);
  
  console.log('🔍 BUILDKEYSETURL: Evaluando cursor -', {
    cursor,
    hasCreatedAt,
    hasId,
    lastCreatedAt: cursor?.lastCreatedAt,
    lastId: cursor?.lastId
  });
  
  let cursorAdded = false;
  
  if (hasCreatedAt) {
    console.log('🔍 BUILDKEYSETURL: Agregando lastCreatedAt');
    url.searchParams.append('lastCreatedAt', encodeURIComponent(cursor.lastCreatedAt));
    cursorAdded = true;
  }
  
  if (hasId) {
    console.log('🔍 BUILDKEYSETURL: Agregando lastId');
    url.searchParams.append('lastId', String(cursor.lastId));
    cursorAdded = true;
  }
  
  if (!cursorAdded) {
    console.log('🔍 BUILDKEYSETURL: NO se agregaron cursor params');
  }
  
  const finalUrl = url.toString();
  console.log('🔍 BUILDKEYSETURL: URL final -', finalUrl);
  return finalUrl;
}
