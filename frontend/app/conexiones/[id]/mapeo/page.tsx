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
import { useAuth } from "@/contexts/AuthContext"
import { PageLoadingSpinner } from "@/components/ui/loading-spinner"
import { getErrorMessage, logError } from "@/lib/errors"

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
  // Hooks - must be called at top level
  const { toast } = useToast()
  const router = useRouter()
  const { authFetch, authFetchJSON } = useAuthFetch()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()

  // Unwrap params
  const resolvedParams = React.use(params)
  const connectionId = Number.parseInt(resolvedParams.id)

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

  // Campos dinámicos
  const [sourceFields, setSourceFields] = useState<SourceField[]>([])

  // Esquema estándar
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
    { name: "url", type: "url", required: false, description: "URL de la oferta" },
    { name: "sector", type: "string", required: false, description: "Sector o categoría" },
  ])

  // Route protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('🛡️ MapeoPage: Usuario no autenticado, redirigiendo...')
      toast({
        title: "Acceso denegado",
        description: "Debes iniciar sesión para acceder a esta página",
        variant: "destructive",
      })
      const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000'
      window.location.href = `${landingUrl}/login`
    }
  }, [authLoading, isAuthenticated, toast])

  // Show loading while checking auth
  if (authLoading) {
    return <PageLoadingSpinner />
  }

  // Ensure user is authenticated
  if (!isAuthenticated || !user) {
    return <PageLoadingSpinner />
  }

  // Load connection data
  useEffect(() => {
    const fetchConnection = async () => {
      if (!connectionId || isNaN(connectionId)) {
        setError("ID de conexión inválido")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        console.log(`🔄 Cargando conexión ${connectionId}...`)

        const conexionData = await authFetchJSON<Conexion>(`http://localhost:3002/api/connections/${connectionId}`)
        setConexion(conexionData)
        console.log("✅ Conexión cargada:", conexionData)
        setError(null)
      } catch (err) {
        const errorMessage = getErrorMessage(err)
        console.error("❌ Error cargando conexión:", err)
        logError(err, { context: 'fetchConnection', connectionId })
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
  }, [connectionId])

  // Load source fields
  useEffect(() => {
    const fetchSourceFields = async () => {
      if (!conexion) return

      try {
        setLoadingSourceFields(true)
        console.log(`🔄 Cargando campos origen para conexión ${connectionId}...`)

        const data = await authFetchJSON<{ success: boolean; fields: SourceField[] }>(
          `http://localhost:3002/api/connections/${connectionId}/fields`
        )

        if (data.success && data.fields && Array.isArray(data.fields)) {
          setSourceFields(data.fields)
          console.log(`✅ ${data.fields.length} campos origen cargados`)
        } else {
          console.warn("⚠️ Respuesta inesperada de fields:", data)
          setSourceFields([])
        }
      } catch (err) {
        const errorMessage = getErrorMessage(err)
        console.error("❌ Error cargando campos origen:", err)
        logError(err, { context: 'fetchSourceFields', connectionId })
        
        toast({
          title: "Error al cargar campos",
          description: errorMessage,
          variant: "destructive",
        })
        setSourceFields([])
      } finally {
        setLoadingSourceFields(false)
      }
    }

    fetchSourceFields()
  }, [conexion, connectionId])

  // Load existing mappings
  useEffect(() => {
    const fetchMapping = async () => {
      if (!conexion || sourceFields.length === 0) return

      try {
        console.log(`🔄 Cargando mapeo actual para conexión ${connectionId}...`)

        const response = await authFetch(`http://localhost:3002/api/connections/${connectionId}/mappings`)
        
        if (response.ok) {
          const existingMappings = await response.json()
          console.log("✅ Mapeo actual cargado:", existingMappings)

          setCurrentMappings(existingMappings)

          // Convert to UI format
          const mappingObj: { [key: string]: string } = {}
          const transformObj: { [key: string]: string } = {}

          existingMappings.forEach((mapping: FieldMapping) => {
            mappingObj[mapping.TargetField] = mapping.SourceField
            if (mapping.TransformationRule) {
              transformObj[mapping.TargetField] = mapping.TransformationRule
            }
          })

          setFieldMapping(mappingObj)
          setTransformations(transformObj)
        } else if (response.status === 404) {
          // No existing mapping, apply intelligent mapping
          console.log("ℹ️ No hay mapeo existente, aplicando mapeo inteligente")
          applyIntelligentMapping()
        }
      } catch (err) {
        console.error("❌ Error cargando mapeo:", err)
        logError(err, { context: 'fetchMapping', connectionId })
      }
    }

    fetchMapping()
  }, [conexion, connectionId, sourceFields.length])

  // Intelligent mapping
  const applyIntelligentMapping = () => {
    // Start with existing mappings to preserve manual selections
    const initialMapping: { [key: string]: string } = { ...fieldMapping }

    sourceFields.forEach((sourceField) => {
      const fieldName = sourceField.name.toLowerCase()
      
      // Title mapping - only if not already mapped
      if (!initialMapping.title && (fieldName === "title" || fieldName === "job_title" || fieldName === "jobtitle" || 
          fieldName === "titulo" || fieldName === "puesto" || fieldName === "cargo")) {
        initialMapping.title = sourceField.name
      }
      
      // Company mapping
      if (!initialMapping.company && (fieldName === "company" || fieldName === "companyname" || fieldName === "company_name" || 
          fieldName === "empresa" || fieldName === "empleador" || fieldName === "employer")) {
        initialMapping.company = sourceField.name
      }
      
      // Location mapping
      if (!initialMapping.location && (fieldName === "location" || fieldName === "city" || fieldName === "ciudad" || 
          fieldName === "ubicacion" || fieldName === "lugar" || fieldName === "provincia" || fieldName === "region")) {
        initialMapping.location = sourceField.name
      }
      
      // Published date mapping
      if (!initialMapping.published_at && (fieldName === "date" || fieldName === "publish_date" || fieldName === "publication_date" || 
          fieldName === "created_at" || fieldName === "published_at" || fieldName === "publication" || 
          fieldName === "fecha" || fieldName === "fecha_publicacion")) {
        initialMapping.published_at = sourceField.name
      }
      
      // Apply URL mapping
      if (!initialMapping.apply_url && (fieldName === "url_apply" || fieldName === "apply_url" || fieldName === "application_url" ||
          fieldName === "link_aplicacion" || fieldName === "enlace_aplicacion" || fieldName === "apply_link")) {
        initialMapping.apply_url = sourceField.name
      }
      
      // URL mapping
      if (!initialMapping.url && (fieldName === "url" || fieldName === "link" || fieldName === "enlace" || 
          fieldName === "job_url" || fieldName === "offer_url") && 
          !fieldName.includes("apply") && !fieldName.includes("logo")) {
        initialMapping.url = sourceField.name
      }
      
      // Description mapping
      if (!initialMapping.description && (fieldName === "description" || fieldName === "content" || fieldName === "summary" ||
          fieldName === "descripcion" || fieldName === "detalle" || fieldName === "contenido")) {
        initialMapping.description = sourceField.name
      }
      
      // Sector mapping
      if (!initialMapping.sector && (fieldName === "sector" || fieldName === "category" || fieldName === "job_category" ||
          fieldName === "categoria" || fieldName === "area" || fieldName === "industria")) {
        initialMapping.sector = sourceField.name
      }
      
      // Contract type mapping
      if (!initialMapping.contract_type && (fieldName === "contract_type" || fieldName === "job_type" || 
          fieldName === "employment_type" || fieldName === "jobtype" || fieldName === "tipo_contrato" || 
          fieldName === "modalidad" || fieldName === "tipo_empleo")) {
        initialMapping.contract_type = sourceField.name
      }
      
      // Salary min mapping
      if (!initialMapping.salary_min && (fieldName === "salary_min" || fieldName === "min_salary" || 
          fieldName === "salario_minimo" || fieldName === "sueldo_minimo" || fieldName === "minimum_salary")) {
        initialMapping.salary_min = sourceField.name
      }
      
      // Salary max mapping
      if (!initialMapping.salary_max && (fieldName === "salary_max" || fieldName === "max_salary" || 
          fieldName === "salario_maximo" || fieldName === "sueldo_maximo" || fieldName === "maximum_salary")) {
        initialMapping.salary_max = sourceField.name
      }
      
      // Work mode mapping
      if (!initialMapping.work_mode && (fieldName === "work_mode" || fieldName === "working_mode" || 
          fieldName === "remote" || fieldName === "modalidad_trabajo" || fieldName === "trabajo_remoto")) {
        initialMapping.work_mode = sourceField.name
      }
      
      // Experience level mapping
      if (!initialMapping.experience_level && (fieldName === "experience" || fieldName === "experience_level" || 
          fieldName === "seniority" || fieldName === "experiencia" || fieldName === "nivel_experiencia")) {
        initialMapping.experience_level = sourceField.name
      }
    })

    setFieldMapping(initialMapping)
    console.log("🤖 Mapeo inteligente aplicado:", initialMapping)
  }

  // Force intelligent mapping
  const forceIntelligentMapping = () => {
    if (sourceFields.length === 0) {
      toast({
        title: "No se puede ejecutar mapeo inteligente",
        description: "No hay campos detectados de la fuente de datos",
        variant: "destructive",
      })
      return
    }
    
    // Keep existing mappings
    const newMappings = { ...fieldMapping }
    let mappedCount = 0
    
    sourceFields.forEach((sourceField) => {
      const fieldName = sourceField.name.toLowerCase()
      
      // Apply intelligent mapping for unmapped fields
      targetFields.forEach((targetField) => {
        if (!newMappings[targetField.name]) {
          const targetName = targetField.name.toLowerCase()
          
          // Check for matches
          if (fieldName.includes(targetName) || targetName.includes(fieldName)) {
            newMappings[targetField.name] = sourceField.name
            mappedCount++
          }
        }
      })
    })
    
    setFieldMapping(newMappings)
    
    toast({
      title: "Mapeo inteligente aplicado",
      description: `Se mapearon ${mappedCount} campos nuevos automáticamente`,
    })
  }

  // Save mapping
  // Function to clean duplicate mappings
  const cleanupMappingDuplicates = (mappingObject: Record<string, string>) => {
    console.log('🧹 LIMPIANDO MAPEOS DUPLICADOS');
    console.log(`📥 Mapeos originales: ${Object.keys(mappingObject).length}`);

    const cleanMapping: Record<string, string> = {};
    const seenTargetFields = new Set<string>();
    const duplicates: string[] = [];

    // Normalization map for standard fields
    const normalizationMap: Record<string, string> = {
      // Title variations
      'title': 'Title',
      'Title': 'Title',
      'job_title': 'JobTitle',
      'JobTitle': 'JobTitle',

      // Description variations
      'description': 'Description',
      'Description': 'Description',

      // Company variations
      'company': 'CompanyName',
      'Company': 'CompanyName',
      'CompanyName': 'CompanyName',
      'company_name': 'CompanyName',

      // Location variations
      'location': 'City', // Default location to City
      'city': 'City',
      'City': 'City',
      'region': 'Region',
      'Region': 'Region',
      'country': 'Country',
      'Country': 'Country',

      // URL variations
      'url': 'ApplicationUrl',
      'apply_url': 'ApplicationUrl',
      'ApplicationUrl': 'ApplicationUrl',
      'application_url': 'ApplicationUrl',
      'ExternalUrl': 'ExternalUrl',
      'external_url': 'ExternalUrl',

      // Date variations
      'published_at': 'PublicationDate',
      'publication_date': 'PublicationDate',
      'PublicationDate': 'PublicationDate',

      // Salary variations
      'salary_min': 'SalaryMin',
      'salary_max': 'SalaryMax',
      'SalaryMin': 'SalaryMin',
      'SalaryMax': 'SalaryMax',
      'salary': 'SalaryMin', // Default single salary to min

      // ID variations
      'id': 'ExternalId',
      'external_id': 'ExternalId',
      'ExternalId': 'ExternalId',

      // Sector variations
      'sector': 'Sector',
      'Sector': 'Sector',
      'sector_id': 'Sector',
      'sectorId': 'Sector'
    };

    // Process each mapping
    Object.entries(mappingObject).forEach(([targetField, sourceField]) => {
      const normalizedTarget = normalizationMap[targetField] || targetField;

      if (seenTargetFields.has(normalizedTarget)) {
        duplicates.push(`${targetField} -> ${normalizedTarget} (duplicate)`);
        return; // Skip duplicate
      }

      seenTargetFields.add(normalizedTarget);
      cleanMapping[normalizedTarget] = sourceField;
    });

    console.log(`✅ Mapeos limpios: ${Object.keys(cleanMapping).length}`);
    console.log(`❌ Duplicados eliminados: ${duplicates.length}`);

    if (duplicates.length > 0) {
      console.log('🗑️ Duplicados eliminados:');
      duplicates.forEach(dup => console.log(`  - ${dup}`));
    }

    return cleanMapping;
  };

  const saveMapping = async () => {
    const errors = validateMapping()
    if (errors.length > 0) {
      toast({
        title: "Error de validación",
        description: errors.join(", "),
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      console.log("🔄 Guardando mapeo...")

      // Clean duplicates before sending
      const cleanedMapping = cleanupMappingDuplicates(fieldMapping);

      // Convert to backend format - ensure ALL mapped fields are included
      console.log("💾 Guardando mapeo limpio:", cleanedMapping)
      console.log("💾 Transformaciones:", transformations)

      const mappings: FieldMapping[] = Object.entries(cleanedMapping)
        .filter(([_, sourceField]) => sourceField && sourceField.trim() !== '') // Only include non-empty mappings
        .map(([targetField, sourceField]) => ({
          ConnectionId: connectionId,
          SourceField: sourceField,
          TargetField: targetField,
        TransformationType: getTransformationType(targetField),
        TransformationRule: transformations[targetField] || null,
      }))

      console.log("📤 Enviando mapeos al backend:", mappings)
      console.log("📤 Total de mapeos a enviar:", mappings.length)

      const response = await authFetchJSON(`http://localhost:3002/api/connections/${connectionId}/mappings`, {
        method: "POST",
        body: JSON.stringify({ mappings }),
      })
      
      console.log("✅ Respuesta del backend:", response)

      setCurrentMappings(mappings)
      
      // Reload mappings to confirm what was actually saved
      try {
        console.log("🔄 Recargando mapeos para confirmar...")
        const reloadedMappings = await authFetchJSON<FieldMapping[]>(
          `http://localhost:3002/api/connections/${connectionId}/mapping`
        )
        
        console.log("📥 Mapeos recargados desde el backend:", reloadedMappings)
        console.log("📥 Total de mapeos recargados:", reloadedMappings.length)
        
        const mappingObj: { [key: string]: string } = {}
        const transformObj: { [key: string]: string } = {}

        reloadedMappings.forEach((mapping: FieldMapping) => {
          mappingObj[mapping.TargetField] = mapping.SourceField
          if (mapping.TransformationRule) {
            transformObj[mapping.TargetField] = mapping.TransformationRule
          }
        })

        console.log("🔄 Mapeo reconstruido:", mappingObj)
        
        // Compare what we sent vs what we got back (use cleaned mapping for comparison)
        const sentFields = Object.keys(cleanedMapping).sort()
        const receivedFields = Object.keys(mappingObj).sort()

        console.log("📊 Campos limpios enviados:", sentFields)
        console.log("📊 Campos recibidos:", receivedFields)

        const missingFields = sentFields.filter(field => !receivedFields.includes(field))
        if (missingFields.length > 0) {
          console.error("❌ Campos perdidos después de guardar:", missingFields)
          toast({
            title: "Advertencia",
            description: `Algunos campos no se guardaron correctamente: ${missingFields.join(", ")}`,
            variant: "destructive",
          })
        } else {
          // Success! Update state with cleaned mapping
          console.log("✅ Todos los campos se guardaron correctamente")
          toast({
            title: "Mapeo guardado",
            description: `Se guardaron ${sentFields.length} campos sin duplicados`,
          })
        }

        // Update the state with cleaned mapping (always, to remove duplicates from UI)
        setFieldMapping(mappingObj);
        setTransformations(transformObj);
        setCurrentMappings(reloadedMappings);
      } catch (reloadError) {
        console.error("⚠️ Error recargando mapeos:", reloadError)
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      console.error("❌ Error guardando mapeo:", err)
      logError(err, { context: 'saveMapping', connectionId })
      
      toast({
        title: "Error al guardar",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Test mapping
  const testMapping = async () => {
    try {
      setTesting(true)
      console.log("🔄 Probando mapeo...")

      await authFetchJSON(`http://localhost:3002/api/connections/${connectionId}/test-mapping`, {
        method: "POST",
        body: JSON.stringify({ fieldMapping, transformations }),
      })

      toast({
        title: "Prueba exitosa",
        description: "El mapeo funciona correctamente con los datos de muestra",
      })
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      console.error("❌ Error probando mapeo:", err)
      logError(err, { context: 'testMapping', connectionId })
      
      toast({
        title: "Error en la prueba",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  // Delete connection
  const deleteConnection = async () => {
    try {
      setDeleting(true)
      console.log("🔄 Eliminando conexión...")

      await authFetchJSON(`http://localhost:3002/api/connections/${connectionId}`, {
        method: "DELETE",
      })

      toast({
        title: "Conexión eliminada",
        description: "La conexión ha sido eliminada exitosamente",
      })

      router.push("/conexiones")
    } catch (err) {
      const errorMessage = getErrorMessage(err)
      console.error("❌ Error eliminando conexión:", err)
      logError(err, { context: 'deleteConnection', connectionId })
      
      toast({
        title: "Error al eliminar",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  // Helper functions
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

        // Apply transformations
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

  // Loading state
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

  // Error state
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

  // Main content
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

      {/* Connection info */}
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
        {/* Field mapping */}
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

        {/* Side panel */}
        <div className="space-y-6">
          {/* Source fields */}
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

          {/* Validation state */}
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

          {/* Actions */}
          <div className="space-y-2">
            <Button onClick={forceIntelligentMapping} variant="outline" className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              Mapeo Inteligente
            </Button>
            <Button onClick={() => setShowPreview(!showPreview)} variant="outline" className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? "Ocultar" : "Ver"} Vista Previa
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
            
            {/* Delete button */}
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
                    Esta acción no se puede deshacer. Se eliminará permanentemente la conexión
                    "{conexion.name}" y toda su configuración asociada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteConnection} className="bg-red-600">
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Eliminando...
                      </>
                    ) : (
                      "Eliminar"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Vista Previa del Mapeo
            </CardTitle>
            <CardDescription>Así se verán los datos después del mapeo</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
              <code>{JSON.stringify(sampleData, null, 2)}</code>
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
