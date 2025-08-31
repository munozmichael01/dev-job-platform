"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Save, ArrowLeft, Megaphone, Users, Target, DollarSign, Settings, Zap, Hand, CheckCircle, AlertTriangle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { fetchCampaign, updateCampaign, fetchSegments } from "@/lib/api-temp"
import { useAuthFetch } from "@/hooks/useAuthFetch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import ChannelSelector from "@/components/campaigns/ChannelSelector"

export default function EditarCampanaPage() {
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string
  const { authFetch } = useAuthFetch()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    segmentId: "",
    distributionType: "automatic",
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

  useEffect(() => {
    loadCampaignData()
    loadSegments()
  }, [campaignId, authFetch])

  const loadCampaignData = async () => {
    try {
      setLoading(true)
      const campaign = await fetchCampaign(Number(campaignId))
      
      // Formatear fechas para inputs de tipo date
      const formatDateForInput = (dateString: string | null) => {
        if (!dateString) return ""
        return new Date(dateString).toISOString().split('T')[0]
      }

      setFormData({
        name: campaign.Name || "",
        description: campaign.Description || "",
        segmentId: String(campaign.SegmentId || ""),
        distributionType: campaign.DistributionType || "automatic",
        startDate: formatDateForInput(campaign.StartDate),
        endDate: formatDateForInput(campaign.EndDate),
        budget: String(campaign.Budget || ""),
        targetApplications: String(campaign.TargetApplications || ""),
        maxCPA: String(campaign.MaxCPA || ""),
        channels: campaign.Channels || [],
        bidStrategy: campaign.BidStrategy || "automatic",
        manualBid: String(campaign.ManualBid || ""),
        priority: campaign.Priority || "medium",
        autoOptimization: campaign.AutoOptimization || true,
      })
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
      router.push("/campanas")
    } finally {
      setLoading(false)
    }
  }

  const loadSegments = async () => {
    try {
      const data = await fetchSegments(authFetch)
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

  const selectedSegment = availableSegments.find((s) => s.id === formData.segmentId)
  
  const toggleChannel = (channelId: string) =>
    setFormData((prev) => ({ 
      ...prev, 
      channels: prev.channels.includes(channelId) 
        ? prev.channels.filter((c) => c !== channelId) 
        : [...prev.channels, channelId] 
    }))

  const calculateEstimatedBudget = () => (formData.targetApplications && formData.maxCPA ? Number(formData.targetApplications) * Number(formData.maxCPA) : 0)
  
  const validateForm = () => {
    const errors = []
    if (!formData.name.trim()) errors.push("El nombre es obligatorio")
    if (!formData.segmentId) errors.push("Debe seleccionar un segmento")
    if (!formData.startDate) errors.push("La fecha de inicio es obligatoria")
    if (!formData.endDate) errors.push("La fecha de fin es obligatoria")
    if (!formData.budget) errors.push("El presupuesto es obligatorio")
    if (!formData.targetApplications) errors.push("El objetivo de aplicaciones es obligatorio")
    if (!formData.maxCPA) errors.push("El CPA máximo es obligatorio")
    if (formData.distributionType === "manual" && formData.channels.length === 0) errors.push("Debe seleccionar al menos un canal para distribución manual")
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateForm()
    if (errors.length > 0) {
      toast({ title: "Errores en el formulario", description: errors.join(", "), variant: "destructive" })
      return
    }
    
    try {
      setSaving(true)
      await updateCampaign(Number(campaignId), {
        name: formData.name,
        description: formData.description,
        segmentId: Number(formData.segmentId),
        distributionType: formData.distributionType,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        budget: formData.budget ? Number(formData.budget) : null,
        targetApplications: formData.targetApplications ? Number(formData.targetApplications) : null,
        maxCPA: formData.maxCPA ? Number(formData.maxCPA) : null,
        channels: formData.distributionType === "manual" ? formData.channels : [],
        bidStrategy: formData.bidStrategy,
        manualBid: formData.manualBid ? Number(formData.manualBid) : null,
        priority: formData.priority,
        autoOptimization: formData.autoOptimization,
      })
      toast({ title: "Campaña actualizada", description: `La campaña "${formData.name}" ha sido actualizada exitosamente` })
      router.push("/campanas")
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Cargando campaña...</h1>
            <p className="text-muted-foreground">Obteniendo datos de la campaña</p>
          </div>
        </div>
      </div>
    )
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
          <h1 className="text-3xl font-bold">Editar Campaña</h1>
          <p className="text-muted-foreground">Modificar "{formData.name}"</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Información Básica
            </CardTitle>
            <CardDescription>Detalles principales de la campaña</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Campaña</Label>
                <Input
                  id="name"
                  placeholder="Ej: Desarrolladores React Madrid"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment">Segmento</Label>
                <Select value={formData.segmentId} onValueChange={(value) => setFormData((prev) => ({ ...prev, segmentId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSegments.map((segment) => (
                      <SelectItem key={segment.id} value={segment.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{segment.name}</span>
                          <Badge variant="outline" className="ml-2">
                            {segment.offerCount} ofertas
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSegment && (
                  <p className="text-sm text-muted-foreground">
                    {selectedSegment.description} • {selectedSegment.offerCount} ofertas disponibles
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Descripción opcional de la campaña"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configuración Temporal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Configuración Temporal
            </CardTitle>
            <CardDescription>Fechas de inicio y fin de la campaña</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de Inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha de Fin</Label>
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

        {/* Presupuesto y Objetivos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Presupuesto y Objetivos
            </CardTitle>
            <CardDescription>Define tu inversión y metas de aplicaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="budget">Presupuesto Total (€)</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="2500"
                  value={formData.budget}
                  onChange={(e) => setFormData((prev) => ({ ...prev, budget: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetApplications">Objetivo de Aplicaciones</Label>
                <Input
                  id="targetApplications"
                  type="number"
                  placeholder="150"
                  value={formData.targetApplications}
                  onChange={(e) => setFormData((prev) => ({ ...prev, targetApplications: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxCPA">CPA Máximo (€)</Label>
                <Input
                  id="maxCPA"
                  type="number"
                  step="0.01"
                  placeholder="16.67"
                  value={formData.maxCPA}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maxCPA: e.target.value }))}
                />
              </div>
            </div>
            {formData.targetApplications && formData.maxCPA && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <DollarSign className="h-4 w-4" />
                  <span className="font-medium">Presupuesto Estimado: €{calculateEstimatedBudget().toLocaleString()}</span>
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  {formData.targetApplications} aplicaciones × €{formData.maxCPA} CPA máximo
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribución y Canales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Distribución y Canales
            </CardTitle>
            <CardDescription>Selecciona cómo distribuir tu presupuesto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Tipo de Distribución</Label>
              <RadioGroup 
                value={formData.distributionType} 
                onValueChange={(value) => setFormData((prev) => ({ ...prev, distributionType: value }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="automatic" id="automatic" />
                  <Label htmlFor="automatic" className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-500" />
                    Automática - IA optimiza la distribución
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="flex items-center gap-2">
                    <Hand className="h-4 w-4 text-orange-500" />
                    Manual - Tú eliges los canales
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <ChannelSelector
              selectedChannels={formData.channels}
              onChannelToggle={toggleChannel}
              distributionType={formData.distributionType}
              budget={Number(formData.budget) || 0}
              targetApplications={Number(formData.targetApplications) || 0}
              userId={1} // TODO: Get from auth context
            />
          </CardContent>
        </Card>

        {/* Configuración Avanzada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración Avanzada
            </CardTitle>
            <CardDescription>Opciones avanzadas de bidding y optimización</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bidStrategy">Estrategia de Bidding</Label>
                <Select value={formData.bidStrategy} onValueChange={(value) => setFormData((prev) => ({ ...prev, bidStrategy: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automático</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="target_cpa">Target CPA</SelectItem>
                    <SelectItem value="maximize_conversions">Maximizar Conversiones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.bidStrategy === "manual" && (
              <div className="space-y-2">
                <Label htmlFor="manualBid">Bid Manual (€)</Label>
                <Input
                  id="manualBid"
                  type="number"
                  step="0.01"
                  placeholder="0.50"
                  value={formData.manualBid}
                  onChange={(e) => setFormData((prev) => ({ ...prev, manualBid: e.target.value }))}
                />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoOptimization"
                checked={formData.autoOptimization}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, autoOptimization: checked as boolean }))}
              />
              <Label htmlFor="autoOptimization" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Activar optimización automática continua
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Botones de Acción */}
        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/campanas")}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
