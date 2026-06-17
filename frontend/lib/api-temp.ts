// API base
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Import fetchWithAuth from AuthContext
// Esta función será inyectada desde el componente que use estas funciones

// -------- Conexiones --------
export async function fetchConnections(fetchWithAuth: any) {
  const res = await fetchWithAuth(`${API_URL}/api/connections`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener conexiones');
  return res.json();
}
export async function createConnection(data: any) {
  const res = await fetch(`${API_URL}/api/connections`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear conexión');
  return res.json();
}
export async function importConnection(connectionId: number) {
  const res = await fetch(`${API_URL}/api/connections/${connectionId}/import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Error al importar conexión');
  return res.json();
}
export async function uploadFile(connectionId: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_URL}/api/connections/${connectionId}/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Error al subir archivo: ${res.status}`);
  return res.json();
}

// -------- Ofertas --------
export async function fetchOffers(params: {
  search?: string; status?: string; location?: string; sector?: string;
  page?: number; limit?: number; sortBy?: string; sortOrder?: string;
} = {}) {
  const clean: Record<string,string> = {};
  if (params.search?.trim()) clean.search = params.search.trim();
  if (params.status && params.status !== 'all') clean.status = params.status;
  if (params.location && params.location !== 'all') clean.location = params.location;
  if (params.sector && params.sector !== 'all') clean.sector = params.sector;
  if (params.page && params.page > 0) clean.page = String(params.page);
  if (params.limit && params.limit > 0 && params.limit <= 100) clean.limit = String(params.limit);
  if (params.sortBy) clean.sortBy = params.sortBy;
  if (params.sortOrder) clean.sortOrder = params.sortOrder.toUpperCase();
  const qs = new URLSearchParams(clean).toString();
  const res = await fetch(`${API_URL}/job-offers${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Error ofertas: ${res.status}`);
  return res.json();
}
export async function createOffer(data: any) {
  const res = await fetch(`${API_URL}/job-offers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear oferta');
  return res.json();
}
// FILTROS DEPENDIENTES - Funciones con soporte para parámetros de filtro

export interface FilterParams {
  status?: string
  location?: string | string[]
  sector?: string | string[]
  company?: string | string[]
  jobTitle?: string | string[]
  jobTitles?: string[]
  externalId?: string
  q?: string
}

function appendFilterParam(params: URLSearchParams, key: string, value?: string | string[]) {
  if (!value) return;
  const values = Array.isArray(value) ? value : [value];
  values
    .filter(item => item && item !== 'all')
    .forEach(item => params.append(key, String(item)));
}

export async function fetchLocations(fetchWithAuth: any, filters: FilterParams = {}) {
  console.log("🔍 fetchLocations con filtros:", filters);
  console.log("🔍 DEBUG: fetchLocations incluye company:", filters.company);
  
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  appendFilterParam(params, 'sector', filters.sector);
  appendFilterParam(params, 'company', filters.company);
  appendFilterParam(params, 'jobTitle', filters.jobTitles || filters.jobTitle);
  if (filters.externalId && filters.externalId !== 'all') params.append('externalId', filters.externalId);
  if (filters.q && filters.q.trim()) params.append('q', filters.q.trim());

  const url = `${API_URL}/job-offers/locations${params.toString() ? '?' + params.toString() : ''}`;
  console.log("🔍 fetchLocations URL:", url);

  const res = await fetchWithAuth(url, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Error al obtener ubicaciones: ${res.status} ${errorText}`)
  }
  return res.json()
}

export async function fetchSectors(fetchWithAuth: any, filters: FilterParams = {}) {
  console.log("🔍 fetchSectors con filtros:", filters);
  console.log("🔍 DEBUG: fetchSectors incluye company:", filters.company);
  
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  appendFilterParam(params, 'location', filters.location);
  appendFilterParam(params, 'company', filters.company);
  appendFilterParam(params, 'jobTitle', filters.jobTitles || filters.jobTitle);
  if (filters.externalId && filters.externalId !== 'all') params.append('externalId', filters.externalId);
  if (filters.q && filters.q.trim()) params.append('q', filters.q.trim());

  const url = `${API_URL}/job-offers/sectors${params.toString() ? '?' + params.toString() : ''}`;
  console.log("🔍 fetchSectors URL:", url);

  const res = await fetchWithAuth(url, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Error al obtener sectores: ${res.status} ${errorText}`)
  }
  return res.json()
}

export async function fetchExternalIds(filters: FilterParams = {}) {
  console.log("🔍 fetchExternalIds con filtros:", filters);
  
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  appendFilterParam(params, 'location', filters.location);
  appendFilterParam(params, 'sector', filters.sector);
  appendFilterParam(params, 'company', filters.company);
  appendFilterParam(params, 'jobTitle', filters.jobTitles || filters.jobTitle);
  if (filters.q && filters.q.trim()) params.append('q', filters.q.trim());

  const url = `${API_URL}/job-offers/external-ids${params.toString() ? '?' + params.toString() : ''}`;
  console.log("🔍 fetchExternalIds URL:", url);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Error al obtener IDs externos: ${res.status} ${errorText}`)
  }
  return res.json()
}
export async function fetchJobTypes() {
  const res = await fetch(`${API_URL}/job-offers/job-types`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener tipos de contrato');
  return res.json(); // { success, data }
}

// -------- Segmentos --------
export async function fetchSegments(fetchWithAuth: any) {
  const res = await fetchWithAuth(`${API_URL}/api/segments`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener segmentos');
  return res.json();
}
export async function createSegment(fetchWithAuth: any, data: any) {
  const res = await fetchWithAuth(`${API_URL}/api/segments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear segmento');
  return res.json();
}
export async function getSegment(fetchWithAuth: any, id: number) {
  const res = await fetchWithAuth(`${API_URL}/api/segments/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener segmento');
  return res.json();
}
export async function updateSegment(fetchWithAuth: any, id: number, data: any) {
  const res = await fetchWithAuth(`${API_URL}/api/segments/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar segmento');
  return res.json();
}
export async function deleteSegment(id: number) {
  const res = await fetch(`${API_URL}/api/segments/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar segmento');
  return true;
}
export async function estimateSegmentPreview(fetchWithAuth: any, filters: {
  jobTitles?: string[]; locations?: string[]; sectors?: string[]; experienceLevels?: string[]; contractTypes?: string[];
}) {
  const res = await fetchWithAuth(`${API_URL}/api/segments/estimate-preview`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filters }),
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Error al estimar segmento (preview)');
  return res.json(); // { success, count }
}
export async function recalculateSegment(id: number) {
  const res = await fetch(`${API_URL}/api/segments/${id}/recalculate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Error al recalcular segmento');
  return res.json(); // { success, message, data }
}
export async function duplicateSegment(id: number, name?: string) {
  const res = await fetch(`${API_URL}/api/segments/${id}/duplicate`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(name ? { name } : {})
  });
  if (!res.ok) throw new Error('Error al duplicar segmento');
  return res.json(); // { success, message, data }
}

// -------- Campañas --------
export async function fetchCampaigns() {
  const res = await fetch(`${API_URL}/api/campaigns`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error al obtener campañas');
  return res.json();
}

export async function fetchCampaign(id: number, fetchWithAuth?: any) {
  if (fetchWithAuth) {
    const res = await fetchWithAuth(`${API_URL}/api/campaigns/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener campaña');
    return res.json();
  } else {
    const res = await fetch(`${API_URL}/api/campaigns/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener campaña');
    return res.json();
  }
}

export async function createCampaign(fetchWithAuth: any, data: any) {
  console.log("🎯 Enviando data a backend:", data);
  const res = await fetchWithAuth(`${API_URL}/api/campaigns`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.text();
    console.error("❌ Error respuesta backend:", error);
    throw new Error(`Error al crear campaña: ${error}`);
  }
  return res.json();
}

export async function updateCampaign(id: number, data: any, fetchWithAuth?: any) {
  if (fetchWithAuth) {
    const res = await fetchWithAuth(`${API_URL}/api/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Error al actualizar campaña: ${error}`);
    }
    return res.json();
  } else {
    const res = await fetch(`${API_URL}/api/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Error al actualizar campaña: ${error}`);
    }
    return res.json();
  }
}

export async function deleteCampaign(id: number) {
  const res = await fetch(`${API_URL}/api/campaigns/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Error al eliminar campaña: ${error}`);
  }
  
  // Verificar si hay contenido JSON válido
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { success: true };
  } catch {
    // Si no es JSON válido, asumir éxito si el status es OK
    return { success: true };
  }
}

export async function pauseCampaign(id: number) {
  const res = await fetch(`${API_URL}/api/campaigns/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'paused' }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Error al pausar campaña: ${error}`);
  }
  return res.json();
}

export async function resumeCampaign(id: number) {
  const res = await fetch(`${API_URL}/api/campaigns/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Error al reanudar campaña: ${error}`);
  }
  return res.json();
}


export async function fetchCompanies(fetchWithAuth: any, filters: FilterParams = {}) {
  console.log("🔍 fetchCompanies con filtros:", filters);
  
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'all') params.append('status', filters.status);
  appendFilterParam(params, 'location', filters.location);
  appendFilterParam(params, 'sector', filters.sector);
  appendFilterParam(params, 'jobTitle', filters.jobTitles || filters.jobTitle);
  if (filters.externalId && filters.externalId !== 'all') params.append('externalId', filters.externalId);
  if (filters.q && filters.q.trim()) params.append('q', filters.q.trim());

  const url = `${API_URL}/job-offers/companies${params.toString() ? '?' + params.toString() : ''}`;
  console.log("🔍 fetchCompanies URL:", url);

  const res = await fetchWithAuth(url, {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    cache: 'no-store'
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Error al obtener empresas: ${res.status} ${errorText}`)
  }
  return res.json()
}
