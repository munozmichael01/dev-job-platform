"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import ChannelsDashboard from "@/components/dashboard/ChannelsDashboard"
import { AlertTriangle, Briefcase, Eye, Megaphone, TrendingUp, Users, DollarSign, Target, Activity } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function Dashboard() {
  const [activeCampaigns, setActiveCampaigns] = useState([])

  useEffect(() => {
    loadCampaigns()
  }, [])

  const loadCampaigns = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/campaigns')
      if (response.ok) {
        const campaigns = await response.json()
        setActiveCampaigns(campaigns)
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
    }
  }

  const alerts = [
    {
      type: "error",
      message: "Error de sincronización con Indeed",
      time: "Hace 2 horas",
    },
    {
      type: "warning",
      message: "Campaña 'Comerciales Senior' cerca del límite de presupuesto",
      time: "Hace 4 horas",
    },
    {
      type: "info",
      message: "15 nuevas ofertas importadas desde XML",
      time: "Hace 6 horas",
    },
  ]

  const unassignedOffers = 8

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de tus campañas y actividad reciente</p>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campañas Activas</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">+1 desde la semana pasada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ofertas Activas</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">80</div>
            <p className="text-xs text-muted-foreground">+12 nuevas hoy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€4,800</div>
            <p className="text-xs text-muted-foreground">€3,300 gastados (69%)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">312</div>
            <p className="text-xs text-muted-foreground">72% del objetivo</p>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard de Canales */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Estado de Canales de Distribución</h2>
        <ChannelsDashboard />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Campañas activas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Campañas Activas
            </CardTitle>
            <CardDescription>Estado actual de tus campañas en ejecución</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeCampaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{campaign.name}</h4>
                    <Badge variant={campaign.status === "active" ? "default" : "destructive"}>
                      {campaign.status === "active" ? "Activa" : "Atención"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {campaign.offers} ofertas • {campaign.segment}
                  </p>
                  <div className="flex gap-4 text-sm">
                    <span>
                      €{campaign.spent}/€{campaign.budget}
                    </span>
                    <span>
                      {campaign.applications}/{campaign.target} aplicaciones
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/campanas/${campaign.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
            <Button className="w-full" asChild>
              <Link href="/campanas">Ver todas las campañas</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Alertas y notificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas y Notificaciones
            </CardTitle>
            <CardDescription>Eventos importantes que requieren tu atención</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {alerts.map((alert, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                <div
                  className={`h-2 w-2 rounded-full mt-2 ${
                    alert.type === "error" ? "bg-red-500" : alert.type === "warning" ? "bg-yellow-500" : "bg-blue-500"
                  }`}
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">{alert.time}</p>
                </div>
              </div>
            ))}

            {unassignedOffers > 0 && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-200">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">{unassignedOffers} ofertas sin canal asignado</span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/ofertas?filter=unassigned">Revisar</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Acciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Tareas comunes para gestionar tu distribución de ofertas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button className="h-20 flex-col gap-2" variant="outline" asChild>
              <Link href="/campanas/nueva">
                <Megaphone className="h-6 w-6" />
                Nueva Campaña
              </Link>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline" asChild>
              <Link href="/segmentos/nuevo">
                <Users className="h-6 w-6" />
                Crear Segmento
              </Link>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline" asChild>
              <Link href="/conexiones">
                <TrendingUp className="h-6 w-6" />
                Sincronizar Ofertas
              </Link>
            </Button>
            <Button className="h-20 flex-col gap-2" variant="outline" asChild>
              <Link href="/metricas">
                <TrendingUp className="h-6 w-6" />
                Ver Métricas
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
