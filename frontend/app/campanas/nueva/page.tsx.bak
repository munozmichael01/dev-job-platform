"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Save,
  ArrowLeft,
  Megaphone,
  Users,
  Target,
  DollarSign,
  Settings,
  Zap,
  Hand,
  CheckCircle,
  AlertTriangle,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function NuevaCampanaPage() {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    segmentId: "",
    distributionType: "automatic", // automatic | manual
    startDate: "",
    endDate: "",
    budget: "",
    targetApplications: "",
    maxCPA: "",
    channels: [] as string[],
    bidStrategy: "automatic", // automatic | manual
    manualBid: "",
    priority: "medium", // low | medium | high
    autoOptimization: true,
  })

  // Datos simulados de segmentos disponibles
  const availableSegments = [
    {
      id: "1",
      name: "Desarrolladores Frontend",
      description: "Ofertas de desarrollo frontend con React, Vue o Angular",
      offerCount: 45,
      avgCPA: 12.5,
    },
    {
      id: "2",
      name: "Hostelería Madrid",
      description: "Puestos de hostelería en la Comunidad de Madrid",
      offerCount: 23,
      avgCPA: 8.2,
    },
    {
      id: "3",
      name: "Comerciales Senior",
      description: "Posiciones comerciales con experiencia en B2B",
      offerCount: 12,
      avgCPA: 18.7,
    },
    {
      id: "4",
      name: "Trabajos Remotos Tech",
      description: "Ofertas tecnológicas 100% remotas",
      offerCount: 67,
      avgCPA: 9.8,
    },
  ]

  // Canales disponibles para distribución manual
  const availableChannels = [
    {
      id: "infojobs",
      name: "InfoJobs",
      description: "Portal líder en España",
      avgCPA: 8.5,
      reach: "Alto",
      category: "General",
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      description: "Red profesional global",
      avgCPA: 15.2,
      reach: "Alto",
      category: "Profesional",
    },
    {
      id: "indeed",
      name: "Indeed",
      description: "Buscador de empleo internacional",
      avgCPA: 7.8,
      reach: "Muy Alto",
      category: "General",
    },
    {
      id: "turijobs",
      name: "Turijobs",
      description: "Especializado en turismo y hostelería",
      avgCPA: 6.2,
      reach: "Medio",
      category: "Especializado",
    },
    {
      id: "remoteok",
      name: "RemoteOK",
      description: "Trabajos remotos en tecnología",
      avgCPA: 12.1,
      reach: "Medio",
      category: "Tech",
    },
    {
      id: "angellist",
      name: "AngelList",
      description: "Startups y tecnología",
      avgCPA: 18.5,
      reach: "Bajo",
      category: "Startups",
    },
  ]

  const selectedSegment = availableSegments.find((s) => s.id === formData.segmentId)

  const toggleChannel = (channelId: string) => {
    setFormData((prev) => ({
      ...prev,
      channels: prev.channels.includes(channelId)
        ? prev.channels.filter((c) => c !== channelId)
        : [...prev.channels, channelId],
    }))
  }

  const calculateEstimatedBudget = () => {
    if (!formData.targetApplications || !formData.maxCPA) return 0
    return Number.parseInt(formData.targetApplications) * Number.parseFloat(formData.maxCPA)
  }

  const validateForm = () => {
    const errors = []

    if (!formData.name.trim()) errors.push("El nombre es obligatorio")
    if (!formData.segmentId) errors.push("Debe seleccionar un segmento")
    if (!formData.startDate) errors.push("La fecha de inicio es obligatoria")
    if (!formData.endDate) errors.push("La fecha de fin es obligatoria")
    if (!formData.budget) errors.push("El presupuesto es obligatorio")
    if (!formData.targetApplications) errors.push("El objetivo de aplicaciones es obligatorio")
    if (!formData.maxCPA) errors.push("El CPA máximo es obligatorio")

    if (formData.distributionType === "manual" && formData.channels.length === 0) {
      errors.push("Debe seleccionar al menos un canal para distribución manual")
    }

    return errors
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const errors = validateForm()
    if (errors.length > 0) {
      toast({
        title: "Errores en el formulario",
        description: errors.join(", "),
        variant: "destructive",
      })
      return
    }

    // Simular creación de campaña
    toast({
      title: "Campaña creada exitosamente",
      description: `La campaña "${formData.name}" ha sido creada y está lista para activarse`,
    })

    console.log("Datos de la campaña:", formData)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Button variant="outline" size="sm" asChild>
          <Link href="/campanas">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nueva Campaña</h1>
          <p className="text-muted-foreground">Crea una nueva campaña de distribución de ofertas</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informaci��n básica */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Información Básica
                </CardTitle>
                <CardDescription>Define los datos principales de tu campaña</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Campaña *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Desarrolladores Frontend Q1 2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe el objetivo y características de esta campaña"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Fecha de Inicio *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Fecha de Fin *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selección de segmento */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Segmento de Ofertas
                </CardTitle>
                <CardDescription>Selecciona el segmento de ofertas para esta campaña</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={formData.segmentId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, segmentId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSegments.map((segment) => (
                      <SelectItem key={segment.id} value={segment.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{segment.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {segment.offerCount} ofertas • CPA promedio: €{segment.avgCPA}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSegment && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium">{selectedSegment.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{selectedSegment.description}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span>
                        <strong>{selectedSegment.offerCount}</strong> ofertas disponibles
                      </span>
                      <span>
                        <strong>€{selectedSegment.avgCPA}</strong> CPA promedio
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tipo de distribución */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Tipo de Distribución
                </CardTitle>
                <CardDescription>Elige cómo se distribuirán las ofertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={formData.distributionType}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, distributionType: value }))}
                >
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem value="automatic" id="automatic" />
                    <div className="flex-1">
                      <Label htmlFor="automatic" className="flex items-center gap-2 font-medium">
                        <Zap className="h-4 w-4 text-blue-600" />
                        Distribución Automática
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        El sistema selecciona automáticamente los mejores canales basándose en el rendimiento histórico
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem value="manual" id="manual" />
                    <div className="flex-1">
                      <Label htmlFor="manual" className="flex items-center gap-2 font-medium">
                        <Hand className="h-4 w-4 text-green-600" />
                        Distribución Manual
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Selecciona manualmente los canales específicos donde distribuir las ofertas
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {/* Selección de canales para distribución manual */}
                {formData.distributionType === "manual" && (
                  <div className="space-y-4 mt-4">
                    <Label className="text-sm font-medium">Selecciona los Canales de Distribución</Label>
                    <div className="grid gap-3">
                      {availableChannels.map((channel) => (
                        <div key={channel.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <Checkbox
                            id={channel.id}
                            checked={formData.channels.includes(channel.id)}
                            onCheckedChange={() => toggleChannel(channel.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={channel.id} className="font-medium">
                                {channel.name}
                              </Label>
                              <Badge variant="outline" className="text-xs">
                                {channel.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{channel.description}</p>
                            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                              <span>CPA promedio: €{channel.avgCPA}</span>
                              <span>Alcance: {channel.reach}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuración de presupuesto y objetivos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Presupuesto y Objetivos
                </CardTitle>
                <CardDescription>Define el presupuesto y metas de la campaña</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget">Presupuesto Total (€) *</Label>
                    <Input
                      id="budget"
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData((prev) => ({ ...prev, budget: e.target.value }))}
                      placeholder="2500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetApplications">Objetivo de Aplicaciones *</Label>
                    <Input
                      id="targetApplications"
                      type="number"
                      value={formData.targetApplications}
                      onChange={(e) => setFormData((prev) => ({ ...prev, targetApplications: e.target.value }))}
                      placeholder="150"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCPA">CPA Máximo (€) *</Label>
                  <Input
                    id="maxCPA"
                    type="number"
                    step="0.01"
                    value={formData.maxCPA}
                    onChange={(e) => setFormData((prev) => ({ ...prev, maxCPA: e.target.value }))}
                    placeholder="15.00"
                  />
                  <p className="text-sm text-muted-foreground">
                    Coste máximo que estás dispuesto a pagar por cada aplicación
                  </p>
                </div>

                {formData.targetApplications && formData.maxCPA && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-medium">Presupuesto Estimado Necesario</span>
                    </div>
                    <p className="text-blue-700 mt-1">
                      €{calculateEstimatedBudget().toLocaleString()}
                      <span className="text-sm ml-2">
                        ({formData.targetApplications} aplicaciones × €{formData.maxCPA} CPA)
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuración avanzada */}
            <Card>
              <CardHeader>
                <CardTitle>Configuración Avanzada</CardTitle>
                <CardDescription>Opciones adicionales para optimizar la campaña</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad de la Campaña</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja - Distribución gradual</SelectItem>
                      <SelectItem value="medium">Media - Distribución estándar</SelectItem>
                      <SelectItem value="high">Alta - Distribución prioritaria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="autoOptimization"
                    checked={formData.autoOptimization}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, autoOptimization: !!checked }))}
                  />
                  <Label htmlFor="autoOptimization" className="text-sm">
                    Habilitar optimización automática de rendimiento
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  El sistema ajustará automáticamente la distribución basándose en el rendimiento de cada canal
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Panel lateral - Resumen */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen de la Campaña</CardTitle>
                <CardDescription>Vista previa de la configuración</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Nombre</Label>
                  <p className="text-sm text-muted-foreground">{formData.name || "Sin nombre"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Segmento</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedSegment ? selectedSegment.name : "No seleccionado"}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Tipo de Distribución</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {formData.distributionType === "automatic" ? (
                      <Badge variant="outline" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        Automática
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Hand className="h-3 w-3 mr-1" />
                        Manual
                      </Badge>
                    )}
                  </div>
                </div>

                {formData.distributionType === "manual" && formData.channels.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Canales Seleccionados</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {formData.channels.map((channelId) => {
                        const channel = availableChannels.find((c) => c.id === channelId)
                        return (
                          <Badge key={channelId} variant="outline" className="text-xs">
                            {channel?.name}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium">Presupuesto</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.budget ? `€${Number.parseInt(formData.budget).toLocaleString()}` : "No definido"}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Objetivo</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.targetApplications ? `${formData.targetApplications} aplicaciones` : "No definido"}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium">CPA Máximo</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.maxCPA ? `€${formData.maxCPA}` : "No definido"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Validación */}
            <Card>
              <CardHeader>
                <CardTitle>Estado de Validación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {validateForm().length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Campaña lista para crear</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Faltan campos por completar</span>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                        {validateForm().map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className="space-y-2">
              <Button type="submit" className="w-full" disabled={validateForm().length > 0}>
                <Save className="h-4 w-4 mr-2" />
                Crear Campaña
              </Button>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link href="/campanas">Cancelar</Link>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
