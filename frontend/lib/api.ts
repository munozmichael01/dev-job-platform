import { useAuth } from '@/contexts/AuthContext'

// API base - usa variable de entorno o fallback a localhost
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

// Hook para usar API autenticada
export function useApi() {
  const { fetchWithAuth } = useAuth()

  return {
    // -------- Conexiones --------
    fetchConnections: async () => {
      const res = await fetchWithAuth(`${API_URL}/api/connections`)
      if (!res.ok) throw new Error('Error al obtener conexiones')
      return res.json()
    },

    createConnection: async (connectionData: any) => {
      const res = await fetchWithAuth(`${API_URL}/api/connections`, {
        method: 'POST',
        body: JSON.stringify(connectionData)
      })
      if (!res.ok) throw new Error('Error al crear conexión')
      return res.json()
    },

    importConnection: async (connectionId: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/connections/${connectionId}/import`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Error al importar conexión')
      return res.json()
    },

    uploadFile: async (connectionId: number, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetchWithAuth(`${API_URL}/api/connections/${connectionId}/upload`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error('Error al subir archivo')
      return res.json()
    },

    // -------- Segmentos --------
    fetchSegments: async () => {
      const res = await fetchWithAuth(`${API_URL}/api/segments`)
      if (!res.ok) throw new Error('Error al obtener segmentos')
      return res.json()
    },

    deleteSegment: async (id: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/segments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar segmento')
      return true
    },

    recalculateSegment: async (id: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/segments/${id}/recalculate`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Error al recalcular segmento')
      return res.json()
    },

    duplicateSegment: async (id: number, name?: string) => {
      const res = await fetchWithAuth(`${API_URL}/api/segments/${id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify(name ? { name } : {})
      })
      if (!res.ok) throw new Error('Error al duplicar segmento')
      return res.json()
    },

    getSegmentDetail: async (id: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/segments/${id}/detail`)
      if (!res.ok) throw new Error('Error al obtener detalle del segmento')
      return res.json()
    },

    // -------- Campañas --------
    fetchCampaigns: async () => {
      const res = await fetchWithAuth(`${API_URL}/api/campaigns`)
      if (!res.ok) throw new Error('Error al obtener campañas')
      return res.json()
    },

    fetchCampaign: async (id: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/campaigns/${id}`)
      if (!res.ok) throw new Error('Error al obtener campaña')
      return res.json()
    },

    pauseCampaign: async (id: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/campaigns/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paused' })
      })
      if (!res.ok) throw new Error('Error al pausar campaña')
      return res.json()
    },

    resumeCampaign: async (id: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/campaigns/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' })
      })
      if (!res.ok) throw new Error('Error al reanudar campaña')
      return res.json()
    },

    deleteCampaign: async (id: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/campaigns/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Error al eliminar campaña')

      const text = await res.text()
      try {
        return text ? JSON.parse(text) : { success: true }
      } catch {
        return { success: true }
      }
    },

    activateCampaign: async (id: number) => {
      const res = await fetchWithAuth(`${API_URL}/api/campaigns/${id}/activate`, {
        method: 'POST'
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al activar campaña')
      }
      return res.json()
    },

    // -------- Dashboard --------
    fetchDashboardMetrics: async () => {
      const res = await fetchWithAuth(`${API_URL}/api/metrics/dashboard`)
      if (!res.ok) throw new Error('Error al obtener métricas dashboard')
      return res.json()
    },

    fetchOffersStats: async () => {
      const res = await fetchWithAuth(`${API_URL}/api/offers/stats`)
      if (!res.ok) throw new Error('Error al obtener estadísticas ofertas')
      return res.json()
    },

    // -------- Credenciales --------
    fetchUserCredentials: async () => {
      const res = await fetchWithAuth(`${API_URL}/api/credentials`)
      if (!res.ok) throw new Error('Error al obtener credenciales')
      return res.json()
    },

    // -------- Clients --------
    fetchClients: async (userId?: number) => {
      const url = userId ? `${API_URL}/api/clients?userId=${userId}` : `${API_URL}/api/clients`
      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al obtener clientes')
      return res.json()
    },

    // -------- Ofertas --------
    fetchOffers: async (params: any = {}) => {
      const cleanParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all') {
          cleanParams.append(key, String(value))
        }
      })
      const url = `${API_URL}/job-offers${cleanParams.toString() ? '?' + cleanParams.toString() : ''}`
      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al obtener ofertas')
      return res.json()
    },

    updateOfferStatus: async (offerId: number, status: number) => {
      const res = await fetchWithAuth(`${API_URL}/job-offers/${offerId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      })
      if (!res.ok) throw new Error('Error al cambiar estado de oferta')
      return res.json()
    },

    // -------- Filtros de Ofertas --------
    fetchLocations: async (filters: any = {}) => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, String(value))
        }
      })
      const url = `${API_URL}/job-offers/locations${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al obtener ubicaciones')
      return res.json()
    },

    fetchSectors: async (filters: any = {}) => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, String(value))
        }
      })
      const url = `${API_URL}/job-offers/sectors${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al obtener sectores')
      return res.json()
    },

    fetchCompanies: async (filters: any = {}) => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, String(value))
        }
      })
      const url = `${API_URL}/job-offers/companies${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al obtener empresas')
      return res.json()
    },

    fetchExternalIds: async (filters: any = {}) => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, String(value))
        }
      })
      const url = `${API_URL}/job-offers/external-ids${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Error al obtener IDs externos')
      return res.json()
    }
  }
} 