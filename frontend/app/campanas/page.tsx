"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Plus, Megaphone, Edit, Pause, Play, Eye, Calendar, DollarSign, Target, Users, AlertTriangle, Trash2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApi } from "@/lib/api"

type ApiCampaign = {
  Id: number
  Name: string
  SegmentId: number
  Budget?: number
  TargetApplications?: number
  MaxCPA?: number
  Channels?: string[] | null
  Status: string
  DistributionType: string
  StartDate?: string
  EndDate?: string
  // Nuevos campos del backend
  segment?: string
  offers?: number
  SegmentName?: string
  SegmentOffers?: number
}

export default function CampanasPage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()
  const api = useApi()
  const [campanas, setCampanas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCampaigns()
  }, [])

  const filteredCampanas = campanas.filter((campana) => (statusFilter === "all" ? true : campana.status === statusFilter))

  const handlePauseCampaign = async (id: number, name: string) => {
    try {
      await api.pauseCampaign(id)
      toast({ title: "Campaña pausada", description: `La campaña "${name}" ha sido pausada exitosamente` })
      // Recargar campañas para actualizar estado
      loadCampaigns()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleResumeCampaign = async (id: number, name: string) => {
    try {
      await api.resumeCampaign(id)
      toast({ title: "Campaña reactivada", description: `La campaña "${name}" ha sido reactivada exitosamente` })
      // Recargar campañas para actualizar estado
      loadCampaigns()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteCampaign = async (id: number, name: string) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la campaña "${name}"? Esta acción no se puede deshacer.`)) {
      return
    }
    
    try {
      await api.deleteCampaign(id)
      toast({ title: "Campaña eliminada", description: `La campaña "${name}" ha sido eliminada exitosamente` })
      // Recargar campañas para actualizar lista inmediatamente
      setTimeout(loadCampaigns, 500) // Dar tiempo para que la BD se actualice
    } catch (error: any) {
      console.error("Error eliminando campaña:", error)
      toast({ title: "Error", description: error.message || "Error desconocido al eliminar", variant: "destructive" })
      // Aún así, intentar recargar por si funcionó en el backend
      setTimeout(loadCampaigns, 1000)
    }
  }

  const handleActivateCampaign = async (id: number, name: string) => {
    if (!window.confirm(`¿Estás seguro de que quieres activar y enviar la campaña "${name}" a los canales configurados?`)) {
      return
    }
    
    try {
      setLoading(true)
      const response = await fetch(`http://localhost:3002/api/campaigns/${id}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        toast({ 
          title: "Campaña activada", 
          description: `La campaña "${name}" ha sido enviada exitosamente a ${result.channels.filter((c: any) => c.success).length} canales` 
        })
        loadCampaigns()
      } else {
        toast({ 
          title: "Error activando campaña", 
          description: result.error || 'Error desconocido',
          variant: "destructive" 
        })
      }
    } catch (error: any) {
      console.error("Error activando campaña:", error)
      toast({ 
        title: "Error", 
        description: error.message || "No se pudo activar la campaña", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const data: ApiCampaign[] = await api.fetchCampaigns()
      setCampanas(
        data.map((c) => ({
          id: c.Id,
          name: c.Name,
          segment: c.segment || `Segmento #${c.SegmentId}`,
          offers: c.offers || 0,
          budget: Number(c.Budget ?? 0),
          spent: 0,
          applications: 0,
          target: c.TargetApplications ?? 0,
          status: c.Status,
          mode: c.DistributionType,
          startDate: c.StartDate,
          endDate: c.EndDate,
          channels: Array.isArray(c.Channels) ? c.Channels : [],
          cpa: c.MaxCPA ?? 0,
          conversionRate: 0,
        })),
      )
    } catch (e: any) {
      setError(e.message || "Error al cargar campañas")
    } finally {
      setLoading(false)
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

  const getModeBadge = (mode: string) => (mode === "automatic" ? <Badge variant="outline">Automático</Badge> : <Badge variant="secondary">Manual</Badge>)
  const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-")
  const calculateProgress = (spent: number, budget: number) => (budget ? Math.round((spent / budget) * 100) : 0)
  const calculateApplicationProgress = (applications: number, target: number) => (target ? Math.round((applications / target) * 100) : 0)

  if (loading) return <div className="p-6">Cargando campañas...</div>
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Gestión de Campañas</h1>
            <p className="text-muted-foreground">Administra y supervisa tus campañas de distribución</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/campanas/nueva">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Campaña
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Campañas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{campanas.filter((c) => c.status === "active").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{campanas.reduce((sum, c) => sum + (c.budget || 0), 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanas.reduce((sum, c) => sum + (c.applications || 0), 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="draft">Borradores</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="paused">Pausadas</SelectItem>
                <SelectItem value="warning">Con Alertas</SelectItem>
                <SelectItem value="completed">Completadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campañas Configuradas
          </CardTitle>
          <CardDescription>{filteredCampanas.length} campañas encontradas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Aplicaciones</TableHead>
                <TableHead>Rendimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCampanas.map((campana) => (
                <TableRow key={campana.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{campana.name}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(campana.startDate)} - {formatDate(campana.endDate)}
                      </div>
                      <div className="flex gap-1">{getModeBadge(campana.mode)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{campana.segment}</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {campana.offers} ofertas
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {campana.channels.slice(0, 2).map((channel: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {channel}
                          </Badge>
                        ))}
                        {campana.channels.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{campana.channels.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span className="text-sm">€{(campana.spent || 0).toLocaleString()} / €{(campana.budget || 0).toLocaleString()}</span>
                      </div>
                      <Progress value={calculateProgress(campana.spent || 0, campana.budget || 0)} className="h-2" />
                      <div className="text-xs text-muted-foreground">{calculateProgress(campana.spent || 0, campana.budget || 0)}% gastado</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        <span className="text-sm">
                          {campana.applications || 0} / {campana.target || 0}
                        </span>
                      </div>
                      <Progress value={calculateApplicationProgress(campana.applications || 0, campana.target || 0)} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        {calculateApplicationProgress(campana.applications || 0, campana.target || 0)}% del objetivo
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">CPA:</span> €{campana.cpa || 0}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Conv:</span> {campana.conversionRate || 0}%
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(campana.status)}
                      {campana.status === "warning" && (
                        <div className="flex items-center gap-1 text-xs text-orange-600">
                          <AlertTriangle className="h-3 w-3" />
                          Presupuesto bajo
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/campanas/${campana.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/campanas/${campana.id}/editar`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                      {campana.status === "draft" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600"
                          onClick={() => handleActivateCampaign(campana.id, campana.name)}
                          disabled={loading}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      ) : campana.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600"
                          onClick={() => handlePauseCampaign(campana.id, campana.name)}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : campana.status === "paused" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600"
                          onClick={() => handleResumeCampaign(campana.id, campana.name)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() => handleDeleteCampaign(campana.id, campana.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
