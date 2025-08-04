"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Search, Filter, Eye, MapPin, Calendar, Building2, DollarSign, AlertCircle, CheckCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"

export default function OfertasPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")

  const ofertas = [
    {
      id: 1,
      title: "Desarrollador Frontend React",
      company: "TechCorp",
      location: "Madrid",
      salary: "35.000-45.000€",
      type: "Tiempo completo",
      sector: "Tecnología",
      publishDate: "2024-01-15",
      status: "active",
      applications: 23,
      channels: ["InfoJobs", "LinkedIn"],
      validated: true,
    },
    {
      id: 2,
      title: "Camarero/a Hotel 5*",
      company: "Hotel Luxury",
      location: "Barcelona",
      salary: "22.000-26.000€",
      type: "Tiempo completo",
      sector: "Hostelería",
      publishDate: "2024-01-14",
      status: "active",
      applications: 45,
      channels: ["Indeed", "Turijobs"],
      validated: true,
    },
    {
      id: 3,
      title: "Comercial Senior B2B",
      company: "SalesForce Inc",
      location: "Valencia",
      salary: "40.000-55.000€",
      type: "Tiempo completo",
      sector: "Ventas",
      publishDate: "2024-01-13",
      status: "pending",
      applications: 12,
      channels: [],
      validated: false,
    },
    {
      id: 4,
      title: "Recepcionista Hotel",
      company: "Hotel Costa",
      location: "Málaga",
      salary: "20.000-24.000€",
      type: "Tiempo parcial",
      sector: "Hostelería",
      publishDate: "2024-01-12",
      status: "active",
      applications: 67,
      channels: ["Turijobs", "InfoJobs"],
      validated: true,
    },
    {
      id: 5,
      title: "Desarrollador Backend Node.js",
      company: "StartupTech",
      location: "Remoto",
      salary: "45.000-60.000€",
      type: "Tiempo completo",
      sector: "Tecnología",
      publishDate: "2024-01-11",
      status: "paused",
      applications: 8,
      channels: ["LinkedIn"],
      validated: true,
    },
  ]

  const filteredOfertas = ofertas.filter((oferta) => {
    const matchesSearch =
      oferta.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      oferta.company.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || oferta.status === statusFilter
    const matchesLocation = locationFilter === "all" || oferta.location === locationFilter

    return matchesSearch && matchesStatus && matchesLocation
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Activa</Badge>
      case "paused":
        return <Badge variant="secondary">Pausada</Badge>
      case "pending":
        return <Badge variant="destructive">Pendiente</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-3xl font-bold">Gestión de Ofertas</h1>
          <p className="text-muted-foreground">Administra y supervisa todas tus ofertas de empleo</p>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Ofertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ofertas.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {ofertas.filter((o) => o.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {ofertas.filter((o) => o.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sin Canal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {ofertas.filter((o) => o.channels.length === 0).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título o empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="paused">Pausadas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Madrid">Madrid</SelectItem>
                <SelectItem value="Barcelona">Barcelona</SelectItem>
                <SelectItem value="Valencia">Valencia</SelectItem>
                <SelectItem value="Málaga">Málaga</SelectItem>
                <SelectItem value="Remoto">Remoto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de ofertas */}
      <Card>
        <CardHeader>
          <CardTitle>Ofertas de Empleo</CardTitle>
          <CardDescription>{filteredOfertas.length} ofertas encontradas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oferta</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Salario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Distribución</TableHead>
                <TableHead>Aplicaciones</TableHead>
                <TableHead>Validación</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOfertas.map((oferta) => (
                <TableRow key={oferta.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{oferta.title}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {oferta.company}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {oferta.publishDate}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {oferta.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {oferta.salary}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(oferta.status)}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {oferta.channels.length > 0 ? (
                          oferta.channels.map((channel, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {channel}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            Sin canal
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div>En {Math.floor(Math.random() * 3) + 1} segmentos</div>
                        <div>En {Math.floor(Math.random() * 2) + 1} campañas</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{oferta.applications}</span>
                  </TableCell>
                  <TableCell>
                    {oferta.validated ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/ofertas/${oferta.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
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
