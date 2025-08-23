"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Plus, X, Save, ArrowLeft, Briefcase, MapPin, Building2, Star, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { useAuthFetch } from "@/hooks/useAuthFetch"
import { createSegment, estimateSegmentPreview, fetchLocations, fetchSectors, fetchCompanies } from "@/lib/api-temp"

export default function NuevoSegmentoPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { authFetch } = useAuthFetch()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    jobTitles: [] as string[],
    locations: [] as string[],
    sectors: [] as string[],
    companies: [] as string[],
    experienceLevels: [] as string[],
    contractTypes: [] as string[], // sin uso
  })

  // Listas reales
  const [locationsList, setLocationsList] = useState<string[]>([])
  const [sectorsList, setSectorsList] = useState<string[]>([])
  const [companiesList, setCompaniesList] = useState<string[]>([])
  const [loadingLists, setLoadingLists] = useState<boolean>(true)

  // Auxiliares
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newLocation, setNewLocation] = useState("")

  // Estimación
  const [estimatedOffers, setEstimatedOffers] = useState<number>(0)
  const [estimating, setEstimating] = useState<boolean>(false)

  // Cargar listas reales
  useEffect(() => {
    ;(async () => {
      try {
        setLoadingLists(true)
        const [loc, sec, comp] = await Promise.all([fetchLocations(authFetch, { status: 'active' }), fetchSectors(authFetch, { status: 'active' }), fetchCompanies(authFetch, { status: 'active' })])
        setLocationsList(loc?.data || [])
        setSectorsList(sec?.data || [])
        setCompaniesList(comp?.data || [])
      } catch {
        setLocationsList([]); setSectorsList([]); setCompaniesList([])
      } finally {
        setLoadingLists(false)
      }
    })()
  }, [])

  // Handlers
  const addJobTitle = () => {
    if (newJobTitle.trim() && !formData.jobTitles.includes(newJobTitle.trim())) {
      setFormData((p) => ({ ...p, jobTitles: [...p.jobTitles, newJobTitle.trim()] }))
      setNewJobTitle("")
    }
  }
  const removeJobTitle = (t: string) => setFormData((p) => ({ ...p, jobTitles: p.jobTitles.filter((x) => x !== t) }))
  const addLocation = () => {
    if (newLocation && !formData.locations.includes(newLocation)) {
      setFormData((p) => ({ ...p, locations: [...p.locations, newLocation] }))
      setNewLocation("")
    }
  }
  const removeLocation = (loc: string) => setFormData((p) => ({ ...p, locations: p.locations.filter((x) => x !== loc) }))
  const toggleSector = (s: string) =>
    setFormData((p) => ({ ...p, sectors: p.sectors.includes(s) ? p.sectors.filter((x) => x !== s) : [...p.sectors, s] }))
  const toggleCompany = (c: string) =>
    setFormData((p) => ({ ...p, companies: p.companies.includes(c) ? p.companies.filter((x) => x !== c) : [...p.companies, c] }))

  // Convert arrays to MultiSelect options
  const sectorsOptions: MultiSelectOption[] = sectorsList.map(sector => ({ label: sector, value: sector }))
  const companiesOptions: MultiSelectOption[] = companiesList.map(company => ({ label: company, value: company }))
  const toggleExperience = (e: string) =>
    setFormData((p) => ({
      ...p,
      experienceLevels: p.experienceLevels.includes(e) ? p.experienceLevels.filter((x) => x !== e) : [...p.experienceLevels, e],
    }))

  // Estimación REAL (solo activas): title opcional, locations, sectors, companies
  const recalcEstimate = async () => {
    setEstimating(true)
    try {
      const { success, count } = await estimateSegmentPreview(authFetch, {
        jobTitles: formData.jobTitles,
        locations: formData.locations,
        sectors: formData.sectors,
        companies: formData.companies,
      } as any)
      setEstimatedOffers(success ? Number(count) || 0 : 0)
    } catch {
      setEstimatedOffers(0)
    } finally {
      setEstimating(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { void recalcEstimate() }, 500)
    return () => clearTimeout(t)
  }, [formData.jobTitles.join("|"), formData.locations.join("|"), formData.sectors.join("|"), formData.companies.join("|")])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({ title: "Errores en el formulario", description: "El nombre es obligatorio", variant: "destructive" })
      return
    }
    
    // Validar que el segmento tenga ofertas estimadas
    if (estimatedOffers === 0) {
      toast({ 
        title: "Segmento vacío", 
        description: "No se puede crear un segmento sin ofertas. Ajusta los filtros para incluir al menos una oferta.", 
        variant: "destructive" 
      })
      return
    }

    try {
      await createSegment(authFetch, {
        name: formData.name,
        description: formData.description,
        filters: {
          jobTitles: formData.jobTitles,
          locations: formData.locations,
          sectors: formData.sectors,
          companies: formData.companies,
          experienceLevels: formData.experienceLevels,
          contractTypes: formData.contractTypes, // sin uso
        },
      })
      toast({ title: "Segmento creado", description: `${formData.name} con ${estimatedOffers} ofertas` })
      router.push("/segmentos")
    } catch (error: any) {
      toast({ 
        title: "Error al crear segmento", 
        description: error.message || "Error desconocido", 
        variant: "destructive" 
      })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Button variant="outline" size="sm" asChild>
          <Link href="/segmentos"><ArrowLeft className="h-4 w-4 mr-2" />Volver</Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Segmento</h1>
          <p className="text-muted-foreground">Crea un nuevo segmento dinámico de ofertas</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Información básica (restaurado) */}
            <Card>
              <CardHeader>
                <CardTitle>Información Básica</CardTitle>
                <CardDescription>Define el nombre y descripción del segmento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Segmento *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Desarrolladores Frontend Madrid" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Describe brevemente" rows={3} />
                </div>
              </CardContent>
            </Card>

            {/* Títulos (opcional) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Títulos de Trabajo (opcional)</CardTitle>
                <CardDescription>Coincidencia de texto con el título de la oferta (LIKE)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="Ej: Desarrollador, Frontend, React..." onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addJobTitle())} />
                  <Button type="button" onClick={addJobTitle}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.jobTitles.map((title, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {title}
                      <button type="button" onClick={() => removeJobTitle(title)} className="ml-1 hover:text-red-600"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ubicaciones (lista real) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Ubicaciones</CardTitle>
                <CardDescription>Selecciona las ubicaciones donde buscar ofertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={newLocation} onValueChange={setNewLocation} disabled={loadingLists}>
                    <SelectTrigger><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger>
                    <SelectContent>
                      {locationsList.filter((loc) => !formData.locations.includes(loc)).map((location) => (
                        <SelectItem key={location} value={location}>{location}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addLocation} disabled={!newLocation}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.locations.map((location, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {location}
                      <button type="button" onClick={() => removeLocation(location)} className="ml-1 hover:text-red-600"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sectores (lista real) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />Sectores
                </CardTitle>
                <CardDescription>Selecciona los sectores donde buscar ofertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MultiSelect
                  options={sectorsOptions}
                  selected={formData.sectors}
                  onChange={(sectors) => setFormData(p => ({ ...p, sectors }))}
                  placeholder="Selecciona sectores..."
                  loading={loadingLists}
                  emptyText="No se encontraron sectores"
                />
                {formData.sectors.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {formData.sectors.length} sector{formData.sectors.length !== 1 ? 'es' : ''} seleccionado{formData.sectors.length !== 1 ? 's' : ''}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Empresas (lista real) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />Empresas
                </CardTitle>
                <CardDescription>Filtra por CompanyName de ofertas activas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MultiSelect
                  options={companiesOptions}
                  selected={formData.companies}
                  onChange={(companies) => setFormData(p => ({ ...p, companies }))}
                  placeholder="Selecciona empresas..."
                  loading={loadingLists}
                  emptyText="No se encontraron empresas"
                />
                {formData.companies.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    {formData.companies.length} empresa{formData.companies.length !== 1 ? 's' : ''} seleccionada{formData.companies.length !== 1 ? 's' : ''}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Nivel de experiencia (informativo) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Star className="h-5 w-5" />Nivel de Experiencia</CardTitle>
                <CardDescription>Filtro informativo (no aplicado aún)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {["Sin experiencia","Junior (1-2 años)","Senior (3-5 años)","Expert (5+ años)","Directivo"].map((level) => (
                    <div key={level} className="flex items-center space-x-2">
                      <Checkbox id={level} checked={formData.experienceLevels.includes(level)} onCheckedChange={() => toggleExperience(level)} />
                      <Label htmlFor={level} className="text-sm">{level}</Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tipo de contrato (pendiente) */}
            <Card>
              <CardHeader>
                <CardTitle>Tipo de Contrato</CardTitle>
                <CardDescription>Bloque pendiente (no requerido)</CardDescription>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Sin campos por ahora.</p></CardContent>
            </Card>
          </div>

          {/* Columna lateral */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Resumen</CardTitle><CardDescription>Vista previa del segmento</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div><Label className="text-sm font-medium">Nombre</Label><p className="text-sm text-muted-foreground">{formData.name || "Sin nombre"}</p></div>
                <div><Label className="text-sm font-medium">Títulos ({formData.jobTitles.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.jobTitles.slice(0,3).map((t,i)=>(<Badge key={i} variant="outline" className="text-xs">{t}</Badge>))}
                    {formData.jobTitles.length>3 && (<Badge variant="outline" className="text-xs">+{formData.jobTitles.length-3} más</Badge>)}
                  </div>
                </div>
                <div><Label className="text-sm font-medium">Ubicaciones ({formData.locations.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.locations.slice(0,2).map((l,i)=>(<Badge key={i} variant="outline" className="text-xs">{l}</Badge>))}
                    {formData.locations.length>2 && (<Badge variant="outline" className="text-xs">+{formData.locations.length-2} más</Badge>)}
                  </div>
                </div>
                <div><Label className="text-sm font-medium">Sectores ({formData.sectors.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.sectors.slice(0,2).map((s,i)=>(<Badge key={i} variant="outline" className="text-xs">{s}</Badge>))}
                    {formData.sectors.length>2 && (<Badge variant="outline" className="text-xs">+{formData.sectors.length-2} más</Badge>)}
                  </div>
                </div>
                <div><Label className="text-sm font-medium">Empresas ({formData.companies.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.companies.slice(0,3).map((c,i)=>(<Badge key={i} variant="outline" className="text-xs">{c}</Badge>))}
                    {formData.companies.length>3 && (<Badge variant="outline" className="text-xs">+{formData.companies.length-3} más</Badge>)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Ofertas Estimadas (activas)</CardTitle><CardDescription>Cálculo automático según filtros</CardDescription></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold text-green-600">{estimatedOffers}</div>
                  {estimating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Button variant="outline" size="sm" onClick={() => recalcEstimate()} className="ml-2">Recalcular</Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">solo ofertas con estado activo</p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button 
                type="submit" 
                className="flex-1" 
                onClick={(e) => { e.preventDefault(); handleSubmit(e) }}
                disabled={!formData.name.trim() || estimatedOffers === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                {estimatedOffers === 0 ? "Sin ofertas - No se puede crear" : "Crear Segmento"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
