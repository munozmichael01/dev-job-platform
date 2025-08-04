"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Plus, Users, Edit, Trash2, Calendar, Briefcase, MapPin, Building2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function SegmentosPage() {
  const segmentos = [
    {
      id: 1,
      name: "Desarrolladores Frontend",
      description: "Ofertas de desarrollo frontend con React, Vue o Angular",
      filters: {
        jobTitle: ["Frontend", "React", "Vue", "Angular"],
        location: ["Madrid", "Barcelona", "Remoto"],
        sector: ["Tecnología"],
        experience: ["Junior", "Senior"],
      },
      offerCount: 45,
      lastUpdated: "2024-01-15T10:30:00",
      campaigns: 2,
      status: "active",
    },
    {
      id: 2,
      name: "Hostelería Madrid",
      description: "Puestos de hostelería en la Comunidad de Madrid",
      filters: {
        jobTitle: ["Camarero", "Recepcionista", "Cocinero"],
        location: ["Madrid"],
        sector: ["Hostelería", "Turismo"],
        experience: ["Sin experiencia", "Junior"],
      },
      offerCount: 23,
      lastUpdated: "2024-01-14T15:45:00",
      campaigns: 1,
      status: "active",
    },
    {
      id: 3,
      name: "Comerciales Senior",
      description: "Posiciones comerciales con experiencia en B2B",
      filters: {
        jobTitle: ["Comercial", "Ventas", "Account Manager"],
        location: ["España"],
        sector: ["Ventas", "Tecnología"],
        experience: ["Senior"],
      },
      offerCount: 12,
      lastUpdated: "2024-01-13T09:15:00",
      campaigns: 1,
      status: "active",
    },
    {
      id: 4,
      name: "Trabajos Remotos Tech",
      description: "Ofertas tecnológicas 100% remotas",
      filters: {
        jobTitle: ["Desarrollador", "DevOps", "QA", "Product Manager"],
        location: ["Remoto"],
        sector: ["Tecnología"],
        experience: ["Junior", "Senior"],
      },
      offerCount: 67,
      lastUpdated: "2024-01-12T14:20:00",
      campaigns: 3,
      status: "active",
    },
    {
      id: 5,
      name: "Prácticas Universitarias",
      description: "Ofertas de prácticas para estudiantes universitarios",
      filters: {
        jobTitle: ["Prácticas", "Becario", "Trainee"],
        location: ["Madrid", "Barcelona", "Valencia"],
        sector: ["Todos"],
        experience: ["Sin experiencia"],
      },
      offerCount: 8,
      lastUpdated: "2024-01-10T11:00:00",
      campaigns: 0,
      status: "inactive",
    },
  ]

  const { toast } = useToast()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Activo</Badge>
      case "inactive":
        return <Badge variant="secondary">Inactivo</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

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

      {/* Estadísticas rápidas */}
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
              {segmentos.filter((s) => s.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ofertas Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segmentos.reduce((sum, s) => sum + s.offerCount, 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{segmentos.reduce((sum, s) => sum + s.campaigns, 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de segmentos */}
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
              {segmentos.map((segmento) => (
                <TableRow key={segmento.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{segmento.name}</div>
                      <div className="text-sm text-muted-foreground">{segmento.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">
                          <Briefcase className="h-3 w-3 mr-1" />
                          {segmento.filters.jobTitle.length} títulos
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          {segmento.filters.location.length} ubicaciones
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="h-3 w-3 mr-1" />
                          {segmento.filters.sector.length} sectores
                        </Badge>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{segmento.offerCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{segmento.campaigns}</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(segmento.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(segmento.lastUpdated)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast({
                            title: "Editando segmento",
                            description: `Abriendo editor para "${segmento.name}"`,
                          })
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          toast({
                            title: "Segmento eliminado",
                            description: `El segmento "${segmento.name}" ha sido eliminado`,
                            variant: "destructive",
                          })
                        }}
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
