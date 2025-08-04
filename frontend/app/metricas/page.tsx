"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Users,
  Briefcase,
  Calendar,
  Eye,
  MousePointer,
  CheckCircle,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState } from "react"

export default function MetricasPage() {
  const [timeRange, setTimeRange] = useState("30d")

  const metricas = {
    totalCampaigns: 12,
    activeCampaigns: 5,
    totalBudget: 15800,
    spentBudget: 8950,
    totalApplications: 1247,
    targetApplications: 1800,
    avgCPA: 7.18,
    avgConversionRate: 3.2,
    totalOffers: 234,
    activeOffers: 156,
  }

  const campaignPerformance = [
    {
      name: "Desarrolladores Frontend Q1",
      budget: 2500,
      spent: 1200,
      applications: 89,
      cpa: 13.48,
      conversionRate: 2.1,
      roi: 145,
      trend: "up",
    },
    {
      name: "Hostelería Madrid Verano",
      budget: 800,
      spent: 650,
      applications: 156,
      cpa: 4.17,
      conversionRate: 6.8,
      roi: 195,
      trend: "up",
    },
    {
      name: "Comerciales Senior B2B",
      budget: 1500,
      spent: 1450,
      applications: 67,
      cpa: 21.64,
      conversionRate: 5.6,
      roi: 89,
      trend: "down",
    },
    {
      name: "Trabajos Remotos Tech",
      budget: 3000,
      spent: 890,
      applications: 234,
      cpa: 3.8,
      conversionRate: 3.5,
      roi: 267,
      trend: "up",
    },
  ]

  const channelPerformance = [
    {
      name: "InfoJobs",
      campaigns: 8,
      applications: 456,
      spent: 3200,
      cpa: 7.02,
      conversionRate: 4.2,
      marketShare: 36.6,
    },
    {
      name: "LinkedIn",
      campaigns: 6,
      applications: 289,
      spent: 2800,
      cpa: 9.69,
      conversionRate: 2.8,
      marketShare: 23.2,
    },
    {
      name: "Indeed",
      campaigns: 4,
      applications: 234,
      spent: 1450,
      cpa: 6.2,
      conversionRate: 5.1,
      marketShare: 18.8,
    },
    {
      name: "Turijobs",
      campaigns: 5,
      applications: 178,
      spent: 890,
      cpa: 5.0,
      conversionRate: 7.2,
      marketShare: 14.3,
    },
    {
      name: "RemoteOK",
      campaigns: 2,
      applications: 90,
      spent: 610,
      cpa: 6.78,
      conversionRate: 3.1,
      marketShare: 7.2,
    },
  ]

  const getTrendIcon = (trend: string) => {
    return trend === "up" ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    )
  }

  const getRoiColor = (roi: number) => {
    if (roi >= 150) return "text-green-600"
    if (roi >= 100) return "text-yellow-600"
    return "text-red-600"
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Métricas y Análisis</h1>
            <p className="text-muted-foreground">Análisis detallado del rendimiento de tus campañas</p>
          </div>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="90d">Últimos 90 días</SelectItem>
            <SelectItem value="1y">Último año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuesto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{metricas.totalBudget.toLocaleString()}</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={(metricas.spentBudget / metricas.totalBudget) * 100} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {Math.round((metricas.spentBudget / metricas.totalBudget) * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">€{metricas.spentBudget.toLocaleString()} gastados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aplicaciones</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.totalApplications}</div>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={(metricas.totalApplications / metricas.targetApplications) * 100} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {Math.round((metricas.totalApplications / metricas.targetApplications) * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Objetivo: {metricas.targetApplications}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPA Promedio</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{metricas.avgCPA}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="h-3 w-3 text-green-600" />
              <p className="text-xs text-green-600">-12% vs mes anterior</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Conversión</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.avgConversionRate}%</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <p className="text-xs text-green-600">+8% vs mes anterior</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rendimiento por campaña */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Rendimiento por Campaña
            </CardTitle>
            <CardDescription>Análisis detallado de cada campaña activa</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead>CPA</TableHead>
                  <TableHead>Conv.</TableHead>
                  <TableHead>ROI</TableHead>
                  <TableHead>Tendencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignPerformance.map((campaign, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{campaign.name}</div>
                        <div className="text-xs text-muted-foreground">{campaign.applications} aplicaciones</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">€{campaign.cpa}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{campaign.conversionRate}%</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${getRoiColor(campaign.roi)}`}>{campaign.roi}%</span>
                    </TableCell>
                    <TableCell>{getTrendIcon(campaign.trend)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Rendimiento por canal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Rendimiento por Canal
            </CardTitle>
            <CardDescription>Comparativa de agregadores y su efectividad</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Aplicaciones</TableHead>
                  <TableHead>CPA</TableHead>
                  <TableHead>Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelPerformance.map((channel, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{channel.name}</div>
                        <div className="text-xs text-muted-foreground">{channel.campaigns} campañas</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{channel.applications}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">€{channel.cpa}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">{channel.marketShare}%</div>
                        <Progress value={channel.marketShare} className="h-1" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Métricas adicionales */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="text-sm">
                <div className="font-medium">Campaña completada</div>
                <div className="text-muted-foreground">Prácticas Universitarias - 45 aplicaciones</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Eye className="h-4 w-4 text-blue-600" />
              <div className="text-sm">
                <div className="font-medium">Nueva sincronización</div>
                <div className="text-muted-foreground">156 ofertas importadas desde XML</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div className="text-sm">
                <div className="font-medium">Mejora en conversión</div>
                <div className="text-muted-foreground">+15% en Hostelería Madrid</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Sectores</CardTitle>
            <CardDescription>Sectores con mejor rendimiento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Hostelería</span>
              <div className="flex items-center gap-2">
                <Progress value={85} className="w-16 h-2" />
                <span className="text-sm font-medium">85%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Tecnología</span>
              <div className="flex items-center gap-2">
                <Progress value={72} className="w-16 h-2" />
                <span className="text-sm font-medium">72%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Ventas</span>
              <div className="flex items-center gap-2">
                <Progress value={68} className="w-16 h-2" />
                <span className="text-sm font-medium">68%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Marketing</span>
              <div className="flex items-center gap-2">
                <Progress value={45} className="w-16 h-2" />
                <span className="text-sm font-medium">45%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Objetivos del Mes</CardTitle>
            <CardDescription>Progreso hacia metas mensuales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Aplicaciones</span>
                <span>1,247 / 1,800</span>
              </div>
              <Progress value={69} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Nuevas ofertas</span>
                <span>234 / 300</span>
              </div>
              <Progress value={78} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>CPA objetivo</span>
                <span>€7.18 / €8.00</span>
              </div>
              <Progress value={90} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>ROI promedio</span>
                <span>174% / 150%</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
