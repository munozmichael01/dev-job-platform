"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ArrowLeft, Edit, Pause, Play, Trash2, Megaphone, Target, DollarSign, Users, Calendar, Activity, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useApi } from "@/lib/api"

type Campaign = {
  Id: number
  Name: string
  Description: string
  SegmentId: number
  DistributionType: string
  StartDate: string | null
  EndDate: string | null
  Budget: number
  TargetApplications: number
  MaxCPA: number
  Channels: string[]
  BidStrategy: string
  ManualBid: number | null
  Priority: string
  AutoOptimization: boolean
  Status: string
  CreatedAt: string
  UpdatedAt: string
  segment?: string
  offers?: number
  SegmentName?: string
  SegmentOffers?: number
}

export default function VerCampanaPage() {
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string
  const api = useApi()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCampaignData()
  }, [campaignId])

  const loadCampaignData = async () => {
    try {
      setLoading(true)
      
      // Validar que tenemos un ID válido
      if (!campaignId || campaignId === 'undefined') {
        throw new Error('ID de campaña no válido')
      }
      
      const numericId = Number(campaignId)
      if (isNaN(numericId)) {
        throw new Error(`ID de campaña no es un número válido: ${campaignId}`)
      }
      
      console.log('🔍 Cargando campaña con ID:', numericId)
      const data = await api.fetchCampaign(numericId)
      setCampaign(data)
    } catch (error: any) {
      console.error('❌ Error cargando campaña:', error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
      router.push("/campanas")
    } finally {
      setLoading(false)
    }
  }

  const handlePauseCampaign = async () => {
    if (!campaign) return
    try {
      await api.pauseCampaign(campaign.Id)
      toast({ title: "Campaña pausada", description: `La campaña "${campaign.Name}" ha sido pausada exitosamente` })
      loadCampaignData()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleResumeCampaign = async () => {
    if (!campaign) return
    try {
      await api.resumeCampaign(campaign.Id)
      toast({ title: "Campaña reactivada", description: `La campaña "${campaign.Name}" ha sido reactivada exitosamente` })
      loadCampaignData()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteCampaign = async () => {
    if (!campaign) return
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la campaña "${campaign.Name}"? Esta acción no se puede deshacer.`)) {
      return
    }
    
    try {
      await api.deleteCampaign(campaign.Id)
      toast({ title: "Campaña eliminada", description: `La campaña "${campaign.Name}" ha sido eliminada exitosamente` })
      router.push("/campanas")
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Error desconocido al eliminar", variant: "destructive" })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Activa</Badge>
      case "paused":
        return <Badge variant="secondary">Pausada</Badge>
      case "warning":
        return <Badge variant="destructive">Atención</Badge>
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800">Completada</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const getDistributionTypeBadge = (type: string) => {
    return type === "automatic" ? 
      <Badge variant="outline">Automático</Badge> : 
      <Badge variant="secondary">Manual</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800", 
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    }
    return <Badge className={colors[priority as keyof typeof colors] || colors.medium}>{priority}</Badge>
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No especificada"
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    })
  }

  const calculateProgress = (spent: number, budget: number) => budget ? Math.round((spent / budget) * 100) : 0
  const calculateApplicationProgress = (applications: number, target: number) => target ? Math.round((applications / target) * 100) : 0

  // Datos simulados para demo
  const simulatedStats = {
    spent: 1200,
    applications: 89,
    conversionRate: 12.5,
    avgCPA: 13.48,
    impressions: 25670,
    clicks: 2134,
    ctr: 8.3
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Cargando campaña...</h1>
            <p className="text-muted-foreground">Obteniendo datos de la campaña</p>
          </div>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Campaña no encontrada</h1>
            <p className="text-muted-foreground">La campaña solicitada no existe</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <Button variant="outline" size="sm" asChild>
            <Link href="/campanas">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{campaign.Name}</h1>
            <p className="text-muted-foreground">{campaign.Description || "Sin descripción"}</p>
          </div>
        </div>
        
        {/* Acciones */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/campanas/${campaign.Id}/editar`}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Link>
          </Button>
          {campaign.Status === "active" ? (
            <Button variant="outline" size="sm" className="text-orange-600" onClick={handlePauseCampaign}>
              <Pause className="h-4 w-4 mr-2" />
              Pausar
            </Button>
          ) : campaign.Status === "paused" ? (
            <Button variant="outline" size="sm" className="text-green-600" onClick={handleResumeCampaign}>
              <Play className="h-4 w-4 mr-2" />
              Reanudar
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="text-red-600" onClick={handleDeleteCampaign}>
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Estado y Métricas Principales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusBadge(campaign.Status)}
              {getDistributionTypeBadge(campaign.DistributionType)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span className="text-sm">€{simulatedStats.spent.toLocaleString()} / €{(campaign.Budget || 0).toLocaleString()}</span>
              </div>
              <Progress value={calculateProgress(simulatedStats.spent, campaign.Budget || 0)} className="h-2" />
              <div className="text-xs text-muted-foreground">{calculateProgress(simulatedStats.spent, campaign.Budget || 0)}% gastado</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                <span className="text-sm">{simulatedStats.applications} / {campaign.TargetApplications || 0}</span>
              </div>
              <Progress value={calculateApplicationProgress(simulatedStats.applications, campaign.TargetApplications || 0)} className="h-2" />
              <div className="text-xs text-muted-foreground">{calculateApplicationProgress(simulatedStats.applications, campaign.TargetApplications || 0)}% del objetivo</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-sm">
                <span className="font-medium">CPA:</span> €{simulatedStats.avgCPA}
              </div>
              <div className="text-sm">
                <span className="font-medium">Conv:</span> {simulatedStats.conversionRate}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detalles de la Campaña */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Configuración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Segmento:</span>
                <span className="text-sm">{campaign.segment || `Segmento #${campaign.SegmentId}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Ofertas disponibles:</span>
                <span className="text-sm">{campaign.offers || campaign.SegmentOffers || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Distribución:</span>
                {getDistributionTypeBadge(campaign.DistributionType)}
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Prioridad:</span>
                {getPriorityBadge(campaign.Priority)}
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Estrategia de Bid:</span>
                <span className="text-sm">{campaign.BidStrategy}</span>
              </div>
              {campaign.ManualBid && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Bid Manual:</span>
                  <span className="text-sm">€{campaign.ManualBid}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm font-medium">Optimización Automática:</span>
                <span className="text-sm">{campaign.AutoOptimization ? "✅ Activa" : "❌ Desactivada"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fechas y Cronología */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Cronología
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Fecha de Inicio:</span>
                <span className="text-sm">{formatDate(campaign.StartDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Fecha de Fin:</span>
                <span className="text-sm">{formatDate(campaign.EndDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Creada:</span>
                <span className="text-sm">{formatDate(campaign.CreatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Última actualización:</span>
                <span className="text-sm">{formatDate(campaign.UpdatedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Canales de Distribución */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Canales de Distribución
          </CardTitle>
          <CardDescription>
            {campaign.DistributionType === "automatic" 
              ? "Canales seleccionados automáticamente por el algoritmo"
              : "Canales seleccionados manualmente"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {campaign.Channels && campaign.Channels.length > 0 ? (
              campaign.Channels.map((channel, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium capitalize">{channel}</div>
                      <div className="text-sm text-muted-foreground">Activo</div>
                    </div>
                  </div>
                  <Badge variant="outline">Configurado</Badge>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                No hay canales configurados
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Métricas Detalladas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Métricas Detalladas
          </CardTitle>
          <CardDescription>Estadísticas de rendimiento de la campaña</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Impresiones</div>
              <div className="text-2xl font-bold">{simulatedStats.impressions.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total de visualizaciones</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Clics</div>
              <div className="text-2xl font-bold">{simulatedStats.clicks.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">CTR: {simulatedStats.ctr}%</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">CPA Promedio</div>
              <div className="text-2xl font-bold">€{simulatedStats.avgCPA}</div>
              <div className="text-sm text-muted-foreground">Objetivo: €{campaign.MaxCPA}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
