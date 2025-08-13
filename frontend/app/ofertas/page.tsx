"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Search, Filter, Eye, MapPin, Calendar, Building2, DollarSign, AlertCircle, CheckCircle, RefreshCw, Loader2, X, Trash2, Play, Pause, Archive, TrendingUp, BarChart3 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { useKeysetPagination } from "@/hooks/use-keyset-pagination"
// Removed infinite scroll - using simple pagination
import { ResultsCounter } from "@/components/ui/infinite-loader"
import { ErrorMessage } from "@/components/ui/error-message"
import { fetchLocations, fetchSectors, fetchCompanies, fetchExternalIds, type FilterParams } from "@/lib/api-temp"

// Tipos TypeScript actualizados para keyset pagination
interface Oferta {
  id: number;
  Id: number; // Backend devuelve ambos formatos
  ExternalId?: string; // ID externo del sistema origen
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  sector: string;
  publishDate: string;
  CreatedAt: string; // Para keyset pagination
  status: 'active' | 'pending' | 'paused' | 'archived';
  StatusId: number; // 1=active, 2=paused, 3=archived
  applications?: number;
  channels?: string[];
  validated?: boolean;
  // NUEVAS COLUMNAS
  campaignCount?: number;
  segmentCount?: number;
  promotion?: string;
  campaigns?: string;
  segments?: string;
  totalBudget?: number;
  budgetSpent?: number;
  targetApplications?: number;
  applicationsReceived?: number;
  performance?: string;
}

// NOTA: API call ahora manejada internamente por el hook useKeysetPagination

