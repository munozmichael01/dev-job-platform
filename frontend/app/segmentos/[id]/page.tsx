"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Edit, RefreshCw, Copy, Users, Building2, MapPin, Briefcase, Calendar, ExternalLink, ChevronRight } from "lucide-react"
import { useApi } from "@/lib/api"

interface Segment {
  Id: number
  Name: string
  Description: string
  Filters: {
    jobTitles: string[]
    locations: string[]
    sectors: string[]
    experienceLevels: string[]
    contractTypes: string[]
    companies: string[]
  }
  Status: string
  OfferCount: number
  CreatedAt: string
  UpdatedAt: string
}

interface Campaign {
  Id: number
  Name: string
  Status: string
  StartDate: string
  EndDate: string
  CreatedAt: string
  IsActive: number
}

interface Offer {
  Id: number
  ExternalId: string
  Title: string
  CompanyName: string
  Location: string
  Sector: string
  JobType: string
  SalaryMin: number
  SalaryMax: number
  CreatedAt: string
}

interface SegmentDetail {
  segment: Segment
  campaigns: Campaign[]
  sampleOffers: Offer[]
  totalOffers: number
}

export default function SegmentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const api = useApi()
  const [detail, setDetail] = useState<SegmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)

  const segmentId = parseInt(params.id as string)

  useEffect(() => {
    loadSegmentDetail()
  }, [segmentId])

  const loadSegmentDetail = async () => {
    try {
      setLoading(true)
      const response = await api.getSegmentDetail(segmentId)
      setDetail(response)
    } catch (error: any) {
      console.error('❌ Error loading segment detail:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al cargar el detalle del segmento"
      })
      router.push("/segmentos")
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculate = async () => {
    try {
      setRecalculating(true)
      const result = await api.recalculateSegment(segmentId)
      toast({
        title: "Recalculado exitosamente",
        description: `${result.message}. Ofertas: ${result.data.oldCount} → ${result.data.newCount}`
      })
      await loadSegmentDetail() // Recargar datos
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al recalcular segmento"
      })
    } finally {
      setRecalculating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return "No especificado"
    if (min && max) return `€${min.toLocaleString()} - €${max.toLocaleString()}`
    if (min) return `Desde €${min.toLocaleString()}`
    if (max) return `Hasta €${max.toLocaleString()}`
    return "No especificado"
  }

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: { label: "Activo", className: "bg-green-100 text-green-800" },
      draft: { label: "Borrador", className: "bg-gray-100 text-gray-800" },
      paused: { label: "Pausado", className: "bg-yellow-100 text-yellow-800" },
      completed: { label: "Completado", className: "bg-blue-100 text-blue-800" }
    }
    const config = statusMap[status as keyof typeof statusMap] || statusMap.draft
    return <Badge className={config.className}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Segmento no encontrado</h2>
          <p className="text-gray-600">El segmento que buscas no existe o no tienes permisos para verlo.</p>
        </div>
      </div>
    )
  }

  const { segment, campaigns, sampleOffers, totalOffers } = detail

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{segment.Name}</h1>
            <p className="text-gray-600">{segment.Description}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            {recalculating ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Recalcular
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/segmentos/${segmentId}/editar`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Información General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Ofertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalOffers.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Campañas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{campaigns.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {getStatusBadge(segment.Status)}
          </CardContent>
        </Card>
      </div>

      {/* Filtros Aplicados */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros Aplicados</CardTitle>
          <CardDescription>
            Criterios que definen este segmento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {segment.Filters.jobTitles.length > 0 && (
            <div className="flex items-start space-x-3">
              <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-900">Puestos de trabajo</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {segment.Filters.jobTitles.map((title, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {title}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {segment.Filters.locations.length > 0 && (
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-900">Ubicaciones</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {segment.Filters.locations.map((location, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {location}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {segment.Filters.companies.length > 0 && (
            <div className="flex items-start space-x-3">
              <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-900">Empresas</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {segment.Filters.companies.map((company, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {company}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {segment.Filters.sectors.length > 0 && (
            <div className="flex items-start space-x-3">
              <Users className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-gray-900">Sectores</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {segment.Filters.sectors.map((sector, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {sector}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {Object.values(segment.Filters).every(arr => arr.length === 0) && (
            <div className="text-center py-4 text-gray-500">
              Sin filtros específicos aplicados - incluye todas las ofertas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campañas que usan este segmento */}
      <Card>
        <CardHeader>
          <CardTitle>Campañas que usan este segmento ({campaigns.length})</CardTitle>
          <CardDescription>
            Lista de campañas activas que incluyen este segmento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.Id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Link
                      href={`/campanas/${campaign.Id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {campaign.Name}
                    </Link>
                    <div className="flex items-center space-x-4 mt-1">
                      {getStatusBadge(campaign.Status)}
                      <span className="text-xs text-gray-500">
                        Creada {formatDate(campaign.CreatedAt)}
                      </span>
                    </div>
                  </div>
                  <Link href={`/campanas/${campaign.Id}`}>
                    <Button variant="ghost" size="sm">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sin campañas activas</h3>
              <p className="text-gray-600 mb-4">
                Este segmento no está siendo utilizado en ninguna campaña actualmente.
              </p>
              <Button asChild>
                <Link href="/campanas/nueva">
                  Crear nueva campaña
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Muestra de ofertas */}
      <Card>
        <CardHeader>
          <CardTitle>Ofertas de trabajo ({totalOffers.toLocaleString()})</CardTitle>
          <CardDescription>
            Muestra de las últimas 100 ofertas que coinciden con este segmento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sampleOffers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Puesto</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Salario</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sampleOffers.map((offer) => (
                    <TableRow key={offer.Id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{offer.Title}</div>
                          {offer.Sector && (
                            <div className="text-xs text-gray-500">{offer.Sector}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{offer.CompanyName || "No especificado"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{offer.Location || "No especificado"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatSalary(offer.SalaryMin, offer.SalaryMax)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-500">
                          {formatDate(offer.CreatedAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalOffers > 100 && (
                <div className="p-4 text-center text-sm text-gray-500 border-t">
                  Mostrando 100 de {totalOffers.toLocaleString()} ofertas totales
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sin ofertas</h3>
              <p className="text-gray-600">
                No hay ofertas que coincidan con los filtros de este segmento.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información adicional */}
      <Card>
        <CardHeader>
          <CardTitle>Información del segmento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Creado:</span>
              <div className="text-gray-900">{formatDate(segment.CreatedAt)}</div>
            </div>
            <div>
              <span className="font-medium text-gray-600">Última actualización:</span>
              <div className="text-gray-900">{formatDate(segment.UpdatedAt)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}