"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  ArrowLeft,
  Database,
  ArrowRight,
  Eye,
  Save,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Settings,
  FileText,
  Zap,
  Loader2,
  Trash2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuthFetch } from "@/hooks/useAuthFetch"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Conexion {
  id: number
  name: string
  type: string
  url: string
  status: string
}

interface FieldMapping {
  ConnectionId: number
  SourceField: string
  TargetField: string
  TransformationType: string
  TransformationRule?: string | null
}

interface SourceField {
  name: string
  type: string
  sample: string
  required: boolean
  description: string
}

interface TargetField {
  name: string
  type: string
  required: boolean
  description: string
}

export default function MapeoPage({ params }: { params: Promise<{ id: string }> }) {
  const { toast } = useToast()
  const router = useRouter()
  const { authFetch } = useAuthFetch()

  // ✅ Unwrap params usando React.use()
  const resolvedParams = React.use(params)
  const connectionId = Number.parseInt(resolvedParams.id)

  console.log("🔍 URL params.id:", resolvedParams.id)
  console.log("🔍 Parsed connectionId:", connectionId)

  // Estados
  const [conexion, setConexion] = useState<Conexion | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSourceFields, setLoadingSourceFields] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Mapeos
  const [currentMappings, setCurrentMappings] = useState<FieldMapping[]>([])
  const [fieldMapping, setFieldMapping] = useState<{ [key: string]: string }>({})
  const [transformations, setTransformations] = useState<{ [key: string]: string }>({})

  // ✅ CAMPOS DINÁMICOS: Ahora se cargan desde el backend
  const [sourceFields, setSourceFields] = useState<SourceField[]>([])

  // Esquema estándar de nuestra plataforma
  const [targetFields] = useState<TargetField[]>([
    { name: "title", type: "string", required: true, description: "Título de la oferta" },
    { name: "company", type: "string", required: true, description: "Nombre de la empresa" },
    { name: "description", type: "text", required: false, description: "Descripción del puesto" },
    { name: "location", type: "string", required: true, description: "Ubicación" },
    { name: "salary_min", type: "number", required: false, description: "Salario mínimo" },
    { name: "salary_max", type: "number", required: false, description: "Salario máximo" },
    { name: "contract_type", type: "string", required: false, description: "Tipo de contrato/modalidad" },
    { name: "work_mode", type: "string", required: false, description: "Modalidad de trabajo" },
    { name: "experience_level", type: "string", required: false, description: "Experiencia requerida" },
    { name: "published_at", type: "date", required: true, description: "Fecha de publicación" },
    { name: "apply_url", type: "url", required: true, description: "URL de aplicación" },
    { name: "url", type: "url", required: false, description: "URL externa de la oferta" },
    { name: "sector", type: "string", required: false, description: "Sector o categoría" },
  ])

  // ✅ CARGAR CONEXIÓN
  useEffect(() => {
    const fetchConnection = async () => {
      try {
        setLoading(true)
        console.log(`🔄 Cargando conexión ${connectionId}...`)

        if (!connectionId || isNaN(connectionId)) {
          throw new Error(`ID de conexión inválido: ${resolvedParams.id}`)
        }

        const response = await authFetch(`http://localhost:3002/api/connections/${connectionId}`)
        console.log(`🌐 Petición a: http://localhost:3002/api/connections/${connectionId}`)

        if (!response.ok) {
          throw new Error(`Error al cargar conexión: ${response.status}`)
        }

        const conexionData = await response.json()
        setConexion(conexionData)
        console.log("✅ Conexión cargada:", conexionData)

        setError(null)
      } catch (err) {
        console.error("❌ Error cargando conexión:", err)
        const errorMessage = err instanceof Error ? err.message : "Error desconocido"
        setError(errorMessage)
        toast({
          title: "Error al cargar conexión",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchConnection()
  }, [connectionId, toast, resolvedParams.id])

  // ✅ CARGAR CAMPOS ORIGEN
  useEffect(() => {
    const fetchSourceFields = async () => {
      if (!conexion) return

      try {
        setLoadingSourceFields(true)
        console.log(`🔄 Cargando campos origen para conexión ${connectionId}...`)

        const response = await authFetch(`http://localhost:3002/api/connections/${connectionId}/fields`)
        console.log(`🌐 Petición a: http://localhost:3002/api/connections/${connectionId}/fields`)

        if (!response.ok) {
          throw new Error(`Error al cargar campos origen: ${response.status}`)
        }

        const data = await response.json()
        console.log("✅ Campos origen recibidos:", data)

        if (data.success && data.fields && Array.isArray(data.fields)) {
          setSourceFields(data.fields)
          console.log(`✅ ${data.fields.length} campos origen cargados`)
        } else {
          console.warn("⚠️ Respuesta inesperada de fields:", data)
          setSourceFields([])
        }
      } catch (err) {
        console.error("❌ Error cargando campos origen:", err)
        toast({
          title: "Error al cargar campos origen",
          description: "No se pudieron detectar los campos de la fuente de datos",
          variant: "destructive",
        })
        setSourceFields([])
      } finally {
        setLoadingSourceFields(false)
      }
    }

    fetchSourceFields()
  }, [conexion, connectionId, toast])

  // ✅ CARGAR MAPEO ACTUAL
  useEffect(() => {
    const fetchMapping = async () => {
      if (!conexion) return

      try {
        console.log(`🔄 Cargando mapeo actual para conexión ${connectionId}...`)

        const response = await authFetch(`http://localhost:3002/api/connections/${connectionId}/mapping`)
        if (response.ok) {
          const mappingData = await response.json()
          console.log("✅ Mapeo actual cargado:", mappingData)

          setCurrentMappings(mappingData)

          // Convertir a formato para la UI
          const mappingObj: { [key: string]: string } = {}
          const transformObj: { [key: string]: string } = {}

          mappingData.forEach((mapping: FieldMapping) => {
            mappingObj[mapping.TargetField] = mapping.SourceField
            if (mapping.TransformationRule) {
              transformObj[mapping.TargetField] = mapping.TransformationRule
            }
          })

          setFieldMapping(mappingObj)
          setTransformations(transformObj)
        } else {
          console.log("ℹ️ No hay mapeo existente, iniciando con mapeo inteligente")
        }
        
        // ✅ MAPEO INTELIGENTE SIEMPRE - Se ejecuta tanto con mapeo vacío como existente
        if (sourceFields.length > 0) {
          const initialMapping: { [key: string]: string } = {}

          // ✅ MAPEO AUTOMÁTICO MEJORADO - Más patrones y campos
          sourceFields.forEach((sourceField) => {
              const sourceName = sourceField.name.toLowerCase()
              const sourceDesc = sourceField.description.toLowerCase()
              
              // Mapear title
              if (sourceName.includes("title") || sourceName.includes("jobtitle") || 
                  sourceDesc.includes("título") || sourceDesc.includes("puesto")) {
                initialMapping.title = sourceField.name
              }
              // Mapear company  
              else if (sourceName.includes("company") || sourceName.includes("employer") ||
                       sourceDesc.includes("empresa") || sourceDesc.includes("compañía")) {
                initialMapping.company = sourceField.name
              }
              // Mapear location/city
              else if (sourceName.includes("location") || sourceName.includes("city") || 
                       sourceName.includes("ciudad") || sourceDesc.includes("ubicación") || 
                       sourceDesc.includes("ciudad")) {
                initialMapping.location = sourceField.name
              }
              // Mapear published_at
              else if (sourceName.includes("date") || sourceName.includes("publish") || 
                       sourceName.includes("publication") || sourceDesc.includes("fecha") ||
                       sourceDesc.includes("publicación")) {
                initialMapping.published_at = sourceField.name
              }
              // Mapear apply_url  
              else if (sourceName.includes("url") || sourceName.includes("link") || 
                       sourceName.includes("apply") || sourceDesc.includes("aplicación") ||
                       sourceDesc.includes("enlace")) {
                initialMapping.apply_url = sourceField.name
              }
              // Mapear description
              else if (sourceName.includes("description") || sourceName.includes("content") ||
                       sourceDesc.includes("descripción") || sourceDesc.includes("contenido")) {
                initialMapping.description = sourceField.name
              }
              // Mapear sector
              else if (sourceName.includes("sector") || sourceName.includes("category") ||
                       sourceDesc.includes("sector") || sourceDesc.includes("categoría")) {
                initialMapping.sector = sourceField.name
              }
              // Mapear contract_type
              else if (sourceName.includes("contract") || sourceName.includes("jobtype") ||
                       sourceDesc.includes("contrato") || sourceDesc.includes("tipo")) {
                initialMapping.contract_type = sourceField.name
              }
              // Mapear salary fields
              else if (sourceName.includes("salary") || sourceName.includes("min") ||
                       sourceDesc.includes("salario")) {
                if (sourceName.includes("min") || sourceDesc.includes("mínimo")) {
                  initialMapping.salary_min = sourceField.name
                } else if (sourceName.includes("max") || sourceDesc.includes("máximo")) {
                  initialMapping.salary_max = sourceField.name
                }
              }
            })

            // Solo aplicar mapeo inteligente si no hay mapeo existente
            if (Object.keys(fieldMapping).length === 0) {
              setFieldMapping(initialMapping)
              console.log("✅ Mapeo inteligente aplicado:", initialMapping)
            } else {
              console.log("💡 Mapeo inteligente disponible (no aplicado porque ya existe mapeo):", initialMapping)
            }
          }
        } catch (err) {
          console.error("❌ Error cargando mapeo:", err)
        }
      }
    }

    fetchMapping()
  }, [conexion, connectionId, sourceFields])

  // ✅ FORZAR MAPEO INTELIGENTE
  const forceIntelligentMapping = () => {
    if (sourceFields.length === 0) {
      toast({
        title: "No se puede ejecutar mapeo inteligente",
        description: "No hay campos detectados de la fuente de datos",
        variant: "destructive",
      })
      return
    }
    
    const initialMapping: { [key: string]: string } = {}

    // ✅ MAPEO AUTOMÁTICO - Misma lógica que arriba
    sourceFields.forEach((sourceField) => {
      const sourceName = sourceField.name.toLowerCase()
      const sourceDesc = sourceField.description.toLowerCase()
      
      // Mapear title
      if (sourceName.includes("title") || sourceName.includes("jobtitle") || 
          sourceDesc.includes("título") || sourceDesc.includes("puesto")) {
        initialMapping.title = sourceField.name
      }
      // Mapear company  
      else if (sourceName.includes("company") || sourceName.includes("employer") ||
               sourceDesc.includes("empresa") || sourceDesc.includes("compañía")) {
        initialMapping.company = sourceField.name
      }
      // Mapear location/city
      else if (sourceName.includes("location") || sourceName.includes("city") || 
               sourceName.includes("ciudad") || sourceDesc.includes("ubicación") || 
               sourceDesc.includes("ciudad")) {
        initialMapping.location = sourceField.name
      }
      // Mapear published_at
      else if (sourceName.includes("date") || sourceName.includes("publish") || 
               sourceName.includes("publication") || sourceDesc.includes("fecha") ||
               sourceDesc.includes("publicación")) {
        initialMapping.published_at = sourceField.name
      }
      // Mapear apply_url  
      else if (sourceName.includes("url") || sourceName.includes("link") || 
               sourceName.includes("apply") || sourceDesc.includes("aplicación") ||
               sourceDesc.includes("enlace")) {
        initialMapping.apply_url = sourceField.name
      }
      // Mapear description
      else if (sourceName.includes("description") || sourceName.includes("content") ||
               sourceDesc.includes("descripción") || sourceDesc.includes("contenido")) {
        initialMapping.description = sourceField.name
      }
      // Mapear sector
      else if (sourceName.includes("sector") || sourceName.includes("category") ||
               sourceDesc.includes("sector") || sourceDesc.includes("categoría")) {
        initialMapping.sector = sourceField.name
      }
      // Mapear contract_type
      else if (sourceName.includes("contract") || sourceName.includes("jobtype") ||
               sourceDesc.includes("contrato") || sourceDesc.includes("tipo")) {
        initialMapping.contract_type = sourceField.name
      }
      // Mapear salary fields
      else if (sourceName.includes("salary") || sourceName.includes("min") ||
               sourceDesc.includes("salario")) {
        if (sourceName.includes("min") || sourceDesc.includes("mínimo")) {
          initialMapping.salary_min = sourceField.name
        } else if (sourceName.includes("max") || sourceDesc.includes("máximo")) {
          initialMapping.salary_max = sourceField.name
        }
      }
    })
    
    setFieldMapping(initialMapping)
    console.log("🤖 Mapeo inteligente forzado:", initialMapping)
    
    toast({
      title: "Mapeo inteligente aplicado",
      description: `Se mapearon ${Object.keys(initialMapping).length} campos automáticamente`,
    })
  }

  // ✅ GUARDAR MAPEO
  const saveMapping = async () => {
    const errors = validateMapping()
    if (errors.length > 0) {
      toast({
        title: "Error en el mapeo",
        description: errors.join(", "),
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      console.log("🔄 Guardando mapeo...")

      // Convertir a formato del backend
      const mappings: FieldMapping[] = Object.entries(fieldMapping).map(([targetField, sourceField]) => ({
        ConnectionId: connectionId,
        SourceField: sourceField,
        TargetField: targetField,
        TransformationType: getTransformationType(targetField),
        TransformationRule: transformations[targetField] || null,
      }))

      const response = await authFetch(`http://localhost:3002/api/connections/${connectionId}/mappings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mappings }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log("✅ Mapeo guardado:", result)

      toast({
        title: "Mapeo guardado exitosamente",
        description: "La configuración de mapeo ha sido guardada y está lista para usar",
      })

      setCurrentMappings(mappings)
    } catch (err) {
      console.error("❌ Error guardando mapeo:", err)
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      toast({
        title: "Error al guardar mapeo",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // ✅ PROBAR MAPEO
  const testMapping = async () => {
    try {
      setTesting(true)
      console.log("🔄 Probando mapeo...")

      const response = await authFetch(`http://localhost:3002/api/connections/${connectionId}/test-mapping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fieldMapping, transformations }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log("✅ Prueba de mapeo exitosa:", result)

      toast({
        title: "Prueba exitosa",
        description: "El mapeo funciona correctamente con los datos de muestra",
      })
    } catch (err) {
      console.error("❌ Error probando mapeo:", err)
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      toast({
        title: "Error en la prueba",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  // ✅ ELIMINAR CONEXIÓN
  const deleteConnection = async () => {
    try {
      setDeleting(true)
      console.log("🔄 Eliminando conexión...")

      const response = await authFetch(`http://localhost:3002/api/connections/${connectionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log("✅ Conexión eliminada:", result)

      toast({
        title: "Conexión eliminada",
        description: "La conexión ha sido eliminada exitosamente",
      })

      // Redirigir a la lista de conexiones
      router.push("/conexiones")
    } catch (err) {
      console.error("❌ Error eliminando conexión:", err)
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      toast({
        title: "Error al eliminar conexión",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  // Funciones auxiliares
  const mapField = (targetField: string, sourceField: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [targetField]: sourceField,
    }))
  }

  const clearMapping = (targetField: string) => {
    setFieldMapping((prev) => {
      const newMapping = { ...prev }
      delete newMapping[targetField]
      return newMapping
    })
  }

  const setTransformation = (targetField: string, transformation: string) => {
    setTransformations((prev) => ({
      ...prev,
      [targetField]: transformation === "none" ? "" : transformation,
    }))
  }

  const getTransformationType = (targetField: string): string => {
    const target = targetFields.find((f) => f.name === targetField)
    switch (target?.type) {
      case "number":
        return "NUMBER"
      case "date":
        return "DATE"
      case "text":
        return "STRING"
      default:
        return "STRING"
    }
  }

  const validateMapping = (): string[] => {
    const errors = []
    const requiredTargetFields = targetFields.filter((f) => f.required)

    for (const requiredField of requiredTargetFields) {
      if (!fieldMapping[requiredField.name]) {
        errors.push(`Campo requerido "${requiredField.description}" sin mapear`)
      }
    }

    return errors
  }

  const generateSampleData = () => {
    const sample: { [key: string]: any } = {}

    for (const [targetField, sourceField] of Object.entries(fieldMapping)) {
      const sourceFieldData = sourceFields.find((f) => f.name === sourceField)
      if (sourceFieldData) {
        let value = sourceFieldData.sample

        // Aplicar transformaciones si existen
        if (transformations[targetField]) {
          switch (transformations[targetField]) {
            case "uppercase":
              value = value.toString().toUpperCase()
              break
            case "lowercase":
              value = value.toString().toLowerCase()
              break
            case "capitalize":
              value = value.toString().charAt(0).toUpperCase() + value.toString().slice(1).toLowerCase()
              break
            case "trim":
              value = value.toString().trim()
              break
          }
        }

        sample[targetField] = value
      }
    }

    return sample
  }

  const sampleData = generateSampleData()
  const validationErrors = validateMapping()

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Mapeo de Campos</h1>
            <p className="text-muted-foreground">Cargando configuración...</p>
          </div>
        </div>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !conexion) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <Button variant="outline" size="sm" asChild>
            <Link href="/conexiones">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Conexiones
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Error</h1>
            <p className="text-muted-foreground text-red-600">{error}</p>
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
          <Link href="/conexiones">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Conexiones
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Mapeo de Campos</h1>
          <p className="text-muted-foreground">
            Configura cómo se mapean los datos de "{conexion.name}" a nuestro esquema
          </p>
        </div>
      </div>

      {/* Info de la conexión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Información de la Conexión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="text-sm font-medium">Nombre</Label>
              <p className="text-sm text-muted-foreground">{conexion.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Tipo</Label>
              <p className="text-sm text-muted-foreground">{conexion.type}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">URL</Label>
              <p className="text-sm text-muted-foreground truncate">{conexion.url}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mapeo de campos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Mapeo de Campos
            </CardTitle>
            <CardDescription>Conecta los campos de origen con nuestro esquema estándar</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo Destino</TableHead>
                  <TableHead>Campo Origen</TableHead>
                  <TableHead>Transformación</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targetFields.map((targetField) => (
                  <TableRow key={targetField.name}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{targetField.description}</span>
                          {targetField.required && (
                            <Badge variant="destructive" className="text-xs">
                              Requerido
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {targetField.name} ({targetField.type})
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={fieldMapping[targetField.name] || "none"}
                        onValueChange={(value) =>
                          value === "none" ? clearMapping(targetField.name) : mapField(targetField.name, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar campo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin mapear</SelectItem>
                          {sourceFields.map((sourceField) => (
                            <SelectItem key={sourceField.name} value={sourceField.name}>
                              <div className="flex flex-col">
                                <span>{sourceField.description}</span>
                                <span className="text-xs text-muted-foreground">
                                  {sourceField.name} • Valor: {sourceField.sample}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={transformations[targetField.name] || "none"}
                        onValueChange={(value) => setTransformation(targetField.name, value)}
                        disabled={!fieldMapping[targetField.name]}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sin transformación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin transformación</SelectItem>
                          <SelectItem value="uppercase">MAYÚSCULAS</SelectItem>
                          <SelectItem value="lowercase">minúsculas</SelectItem>
                          <SelectItem value="capitalize">Capitalizar</SelectItem>
                          <SelectItem value="trim">Quitar espacios</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {fieldMapping[targetField.name] && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => clearMapping(targetField.name)}
                          className="text-red-600"
                        >
                          Limpiar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Panel lateral */}
        <div className="space-y-6">
          {/* Campos de origen */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Campos Detectados
                {loadingSourceFields && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <CardDescription>Campos disponibles en la fuente de datos</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSourceFields ? (
                <div className="flex justify-center items-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Detectando campos...</span>
                </div>
              ) : sourceFields.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No se detectaron campos</h3>
                  <p className="text-muted-foreground text-sm">
                    Verifica que la conexión esté configurada correctamente y que la fuente de datos sea accesible.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {sourceFields.map((field) => (
                    <div key={field.name} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{field.description}</span>
                        {field.required && (
                          <Badge variant="outline" className="text-xs">
                            Requerido
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <div>
                          {field.name} ({field.type})
                        </div>
                        <div className="mt-1">
                          <strong>Valor:</strong> {field.sample}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estado de validación */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Estado del Mapeo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Campos mapeados</span>
                  <span className="font-medium">
                    {Object.keys(fieldMapping).length} / {targetFields.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Campos requeridos</span>
                  <span className="font-medium">
                    {targetFields.filter((f) => f.required).length - validationErrors.length} /{" "}
                    {targetFields.filter((f) => f.required).length}
                  </span>
                </div>
                {validationErrors.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Mapeo válido</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">Errores de validación</span>
                    </div>
                    <ul className="text-xs text-red-600 space-y-1 ml-6">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="space-y-2">
            <Button onClick={forceIntelligentMapping} variant="outline" className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              Mapeo Inteligente
            </Button>
            <Button onClick={() => setShowPreview(!showPreview)} variant="outline" className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Ocultar" : "Ver"} Vista Previa
            </Button>
            <Button onClick={testMapping} variant="outline" className="w-full bg-transparent" disabled={testing}>
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Probando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Probar Mapeo
                </>
              )}
            </Button>
            <Button onClick={saveMapping} className="w-full" disabled={validationErrors.length > 0 || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Mapeo
                </>
              )}
            </Button>
            
            {/* Botón para eliminar conexión */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Conexión
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente la conexión "{conexion?.name}" y todos sus mapeos de campos asociados. 
                    Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={deleteConnection}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Eliminando...
                      </>
                    ) : (
                      "Sí, eliminar"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Vista previa de datos */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Vista Previa de Datos Mapeados
            </CardTitle>
            <CardDescription>Así quedarían los datos después del mapeo y transformaciones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(sampleData).map(([field, value]) => (
                  <div key={field} className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">
                        {targetFields.find((f) => f.name === field)?.description}
                      </Label>
                      {transformations[field] && (
                        <Badge variant="outline" className="text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          {transformations[field]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{value}</p>
                    <p className="text-xs text-muted-foreground">Origen: {fieldMapping[field]}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