export default function OfertasPage() {
  const searchParams = useSearchParams()
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [sectorFilter, setSectorFilter] = useState<string>("all")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [externalIdFilter, setExternalIdFilter] = useState<string>("all")
  const [promocionFilter, setPromocionFilter] = useState<string>(() => {
    const promocionParam = searchParams?.get("promocion")
    // Mapear valores legacy del dashboard
    if (promocionParam === "no") return "sin-promocion"
    if (promocionParam === "si") return "promocionandose"
    // Valores específicos de 4 estados
    if (["promocionandose", "preparada", "categorizada", "sin-promocion"].includes(promocionParam || "")) {
      return promocionParam || "all"
    }
    return "all"
  })
  
  // Estados para opciones de dropdowns
  const [locations, setLocations] = useState<string[]>([])
  const [sectors, setSectors] = useState<string[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [externalIds, setExternalIds] = useState<(string | number)[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  
  // Estado específico para loading del input de búsqueda
  const [isSearching, setIsSearching] = useState(false)
  
  // Estados para UI - SIMPLIFICADOS (algunos vienen del hook ahora)
  const [stats, setStats] = useState({
    totalOffers: 0,
    activeOffers: 0,
    pendingOffers: 0,
    pausedOffers: 0,
    totalSectors: 0,
    totalCities: 0
  })
  const [queryTime, setQueryTime] = useState<number>(0)
  const [searchType, setSearchType] = useState<string>('')

  const { toast } = useToast()

  // Función para cambiar estado de ofertas
  const handleOfferStatusChange = async (offerId: number, newStatus: number) => {
    try {
      const response = await fetch(`http://localhost:3002/job-offers/${offerId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3006'
        },
        body: JSON.stringify({ status: newStatus })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "Estado actualizado",
          description: result.message
        })
        // Recargar datos
        reset(getCleanFilters())
      } else {
        toast({
          title: "Error",
          description: result.error || 'Error al cambiar estado',
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      toast({
        title: "Error de conexión",
        description: 'No se pudo conectar con el servidor',
        variant: "destructive"
      })
    }
  }

  // Debounced search optimizado - solo busca a partir del 3er carácter
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)
  useEffect(() => {
    // Si hay menos de 3 caracteres, limpiar búsqueda inmediatamente
    if (searchTerm.length < 3) {
      setDebouncedSearchTerm('')
      setIsSearching(false)
      return
    }
    
    // Mostrar loading si hay 3+ caracteres
    setIsSearching(true)
    
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setIsSearching(false) // Loading se quita cuando se ejecuta la búsqueda
    }, 500)
    
    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [searchTerm])

  // Función para obtener filtros limpios
  const getCleanFilters = useCallback(() => {
    return {
      ...(debouncedSearchTerm && debouncedSearchTerm.trim() !== '' ? { q: debouncedSearchTerm.trim() } : {}),
      mode: 'auto', // Usar siempre modo auto para cascada inteligente
      ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(locationFilter && locationFilter !== 'all' ? { location: locationFilter } : {}),
      ...(sectorFilter && sectorFilter !== 'all' ? { sector: sectorFilter } : {}),
      ...(companyFilter && companyFilter !== 'all' ? { company: companyFilter } : {}),
      ...(externalIdFilter && externalIdFilter !== 'all' ? { externalId: externalIdFilter } : {}),
      ...(promocionFilter && promocionFilter !== 'all' ? { promocion: promocionFilter } : {}),
    }
  }, [debouncedSearchTerm, statusFilter, locationFilter, sectorFilter, companyFilter, externalIdFilter, promocionFilter])

  // Hash para detectar cambios en filtros
  const filtersHash = useMemo(() => {
    const filters = getCleanFilters()
    return JSON.stringify(filters)
  }, [getCleanFilters])

  // Hook de keyset pagination con navegación anterior/siguiente
  const {
    items: ofertas,
    isLoading: isInitialLoading,
    isLoadingMore,
    hasMore,
    error,
    total,
    totalLoaded,
    cursor,
    currentPage,
    canGoPrevious,
    loadMore,
    loadPrevious,
    retry,
    reset
  } = useKeysetPagination({
    limit: 20,
    baseUrl: 'http://localhost:3002/job-offers', // URL completa del backend
    initialParams: getCleanFilters() // Parámetros iniciales
  });

  // 🔍 DEBUG: Log de re-render del componente
  console.log('🔍 COMPONENT RE-RENDER:', {
    ofertasCount: ofertas.length,
    primeros3: ofertas.slice(0, 3).map(o => `${o.id || o.Id}:${o.title?.substring(0, 20)}`),
    isLoading: isInitialLoading,
    currentPage
  });

  // Paginación simple - sin scroll infinito

  // Efecto para resetear y cargar cuando cambien los filtros
  useEffect(() => {
    reset(getCleanFilters());
  }, [filtersHash, reset]);

  // Cargar opciones de dropdowns con filtros dependientes
  useEffect(() => {
    const loadDropdownOptions = async () => {
      setLoadingOptions(true)
      try {
        // Filtros actuales para consultas dependientes
        const currentFilters = {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          location: locationFilter !== 'all' ? locationFilter : undefined,
          sector: sectorFilter !== 'all' ? sectorFilter : undefined,
          company: companyFilter !== 'all' ? companyFilter : undefined,
          externalId: externalIdFilter !== 'all' ? externalIdFilter : undefined,
          q: debouncedSearchTerm || undefined
        }

        console.log('🔍 Cargando opciones con filtros dependientes:', currentFilters)

        const [locationsResult, sectorsResult, companiesResult, externalIdsResult] = await Promise.all([
          fetchLocations({
            status: currentFilters.status,
            sector: currentFilters.sector,
            company: currentFilters.company,
            externalId: currentFilters.externalId,
            q: currentFilters.q
          }),
          fetchSectors({
            status: currentFilters.status,
            location: currentFilters.location,
            company: currentFilters.company,
            externalId: currentFilters.externalId,
            q: currentFilters.q
          }),
          fetchCompanies({
            status: currentFilters.status,
            location: currentFilters.location,
            sector: currentFilters.sector,
            externalId: currentFilters.externalId,
            q: currentFilters.q
          }),
          fetchExternalIds({
            status: currentFilters.status,
            location: currentFilters.location,
            sector: currentFilters.sector,
            company: currentFilters.company,
            q: currentFilters.q
          })
        ])
        
        if (locationsResult.success) {
          setLocations(locationsResult.data || [])
          console.log(`✅ Locations actualizadas: ${locationsResult.data?.length || 0} opciones`)
        }
        
        if (sectorsResult.success) {
          setSectors(sectorsResult.data || [])
          console.log(`✅ Sectors actualizados: ${sectorsResult.data?.length || 0} opciones`)
        }
        
        if (companiesResult.success) {
          setCompanies(companiesResult.data || [])
          console.log(`✅ Companies actualizadas: ${companiesResult.data?.length || 0} opciones`)
        }
        
        if (externalIdsResult.success) {
          setExternalIds(externalIdsResult.data || [])
          console.log(`✅ ExternalIds actualizados: ${externalIdsResult.data?.length || 0} opciones`)
        }
      } catch (error) {
        console.error('❌ Error cargando opciones de filtros:', error)
        // No mostrar toast error aquí, son opcionales
      } finally {
        setLoadingOptions(false)
      }
    }
    
    loadDropdownOptions()
  }, [statusFilter, locationFilter, sectorFilter, companyFilter, externalIdFilter, promocionFilter, debouncedSearchTerm]) // Recargar cuando cambien los filtros

  // NOTA: La carga inicial se maneja en el efecto de abajo con reset()

  // Handlers para filtros
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
  }, [])

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value)
  }, [])

  const handleLocationChange = useCallback((value: string) => {
    setLocationFilter(value)
  }, [])

  const handleSectorChange = useCallback((value: string) => {
    setSectorFilter(value)
  }, [])

  const handleCompanyChange = useCallback((value: string) => {
    setCompanyFilter(value)
  }, [])

  const handleExternalIdChange = useCallback((value: string) => {
    setExternalIdFilter(value)
  }, [])

  const handlePromocionChange = useCallback((value: string) => {
    setPromocionFilter(value)
  }, [])

  const handleClearFilters = useCallback(() => {
    setSearchTerm("")
    setStatusFilter("all")
    setLocationFilter("all")
    setSectorFilter("all")
    setCompanyFilter("all")
    setExternalIdFilter("all")
    setPromocionFilter("all")
  }, [])

  const handleRetry = useCallback(() => {
    retry()
  }, [retry])

  // Usar opciones de filtros desde la API (todos los datos, no solo ofertas cargadas)
  const uniqueLocations = locations
  const uniqueSectors = sectors
  const uniqueCompanies = companies
  const uniqueExternalIds = externalIds

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'pending': return 'secondary'
      case 'paused': return 'outline'
      case 'archived': return 'destructive'
      default: return 'secondary'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-3 w-3" />
      case 'pending': return <AlertCircle className="h-3 w-3" />
      case 'paused': return <RefreshCw className="h-3 w-3" />
      default: return null
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activa'
      case 'pending': return 'Pendiente'
      case 'paused': return 'Pausada'
      case 'archived': return 'Archivada'
      default: return status
    }
  }

  // Componente para columna de Promoción
  const PromotionColumn = ({ oferta }: { oferta: Oferta }) => {
    if (!oferta.campaignCount || oferta.campaignCount === 0) {
      return <span className="text-gray-400 text-sm">No promocionada</span>
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{oferta.promotion}</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            <div className="space-y-2">
              <div>
                <strong>Campañas activas:</strong>
                <div className="text-sm text-muted-foreground">
                  {oferta.campaigns || 'Sin detalles de campañas'}
                </div>
              </div>
              <div>
                <strong>Segmentos:</strong>
                <div className="text-sm text-muted-foreground">
                  {oferta.segments || 'Sin detalles de segmentos'}
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Componente para columna de Performance
  const PerformanceColumn = ({ oferta }: { oferta: Oferta }) => {
    if (!oferta.totalBudget || oferta.totalBudget === 0) {
      return <span className="text-gray-400 text-sm">Sin datos</span>
    }

    const spent = oferta.budgetSpent || 0
    const budget = oferta.totalBudget || 0
    const inscriptions = oferta.applicationsReceived || 0
    const target = oferta.targetApplications || 0
    const cpi = inscriptions > 0 ? (spent / inscriptions).toFixed(2) : '0'
    const budgetPercentage = budget > 0 ? ((spent / budget) * 100).toFixed(1) : '0'
    const inscriptionsPercentage = target > 0 ? ((inscriptions / target) * 100).toFixed(1) : '0'

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">
              <div className="flex items-center gap-1 text-sm">
                <BarChart3 className="h-4 w-4 text-green-500" />
                <span className="font-medium">{oferta.performance}</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            <div className="space-y-2">
              <div>
                <strong>Presupuesto:</strong>
                <div className="text-sm text-muted-foreground">
                  €{spent.toLocaleString()} gastados de €{budget.toLocaleString()} ({budgetPercentage}%)
                </div>
              </div>
              <div>
                <strong>Inscripciones:</strong>
                <div className="text-sm text-muted-foreground">
                  {inscriptions} logradas de {target} objetivo ({inscriptionsPercentage}%)
                </div>
              </div>
              <div>
                <strong>CPI (Costo Por Inscripción):</strong>
                <div className="text-sm text-muted-foreground">€{cpi}</div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Componente para botones de acciones contextuales
  const ActionButtons = ({ oferta, onStatusChange }: { oferta: Oferta; onStatusChange: (id: number, status: number) => void }) => {
    const getActions = (statusId: number) => {
      switch(statusId) {
        case 1: // ACTIVA
          return [
            { label: 'Pausar', action: 'pause', status: 2, color: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800', icon: <Pause className="h-3 w-3" /> },
            { label: 'Archivar', action: 'archive', status: 3, color: 'bg-red-100 hover:bg-red-200 text-red-800', icon: <Archive className="h-3 w-3" /> }
          ]
        case 2: // PAUSADA
          return [
            { label: 'Activar', action: 'activate', status: 1, color: 'bg-green-100 hover:bg-green-200 text-green-800', icon: <Play className="h-3 w-3" /> },
            { label: 'Archivar', action: 'archive', status: 3, color: 'bg-red-100 hover:bg-red-200 text-red-800', icon: <Archive className="h-3 w-3" /> }
          ]
        case 3: // ARCHIVADA
          return [
            { label: 'Activar', action: 'activate', status: 1, color: 'bg-green-100 hover:bg-green-200 text-green-800', icon: <Play className="h-3 w-3" /> }
          ]
        default:
          return []
      }
    }

    const handleAction = async (action: string, newStatus: number) => {
      const confirmMessages = {
        pause: '¿Pausar oferta temporalmente?',
        archive: '¿Archivar oferta definitivamente?',
        activate: oferta.StatusId === 3 ? '¿Reactivar esta oferta archivada?' : '¿Activar oferta nuevamente?'
      }
      
      // Validar si está en campañas activas
      if ((action === 'pause' || action === 'archive') && oferta.campaignCount && oferta.campaignCount > 0) {
        const extraWarning = '\n\n⚠️ Esta oferta está en campañas activas. Esto afectará su promoción.'
        if (!confirm(confirmMessages[action as keyof typeof confirmMessages] + extraWarning)) return
      } else {
        if (!confirm(confirmMessages[action as keyof typeof confirmMessages])) return
      }
      
      await onStatusChange(oferta.id || oferta.Id, newStatus)
    }

    return (
      <div className="flex gap-1">
        {getActions(oferta.StatusId).map(action => (
          <Button
            key={action.action}
            onClick={() => handleAction(action.action, action.status)}
            size="sm"
            variant="ghost"
            className={`h-7 px-2 text-xs ${action.color}`}
          >
            {action.icon}
            <span className="ml-1">{action.label}</span>
          </Button>
        ))}
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Ofertas</h1>
          <p className="text-muted-foreground">
            Arquitectura SARGable con Keyset Pagination - Performance &lt;300ms constante
          </p>
        </div>
      </div>

      {/* Estadísticas mejoradas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cargadas</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLoaded.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {hasMore ? `de ${total.toLocaleString()} disponibles` : 'todas cargadas'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queryTime}ms</div>
            <p className="text-xs text-muted-foreground">
              {searchType || 'keyset'} · {hasMore ? 'más disponible' : 'completo'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ubicaciones</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueLocations.length}</div>
            <p className="text-xs text-muted-foreground">
              ciudades disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sectores</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueSectors.length}</div>
            <p className="text-xs text-muted-foreground">
              sectores representados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
          <CardDescription>
            Búsqueda inteligente con cascada automática (exacta → prefijo → amplia)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Búsqueda</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground opacity-70" />
                )}
                <Input
                  placeholder="Buscar por puesto, empresa, ubicación..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 pr-8"
                  disabled={false}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="archived">Archivada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Promoción</label>
              <Select value={promocionFilter} onValueChange={handlePromocionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="promocionandose">🟢 En campañas activas</SelectItem>
                  <SelectItem value="preparada">🟡 En campañas pausadas</SelectItem>
                  <SelectItem value="categorizada">🟠 En campañas inactivas</SelectItem>
                  <SelectItem value="sin-promocion">🔴 Sin campañas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ubicación</label>
              <SearchableSelect
                options={uniqueLocations}
                value={locationFilter}
                onValueChange={handleLocationChange}
                placeholder="Todas las ubicaciones"
                searchPlaceholder="Buscar ubicación..."
                emptyMessage="No se encontraron ubicaciones"
                loading={loadingOptions}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sector</label>
              <SearchableSelect
                options={uniqueSectors}
                value={sectorFilter}
                onValueChange={handleSectorChange}
                placeholder="Todos los sectores"
                searchPlaceholder="Buscar sector..."
                emptyMessage="No se encontraron sectores"
                loading={loadingOptions}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <SearchableSelect
                options={uniqueCompanies}
                value={companyFilter}
                onValueChange={handleCompanyChange}
                placeholder="Todas las empresas"
                searchPlaceholder="Buscar empresa..."
                emptyMessage="No se encontraron empresas"
                loading={loadingOptions}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">ID Externo</label>
              <SearchableSelect
                options={uniqueExternalIds}
                value={externalIdFilter}
                onValueChange={handleExternalIdChange}
                placeholder="Todos los IDs"
                searchPlaceholder="Buscar ID..."
                emptyMessage="No se encontraron IDs"
                loading={loadingOptions}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">&nbsp;</label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearFilters}
                className="w-full flex items-center gap-2"
                title="Limpiar todos los filtros"
              >
                <Trash2 className="h-3 w-3" />
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contador de resultados */}
      <ResultsCounter 
        showing={totalLoaded}
        total={total}
        isLoading={isInitialLoading}
      />
      

      {/* Error handling */}
      {error && (
        <ErrorMessage 
          error={error}
          onRetry={handleRetry}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Lista de ofertas con paginación simple */}
      <Card>
        <CardHeader>
          <CardTitle>
            Ofertas de Trabajo
            {isInitialLoading && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin inline" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isInitialLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Cargando ofertas...</span>
            </div>
          ) : ofertas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {error ? 'Error cargando ofertas' : 'No se encontraron ofertas con los filtros aplicados'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
          <Table key={`ofertas-table-${ofertas.length}-${ofertas[0]?.id || 'empty'}-${currentPage}`}>
            <TableHeader>
              <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>ID Externo</TableHead>
                    <TableHead>Empresa</TableHead>
                <TableHead>Ubicación</TableHead>
                    <TableHead>Sector</TableHead>
                <TableHead>Salario</TableHead>
                <TableHead>Promoción</TableHead>
                <TableHead>Performance</TableHead>
                <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                  {ofertas.map((oferta, index) => {
                    // 🔍 DEBUG: Log de cada oferta renderizada
                    if (index < 3) console.log(`🔍 RENDERING ROW ${index}:`, oferta.id || oferta.Id, oferta.title?.substring(0, 30));
                    return (
                    <TableRow key={String(oferta.id ?? oferta.Id)}>
                      <TableCell className="font-medium">{oferta.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{oferta.ExternalId || 'N/A'}</TableCell>
                      <TableCell>{oferta.company}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {oferta.location || 'No especificada'}
                    </div>
                  </TableCell>
                      <TableCell>{oferta.sector || 'General'}</TableCell>
                      <TableCell>{oferta.salary || 'No especificado'}</TableCell>
                      <TableCell>
                        <PromotionColumn oferta={oferta} />
                      </TableCell>
                      <TableCell>
                        <PerformanceColumn oferta={oferta} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(oferta.status)} className="flex items-center gap-1">
                          {getStatusIcon(oferta.status)}
                          {getStatusText(oferta.status)}
                        </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(oferta.publishDate)}
                    </div>
                  </TableCell>
                  <TableCell>
                        <ActionButtons oferta={oferta} onStatusChange={handleOfferStatusChange} />
                  </TableCell>
                </TableRow>
                    );
                  })}
            </TableBody>
          </Table>

              {/* Paginación estilo Google */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} • Mostrando {totalLoaded} ofertas de {total.toLocaleString()} disponibles
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadPrevious()}
                    disabled={isLoadingMore || !canGoPrevious}
                  >
                    ← Anterior
                  </Button>
                  
                  <div className="text-sm text-muted-foreground px-3 min-w-[80px] text-center">
                    Página {currentPage}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMore()}
                    disabled={isLoadingMore || !hasMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Cargando...
                      </>
                    ) : hasMore ? 'Siguiente →' : 'Fin'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
