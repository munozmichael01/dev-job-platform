"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Settings,
  Users,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Edit,
  Trash2,
  Plus,
  Eye,
  Activity,
  Globe,
  Shield,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function AdminPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const clientes = [
    {
      id: 1,
      name: "Turijobs",
      email: "admin@turijobs.com",
      status: "active",
      connectionType: "XML",
      connectionUrl: "https://turijobs.com/feed/ofertas.xml",
      lastSync: "2024-01-15T14:30:00",
      totalOffers: 156,
      activeCampaigns: 3,
      totalBudget: 4800,
      spentBudget: 3300,
      plan: "Premium",
      createdAt: "2023-06-15",
    },
    {
      id: 2,
      name: "TechJobs España",
      email: "contact@techjobs.es",
      status: "active",
      connectionType: "API",
      connectionUrl: "https://api.techjobs.es/v2/ofertas",
      lastSync: "2024-01-15T13:45:00",
      totalOffers: 89,
      activeCampaigns: 2,
      totalBudget: 2500,
      spentBudget: 1200,
      plan: "Standard",
      createdAt: "2023-08-22",
    },
    {
      id: 3,
      name: "Hostelería Jobs",
      email: "info@hosteljobs.com",
      status: "warning",
      connectionType: "XML",
      connectionUrl: "https://hosteljobs.com/xml/feed.xml",
      lastSync: "2024-01-13T08:00:00",
      totalOffers: 45,
      activeCampaigns: 1,
      totalBudget: 800,
      spentBudget: 650,
      plan: "Basic",
      createdAt: "2023-11-10",
    },
    {
      id: 4,
      name: "Remote Work Hub",
      email: "admin@remotehub.io",
      status: "inactive",
      connectionType: "API",
      connectionUrl: "https://api.remotehub.io/jobs",
      lastSync: "2024-01-05T16:20:00",
      totalOffers: 23,
      activeCampaigns: 0,
      totalBudget: 1500,
      spentBudget: 400,
      plan: "Standard",
      createdAt: "2023-12-01",
    },
  ]

  const systemLogs = [
    {
      id: 1,
      timestamp: "2024-01-15T14:30:00",
      level: "info",
      message: "Sincronización exitosa - Turijobs: 12 nuevas ofertas importadas",
      client: "Turijobs",
    },
    {
      id: 2,
      timestamp: "2024-01-15T14:15:00",
      level: "error",
      message: "Error de conexión con API de Remote Work Hub - Timeout después de 30s",
      client: "Remote Work Hub",
    },
    {
      id: 3,
      timestamp: "2024-01-15T13:45:00",
      level: "warning",
      message: "Presupuesto de campaña 'Comerciales Senior' al 95% - Cliente: Turijobs",
      client: "Turijobs",
    },
    {
      id: 4,
      timestamp: "2024-01-15T13:30:00",
      level: "info",
      message: "Nueva campaña creada: 'Desarrolladores React' - TechJobs España",
      client: "TechJobs España",
    },
  ]

  const agregadores = [
    {
      name: "InfoJobs",
      status: "active",
      campaigns: 15,
      totalApplications: 1247,
      avgCPA: 7.2,
      lastUpdate: "2024-01-15T14:00:00",
    },
    {
      name: "LinkedIn",
      status: "active",
      campaigns: 8,
      totalApplications: 892,
      avgCPA: 12.5,
      lastUpdate: "2024-01-15T13:30:00",
    },
    {
      name: "Indeed",
      status: "warning",
      campaigns: 6,
      totalApplications: 456,
      avgCPA: 8.9,
      lastUpdate: "2024-01-14T22:15:00",
    },
    {
      name: "Turijobs",
      status: "active",
      campaigns: 4,
      totalApplications: 234,
      avgCPA: 5.8,
      lastUpdate: "2024-01-15T14:10:00",
    },
  ]

  const filteredClientes = clientes.filter((cliente) => {
    const matchesSearch = cliente.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || cliente.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case "inactive":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Activo</Badge>
      case "warning":
        return <Badge variant="destructive">Advertencia</Badge>
      case "inactive":
        return <Badge variant="secondary">Inactivo</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case "info":
        return <Badge variant="outline">Info</Badge>
      case "warning":
        return <Badge className="bg-orange-100 text-orange-800">Warning</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

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

  const handleClientAction = (action: string, clientName: string) => {
    toast({
      title: `${action} cliente`,
      description: `Acción "${action}" ejecutada para ${clientName}`,
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Panel de Administración</h1>
            <p className="text-muted-foreground">Gestión global de clientes, sistema y agregadores</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        </div>
      </div>

      {/* Métricas globales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientes.length}</div>
            <p className="text-xs text-muted-foreground">
              {clientes.filter((c) => c.status === "active").length} activos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ofertas Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientes.reduce((sum, c) => sum + c.totalOffers, 0)}</div>
            <p className="text-xs text-muted-foreground">Across all clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientes.reduce((sum, c) => sum + c.activeCampaigns, 0)}</div>
            <p className="text-xs text-muted-foreground">En ejecución</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{clientes.reduce((sum, c) => sum + c.spentBudget, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gestión de clientes */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestión de Clientes
              </CardTitle>
              <CardDescription>Administra todos los clientes de la plataforma</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar clientes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="warning">Advertencia</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuevo Cliente
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nuevo Cliente</DialogTitle>
                      <DialogDescription>Agrega un nuevo cliente a la plataforma</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="clientName">Nombre del cliente</Label>
                        <Input id="clientName" placeholder="Ej: TechJobs España" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clientEmail">Email</Label>
                        <Input id="clientEmail" type="email" placeholder="admin@techjobs.es" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="plan">Plan</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button
                          onClick={() => {
                            toast({
                              title: "Cliente creado",
                              description: "El nuevo cliente ha sido agregado exitosamente",
                            })
                            setIsDialogOpen(false)
                          }}
                          className="flex-1"
                        >
                          Crear Cliente
                        </Button>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Ofertas</TableHead>
                    <TableHead>Campañas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.map((cliente) => (
                    <TableRow key={cliente.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{cliente.name}</div>
                          <div className="text-sm text-muted-foreground">{cliente.email}</div>
                          <div className="text-xs text-muted-foreground">
                            {cliente.connectionType} • Desde {new Date(cliente.createdAt).getFullYear()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{cliente.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{cliente.totalOffers}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{cliente.activeCampaigns}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(cliente.status)}
                          {getStatusBadge(cliente.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleClientAction("Ver", cliente.name)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClientAction("Editar", cliente.name)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleClientAction("Eliminar", cliente.name)}
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

          {/* Logs del sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Logs del Sistema
              </CardTitle>
              <CardDescription>Actividad reciente y eventos del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {systemLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getLogLevelBadge(log.level)}
                        <span className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="text-sm">{log.message}</p>
                      <p className="text-xs text-muted-foreground">Cliente: {log.client}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Estado de agregadores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Estado Agregadores
              </CardTitle>
              <CardDescription>Monitoreo de canales de distribución</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agregadores.map((agregador, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(agregador.status)}
                    <div>
                      <div className="font-medium text-sm">{agregador.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {agregador.campaigns} campañas • €{agregador.avgCPA} CPA
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{agregador.totalApplications}</div>
                    <div className="text-xs text-muted-foreground">aplicaciones</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Configuración del sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Database className="h-4 w-4 mr-2" />
                Configurar Base de Datos
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Globe className="h-4 w-4 mr-2" />
                Gestionar Agregadores
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Configuración Global
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Shield className="h-4 w-4 mr-2" />
                Seguridad y Permisos
              </Button>
            </CardContent>
          </Card>

          {/* Alertas del sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Alertas Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <AlertTriangle className="h-3 w-3" />
                <span>2 clientes con errores de sincronización</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-red-600">
                <XCircle className="h-3 w-3" />
                <span>1 agregador desconectado</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <CheckCircle className="h-3 w-3" />
                <span>Sistema funcionando correctamente</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
