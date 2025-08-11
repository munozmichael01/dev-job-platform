"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Plus, Users, Edit, Trash2, Calendar, Briefcase, MapPin, Building2, RefreshCw, Copy, AlertTriangle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { fetchSegments, deleteSegment, recalculateSegment, duplicateSegment } from "@/lib/api-temp"

type ApiSegment = {
  Id: number
  Name: string
  Description?: string
  Filters?: { jobTitles?: string[]; locations?: string[]; sectors?: string[]; experienceLevels?: string[]; contractTypes?: string[] }
  Status: string
  OfferCount?: number
  Campaigns?: number
  HasCampaigns?: boolean
  UpdatedAt?: string
}

export default function SegmentosPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [segmentos, setSegmentos] = useState<ApiSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recalculatingId, setRecalculatingId] = useState<number | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; segment: ApiSegment | null }>({ open: false, segment: null })

  const loadSegments = async () => {
    try {
      const data = await fetchSegments()
      setSegmentos(data)
    } catch (e: any) {
      setError(e.message || "Error al cargar segmentos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSegments()
  }, [])

  const handleRecalculate = async (segment: ApiSegment) => {
    setRecalculatingId(segment.Id)
    try {
      const result = await recalculateSegment(segment.Id)
      toast({
        title: "Recalculado exitosamente",
        description: `${result.message}. Ofertas: ${result.data.oldCount} → ${result.data.newCount}`
      })
      // Actualizar el segmento en la lista
      setSegmentos(prev => prev.map(s => 
        s.Id === segment.Id 
          ? { ...s, OfferCount: result.data.newCount, UpdatedAt: result.data.updatedAt }
          : s
      ))
    } catch (e: any) {
      toast({
        title: "Error al recalcular",
        description: e.message,
        variant: "destructive"
      })
    } finally {
      setRecalculatingId(null)
    }
  }

  const handleDuplicate = async (segment: ApiSegment) => {
    setDuplicatingId(segment.Id)
    try {
      const result = await duplicateSegment(segment.Id)
      toast({
        title: "Segmento duplicado",
        description: result.message
      })
      // Recargar la lista para mostrar el duplicado
      await loadSegments()
    } catch (e: any) {
      toast({
        title: "Error al duplicar",
        description: e.message,
        variant: "destructive"
      })
    } finally {
      setDuplicatingId(null)
    }
  }

  const handleDelete = async (segment: ApiSegment) => {
    try {
      if (segment.HasCampaigns) {
        toast({
          title: "No se puede eliminar",
          description: `El segmento "${segment.Name}" está siendo usado en ${segment.Campaigns} campaña(s) activa(s)`,
          variant: "destructive"
        })
        return
      }
      
      await deleteSegment(segment.Id)
      toast({
        title: "Segmento eliminado",
        description: `"${segment.Name}" ha sido eliminado exitosamente`
      })
      // Remover de la lista
      setSegmentos(prev => prev.filter(s => s.Id !== segment.Id))
    } catch (e: any) {
      toast({
        title: "Error al eliminar",
        description: e.message,
        variant: "destructive"
      })
    } finally {
      setDeleteDialog({ open: false, segment: null })
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "-"
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  const getStatusBadge = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Activo</Badge>
      case "inactive":
        return <Badge variant="secondary">Inactivo</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  if (loading) return <div className="p-6">Cargando segmentos...</div>
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>

  const totalOffers = segmentos.reduce((sum, s) => sum + (s.OfferCount || 0), 0)
  const totalCampaigns = segmentos.reduce((sum, s) => sum + (s.Campaigns || 0), 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Gestión de Segmentos</h1>
            <p className="text-muted-foreground">Crea y administra segmentos dinámicos de ofertas</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/segmentos/nuevo">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Segmento
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Segmentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segmentos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Segmentos Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {segmentos.filter((s) => (s.Status || "").toLowerCase() === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ofertas Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOffers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCampaigns}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Segmentos Configurados
          </CardTitle>
          <CardDescription>Administra tus segmentos de ofertas y sus filtros dinámicos</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segmento</TableHead>
                <TableHead>Filtros</TableHead>
                <TableHead>Ofertas</TableHead>
                <TableHead>Campañas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última Actualización</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segmentos.map((segmento) => {
                const filters = segmento.Filters || {}
                const jt = filters.jobTitles?.length || 0
                const loc = filters.locations?.length || 0
                const sec = filters.sectors?.length || 0
                return (
                  <TableRow key={segmento.Id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{segmento.Name}</div>
                        <div className="text-sm text-muted-foreground">{segmento.Description || "-"}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">
                            <Briefcase className="h-3 w-3 mr-1" />
                            {jt} títulos
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            {loc} ubicaciones
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Building2 className="h-3 w-3 mr-1" />
                            {sec} sectores
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{segmento.OfferCount ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{segmento.Campaigns ?? 0}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(segmento.Status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(segmento.UpdatedAt || "")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <TooltipProvider>
                          {/* Botón Recalcular */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={recalculatingId === segmento.Id}
                                onClick={() => handleRecalculate(segmento)}
                              >
                                {recalculatingId === segmento.Id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Recalcular número de ofertas</p>
                            </TooltipContent>
                          </Tooltip>

                          {/* Botón Editar - Condicional */}
                          {!segmento.HasCampaigns ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/segmentos/${segmento.Id}/editar`)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar segmento</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className="opacity-50"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>No se puede editar: segmento usado en {segmento.Campaigns} campaña(s)</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Botón Eliminar - Condicional */}
                          {!segmento.HasCampaigns ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => setDeleteDialog({ open: true, segment: segmento })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar segmento</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className="opacity-50 text-red-300"
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>No se puede eliminar: usado en {segmento.Campaigns} campaña(s) activa(s)</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Botón Duplicar */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={duplicatingId === segmento.Id}
                                onClick={() => handleDuplicate(segmento)}
                              >
                                {duplicatingId === segmento.Id ? (
                                  <Copy className="h-4 w-4 animate-pulse" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Duplicar segmento</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de confirmación para eliminar */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, segment: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar segmento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el segmento "{deleteDialog.segment?.Name}".
              {deleteDialog.segment?.HasCampaigns ? (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">No se puede eliminar</span>
                  </div>
                  <p className="text-sm mt-1">
                    Este segmento está siendo usado en {deleteDialog.segment.Campaigns} campaña(s) activa(s).
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm">
                  Esta acción no se puede deshacer.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {!deleteDialog.segment?.HasCampaigns && (
              <AlertDialogAction
                onClick={() => deleteDialog.segment && handleDelete(deleteDialog.segment)}
                className="bg-red-600 hover:bg-red-700"
              >
                Eliminar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
