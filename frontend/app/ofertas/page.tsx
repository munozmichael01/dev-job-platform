"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Search, Filter, Eye, MapPin, Calendar, Building2, DollarSign, AlertCircle, CheckCircle, RefreshCw, Loader2, X, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { useKeysetPagination } from "@/hooks/use-keyset-pagination"
// Removed infinite scroll - using simple pagination
import { ResultsCounter } from "@/components/ui/infinite-loader"
import { ErrorMessage } from "@/components/ui/error-message"
import { fetchLocations, fetchSectors, fetchExternalIds, type FilterParams } from "@/lib/api-temp"

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
  applications?: number;
  channels?: string[];
  validated?: boolean;
}

// NOTA: API call ahora manejada internamente por el hook useKeysetPagination

export default function OfertasPage() {
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [sectorFilter, setSectorFilter] = useState<string>("all")
  const [externalIdFilter, setExternalIdFilter] = useState<string>("all")
  
  // Estados para opciones de dropdowns
  const [locations, setLocations] = useState<string[]>([])
  const [sectors, setSectors] = useState<string[]>([])
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
      ...(externalIdFilter && externalIdFilter !== 'all' ? { externalId: externalIdFilter } : {}),
    }
  }, [debouncedSearchTerm, statusFilter, locationFilter, sectorFilter, externalIdFilter])

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
  }, [filtersHash, reset, getCleanFilters]);

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
          externalId: externalIdFilter !== 'all' ? externalIdFilter : undefined,
          q: debouncedSearchTerm || undefined
        }

        console.log('🔍 Cargando opciones con filtros dependientes:', currentFilters)

        const [locationsResult, sectorsResult, externalIdsResult] = await Promise.all([
          fetchLocations({
            status: currentFilters.status,
            sector: currentFilters.sector,
            externalId: currentFilters.externalId,
            q: currentFilters.q
          }),
          fetchSectors({
            status: currentFilters.status,
            location: currentFilters.location,
            externalId: currentFilters.externalId,
            q: currentFilters.q
          }),
          fetchExternalIds({
            status: currentFilters.status,
            location: currentFilters.location,
            sector: currentFilters.sector,
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
  }, [statusFilter, locationFilter, sectorFilter, externalIdFilter, debouncedSearchTerm]) // Recargar cuando cambien los filtros

  // NOTA: La carga inicial se maneja en el efecto de abajo con reset()

  // Handlers para filtros
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value)
  }, [])

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value)
  }, [])

  const handleLocationChange = useCallback((value: string) => {
    setLocationFilter(value)
  }, [])

  const handleSectorChange = useCallback((value: string) => {
    setSectorFilter(value)
  }, [])

  const handleExternalIdChange = useCallback((value: string) => {
    setExternalIdFilter(value)
  }, [])

  const handleClearFilters = useCallback(() => {
    setSearchTerm("")
    setStatusFilter("all")
    setLocationFilter("all")
    setSectorFilter("all")
    setExternalIdFilter("all")
  }, [])

  const handleRetry = useCallback(() => {
    retry()
  }, [retry])

  // Usar opciones de filtros desde la API (todos los datos, no solo ofertas cargadas)
  const uniqueLocations = locations
  const uniqueSectors = sectors
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
              <Select value={statusFilter} onValueChange={handleStatusChange}>
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
                        <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                    </Button>
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
