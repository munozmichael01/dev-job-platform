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
import { Plus, X, Save, ArrowLeft, Briefcase, MapPin, Building2, Star } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function NuevoSegmentoPage() {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    jobTitles: [] as string[],
    locations: [] as string[],
    sectors: [] as string[],
    experienceLevels: [] as string[],
    contractTypes: [] as string[],
  })

  const [newJobTitle, setNewJobTitle] = useState("")
  const [newLocation, setNewLocation] = useState("")

  const availableSectors = [
    "Tecnología",
    "Hostelería",
    "Turismo",
    "Ventas",
    "Marketing",
    "Finanzas",
    "Salud",
    "Educación",
    "Construcción",
    "Retail",
  ]

  const experienceLevels = [
    "Sin experiencia",
    "Junior (1-2 años)",
    "Senior (3-5 años)",
    "Expert (5+ años)",
    "Directivo",
  ]

  const contractTypes = ["Tiempo completo", "Tiempo parcial", "Temporal", "Prácticas", "Freelance", "Indefinido"]

  const locations = [
    "Madrid",
    "Barcelona",
    "Valencia",
    "Sevilla",
    "Bilbao",
    "Málaga",
    "Zaragoza",
    "Murcia",
    "Remoto",
    "España",
  ]

  const addJobTitle = () => {
    if (newJobTitle.trim() && !formData.jobTitles.includes(newJobTitle.trim())) {
      setFormData((prev) => ({
        ...prev,
        jobTitles: [...prev.jobTitles, newJobTitle.trim()],
      }))
      setNewJobTitle("")
    }
  }

  const removeJobTitle = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      jobTitles: prev.jobTitles.filter((t) => t !== title),
    }))
  }

  const addLocation = () => {
    if (newLocation && !formData.locations.includes(newLocation)) {
      setFormData((prev) => ({
        ...prev,
        locations: [...prev.locations, newLocation],
      }))
      setNewLocation("")
    }
  }

  const removeLocation = (location: string) => {
    setFormData((prev) => ({
      ...prev,
      locations: prev.locations.filter((l) => l !== location),
    }))
  }

  const toggleSector = (sector: string) => {
    setFormData((prev) => ({
      ...prev,
      sectors: prev.sectors.includes(sector) ? prev.sectors.filter((s) => s !== sector) : [...prev.sectors, sector],
    }))
  }

  const toggleExperience = (level: string) => {
    setFormData((prev) => ({
      ...prev,
      experienceLevels: prev.experienceLevels.includes(level)
        ? prev.experienceLevels.filter((e) => e !== level)
        : [...prev.experienceLevels, level],
    }))
  }

  const toggleContractType = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      contractTypes: prev.contractTypes.includes(type)
        ? prev.contractTypes.filter((c) => c !== type)
        : [...prev.contractTypes, type],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del segmento es obligatorio",
        variant: "destructive",
      })
      return
    }

    if (formData.jobTitles.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un título de trabajo",
        variant: "destructive",
      })
      return
    }

    // Simular guardado
    toast({
      title: "Segmento creado",
      description: `El segmento "${formData.name}" ha sido creado exitosamente`,
    })

    // Aquí iría la lógica para guardar en la base de datos
    console.log("Datos del segmento:", formData)
  }

  const estimatedOffers = Math.floor(Math.random() * 50) + 10 // Simulación

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <Button variant="outline" size="sm" asChild>
          <Link href="/segmentos">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Segmento</h1>
          <p className="text-muted-foreground">Crea un nuevo segmento dinámico de ofertas</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Información básica */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información Básica</CardTitle>
                <CardDescription>Define el nombre y descripción del segmento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Segmento *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Desarrolladores Frontend Madrid"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe brevemente qué tipo de ofertas incluye este segmento"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Títulos de trabajo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Títulos de Trabajo
                </CardTitle>
                <CardDescription>Palabras clave que deben contener los títulos de las ofertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                    placeholder="Ej: Desarrollador, Frontend, React..."
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addJobTitle())}
                  />
                  <Button type="button" onClick={addJobTitle}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.jobTitles.map((title, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {title}
                      <button type="button" onClick={() => removeJobTitle(title)} className="ml-1 hover:text-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ubicaciones */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Ubicaciones
                </CardTitle>
                <CardDescription>Selecciona las ubicaciones donde buscar ofertas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={newLocation} onValueChange={setNewLocation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una ubicación" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter((loc) => !formData.locations.includes(loc))
                        .map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addLocation} disabled={!newLocation}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.locations.map((location, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {location}
                      <button
                        type="button"
                        onClick={() => removeLocation(location)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Sectores */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Sectores
                </CardTitle>
                <CardDescription>Selecciona los sectores de interés</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {availableSectors.map((sector) => (
                    <div key={sector} className="flex items-center space-x-2">
                      <Checkbox
                        id={sector}
                        checked={formData.sectors.includes(sector)}
                        onCheckedChange={() => toggleSector(sector)}
                      />
                      <Label htmlFor={sector} className="text-sm">
                        {sector}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Nivel de experiencia */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Nivel de Experiencia
                </CardTitle>
                <CardDescription>Filtra por nivel de experiencia requerido</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {experienceLevels.map((level) => (
                    <div key={level} className="flex items-center space-x-2">
                      <Checkbox
                        id={level}
                        checked={formData.experienceLevels.includes(level)}
                        onCheckedChange={() => toggleExperience(level)}
                      />
                      <Label htmlFor={level} className="text-sm">
                        {level}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tipo de contrato */}
            <Card>
              <CardHeader>
                <CardTitle>Tipo de Contrato</CardTitle>
                <CardDescription>Selecciona los tipos de contrato de interés</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {contractTypes.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={type}
                        checked={formData.contractTypes.includes(type)}
                        onCheckedChange={() => toggleContractType(type)}
                      />
                      <Label htmlFor={type} className="text-sm">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vista previa */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Vista Previa</CardTitle>
                <CardDescription>Resumen del segmento que estás creando</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Nombre</Label>
                  <p className="text-sm text-muted-foreground">{formData.name || "Sin nombre"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium">Títulos ({formData.jobTitles.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.jobTitles.slice(0, 3).map((title, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {title}
                      </Badge>
                    ))}
                    {formData.jobTitles.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{formData.jobTitles.length - 3} más
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Ubicaciones ({formData.locations.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.locations.slice(0, 2).map((location, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {location}
                      </Badge>
                    ))}
                    {formData.locations.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{formData.locations.length - 2} más
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Sectores ({formData.sectors.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.sectors.slice(0, 2).map((sector, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {sector}
                      </Badge>
                    ))}
                    {formData.sectors.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{formData.sectors.length - 2} más
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ofertas Estimadas</CardTitle>
                <CardDescription>Número aproximado de ofertas que coincidirán</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{estimatedOffers}</div>
                <p className="text-sm text-muted-foreground">ofertas actuales</p>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Crear Segmento
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
