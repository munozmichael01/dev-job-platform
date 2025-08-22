"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import ChannelsDashboard from "@/components/dashboard/ChannelsDashboard"
import { AlertTriangle, Briefcase, Eye, Megaphone, TrendingUp, Users, DollarSign, Target, Activity, PieChart } from "lucide-react"
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useApi } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"

export default function Dashboard() {
  const api = useApi()
  const { login } = useAuth()
  const [activeCampaigns, setActiveCampaigns] = useState([])
  const [dashboardMetrics, setDashboardMetrics] = useState(null)
  const [offersStats, setOffersStats] = useState(null)

  useEffect(() => {
    loadCampaigns()
    loadDashboardMetrics()
    loadOffersStats()
  }, [])

  const loadCampaigns = async () => {
    try {
      const campaigns = await api.fetchCampaigns()
      setActiveCampaigns(campaigns)
    } catch (error) {
      console.error('Error loading campaigns:', error)
    }
  }

  const loadDashboardMetrics = async () => {
    try {
      const data = await api.fetchDashboardMetrics()
      setDashboardMetrics(data.data)
    } catch (error) {
      console.error('Error loading dashboard metrics:', error)
    }
  }

  const loadOffersStats = async () => {
    try {
      const data = await api.fetchOffersStats()
      setOffersStats(data.data)
    } catch (error) {
      console.error('Error loading offers stats:', error)
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

  const unassignedOffers = offersStats?.unassignedOffers || 0

  // Usar datos reales del API o fallback
  const budgetDistribution = dashboardMetrics?.budgetDistribution || [
    { name: "Talent.com", value: 1850, color: "#3b82f6" },
    { name: "Jooble", value: 1200, color: "#10b981" },
    { name: "WhatJobs", value: 950, color: "#f59e0b" },
    { name: "JobRapido", value: 800, color: "#8b5cf6" }
  ]

  const applicationsDistribution = dashboardMetrics?.applicationsDistribution || [
    { name: "Talent.com", value: 145, color: "#3b82f6" },
    { name: "Jooble", value: 98, color: "#10b981" },
    { name: "WhatJobs", value: 76, color: "#f59e0b" },
    { name: "JobRapido", value: 52, color: "#8b5cf6" }
  ]
  
  const metrics = dashboardMetrics?.generalMetrics || {
    activeCampaigns: 3,
    activeOffers: 80,
    totalBudget: 4800,
    totalSpent: 3300,
    totalApplications: 312,
    spentPercentage: 69
  }

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
            <div className="text-2xl font-bold">{metrics.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">+1 desde la semana pasada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ofertas Activas</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeOffers}</div>
            <p className="text-xs text-muted-foreground">+12 nuevas hoy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{metrics.totalBudget.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">€{metrics.totalSpent.toLocaleString()} gastados ({metrics.spentPercentage}%)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalApplications}</div>
            <p className="text-xs text-muted-foreground">72% del objetivo</p>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard de Canales */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Estado de Canales de Distribución</h2>
        <ChannelsDashboard />
      </div>

      {/* Gráficos de Distribución */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribución de Presupuesto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Distribución de Presupuesto
            </CardTitle>
            <CardDescription>
              Presupuesto asignado por canal en campañas activas
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-2">
              Total acumulado para campañas actualmente activas
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={budgetDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `€${value}`}
                  >
                    {budgetDistribution.map((entry, index) => (
                      <Cell key={`budget-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => {
                      const total = budgetDistribution.reduce((sum, item) => sum + item.value, 0)
                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
                      return [`€${value} (${percentage}%)`, 'Presupuesto']
                    }}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribución de Aplicaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Distribución de Aplicaciones
            </CardTitle>
            <CardDescription>
              Aplicaciones recibidas por canal
            </CardDescription>
            <p className="text-xs text-muted-foreground mt-2">
              Total acumulado para campañas actualmente activas
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={applicationsDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${value}`}
                  >
                    {applicationsDistribution.map((entry, index) => (
                      <Cell key={`apps-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => {
                      const total = applicationsDistribution.reduce((sum, item) => sum + item.value, 0)
                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
                      return [`${value} (${percentage}%)`, 'Aplicaciones']
                    }}
                    labelStyle={{ color: '#000' }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
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
              <div key={campaign.id || campaign.Id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{campaign.Name || campaign.name}</h4>
                    <Badge variant={(campaign.Status || campaign.status) === "active" ? "default" : "destructive"}>
                      {(campaign.Status || campaign.status) === "active" ? "Activa" : "Atención"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {campaign.offers || 0} ofertas • {campaign.segment || campaign.SegmentName}
                  </p>
                  <div className="flex gap-4 text-sm">
                    <span>
                      €{campaign.spent || 0}/€{campaign.Budget || campaign.budget}
                    </span>
                    <span>
                      {campaign.applications || 0}/{campaign.TargetApplications || campaign.target} aplicaciones
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/campanas/${campaign.Id || campaign.id}`}>
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
              <div key={`alert-${index}`} className="flex items-start gap-3 p-3 border rounded-lg">
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
                  <span className="text-sm font-medium">{unassignedOffers} ofertas no están incluidas en ninguna campaña activa</span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/ofertas?promocion=no">Revisar</Link>
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
