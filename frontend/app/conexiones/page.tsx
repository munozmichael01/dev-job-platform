"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Plus,
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Globe,
  Upload,
  Settings,
  AlertTriangle,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { fetchConnections, createConnection, importConnection, uploadFile } from "@/lib/api-temp"

interface Conexion {
  id: number
  name: string
  Name: string
  type: string
  Type: string
  url: string
  Url: string
  Endpoint: string
  frequency: string
  Frequency: string
  status: string
  Status: string
  lastSync?: string
  LastSync?: string
  importedOffers?: number
  ImportedOffers?: number
  errorCount?: number
  ErrorCount?: number
}

export default function ConexionesPage() {
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [conexiones, setConexiones] = useState<Conexion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState<Record<number, boolean>>({})

  const [newConnection, setNewConnection] = useState({
    name: "",
    type: "",
    url: "",
    frequency: "daily",
    clientId: 1,
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // ✅ FETCH CONEXIONES DESDE TU BACKEND REAL
  const fetchConexiones = async () => {
    try {
      setLoading(true)
      console.log("🔄 Fetching conexiones...")

      const data = await fetchConnections()
      console.log("✅ Conexiones recibidas:", data)

      setConexiones(data)
      setError(null)
    } catch (err) {
      console.error("❌ Error fetching conexiones:", err)
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      setError(errorMessage)
      toast({
        title: "Error al cargar conexiones",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConexiones()
  }, [])

  // ✅ CREAR NUEVA CONEXIÓN
  const handleCreateConnection = async () => {
    if (!newConnection.name || !newConnection.type) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      })
      return
    }

    if (newConnection.type === "Manual" && !selectedFile) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo para la conexión manual",
        variant: "destructive",
      })
      return
    }

    if (newConnection.type !== "Manual" && !newConnection.url) {
      toast({
        title: "Error", 
        description: "Por favor proporciona una URL para la conexión",
        variant: "destructive",
      })
      return
    }

    try {
      setCreating(true)
      console.log("🔄 Creando conexión:", newConnection)

      const createdConnection = await createConnection(newConnection)
      console.log("✅ Conexión creada:", createdConnection)

      toast({
        title: "Conexión creada exitosamente",
        description: `La conexión "${newConnection.name}" ha sido creada.`,
      })

      // ✅ IMPORTACIÓN AUTOMÁTICA INMEDIATA (solo para XML y API)
      console.log(`🔍 Tipo de conexión: ${newConnection.type}`)
      if (newConnection.type !== "Manual") {
        console.log("🚀 Iniciando proceso de sincronización automática...")
        
        // Mostrar toast inmediato de procesamiento
        toast({
          title: "Procesando conexión",
          description: `Sincronizando ofertas desde ${newConnection.type} feed. Esto puede tardar unos momentos...`,
        })
        
        setTimeout(async () => {
          try {
            console.log(`🔄 Ejecutando importación automática para conexión ${createdConnection.id} (tipo: ${newConnection.type})...`)

            const importResult = await importConnection(createdConnection.id)
            console.log("✅ Importación automática completada:", importResult)

            toast({
              title: "Sincronización completada",
              description: `Se importaron ${importResult.processed || 0} ofertas automáticamente`,
            })
          } catch (importError) {
            console.error("❌ Error en importación automática:", importError)
            toast({
              title: "Conexión creada",
              description: "La conexión fue creada. La sincronización inicial falló, puedes sincronizar manualmente.",
              variant: "destructive",
            })
          }

          // Refrescar lista después de la importación
          await fetchConexiones()
        }, 2000) // Aumentado a 2 segundos para dar tiempo al backend
      } else {
        // Para conexiones manuales, solo mostrar mensaje de éxito
        console.log("📁 Conexión manual creada - no se requiere sincronización automática")
        toast({
          title: "Conexión manual creada",
          description: "La conexión manual ha sido creada exitosamente. Usa el botón de sincronización para procesar el archivo.",
        })
      }

      // Limpiar formulario y cerrar dialog
      setNewConnection({ name: "", type: "", url: "", frequency: "daily", clientId: 1 })
      setSelectedFile(null)
      setIsDialogOpen(false)

      // Refrescar lista inmediatamente
      await fetchConexiones()
    } catch (err) {
      console.error("❌ Error creando conexión:", err)
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      toast({
        title: "Error al crear conexión",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  // ✅ MANEJAR SUBIDA DE ARCHIVOS MANUALES CON DEBUG MEJORADO
  const handleManualUpload = async (connectionId: number) => {
    console.log(`🔍 handleManualUpload called for connectionId: ${connectionId}`)
    console.log(`🔍 Current importing state:`, importing)
    
    // Verificar que no esté ya importando
    if (importing[connectionId]) {
      console.log(`⚠️ Already importing for connection ${connectionId}, skipping`);
      toast({
        title: "Proceso en curso",
        description: "Ya se está procesando un archivo para esta conexión",
        variant: "default",
      });
      return;
    }
    
    const connection = conexiones.find(c => c.id === connectionId);
    console.log(`🔍 Connection found:`, connection);
    
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.xml,.csv,.json'
    
    console.log(`🔍 File input created, setting up onchange handler`)
    
    fileInput.onchange = async (e) => {
      console.log(`📁 File input onchange event triggered`)
      console.log(`📁 Event target:`, e.target)
      console.log(`📁 Event type:`, e.type)
      
      const input = e.target as HTMLInputElement;
      console.log(`📁 Input files length:`, input.files?.length)
      
      const file = input.files?.[0]
      console.log(`📁 Selected file details:`, {
        exists: !!file,
        name: file?.name,
        size: file?.size,
        type: file?.type,
        lastModified: file?.lastModified ? new Date(file.lastModified).toISOString() : undefined
      })
      
      if (file) {
        try {
          console.log(`📁 Starting upload process for file: ${file.name}, size: ${file.size}, type: ${file.type}`)
          console.log(`📁 Setting importing state to true for connection ${connectionId}`)
          setImporting((prev) => ({ ...prev, [connectionId]: true }))
          
          // Mostrar toast de inicio
          toast({
            title: "Procesando archivo",
            description: `Subiendo ${file.name}...`,
          });
          
          console.log(`📁 About to call uploadFile(${connectionId}, file)...`)
          const result = await uploadFile(connectionId, file)
          console.log("✅ Upload completado:", result)

          // Actualización optimista inmediata del estado local
          setConexiones(prev => prev.map(conn => 
            conn.id === connectionId 
              ? {
                  ...conn,
                  status: "active",
                  lastSync: new Date().toISOString(),
                  // Para manuales, reemplazar total (no sumar)
                  importedOffers: result.processed || 0,
                  errorCount: result.errors || 0
                }
              : conn
          ))

          toast({
            title: "Archivo procesado exitosamente",
            description: `Se procesaron ${result.processed || 0} ofertas del archivo ${result.filename}`,
          })

          // Refrescar lista desde servidor para confirmar
          await fetchConexiones()
        } catch (uploadErr) {
          console.error("❌ Error en upload:", {
            error: uploadErr,
            connectionId,
            fileName: file.name,
            message: uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
          })
          const errorMessage = uploadErr instanceof Error ? uploadErr.message : "Error desconocido"
          toast({
            title: "Error procesando archivo",
            description: errorMessage,
            variant: "destructive",
          })
        } finally {
          console.log(`📁 Setting importing state to false for connection ${connectionId}`)
          setImporting((prev) => ({ ...prev, [connectionId]: false }))
        }
      } else {
        console.log("❌ No file selected in onchange handler")
        console.log("📁 Input target:", e.target)
        console.log("📁 Files array:", (e.target as HTMLInputElement).files)
        setImporting((prev) => ({ ...prev, [connectionId]: false }))
      }
    }
    
    console.log(`🔍 About to click file input...`)
    fileInput.click()
    console.log(`🔍 File input clicked, waiting for user selection...`)
  }

  // ✅ REFRESCAR SOLO DATOS (SIN SUBIR ARCHIVO)
  const handleRefreshOnly = async () => {
    try {
      console.log("🔄 Refrescando datos desde servidor...")
      await fetchConexiones()
      toast({
        title: "Datos actualizados",
        description: "Los datos se han sincronizado con el servidor",
      })
    } catch (err) {
      console.error("❌ Error refrescando datos:", err)
      toast({
        title: "Error al actualizar",
        description: "No se pudieron obtener los datos del servidor",
        variant: "destructive",
      })
    }
  }

  // ✅ SINCRONIZAR OFERTAS (SOLO XML/API)
  const handleSync = async (connectionId: number) => {
    try {
      setImporting((prev) => ({ ...prev, [connectionId]: true }))
      console.log(`🔄 Importando ofertas para conexión ${connectionId}...`)

      // Para conexiones XML/API, usar importación normal
      const result = await importConnection(connectionId)
      console.log("✅ Importación completada:", result)

      // Actualización optimista inmediata del estado local
      setConexiones(prev => prev.map(conn => 
        conn.id === connectionId 
          ? {
              ...conn,
              status: "active",
              lastSync: new Date().toISOString(),
              importedOffers: (conn.importedOffers || 0) + (result.processed || 0),
              errorCount: result.errors || 0
            }
          : conn
      ))

      toast({
        title: "Sincronización exitosa",
        description: result.message || `Se importaron ${result.processed || 0} ofertas correctamente`,
      })

      // Refrescar lista desde servidor para confirmar
      await fetchConexiones()
    } catch (err) {
      console.error("❌ Error en sincronización:", err)
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      toast({
        title: "Error en sincronización",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setImporting((prev) => ({ ...prev, [connectionId]: false }))
    }
  }

  // ✅ FUNCIONES PARA CALCULAR ESTADÍSTICAS CORRECTAMENTE - ARREGLADAS
  const getTotalOffers = () => {
    return conexiones.reduce((sum, c) => {
      // Intentar diferentes nombres de campo que puede tener el backend
      const offers = c.importedOffers || c.ImportedOffers || 0
      const numOffers = typeof offers === "number" ? offers : Number.parseInt(offers) || 0
      return sum + numOffers
    }, 0)
  }

  const getTotalErrors = () => {
    return conexiones.reduce((sum, c) => {
      // Intentar diferentes nombres de campo que puede tener el backend
      const errors = c.errorCount || c.ErrorCount || 0
      const numErrors = typeof errors === "number" ? errors : Number.parseInt(errors) || 0
      return sum + numErrors
    }, 0)
  }

  const getActiveConnections = () => {
    return conexiones.filter((c) => {
      const status = c.status || c.Status || ""
      return status.toLowerCase() === "active"
    }).length
  }

  // ✅ FUNCIONES HELPER PARA MANEJAR DIFERENTES FORMATOS DE DATOS
  const getConnectionName = (conexion: Conexion) => {
    return conexion.name || conexion.Name || "Sin nombre"
  }

  const getConnectionType = (conexion: Conexion) => {
    return conexion.type || conexion.Type || "Desconocido"
  }

  const getConnectionUrl = (conexion: Conexion) => {
    return conexion.url || conexion.Url || conexion.Endpoint || ""
  }

  const getConnectionFrequency = (conexion: Conexion) => {
    return conexion.frequency || conexion.Frequency || "manual"
  }

  const getConnectionStatus = (conexion: Conexion) => {
    return conexion.status || conexion.Status || "pending"
  }

  const getConnectionLastSync = (conexion: Conexion) => {
    return conexion.lastSync || conexion.LastSync
  }

  const getConnectionOffers = (conexion: Conexion) => {
    const offers = conexion.importedOffers || conexion.ImportedOffers || 0
    return typeof offers === "number" ? offers : Number.parseInt(offers) || 0
  }

  const getConnectionErrors = (conexion: Conexion) => {
    const errors = conexion.errorCount || conexion.ErrorCount || 0
    return typeof errors === "number" ? errors : Number.parseInt(errors) || 0
  }

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    switch (normalizedStatus) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "pending":
        return <Clock className="h-4 w-4 text-orange-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    switch (normalizedStatus) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Activa</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "pending":
        return <Badge variant="secondary">Pendiente</Badge>
      default:
        return <Badge variant="outline">Desconocido</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    const normalizedType = type.toUpperCase()
    switch (normalizedType) {
      case "XML":
        return <FileText className="h-4 w-4" />
      case "API":
        return <Globe className="h-4 w-4" />
      case "MANUAL":
        return <Upload className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Nunca"
    const date = new Date(dateString)
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Conexiones de Datos</h1>
            <p className="text-muted-foreground">Cargando conexiones...</p>
          </div>
        </div>
        <div className="flex justify-center items-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Conexiones de Datos</h1>
            <p className="text-muted-foreground text-red-600">Error: {error}</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar conexiones</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchConexiones}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-3xl font-bold">Conexiones de Datos</h1>
            <p className="text-muted-foreground">Gestiona las fuentes de datos para importar ofertas</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchConexiones}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Conexión
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Conexión de Datos</DialogTitle>
                <DialogDescription>Configura una nueva fuente de datos para importar ofertas</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la conexión *</Label>
                  <Input
                    id="name"
                    value={newConnection.name}
                    onChange={(e) => setNewConnection((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Feed Principal XML"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo de conexión *</Label>
                  <Select
                    value={newConnection.type}
                    onValueChange={(value) => setNewConnection((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XML">XML Feed</SelectItem>
                      <SelectItem value="API">API REST</SelectItem>
                      <SelectItem value="Manual">Carga Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL o Archivo *</Label>
                  {newConnection.type === "Manual" ? (
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept=".xml,.csv,.json"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          setSelectedFile(file || null)
                          setNewConnection((prev) => ({ ...prev, url: file?.name || "" }))
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Formatos soportados: XML, CSV, JSON
                      </p>
                    </div>
                  ) : (
                    <Input
                      id="url"
                      value={newConnection.url}
                      onChange={(e) => setNewConnection((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="https://ejemplo.com/feed.xml"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frecuencia de actualización</Label>
                  <Select
                    value={newConnection.frequency}
                    onValueChange={(value) => setNewConnection((prev) => ({ ...prev, frequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="hourly">Cada hora</SelectItem>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateConnection} className="flex-1" disabled={creating}>
                    {creating ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Conexión"
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={creating}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ✅ ESTADÍSTICAS ARREGLADAS */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Conexiones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conexiones.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conexiones Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{getActiveConnections()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ofertas Importadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalOffers().toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Errores Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{getTotalErrors()}</div>
          </CardContent>
        </Card>
      </div>

      {/* ✅ TABLA ARREGLADA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Conexiones Configuradas
          </CardTitle>
          <CardDescription>
            Administra tus fuentes de datos y su estado de sincronización ({conexiones.length} conexiones)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conexiones.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay conexiones</h3>
              <p className="text-muted-foreground">Crea tu primera conexión para empezar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conexión</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Sincronización</TableHead>
                  <TableHead>Ofertas</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conexiones.map((conexion) => (
                  <TableRow key={conexion.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{getConnectionName(conexion)}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {getConnectionUrl(conexion)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(getConnectionType(conexion))}
                        <span>{getConnectionType(conexion)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getConnectionFrequency(conexion)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(getConnectionStatus(conexion))}
                        {getStatusBadge(getConnectionStatus(conexion))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{formatDate(getConnectionLastSync(conexion))}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{getConnectionOffers(conexion).toLocaleString()}</div>
                        {getConnectionErrors(conexion) > 0 && (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            {getConnectionErrors(conexion)} errores
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {getConnectionType(conexion).toLowerCase() === "manual" ? (
                          // Para conexiones manuales: botón separado para upload y refresh
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                console.log(`🔍 Upload button clicked for connection ${conexion.id}`)
                                console.log(`🔍 Connection type: ${getConnectionType(conexion)}`)
                                handleManualUpload(conexion.id)
                              }}
                              disabled={importing[conexion.id]}
                              title="Subir nuevo archivo"
                            >
                              {importing[conexion.id] ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRefreshOnly}
                              title="Actualizar estado"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          // Para conexiones XML/API: botón normal de sync con loading
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSync(conexion.id)}
                            disabled={getConnectionStatus(conexion) === "error" || importing[conexion.id]}
                            title={importing[conexion.id] ? "Sincronizando..." : "Sincronizar ofertas"}
                          >
                            {importing[conexion.id] ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/conexiones/${conexion.id}/mapeo`}>
                            <Settings className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Información adicional */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tipos de Conexión Soportados</CardTitle>
            <CardDescription>Modalidades disponibles para importar ofertas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium">XML Feed</h4>
                <p className="text-sm text-muted-foreground">
                  Importación automática desde URLs XML con estructura estándar
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium">API REST</h4>
                <p className="text-sm text-muted-foreground">
                  Conexión directa con APIs REST con autenticación configurable
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Upload className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-medium">Carga Manual</h4>
                <p className="text-sm text-muted-foreground">
                  Subida manual de archivos CSV o XML para importación puntual
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estado de Sincronización</CardTitle>
            <CardDescription>Resumen del estado actual de las conexiones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Conexiones activas</span>
              </div>
              <span className="font-medium">{getActiveConnections()}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm">Conexiones con error</span>
              </div>
              <span className="font-medium">
                {conexiones.filter((c) => getConnectionStatus(c).toLowerCase() === "error").length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm">Conexiones pendientes</span>
              </div>
              <span className="font-medium">
                {conexiones.filter((c) => getConnectionStatus(c).toLowerCase() === "pending").length}
              </span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total ofertas importadas</span>
                <span className="font-bold">{getTotalOffers().toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
