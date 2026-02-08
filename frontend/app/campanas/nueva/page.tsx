"use client"
import React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Save, ArrowLeft, Megaphone, Users, Target, DollarSign, Settings, Zap, Hand, CheckCircle, AlertTriangle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { createCampaign, fetchSegments } from "@/lib/api-temp"
import { useAuth } from "@/contexts/AuthContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { MultiSelect } from "@/components/ui/multi-select"
import ChannelSelector from "@/components/campaigns/ChannelSelector"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { API_URL } from '@/lib/config';

export default function NuevaCampanaPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { user, fetchWithAuth } = useAuth()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    segmentIds: [] as string[],
    distributionType: "automatic" as "automatic" | "manual",
    startDate: "",
    endDate: "",
    budget: "",
    targetApplications: "",
    maxCPA: "",
    channels: [] as string[],
    bidStrategy: "automatic",
    manualBid: "",
    priority: "medium",
    autoOptimization: true,
  })
  const [availableSegments, setAvailableSegments] = useState<{ id: string; name: string; description: string; offerCount: number }[]>([])
  const [configuredChannels, setConfiguredChannels] = useState<string[]>([])
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null)
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)
  const [isActivatingCampaign, setIsActivatingCampaign] = useState(false)


  useEffect(() => {
    if (!user?.id) return
    
    const loadSegments = async () => {
      try {
        const data = await fetchSegments(fetchWithAuth)
        setAvailableSegments(
          data.map((s: any) => ({
            id: String(s.Id),
            name: s.Name,
            description: s.Description || "",
            offerCount: s.OfferCount || 0,
          })),
        )
      } catch (error) {
        console.error("Error loading segments:", error)
      }
    }
    
    loadSegments()
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    
    const loadChannels = async () => {
      try {
        const response = await fetchWithAuth(`${API_URL}/api/users/${user.id}/credentials`)
        const data = await response.json()
        const configured = data.channels?.filter((c: any) => c.isActive && c.isValidated).map((c: any) => c.channelId) || []
        setConfiguredChannels(configured)
      } catch {
        setConfiguredChannels([])
      }
    }
    
    loadChannels()
  }, [user?.id])

  const selectedSegments = React.useMemo(
    () => availableSegments.filter((s) => formData.segmentIds.includes(s.id)),
    [availableSegments, formData.segmentIds]
  )
  
  const totalOffers = React.useMemo(
    () => selectedSegments.reduce((sum, segment) => sum + segment.offerCount, 0),
    [selectedSegments]
  )
  
  const toggleChannel = React.useCallback((channelId: string) => {
    setFormData((prev) => ({ 
      ...prev, 
      channels: prev.channels.includes(channelId) 
        ? prev.channels.filter((c) => c !== channelId) 
        : [...prev.channels, channelId] 
    }))
  }, [])
  
  const calculateEstimatedBudget = React.useCallback(() => {
    return (formData.targetApplications && formData.maxCPA ? Number(formData.targetApplications) * Number(formData.maxCPA) : 0)
  }, [formData.targetApplications, formData.maxCPA])
  
  const validateForm = React.useCallback(() => {
    const errors = []
    if (!formData.name.trim()) errors.push("El nombre es obligatorio")
    if (formData.segmentIds.length === 0) errors.push("Debe seleccionar al menos un segmento")
    if (!formData.startDate) errors.push("La fecha de inicio es obligatoria")
    if (!formData.endDate) errors.push("La fecha de fin es obligatoria")
    if (!formData.budget) errors.push("El presupuesto es obligatorio")
    if (!formData.targetApplications) errors.push("El objetivo de aplicaciones es obligatorio")
    if (!formData.maxCPA) errors.push("El CPA máximo es obligatorio")
    
    // Validar canales configurados para cualquier tipo de distribución
    if (configuredChannels.length === 0) {
      errors.push("Debe configurar al menos un canal antes de crear una campaña")
    } else if (formData.distributionType === "manual" && formData.channels.length === 0) {
      errors.push("Debe seleccionar al menos un canal para distribución manual")
    }
    
    return errors
  }, [formData, configuredChannels])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateForm()
    if (errors.length > 0) {
      toast({ title: "Errores en el formulario", description: errors.join(", "), variant: "destructive" })
      return
    }

    // Mostrar modal de confirmación
    setShowConfirmModal(true)
  }

  const handleCreateDraft = async () => {
    setIsCreatingCampaign(true)
    
    const channelsToUse = formData.distributionType === "manual" 
      ? formData.channels 
      : formData.channels.length > 0 
        ? formData.channels  // Si hay canales seleccionados específicamente, usar esos
        : configuredChannels // Solo si no hay selección específica, usar todos

    try {
      const response = await createCampaign(fetchWithAuth, {
        name: formData.name,
        description: formData.description,
        segmentIds: formData.segmentIds.map(id => Number(id)),
        distributionType: formData.distributionType,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        budget: formData.budget ? Number(formData.budget) : null,
        targetApplications: formData.targetApplications ? Number(formData.targetApplications) : null,
        maxCPA: formData.maxCPA ? Number(formData.maxCPA) : null,
        channels: channelsToUse,
        bidStrategy: formData.bidStrategy,
        manualBid: formData.manualBid ? Number(formData.manualBid) : null,
        priority: formData.priority,
        autoOptimization: formData.autoOptimization,
      })
      
      toast({ title: "Campaña guardada como borrador", description: `La campaña "${formData.name}" ha sido guardada` })
      setShowConfirmModal(false)
      router.push("/campanas")
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsCreatingCampaign(false)
    }
  }

  const handleCreateAndSend = async () => {
    setIsCreatingCampaign(true)
    
    // Debug: verificar canales seleccionados
    console.log("🔍 Debug canales:")
    console.log("- Distribution Type:", formData.distributionType)
    console.log("- Canales seleccionados (formData.channels):", formData.channels)
    console.log("- Canales configurados:", configuredChannels)
    
    const channelsToUse = formData.distributionType === "manual" 
      ? formData.channels 
      : formData.channels.length > 0 
        ? formData.channels  // Si hay canales seleccionados específicamente, usar esos
        : configuredChannels // Solo si no hay selección específica, usar todos
    
    console.log("- Canales que se van a usar:", channelsToUse)

    try {
      // 1. Crear campaña como borrador
      const response = await createCampaign(fetchWithAuth, {
        name: formData.name,
        description: formData.description,
        segmentIds: formData.segmentIds.map(id => Number(id)),
        distributionType: formData.distributionType,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        budget: formData.budget ? Number(formData.budget) : null,
        targetApplications: formData.targetApplications ? Number(formData.targetApplications) : null,
        maxCPA: formData.maxCPA ? Number(formData.maxCPA) : null,
        channels: channelsToUse,
        bidStrategy: formData.bidStrategy,
        manualBid: formData.manualBid ? Number(formData.manualBid) : null,
        priority: formData.priority,
        autoOptimization: formData.autoOptimization,
      })
      
      // Verificar la estructura de la respuesta
      console.log("Response de createCampaign:", response)
      
      const campaignId = response.campaign?.Id || response.campaign?.id || response.Id || response.id
      if (!campaignId) {
        throw new Error("No se pudo obtener el ID de la campaña creada")
      }
      
      setCreatedCampaignId(campaignId)
      setIsCreatingCampaign(false)
      setIsActivatingCampaign(true)
      
      // 2. Activar y enviar a canales
      const activateResponse = await fetchWithAuth(`${API_URL}/api/campaigns/${campaignId}/activate`, {
        method: 'POST',
      })
      
      if (!activateResponse.ok) {
        const errorText = await activateResponse.text()
        console.error("❌ Error detallado de activación:", errorText)
        let errorMessage = 'Error activando campaña'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorData.message || errorText
        } catch (e) {
          errorMessage = errorText || 'Error activando campaña'
        }
        throw new Error(errorMessage)
      }
      
      const activateData = await activateResponse.json()
      
      toast({ 
        title: "Campaña creada y enviada exitosamente", 
        description: `La campaña "${formData.name}" ha sido enviada a los canales seleccionados` 
      })
      setShowConfirmModal(false)
      router.push("/campanas")
    } catch (error: any) {
      console.error("❌ Error completo en creación/activación:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsCreatingCampaign(false)
      setIsActivatingCampaign(false)
    }
  }

  const availableChannels = [
    { id: "infojobs", name: "InfoJobs", description: "Portal líder en España", avgCPA: 8.5, reach: "Alto", category: "General" },
    { id: "linkedin", name: "LinkedIn", description: "Red profesional global", avgCPA: 15.2, reach: "Alto", category: "Profesional" },
    { id: "indeed", name: "Indeed", description: "Buscador de empleo internacional", avgCPA: 7.8, reach: "Muy Alto", category: "General" },
  ]

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
          <div className="lg:col-span-2 space-y-6">
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
                  <Input id="name" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ej: Desarrolladores Frontend Q1 2024" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe el objetivo y características" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Fecha de Inicio *</Label>
                    <Input id="startDate" type="date" value={formData.startDate} onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Fecha de Fin *</Label>
                    <Input id="endDate" type="date" value={formData.endDate} onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Segmento de Ofertas
                </CardTitle>
                <CardDescription>Selecciona el segmento de ofertas para esta campaña</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MultiSelect
                  options={availableSegments.map(segment => ({
                    label: `${segment.name} (${segment.offerCount} ofertas)`,
                    value: segment.id
                  }))}
                  selected={formData.segmentIds}
                  onChange={(selected) => setFormData((prev) => ({ ...prev, segmentIds: selected }))}
                  placeholder="Selecciona uno o más segmentos"
                />

                {selectedSegments.length > 0 && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium">
                      {selectedSegments.length} segmento{selectedSegments.length > 1 ? 's' : ''} seleccionado{selectedSegments.length > 1 ? 's' : ''}
                    </h4>
                    <div className="flex items-center gap-2 mt-2">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{totalOffers} ofertas disponibles en total</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {selectedSegments.map(segment => (
                        <div key={segment.id} className="text-sm text-muted-foreground">
                          • {segment.name}: {segment.offerCount} ofertas
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

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
                  onValueChange={(value) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      distributionType: value as "automatic" | "manual" 
                    }))
                  }}
                >
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem value="automatic" id="automatic" />
                    <div className="flex-1">
                      <Label htmlFor="automatic" className="flex items-center gap-2 font-medium">
                        <Zap className="h-4 w-4 text-blue-600" />
                        Distribución Automática
                      </Label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-lg">
                    <RadioGroupItem value="manual" id="manual" />
                    <div className="flex-1">
                      <Label htmlFor="manual" className="flex items-center gap-2 font-medium">
                        <Hand className="h-4 w-4 text-green-600" />
                        Distribución Manual
                      </Label>
                    </div>
                  </div>
                </RadioGroup>

                <div className="mt-4">
                  <Label className="text-sm font-medium mb-3 block">
                    {formData.distributionType === "automatic" ? "Canales Disponibles" : "Selecciona Canales de Distribución"}
                  </Label>
                  {/* Selector temporal simple */}
                  <div className="p-4 border rounded-lg space-y-3">
                    <p className="text-sm font-medium">Selecciona canales para la campaña:</p>
                    {configuredChannels.map(channelId => (
                      <div key={channelId} className="flex items-center space-x-2">
                        <input 
                          type="checkbox"
                          id={`channel-${channelId}`}
                          checked={formData.channels.includes(channelId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                channels: [...prev.channels, channelId]
                              }))
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                channels: prev.channels.filter(c => c !== channelId)
                              }))
                            }
                          }}
                        />
                        <label htmlFor={`channel-${channelId}`} className="text-sm cursor-pointer">
                          {channelId}
                        </label>
                      </div>
                    ))}
                    {formData.channels.length > 0 && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ {formData.channels.length} canal(es) seleccionado(s): {formData.channels.join(', ')}
                      </p>
                    )}
                  </div>
                  {/* <ChannelSelector
                    selectedChannels={formData.channels}
                    onChannelToggle={(channelId) => toggleChannel(channelId)}
                    distributionType={formData.distributionType as 'automatic' | 'manual'}
                    campaignBudget={formData.budget ? Number(formData.budget) : undefined}
                  /> */}
                </div>
              </CardContent>
            </Card>

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
                    <Input id="budget" type="number" value={formData.budget} onChange={(e) => setFormData((prev) => ({ ...prev, budget: e.target.value }))} placeholder="2500" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetApplications">Objetivo de Aplicaciones *</Label>
                    <Input id="targetApplications" type="number" value={formData.targetApplications} onChange={(e) => setFormData((prev) => ({ ...prev, targetApplications: e.target.value }))} placeholder="150" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCPA">CPA Máximo (€) *</Label>
                  <Input id="maxCPA" type="number" step="0.01" value={formData.maxCPA} onChange={(e) => setFormData((prev) => ({ ...prev, maxCPA: e.target.value }))} placeholder="15.00" />
                </div>

                {formData.targetApplications && formData.maxCPA && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-800">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-medium">Presupuesto Estimado Necesario</span>
                    </div>
                    <p className="text-blue-700 mt-1">
                      €{calculateEstimatedBudget().toLocaleString()}
                      <span className="text-sm ml-2">({formData.targetApplications} apps × €{formData.maxCPA} CPA)</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuración Avanzada</CardTitle>
                <CardDescription>Opciones adicionales para optimizar la campaña</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Prioridad de la Campaña</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}>
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
                  <Checkbox id="autoOptimization" checked={formData.autoOptimization} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, autoOptimization: !!checked }))} />
                  <Label htmlFor="autoOptimization" className="text-sm">
                    Habilitar optimización automática de rendimiento
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

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
                  <Label className="text-sm font-medium">Segmentos</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedSegments.length > 0 
                      ? selectedSegments.map(s => s.name).join(", ")
                      : "No seleccionados"
                    }
                  </p>
                  {selectedSegments.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalOffers} ofertas en total
                    </p>
                  )}
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
                <div>
                  <Label className="text-sm font-medium">Presupuesto</Label>
                  <p className="text-sm text-muted-foreground">{formData.budget ? `€${Number.parseInt(formData.budget).toLocaleString()}` : "No definido"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Objetivo</Label>
                  <p className="text-sm text-muted-foreground">{formData.targetApplications ? `${formData.targetApplications} aplicaciones` : "No definido"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">CPA Máximo</Label>
                  <p className="text-sm text-muted-foreground">{formData.maxCPA ? `€${formData.maxCPA}` : "No definido"}</p>
                </div>
              </CardContent>
            </Card>

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

      {/* Modal de confirmación */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirmar creación de campaña
            </DialogTitle>
            <DialogDescription>
              ¿Qué deseas hacer con la campaña "{formData.name}"?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Resumen de la campaña:</h4>
              <div className="text-sm space-y-1">
                <div><strong>Segmentos:</strong> {selectedSegments.map(s => s.name).join(", ")}</div>
                <div><strong>Presupuesto:</strong> €{formData.budget}</div>
                <div><strong>Objetivo:</strong> {formData.targetApplications} aplicaciones</div>
                {(formData.distributionType === "manual" ? formData.channels : configuredChannels).length > 0 && (
                  <div><strong>Canales:</strong> {
                    (formData.distributionType === "manual" ? formData.channels : configuredChannels)
                      .map(channelId => {
                        if (channelId === 'jooble-es') return 'Jooble ES';
                        if (channelId === 'jooble-pt') return 'Jooble PT';
                        if (channelId === 'talent') return 'Talent.com';
                        if (channelId === 'jobrapido') return 'JobRapido';
                        if (channelId === 'whatjobs') return 'WhatJobs';
                        return channelId;
                      }).join(", ")
                  }</div>
                )}
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <strong>Opciones disponibles:</strong>
              <ul className="mt-2 space-y-1">
                <li>• <strong>Guardar como borrador:</strong> La campaña se creará pero no se enviará a los canales</li>
                <li>• <strong>Crear y enviar:</strong> La campaña se creará y se enviará inmediatamente a los canales seleccionados</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCreateDraft}
              disabled={isCreatingCampaign || isActivatingCampaign}
            >
              {isCreatingCampaign ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar como borrador
                </>
              )}
            </Button>
            <Button
              onClick={handleCreateAndSend}
              disabled={isCreatingCampaign || isActivatingCampaign}
            >
              {isActivatingCampaign ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Enviando...
                </>
              ) : isCreatingCampaign ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Creando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Crear y enviar →
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
