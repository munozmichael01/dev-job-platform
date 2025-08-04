"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Plus,
  Megaphone,
  Edit,
  Pause,
  Play,
  Eye,
  Calendar,
  DollarSign,
  Target,
  Users,
  AlertTriangle,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function CampanasPage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const { toast } = useToast()

  const campanas = [
    {
      id: 1,
      name: "Desarrolladores Frontend Q1",
      segment: "Desarrolladores Frontend",
      offers: 45,
      budget: 2500,
      spent: 1200,
      applications: 89,
      target: 150,
      status: "active",
      mode: "automatic",
      startDate: "2024-01-01",
      endDate: "2024-03-31",
      channels: ["InfoJobs", "LinkedIn", "Indeed"],
      cpa: 13.48,
      conversionRate: 2.1,
    },
    {
      id: 2,
      name: "Hostelería Madrid Verano",
      segment: "Hostelería Madrid",
      offers: 23,
      budget: 800,
      spent: 650,
      applications: 156,
      target: 200,
      status: "active",
      mode: "manual",
      startDate: "2024-01-15",
      endDate: "2024-04-15",
      channels: ["Turijobs", "InfoJobs"],
      cpa: 4.17,
      conversionRate: 6.8,
    },
    {
      id: 3,
      name: "Comerciales Senior B2B",
      segment: "Comerciales Senior",
      offers: 12,
      budget: 1500,
      spent: 1450,
      applications: 67,
      target: 80,
      status: "warning",
      mode: "automatic",
      startDate: "2024-01-10",
      endDate: "2024-02-28",
      channels: ["LinkedIn", "InfoJobs"],
      cpa: 21.64,
      conversionRate: 5.6,
    },
    {
      id: 4,
      name: "Trabajos Remotos Tech",
      segment: "Trabajos Remotos Tech",
      offers: 67,
      budget: 3000,
      spent: 890,
      applications: 234,
      target: 400,
      status: "active",
      mode: "automatic",
      startDate: "2024-01-05",
      endDate: "2024-06-30",
      channels: ["LinkedIn", "RemoteOK", "AngelList"],
      cpa: 3.8,
      conversionRate: 3.5,
    },
    {
      id: 5,
      name: "Prácticas Universitarias",
      segment: "Prácticas Universitarias",
      offers: 8,
      budget: 400,
      spent: 400,
      applications: 45,
      target: 60,
      status: "completed",
      mode: "manual",
      startDate: "2023-12-01",
      endDate: "2024-01-31",
      channels: ["InfoJobs", "Universidad"],
      cpa: 8.89,
      conversionRate: 5.6,
    },
  ]

  const filteredCampanas = campanas.filter((campana) => {
    if (statusFilter === "all") return true
    return campana.status === statusFilter
  })

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

  const getModeBadge = (mode: string) => {
    return mode === "automatic" ? (
      <Badge variant="outline">Automático</Badge>
    ) : (
      <Badge variant="secondary">Manual</Badge>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const calculateProgress = (spent: number, budget: number) => {
    return Math.round((spent / budget) * 100)
  }

  const calculateApplicationProgress = (applications: number, target: number) => {
    return Math.round((applications / target) * 100)
  }

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

      {/* Estadísticas rápidas */}
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
            <div className="text-2xl font-bold text-green-600">
              {campanas.filter((c) => c.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{campanas.reduce((sum, c) => sum + c.budget, 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campanas.reduce((sum, c) => sum + c.applications, 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
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
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="paused">Pausadas</SelectItem>
                <SelectItem value="warning">Con Alertas</SelectItem>
                <SelectItem value="completed">Completadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de campañas */}
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
                        {campana.channels.slice(0, 2).map((channel, index) => (
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
                        <span className="text-sm">
                          €{campana.spent.toLocaleString()} / €{campana.budget.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={calculateProgress(campana.spent, campana.budget)} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        {calculateProgress(campana.spent, campana.budget)}% gastado
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        <span className="text-sm">
                          {campana.applications} / {campana.target}
                        </span>
                      </div>
                      <Progress
                        value={calculateApplicationProgress(campana.applications, campana.target)}
                        className="h-2"
                      />
                      <div className="text-xs text-muted-foreground">
                        {calculateApplicationProgress(campana.applications, campana.target)}% del objetivo
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="font-medium">CPA:</span> €{campana.cpa}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Conv:</span> {campana.conversionRate}%
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
                        onClick={() => {
                          toast({
                            title: "Ver campaña",
                            description: `Abriendo detalles de "${campana.name}"`,
                          })
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast({
                            title: "Editando campaña",
                            description: `Abriendo editor para "${campana.name}"`,
                          })
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {campana.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600"
                          onClick={() => {
                            toast({
                              title: "Campaña pausada",
                              description: `La campaña "${campana.name}" ha sido pausada`,
                            })
                          }}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : campana.status === "paused" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600"
                          onClick={() => {
                            toast({
                              title: "Campaña reanudada",
                              description: `La campaña "${campana.name}" ha sido reanudada`,
                            })
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      ) : null}
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
