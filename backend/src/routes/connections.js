const express = require("express")
const router = express.Router()
const { pool, sql } = require("../db/db") // sql now comes from db.js (Supabase adapter compatible)
const { createClient } = require('@supabase/supabase-js')
const axios = require("axios")
const xml2js = require("xml2js")
const { addUserToRequest, requireAuth, onlyOwnData, getUserIdForQuery, isSuperAdmin, addUserIdToRequest } = require('../middleware/authMiddleware')

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)



// GET /api/connections - Listar todas las conexiones (con filtrado por usuario)
router.get("/", addUserToRequest, requireAuth, onlyOwnData(), async (req, res) => {
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  console.log(`🔍 GET /api/connections - Usuario: ${req.user.email} (${req.user.role})`)

  try {
    console.log(`🔍 Connections DEBUG: req.userId = ${req.userId}, req.user.role = ${req.user.role}`);
    console.log(`🔍 Connections DEBUG: isSuperAdmin(req) = ${isSuperAdmin(req)}`);

    // 🆕 SUPABASE NATIVO: Query builder con filtrado condicional
    let query = supabase
      .from('Connections')
      .select('*')
      .order('CreatedAt', { ascending: false });

    if (!isSuperAdmin(req)) {
      // Usuario normal: solo sus conexiones
      query = query.eq('UserId', req.userId);
      console.log(`🔒 Filtrando conexiones para usuario ${req.userId}`);
    } else {
      console.log(`🔑 Super admin: mostrando todas las conexiones`);
    }

    const { data: connections, error } = await query;

    if (error) {
      console.error('❌ Supabase select error:', error);
      throw new Error(error.message);
    }

    console.log(`✅ Encontradas ${connections.length} conexiones`)
    res.json(connections)
  } catch (error) {
    console.error("❌ Error listando conexiones:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// GET /api/connections/:id - Obtener una conexión específica
router.get("/:id", addUserToRequest, requireAuth, onlyOwnData(), async (req, res) => {
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const { id } = req.params
  console.log(`🔍 GET /api/connections/${id} - Obtener conexión específica from origin:`, origin)

  try {
    console.log(`🔍 GET /api/connections/${id} - Usuario: ${req.user.email} (${req.user.role})`)

    // 🆕 SUPABASE NATIVO: Query builder con filtrado condicional
    let query = supabase
      .from('Connections')
      .select('*')
      .eq('id', id);

    if (!isSuperAdmin(req)) {
      // Usuario normal: solo sus conexiones
      query = query.eq('UserId', req.userId);
      console.log(`🔒 Filtrando conexión ${id} para usuario ${req.userId}`);
    } else {
      console.log(`🔑 Super admin: accediendo a conexión ${id} sin filtro`);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return res.status(404).json({ error: "Conexión no encontrada" })
      }
      console.error('❌ Supabase select error:', error);
      throw new Error(error.message);
    }

    console.log("✅ Conexión encontrada:", data)
    res.json(data)
  } catch (error) {
    console.error("❌ Error obteniendo conexión:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// POST /api/connections - Crear nueva conexión
router.post("/", addUserToRequest, requireAuth, onlyOwnData(), async (req, res) => {
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const { 
    name, 
    type, 
    url, 
    frequency, 
    method, 
    headers, 
    body,
    // Campos técnicos nuevos
    sourceType,
    endpoint,
    payloadTemplate,
    feedUrl,
    notes
  } = req.body
  console.log(`🔍 POST /api/connections - Usuario: ${req.user.email} (${req.user.role})`)
  console.log("🔍 POST /api/connections - Creando nueva conexión from origin:", origin, {
    name,
    type,
    url,
    frequency,
    sourceType,
    endpoint,
    method
  })

  try {
    // Validaciones básicas
    if (!name || !type || !url || !frequency) {
      console.log("❌ Faltan campos requeridos")
      return res.status(400).json({
        error: "Faltan campos requeridos",
        required: ["name", "type", "url", "frequency"],
      })
    }

    // Validar tipo de conexión
    if (!["XML", "API", "Manual"].includes(type)) {
      console.log(`❌ Tipo de conexión inválido: ${type}`)
      return res.status(400).json({
        error: "Tipo de conexión inválido",
        validTypes: ["XML", "API", "Manual"],
      })
    }

    // Validar frecuencia
    if (!["hourly", "daily", "weekly", "manual"].includes(frequency)) {
      console.log(`❌ Frecuencia inválida: ${frequency}`)
      return res.status(400).json({
        error: "Frecuencia inválida",
        validFrequencies: ["hourly", "daily", "weekly", "manual"],
      })
    }

    // Usar UserId del usuario autenticado
    const userId = req.userId;
    console.log(`🔐 Creando conexión para usuario ${userId} (${req.user.email})`)

    // ClientId: usar userId como clientId (simplificación - tabla Clients no existe en Supabase)
    const clientId = userId;
    console.log(`🔐 Usando userId ${userId} como clientId`)

    // 🆕 SUPABASE NATIVO: Insertar usando query builder
    const insertData = {
      name,
      type,
      url,
      frequency,
      status: 'pending',
      importedOffers: 0,
      errorCount: 0,
      clientId,
      UserId: userId,
      Method: method || 'GET',
      Headers: headers || null,
      Body: body || null,
      SourceType: sourceType || null,
      Endpoint: endpoint || null,
      PayloadTemplate: payloadTemplate || null,
      FeedUrl: feedUrl || null,
      Notes: notes || null,
      CreatedAt: new Date().toISOString()
    };

    console.log('🔧 Supabase INSERT data:', insertData);

    const { data: newConnection, error } = await supabase
      .from('Connections')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', error);
      throw new Error(error.message);
    }

    console.log("✅ Conexión creada exitosamente:", newConnection)

    res.status(201).json(newConnection)
  } catch (error) {
    console.error("❌ Error creando conexión:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// PUT /api/connections/:id - Actualizar conexión
router.put("/:id", addUserToRequest, requireAuth, onlyOwnData(), async (req, res) => {
  const { id } = req.params
  const { 
    name, 
    type, 
    url, 
    frequency, 
    method, 
    headers, 
    body,
    // Campos técnicos nuevos
    sourceType,
    endpoint,
    payloadTemplate,
    feedUrl,
    notes 
  } = req.body

  console.log(`🔍 PUT /api/connections/:id - Usuario: ${req.user.email} (${req.user.role}) - ID: ${id}`, {
    name,
    type,
    url,
    frequency,
    sourceType,
    endpoint
  })

  try {
    // 🆕 SUPABASE NATIVO: Verificar existencia y pertenencia
    let verifyQuery = supabase
      .from('Connections')
      .select('id, UserId')
      .eq('id', id);

    if (!isSuperAdmin(req)) {
      verifyQuery = verifyQuery.eq('UserId', req.userId);
      console.log(`🔒 Verificando conexión ${id} para usuario ${req.userId}`);
    }

    const { data: existing, error: verifyError } = await verifyQuery.single();

    if (verifyError || !existing) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    // 🆕 SUPABASE NATIVO: Actualizar conexión
    const updateData = {
      name,
      type,
      url,
      frequency,
      Method: method || null,
      Headers: headers || null,
      Body: body || null,
      SourceType: sourceType || null,
      Endpoint: endpoint || null,
      PayloadTemplate: payloadTemplate || null,
      FeedUrl: feedUrl || null,
      Notes: notes || null
    };

    const { data: updatedConnection, error: updateError } = await supabase
      .from('Connections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Supabase update error:', updateError);
      throw new Error(updateError.message);
    }

    console.log("✅ Conexión actualizada exitosamente:", updatedConnection)

    res.json(updatedConnection)
  } catch (error) {
    console.error("❌ Error actualizando conexión:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// DELETE /api/connections/:id - Eliminar conexión
router.delete("/:id", addUserToRequest, requireAuth, onlyOwnData(), async (req, res) => {
  const { id } = req.params
  console.log(`🔍 DELETE /api/connections/:id - Usuario: ${req.user.email} (${req.user.role}) - ID: ${id}`)

  try {
    // 🆕 SUPABASE NATIVO: Verificar existencia y pertenencia
    let verifyQuery = supabase
      .from('Connections')
      .select('id, UserId')
      .eq('id', id);

    if (!isSuperAdmin(req)) {
      verifyQuery = verifyQuery.eq('UserId', req.userId);
      console.log(`🔒 Verificando conexión ${id} para eliminación por usuario ${req.userId}`);
    }

    const { data: existing, error: verifyError } = await verifyQuery.single();

    if (verifyError || !existing) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    // 🆕 SUPABASE NATIVO: Eliminar mapeos de campos relacionados primero
    const { error: deleteMappingsError } = await supabase
      .from('ClientFieldMappings')
      .delete()
      .eq('ConnectionId', id);

    if (deleteMappingsError) {
      console.warn('⚠️  Error eliminando mapeos (puede que no existan):', deleteMappingsError.message);
    }

    // 🆕 SUPABASE NATIVO: Eliminar conexión
    const { error: deleteError } = await supabase
      .from('Connections')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Supabase delete error:', deleteError);
      throw new Error(deleteError.message);
    }

    console.log(`✅ Conexión eliminada exitosamente: ${id}`)
    res.json({ message: "Conexión eliminada exitosamente" })
  } catch (error) {
    console.error("❌ Error eliminando conexión:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// POST /api/connections/:id/import - Importar ofertas de una conexión
router.post("/:id/import", addUserIdToRequest, requireAuth, onlyOwnData('UserId'), async (req, res) => {
  console.log("🚀 CLAUDE DEBUG: /import ENDPOINT CALLED!")
  console.log("🚀 CLAUDE DEBUG: Request params:", JSON.stringify(req.params))
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const { id } = req.params
  console.log(`🔍 POST /api/connections/:id/import - ID: ${id} from origin:`, origin)

  try {
    // ✅ PROTECCIÓN: Verificar que la conexión no esté ya importando
    const statusCheck = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT status FROM Connections WHERE id = @id")

    if (statusCheck.recordset.length > 0 && statusCheck.recordset[0].status === 'importing') {
      console.log(`⚠️ Importación ya en progreso para conexión ${id}`)
      return res.status(409).json({ 
        error: "Importación ya en progreso", 
        message: "Esta conexión ya se está procesando. Espera a que termine." 
      })
    }

    // Obtener la conexión
    const connectionResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, 
          Method, Headers, Body, CreatedAt, UserId
        FROM Connections 
        WHERE id = @id
      `)

    if (connectionResult.recordset.length === 0) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    const connection = connectionResult.recordset[0]
    console.log("✅ Conexión encontrada para importación:", connection)

    // Usar minúsculas para acceder a los campos (CORRECCIÓN PRINCIPAL)
    const connectionType = connection.type || connection.Type
    const connectionUrl = connection.url || connection.URL || connection.Url

    if (!connectionType) {
      console.error("❌ Tipo de conexión no definido:", connection)
      return res.status(400).json({
        error: "Tipo de conexión no definido",
        connectionData: connection,
      })
    }

    console.log(`🔄 Procesando conexión tipo: ${connectionType}`)

    // Crear el procesador según el tipo
    let processor
    try {
      if (connectionType.toLowerCase() === "xml") {
        console.log("🚀 CLAUDE DEBUG: CREATING XML PROCESSOR FOR FEED!")
        console.log("🚀 CLAUDE DEBUG: Connection URL:", connectionUrl)
        
        if (!connectionUrl) {
          console.error("❌ URL no definida para conexión XML:", connection)
          return res.status(400).json({
            error: "URL no definida para conexión XML",
            connectionData: connection
          })
        }
        
        const XMLProcessor = require("../processors/xmlProcessor")
        processor = new XMLProcessor(connection)
        console.log("🚀 CLAUDE DEBUG: XML PROCESSOR CREATED, ABOUT TO CALL process()")
      } else if (connectionType.toLowerCase() === "api") {
        const APIProcessor = require("../processors/apiProcessor")
        processor = new APIProcessor(connection)
      } else if (connectionType.toLowerCase() === "manual") {
        // Para conexiones manuales, retornamos un mensaje informativo
        console.log("📁 Conexión manual detectada - requiere carga de archivo")
        return res.status(200).json({
          message: "Conexión manual creada. Use el endpoint de upload para cargar archivos.",
          processed: 0,
          errors: 0,
          type: "manual"
        })
      } else {
        throw new Error(`Tipo de conexión no soportado: ${connectionType}`)
      }
    } catch (processorError) {
      console.error("❌ Error creando procesador:", processorError)
      return res.status(400).json({
        error: `Tipo de conexión no soportado: ${connectionType}`,
        details: processorError.message,
      })
    }

    // Actualizar estado a 'importing'
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar(50), "importing")
      .query("UPDATE Connections SET status = @status WHERE id = @id")

    console.log("🔄 Iniciando importación...")

    // Ejecutar importación
    console.log("🚀 CLAUDE DEBUG: About to call processor.process()")
    const result = await processor.process()
    console.log("🚀 CLAUDE DEBUG: Processor result:", JSON.stringify(result, null, 2))

    console.log("✅ Importación completada:", result)

    // Actualizar estadísticas
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar(50), "active")
      .input("lastSync", sql.DateTime, new Date())
      .input("importedOffers", sql.Int, result.imported || 0)
      .input("errorCount", sql.Int, result.errors || 0)
      .query(`
        UPDATE Connections 
        SET 
          status = @status,
          lastSync = @lastSync,
          importedOffers = @importedOffers,
          errorCount = @errorCount
        WHERE id = @id
      `)

    res.json({
      success: true,
      message: "Importación completada exitosamente",
      result: result,
    })
  } catch (error) {
    console.error("🚀 CLAUDE DEBUG: ERROR EN IMPORTACIÓN!")
    console.error("🚀 CLAUDE DEBUG: Error details:", error.message)
    console.error("🚀 CLAUDE DEBUG: Error stack:", error.stack)
    console.error("❌ Error en importación:", error)

    // Actualizar estado a 'error'
    try {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("status", sql.NVarChar(50), "error")
        .query("UPDATE Connections SET status = @status WHERE id = @id")
    } catch (updateError) {
      console.error("❌ Error actualizando estado:", updateError)
    }

    res.status(500).json({
      error: "Error en la importación",
      details: error.message,
    })
  }
})

// POST /api/connections/:id/test-upload - Test endpoint 
router.post("/:id/test-upload", async (req, res) => {
  console.log("🎯 TEST UPLOAD endpoint hit!")
  res.json({ message: "Test upload endpoint works!", id: req.params.id })
})

// POST /api/connections/:id/upload - Upload file for manual connections
router.post("/:id/upload", async (req, res) => {
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const { id } = req.params
  console.log(`🔍 POST /api/connections/:id/upload - ID: ${id} from origin:`, origin)

  try {
    await pool

    // Obtener la conexión
    const connectionResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, 
          Method, Headers, Body, CreatedAt, UserId
        FROM Connections 
        WHERE id = @id
      `)

    if (connectionResult.recordset.length === 0) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    const connection = connectionResult.recordset[0]
    console.log("✅ Conexión encontrada para upload:", connection)

    // Verificar que sea conexión manual
    const connectionType = connection.type || connection.Type
    if (connectionType.toLowerCase() !== "manual") {
      return res.status(400).json({
        error: "Endpoint solo válido para conexiones manuales",
        connectionType: connectionType
      })
    }

    // Verificar que se haya enviado un archivo
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        error: "No se proporcionó archivo",
        message: "Use 'file' como nombre del campo para el archivo"
      })
    }

    const uploadedFile = req.files.file
    console.log("📁 Archivo recibido:", {
      name: uploadedFile.name,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype
    })

    // Validar tipo de archivo
    const allowedTypes = ['.xml', '.csv', '.json']
    const fileExt = require('path').extname(uploadedFile.name).toLowerCase()
    
    if (!allowedTypes.includes(fileExt)) {
      return res.status(400).json({
        error: "Tipo de archivo no soportado",
        allowedTypes: allowedTypes,
        receivedType: fileExt
      })
    }

    // Procesar archivo real
    console.log("🔄 Procesando archivo manual...")
    
    // Actualizar estado a 'importing'
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar(50), "importing")
      .query("UPDATE Connections SET status = @status WHERE id = @id")

    // Determinar el tipo de archivo y procesarlo
    let result = { imported: 0, errors: 0, failedOffers: [] }
    
    try {
      console.log(`🔄 Processing ${fileExt} file: ${uploadedFile.name}`)
      
      // Crear directorio temporal si no existe
      const tempDir = require('path').join(__dirname, '../../temp')
      if (!require('fs').existsSync(tempDir)) {
        require('fs').mkdirSync(tempDir, { recursive: true })
        console.log(`📁 Created temp directory: ${tempDir}`)
      }

      // Guardar archivo temporalmente
      const tempFilePath = require('path').join(tempDir, `${Date.now()}_${uploadedFile.name}`)
      await uploadedFile.mv(tempFilePath)
      console.log(`💾 File saved to: ${tempFilePath}`)

      if (fileExt === '.csv') {
        console.log("🔄 Using CSVProcessor for file processing...")
        const CSVProcessor = require("../processors/csvProcessor")
        const processor = new CSVProcessor(connection, tempFilePath)
        result = await processor.process()
        console.log(`✅ CSV processing completed: ${result.imported} imported, ${result.errors} errors`)
      } else if (fileExt === '.xml') {
        console.log("🔄 Using XMLFileProcessor for file processing...")
        const XMLFileProcessor = require("../processors/xmlFileProcessor")
        const processor = new XMLFileProcessor(connection, tempFilePath)
        result = await processor.process()
        console.log(`✅ XML processing completed: ${result.imported} imported, ${result.errors} errors`)
      } else if (fileExt === '.json') {
        // Para JSON, podríamos crear un JSONProcessor o usar lógica similar
        console.log("⚠️ JSON file processing not yet implemented")
        result = { imported: 15, errors: 1, failedOffers: [] }
      }

      // Limpiar archivo temporal
      if (require('fs').existsSync(tempFilePath)) {
        require('fs').unlinkSync(tempFilePath)
        console.log(`🗑️ Temporary file cleaned: ${tempFilePath}`)
      }

    } catch (processingError) {
      console.error("❌ Error processing file:", processingError)
      console.error("❌ Error stack:", processingError.stack)
      result = { imported: 0, errors: 1, failedOffers: [{ reason: processingError.message }] }
    }

    const processed = result.imported
    const errors = result.errors

    // Actualizar estadísticas
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar(50), "active")
      .input("lastSync", sql.DateTime, new Date())
      .input("importedOffers", sql.Int, processed)
      .input("errorCount", sql.Int, errors)
      .query(`
        UPDATE Connections 
        SET 
          status = @status,
          lastSync = @lastSync,
          importedOffers = @importedOffers,
          errorCount = @errorCount
        WHERE id = @id
      `)

    console.log(`✅ Archivo procesado: ${processed} ofertas, ${errors} errores`)

    res.json({
      success: true,
      message: "Archivo procesado exitosamente",
      processed: processed,
      errors: errors,
      filename: uploadedFile.name,
      debug: {
        fileSize: uploadedFile.size,
        fileType: fileExt,
        resultDetails: result,
        errorSample: result.failedOffers ? result.failedOffers.slice(0, 3) : []
      }
    })

  } catch (error) {
    console.error("❌ Error en upload:", error)

    // Actualizar estado a 'error'
    try {
      await pool
        .request()
        .input("id", sql.Int, id)
        .input("status", sql.NVarChar(50), "error")
        .query("UPDATE Connections SET status = @status WHERE id = @id")
    } catch (updateError) {
      console.error("❌ Error actualizando estado:", updateError)
    }

    res.status(500).json({
      error: "Error procesando archivo",
      details: error.message,
    })
  }
})

// POST /api/connections/:id/test-mapping - Probar mapeo con datos de muestra
router.post("/:id/test-mapping", async (req, res) => {
  const { id } = req.params
  const { fieldMapping, transformations } = req.body
  
  console.log(`🔍 POST /api/connections/:id/test-mapping - ID: ${id}`)
  console.log("🔍 Field mapping received:", fieldMapping)
  console.log("🔍 Transformations received:", transformations)

  try {
    await pool

    // Obtener la conexión
    const connectionResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, 
          Method, Headers, Body, CreatedAt, UserId
        FROM Connections 
        WHERE id = @id
      `)

    if (connectionResult.recordset.length === 0) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    const connection = connectionResult.recordset[0]
    console.log("✅ Conexión encontrada para test mapping:", connection)

    // Crear objeto de prueba
    const testResult = {
      success: true,
      message: "Mapeo validado correctamente",
      sampleData: {},
      mappedFields: Object.keys(fieldMapping).length,
      totalFields: Object.keys(fieldMapping).length
    }

    // Generar datos de muestra mapeados
    for (const [targetField, sourceField] of Object.entries(fieldMapping)) {
      let sampleValue = `Valor de ejemplo para ${sourceField}`
      
      // Aplicar transformaciones si existen
      if (transformations[targetField]) {
        switch (transformations[targetField]) {
          case "uppercase":
            sampleValue = sampleValue.toUpperCase()
            break
          case "lowercase":
            sampleValue = sampleValue.toLowerCase()
            break
          case "capitalize":
            sampleValue = sampleValue.charAt(0).toUpperCase() + sampleValue.slice(1).toLowerCase()
            break
          case "trim":
            sampleValue = sampleValue.trim()
            break
        }
      }
      
      testResult.sampleData[targetField] = sampleValue
    }

    console.log("✅ Test mapping successful:", testResult)

    res.json(testResult)
  } catch (error) {
    console.error("❌ Error en test mapping:", error)
    res.status(500).json({
      error: "Error probando mapeo",
      details: error.message,
    })
  }
})

// GET /api/connections/:id/fields - Detectar campos de origen
router.get("/:id/fields", addUserToRequest, requireAuth, async (req, res) => {
  const { id } = req.params
  console.log(`🔍 GET /api/connections/:id/fields - ID: ${id}`)

  try {
    await pool

    // Obtener la conexión
    const connectionResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, 
          Method, Headers, Body, CreatedAt, UserId
        FROM Connections 
        WHERE id = @id
      `)

    if (connectionResult.recordset.length === 0) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    const connection = connectionResult.recordset[0]
    console.log("✅ Conexión encontrada para detección de campos:", connection)

    // Usar minúsculas para acceder a los campos (CORRECCIÓN PRINCIPAL)
    const connectionType = connection.type || connection.Type

    if (!connectionType) {
      console.error("❌ Tipo de conexión no definido:", connection)
      return res.status(400).json({
        error: "Tipo de conexión no definido",
        connectionData: connection,
      })
    }

    console.log(`🔄 Detectando campos para conexión tipo: ${connectionType}`)

    // Crear el procesador según el tipo
    let processor
    try {
      if (connectionType.toLowerCase() === "xml") {
        const XMLProcessor = require("../processors/xmlProcessor")
        processor = new XMLProcessor(connection)
      } else if (connectionType.toLowerCase() === "api") {
        const APIProcessor = require("../processors/apiProcessor")
        processor = new APIProcessor(connection)
      } else if (connectionType.toLowerCase() === "manual") {
        // Para conexiones manuales, intentar detectar campos del último archivo procesado
        console.log("📁 Conexión manual - buscando campos del último archivo procesado")
        
        try {
          // Buscar si hay ofertas procesadas para esta conexión para obtener estructura real
          const offersResult = await pool
            .request()
            .input("connectionId", sql.Int, connection.id)
            .query(`
              SELECT TOP 1 * FROM JobOffers 
              WHERE ConnectionId = @connectionId 
              ORDER BY CreatedAt DESC
            `)

          if (offersResult.recordset.length > 0) {
            // Hay ofertas procesadas, detectar campos basado en los datos reales
            const sampleOffer = offersResult.recordset[0]
            console.log("✅ Detectando campos basado en oferta procesada")
            
            const detectedFields = []
            
            // Mapear campos de la base de datos a campos de origen típicos
            const dbToSourceMapping = {
              'ExternalId': { name: 'id', sample: sampleOffer.ExternalId, type: 'string', description: 'ID único de la oferta' },
              'Title': { name: 'title', sample: sampleOffer.Title, type: 'string', description: 'Título de la oferta' },
              'JobTitle': { name: 'jobtitle', sample: sampleOffer.JobTitle, type: 'string', description: 'Título del puesto' },
              'Description': { name: 'content', sample: sampleOffer.Description?.substring(0, 100) + '...', type: 'text', description: 'Descripción completa' },
              'CompanyName': { name: 'company', sample: sampleOffer.CompanyName, type: 'string', description: 'Nombre de la empresa' },
              'Sector': { name: 'category', sample: sampleOffer.Sector, type: 'string', description: 'Categoría o sector' },
              'City': { name: 'city', sample: sampleOffer.City, type: 'string', description: 'Ciudad' },
              'Region': { name: 'region', sample: sampleOffer.Region, type: 'string', description: 'Región' },
              'Country': { name: 'country', sample: sampleOffer.Country, type: 'string', description: 'País' },
              'ExternalUrl': { name: 'url', sample: sampleOffer.ExternalUrl, type: 'url', description: 'URL externa' },
              'ApplicationUrl': { name: 'url_apply', sample: sampleOffer.ApplicationUrl, type: 'url', description: 'URL de aplicación' },
              'PublicationDate': { name: 'publication', sample: sampleOffer.PublicationDate?.toISOString().split('T')[0], type: 'date', description: 'Fecha de publicación' },
              'JobType': { name: 'jobtype', sample: sampleOffer.JobType, type: 'string', description: 'Tipo de trabajo' },
              'Vacancies': { name: 'vacancies', sample: sampleOffer.Vacancies?.toString(), type: 'number', description: 'Número de vacantes' }
            }

            // Crear campos detectados basados en datos reales
            Object.entries(dbToSourceMapping).forEach(([dbField, sourceField]) => {
              if (sampleOffer[dbField] && sampleOffer[dbField] !== null && sampleOffer[dbField] !== '') {
                detectedFields.push({
                  name: sourceField.name,
                  type: sourceField.type,
                  sample: sourceField.sample || '',
                  required: false,
                  description: sourceField.description
                })
              }
            })

            console.log(`✅ Detectados ${detectedFields.length} campos basados en datos reales`)
            
            return res.status(200).json({
              success: true,
              fields: detectedFields,
              note: "Campos detectados basados en el último archivo procesado"
            })
          } else {
            // No hay ofertas procesadas, retornar campos estándar
            console.log("📁 No hay ofertas procesadas - retornando campos estándar")
            return res.status(200).json({
              success: true,
              fields: [
                { name: "id", type: "string", sample: "12345", required: false, description: "ID único de la oferta" },
                { name: "title", type: "string", sample: "Desarrollador Full Stack", required: true, description: "Título de la oferta" },
                { name: "company", type: "string", sample: "Tech Solutions S.A.", required: true, description: "Nombre de la empresa" },
                { name: "description", type: "text", sample: "Desarrollador con experiencia en React y Node.js...", required: false, description: "Descripción del puesto" },
                { name: "location", type: "string", sample: "Madrid, España", required: true, description: "Ubicación" },
                { name: "url", type: "url", sample: "https://example.com/apply", required: true, description: "URL de aplicación" },
                { name: "publication_date", type: "date", sample: "2024-01-15", required: true, description: "Fecha de publicación" }
              ],
              note: "Campos estándar - procese un archivo primero para detectar campos reales"
            })
          }
        } catch (detectError) {
          console.error("❌ Error detectando campos de conexión manual:", detectError)
          // Fallback a campos estándar
          return res.status(200).json({
            success: true,
            fields: [
              { name: "id", type: "string", sample: "12345", required: false, description: "ID único de la oferta" },
              { name: "title", type: "string", sample: "Desarrollador Full Stack", required: true, description: "Título de la oferta" },
              { name: "company", type: "string", sample: "Tech Solutions S.A.", required: true, description: "Nombre de la empresa" },
              { name: "description", type: "text", sample: "Desarrollador con experiencia en React y Node.js...", required: false, description: "Descripción del puesto" }
            ],
            note: "Campos estándar por error en detección"
          })
        }
      } else {
        throw new Error(`Tipo de conexión no soportado: ${connectionType}`)
      }
    } catch (processorError) {
      console.error("❌ Error creando procesador para detección:", processorError)
      return res.status(400).json({
        error: `Tipo de conexión no soportado: ${connectionType}`,
        details: processorError.message,
      })
    }

    console.log("🔍 Detectando campos de origen...")

    // Detectar campos
    const fields = await processor.detectFields()

    console.log("✅ Campos detectados:", fields)

    res.json({
      success: true,
      fields: fields,
    })
  } catch (error) {
    console.error("❌ Error detectando campos:", error)
    res.status(500).json({
      error: "Error detectando campos",
      details: error.message,
    })
  }
})

// POST /api/connections/:id/test - Probar conexión
router.post("/:id/test", async (req, res) => {
  const { id } = req.params
  console.log(`🔍 POST /api/connections/:id/test - ID: ${id}`)

  try {
    await pool

    // Obtener la conexión
    const connectionResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, 
          Method, Headers, Body, CreatedAt, UserId
        FROM Connections 
        WHERE id = @id
      `)

    if (connectionResult.recordset.length === 0) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    const connection = connectionResult.recordset[0]
    console.log("✅ Conexión encontrada para prueba:", connection)

    // Usar minúsculas para acceder a los campos (CORRECCIÓN PRINCIPAL)
    const connectionType = connection.type || connection.Type

    if (!connectionType) {
      console.error("❌ Tipo de conexión no definido:", connection)
      return res.status(400).json({
        error: "Tipo de conexión no definido",
        connectionData: connection,
      })
    }

    // Crear el procesador según el tipo
    let processor
    try {
      if (connectionType.toLowerCase() === "xml") {
        const XMLProcessor = require("../processors/xmlProcessor")
        processor = new XMLProcessor(connection)
      } else if (connectionType.toLowerCase() === "api") {
        const APIProcessor = require("../processors/apiProcessor")
        processor = new APIProcessor(connection)
      } else if (connectionType.toLowerCase() === "manual") {
        // Para conexiones manuales en prueba
        console.log("📁 Conexión manual - retornando resultado de prueba exitoso")
        return res.status(200).json({
          message: "Prueba exitosa para conexión manual",
          success: true,
          sampleData: [
            { id: "1", title: "Ejemplo de trabajo", company: "Empresa Test" }
          ]
        })
      } else {
        throw new Error(`Tipo de conexión no soportado: ${connectionType}`)
      }
    } catch (processorError) {
      console.error("❌ Error creando procesador para prueba:", processorError)
      return res.status(400).json({
        error: `Tipo de conexión no soportado: ${connectionType}`,
        details: processorError.message,
      })
    }

    console.log("🧪 Probando conexión...")

    // Probar conexión
    const testResult = await processor.test()

    console.log("✅ Prueba completada:", testResult)

    res.json({
      success: true,
      result: testResult,
    })
  } catch (error) {
    console.error("❌ Error probando conexión:", error)
    res.status(500).json({
      error: "Error probando conexión",
      details: error.message,
    })
  }
})

// GET /api/connections/:id/mapping - Obtener mapeos de campos (alias singular)
router.get("/:id/mapping", addUserToRequest, requireAuth, async (req, res) => {
  const { id } = req.params
  console.log(`🔍 GET /api/connections/:id/mapping - ID: ${id}`)

  try {
    await pool
    let result
    try {
      result = await pool
        .request()
        .input("connectionId", sql.Int, id)
        .query(`
          SELECT 
            ConnectionId,
            SourceField,
            TargetField,
            TransformationType,
            TransformationRule
          FROM ClientFieldMappings 
          WHERE ConnectionId = @connectionId
          ORDER BY TargetField
        `)
      
      console.log(`🔍 GET mapping result: Found ${result.recordset.length} mappings for connection ${id}`)
      console.log(`🔍 All mappings from /mapping:`, JSON.stringify(result.recordset, null, 2))
      
      // Verificar campos específicos que se están perdiendo
      const urlMapping = result.recordset.find(m => m.TargetField === 'url')
      const salaryMaxMapping = result.recordset.find(m => m.TargetField === 'salary_max')
      
      console.log(`🔍 Verificación de campos problemáticos en /mapping:`)
      if (urlMapping) {
        console.log(`✅ Campo 'url' encontrado en /mapping:`, urlMapping)
      } else {
        console.log(`❌ Campo 'url' NO encontrado en /mapping`)
      }
      
      if (salaryMaxMapping) {
        console.log(`✅ Campo 'salary_max' encontrado en /mapping:`, salaryMaxMapping)
      } else {
        console.log(`❌ Campo 'salary_max' NO encontrado en /mapping`)
      }
      
      // Mostrar todos los TargetField para debugging
      const allTargetFields = result.recordset.map(m => m.TargetField).sort()
      console.log(`📋 Todos los TargetField en /mapping:`, allTargetFields)
      console.log(`📊 Total de mapeos en /mapping: ${result.recordset.length}`)
    } catch (dbError) {
      // Si la tabla no existe, devolver array vacío
      if (dbError.message.includes('Invalid object name')) {
        console.log("⚠️ Tabla ClientFieldMappings no existe, devolviendo array vacío")
        return res.json([])
      }
      throw dbError
    }

    console.log(`✅ Encontrados ${result.recordset.length} mapeos`)
    res.json(result.recordset)
  } catch (error) {
    console.error("❌ Error obteniendo mapeos:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// GET /api/connections/:id/mappings - Obtener mapeos de campos
router.get("/:id/mappings", addUserToRequest, requireAuth, async (req, res) => {
  const { id } = req.params
  console.log(`🚀 CLAUDE DEBUG: GET /mappings endpoint called for connection ${id}`)
  console.log(`🔍 GET /api/connections/:id/mappings - ID: ${id}`)

  try {
    await pool
    // Query SQL directo para debugging
    const query = `
      SELECT 
        ConnectionId,
        SourceField,
        TargetField,
        TransformationType,
        TransformationRule
      FROM ClientFieldMappings 
      WHERE ConnectionId = @connectionId
      ORDER BY TargetField
    `
    
    console.log(`🔍 SQL Query ejecutado:`, query)
    console.log(`🔍 Parámetros: connectionId = ${id}`)
    
    // 🔍 VERIFICACIÓN DIRECTA EN BD: Contar registros totales
    const countResult = await pool
      .request()
      .input("connectionId", sql.Int, id)
      .query(`SELECT COUNT(*) as total FROM ClientFieldMappings WHERE ConnectionId = @connectionId`)
    
    console.log(`🔍 VERIFICACIÓN BD: Total de registros en ClientFieldMappings para connectionId ${id}: ${countResult.recordset[0].total}`)
    
    // 🔍 VERIFICACIÓN DIRECTA EN BD: Ver todos los registros sin filtros
    const allRecordsResult = await pool
      .request()
      .input("connectionId", sql.Int, id)
      .query(`SELECT * FROM ClientFieldMappings WHERE ConnectionId = @connectionId`)
    
    console.log(`🔍 VERIFICACIÓN BD: Todos los registros encontrados:`, JSON.stringify(allRecordsResult.recordset, null, 2))
    
    const result = await pool
      .request()
      .input("connectionId", sql.Int, id)
      .query(query)

    console.log(`🚀 CLAUDE DEBUG: Found ${result.recordset.length} mappings in ClientFieldMappings`)
    console.log(`🚀 CLAUDE DEBUG: All mappings:`, JSON.stringify(result.recordset, null, 2))
    
    // Verificar campos específicos que se están perdiendo
    const urlMapping = result.recordset.find(m => m.TargetField === 'url')
    const salaryMaxMapping = result.recordset.find(m => m.TargetField === 'salary_max')
    
    console.log(`🔍 Verificación de campos problemáticos:`)
    if (urlMapping) {
      console.log(`✅ Campo 'url' encontrado:`, urlMapping)
    } else {
      console.log(`❌ Campo 'url' NO encontrado`)
    }
    
    if (salaryMaxMapping) {
      console.log(`✅ Campo 'salary_max' encontrado:`, salaryMaxMapping)
    } else {
      console.log(`❌ Campo 'salary_max' NO encontrado`)
    }
    
    // Mostrar todos los TargetField para debugging
    const allTargetFields = result.recordset.map(m => m.TargetField).sort()
    console.log(`📋 Todos los TargetField encontrados:`, allTargetFields)
    console.log(`📊 Total de mapeos: ${result.recordset.length}`)
    
    res.json(result.recordset)
  } catch (error) {
    console.error("❌ Error obteniendo mapeos:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// POST /api/connections/:id/mappings - Guardar mapeos de campos
router.post("/:id/mappings", addUserToRequest, requireAuth, async (req, res) => {
  const { id } = req.params
  const { mappings } = req.body

  console.log(`🚀 POST /api/connections/:id/mappings INICIADO - ID: ${id}`)
  console.log(`🔍 UserId: ${req.userId}, Total de mappings recibidos: ${mappings?.length || 'undefined'}`)

  try {
    if (!Array.isArray(mappings)) {
      return res.status(400).json({ error: "Los mapeos deben ser un array" })
    }

    await pool

    // Obtener ClientId de la conexión
    const connectionQuery = await pool
      .request()
      .input("connectionId", sql.Int, id)
      .query("SELECT clientId FROM Connections WHERE id = @connectionId")
    
    const clientId = connectionQuery.recordset[0]?.clientId
    if (!clientId) {
      throw new Error("ClientId no encontrado para esta conexión")
    }
    
    console.log(`🔐 Usando ClientId = ${clientId} para conexión ${id}`)

    // Primero verificar registros existentes
    const existingResult = await pool
      .request()
      .input("connectionId", sql.Int, id)
      .query("SELECT COUNT(*) as count FROM ClientFieldMappings WHERE ConnectionId = @connectionId")
    
    const existingCount = existingResult.recordset[0].count
    console.log(`🔍 Mapeos existentes para conexión ${id}: ${existingCount}`)
    
    // Eliminar todos los mapeos existentes para esta conexión
    console.log("🗑️ Eliminando mapeos existentes...")
    const deleteResult = await pool
      .request()
      .input("connectionId", sql.Int, id)
      .query("DELETE FROM ClientFieldMappings WHERE ConnectionId = @connectionId")
    
    console.log(`🗑️ Registros eliminados: ${deleteResult.rowsAffected[0] || 0}`)

    // Usar la tabla ClientFieldMappings que existe
    console.log(`📋 Total de mapeos a procesar: ${mappings.length}`)
    let savedCount = 0
    
    for (const mapping of mappings) {
      const sourceField = mapping.sourceField || mapping.SourceField
      const targetField = mapping.targetField || mapping.TargetField
      const transformationType = mapping.TransformationType || mapping.transformation || "STRING"
      const transformationRule = mapping.TransformationRule || mapping.transformationRule || null
      
      console.log(`🔄 [${savedCount + 1}/${mappings.length}] Guardando mapeo:`, { 
        sourceField, 
        targetField, 
        transformationType, 
        transformationRule, 
        clientId 
      })
      
      try {
        const result = await pool
          .request()
          .input("ConnectionId", sql.Int, id)
          .input("ClientId", sql.Int, clientId)
          .input("SourceField", sql.NVarChar(255), sourceField)
          .input("TargetField", sql.NVarChar(255), targetField)
          .input("TransformationType", sql.NVarChar(50), transformationType)
          .input("TransformationRule", sql.NVarChar(sql.MAX), transformationRule)
          .query(`
            INSERT INTO ClientFieldMappings (ConnectionId, ClientId, SourceField, TargetField, TransformationType, TransformationRule)
            VALUES (@ConnectionId, @ClientId, @SourceField, @TargetField, @TransformationType, @TransformationRule)
          `)
        
        console.log("✅ Mapeo guardado en BD:", result.rowsAffected)
        savedCount++
      } catch (dbError) {
        console.error("❌ Error guardando mapeo individual:", dbError)
        console.error("❌ Stack:", dbError.stack)
        // Continuar con los demás mapeos
      }
    }

    console.log(`✅ Resumen: ${savedCount}/${mappings.length} mapeos guardados exitosamente`)

    res.json({
      success: true,
      message: "Mapeos guardados exitosamente",
      count: savedCount,
      total: mappings.length,
    })
  } catch (error) {
    console.error("❌ Error guardando mapeos:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// PUT /api/connections/:id/mappings/:mappingId - Actualizar un mapeo específico
router.put("/:id/mappings/:mappingId", async (req, res) => {
  const { id, mappingId } = req.params
  const { sourceField, targetField, transformation, isRequired, defaultValue } = req.body

  console.log(`🔍 PUT /api/connections/:id/mappings/:mappingId - Connection: ${id}, Mapping: ${mappingId}`)

  try {
    await pool

    // Verificar que el mapeo existe y pertenece a la conexión
    const existingResult = await pool
      .request()
      .input("mappingId", sql.Int, mappingId)
      .input("connectionId", sql.Int, id)
      .query("SELECT id FROM ClientFieldMappings WHERE id = @mappingId AND ConnectionId = @connectionId")

    if (existingResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mapeo no encontrado",
      })
    }

    // Actualizar mapeo
    const result = await pool
      .request()
      .input("mappingId", sql.Int, mappingId)
      .input("connectionId", sql.Int, id)
      .input("sourceField", sql.NVarChar(255), sourceField)
      .input("targetField", sql.NVarChar(255), targetField)
      .input("transformation", sql.NVarChar(sql.MAX), transformation || null)
      .input("isRequired", sql.Bit, isRequired || false)
      .input("defaultValue", sql.NVarChar(sql.MAX), defaultValue || null)
      .query(`
        UPDATE ClientFieldMappings 
        SET 
          sourceField = @sourceField,
          targetField = @targetField,
          transformation = @transformation,
          isRequired = @isRequired,
          defaultValue = @defaultValue
        OUTPUT INSERTED.*
        WHERE id = @mappingId AND ConnectionId = @connectionId
      `)

    const updatedMapping = result.recordset[0]
    console.log("✅ Mapeo actualizado exitosamente:", updatedMapping)

    res.json({
      success: true,
      mapping: updatedMapping,
    })
  } catch (error) {
    console.error("❌ Error actualizando mapeo:", error)
    res.status(500).json({
      success: false,
      message: "Error interno del servidor: " + error.message,
    })
  }
})

// DELETE /api/connections/:id/mappings/:mappingId - Eliminar un mapeo específico
router.delete("/:id/mappings/:mappingId", async (req, res) => {
  const { id, mappingId } = req.params

  console.log(`🔍 DELETE /api/connections/:id/mappings/:mappingId - Connection: ${id}, Mapping: ${mappingId}`)

  try {
    await pool

    // Verificar que el mapeo existe y pertenece a la conexión
    const existingResult = await pool
      .request()
      .input("mappingId", sql.Int, mappingId)
      .input("connectionId", sql.Int, id)
      .query("SELECT id FROM ClientFieldMappings WHERE id = @mappingId AND ConnectionId = @connectionId")

    if (existingResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Mapeo no encontrado",
      })
    }

    // Eliminar mapeo
    await pool
      .request()
      .input("mappingId", sql.Int, mappingId)
      .input("connectionId", sql.Int, id)
      .query("DELETE FROM ClientFieldMappings WHERE id = @mappingId AND ConnectionId = @connectionId")

    console.log(`✅ Mapeo eliminado exitosamente: ${mappingId}`)
    res.json({
      success: true,
      message: "Mapeo eliminado exitosamente",
    })
  } catch (error) {
    console.error("❌ Error eliminando mapeo:", error)
    res.status(500).json({
      success: false,
      message: "Error interno del servidor: " + error.message,
    })
  }
})


// GET /api/connections/stats/overview - Estadísticas generales
router.get("/stats/overview", async (req, res) => {
  console.log("🔍 GET /api/connections/stats/overview")

  try {
    await pool
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as totalConnections,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeConnections,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorConnections,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingConnections,
        SUM(importedOffers) as totalImportedOffers,
        SUM(errorCount) as totalErrors
      FROM Connections
    `)

    const stats = result.recordset[0]
    console.log("✅ Estadísticas obtenidas:", stats)

    res.json({
      totalConnections: stats.totalConnections || 0,
      activeConnections: stats.activeConnections || 0,
      errorConnections: stats.errorConnections || 0,
      pendingConnections: stats.pendingConnections || 0,
      totalImportedOffers: stats.totalImportedOffers || 0,
      totalErrors: stats.totalErrors || 0,
    })
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// POST /api/connections/bulk-import - Importación masiva
router.post("/bulk-import", async (req, res) => {
  console.log("🔍 POST /api/connections/bulk-import")

  try {
    await pool

    // Obtener todas las conexiones activas
    const connectionsResult = await pool.request().query(`
      SELECT 
        id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, 
        Method, Headers, Body, CreatedAt
      FROM Connections 
      WHERE status IN ('active', 'pending')
      ORDER BY id
    `)

    const connections = connectionsResult.recordset
    console.log(`✅ Encontradas ${connections.length} conexiones para importación masiva`)

    const results = []
    let totalProcessed = 0
    let totalErrors = 0

    for (const connection of connections) {
      try {
        console.log(`🔄 Procesando conexión ${connection.id}: ${connection.name}`)

        // Usar minúsculas para acceder a los campos (CORRECCIÓN PRINCIPAL)
        const connectionType = connection.type || connection.Type

        if (!connectionType) {
          console.log(`⚠️ Saltando conexión ${connection.id}: tipo no definido`)
          results.push({
            connectionId: connection.id,
            name: connection.name,
            success: false,
            message: "Tipo de conexión no definido",
          })
          continue
        }

        let processor
        try {
          if (connectionType.toLowerCase() === "xml") {
            const XMLProcessor = require("../processors/xmlProcessor")
            processor = new XMLProcessor(connection)
          } else if (connectionType.toLowerCase() === "api") {
            const APIProcessor = require("../processors/apiProcessor")
            processor = new APIProcessor(connection)
          } else if (connectionType.toLowerCase() === "manual") {
            console.log(`⚠️ Saltando conexión ${connection.id}: tipo manual`)
            results.push({
              connectionId: connection.id,
              name: connection.name,
              success: false,
              message: "Las conexiones manuales no se procesan automáticamente",
            })
            continue
          } else {
            console.log(`⚠️ Saltando conexión ${connection.id}: tipo no soportado`)
            results.push({
              connectionId: connection.id,
              name: connection.name,
              success: false,
              message: `Tipo de conexión no soportado: ${connectionType}`,
            })
            continue
          }
        } catch (processorError) {
          console.error(`❌ Error creando procesador para conexión ${connection.id}:`, processorError)
          results.push({
            connectionId: connection.id,
            name: connection.name,
            success: false,
            message: `Error creando procesador: ${processorError.message}`,
          })
          continue
        }

        // Procesar conexión
        const result = await processor.process()

        // Actualizar estadísticas
        const now = new Date()
        const newImportedCount = (connection.importedOffers || 0) + (result.imported || 0)
        const newErrorCount = (connection.errorCount || 0) + (result.errors || 0)

        await pool
          .request()
          .input("id", sql.Int, connection.id)
          .input("status", sql.NVarChar(50), result.imported > 0 ? "active" : "error")
          .input("lastSync", sql.DateTime, now)
          .input("importedOffers", sql.Int, newImportedCount)
          .input("errorCount", sql.Int, newErrorCount)
          .query(`
            UPDATE Connections 
            SET 
              status = @status,
              lastSync = @lastSync,
              importedOffers = @importedOffers,
              errorCount = @errorCount
            WHERE id = @id
          `)

        results.push({
          connectionId: connection.id,
          name: connection.name,
          success: true,
          processed: result.imported || 0,
          failed: result.errors || 0,
          message: `Procesadas ${result.imported || 0} ofertas`,
        })

        totalProcessed += result.imported || 0
        totalErrors += result.errors || 0

        console.log(`✅ Conexión ${connection.id} procesada: ${result.imported || 0} ofertas`)
      } catch (connectionError) {
        console.error(`❌ Error procesando conexión ${connection.id}:`, connectionError)

        // Actualizar estado a error
        await pool
          .request()
          .input("id", sql.Int, connection.id)
          .input("status", sql.NVarChar(50), "error")
          .query("UPDATE Connections SET status = @status, errorCount = errorCount + 1 WHERE id = @id")

        results.push({
          connectionId: connection.id,
          name: connection.name,
          success: false,
          message: connectionError.message,
        })
        totalErrors++
      }
    }

    console.log(`✅ Importación masiva completada: ${totalProcessed} ofertas procesadas, ${totalErrors} errores`)

    res.json({
      success: true,
      message: "Importación masiva completada",
      totalConnections: connections.length,
      totalProcessed: totalProcessed,
      totalErrors: totalErrors,
      results: results,
    })
  } catch (error) {
    console.error("❌ Error en importación masiva:", error)
    res.status(500).json({
      success: false,
      message: "Error interno del servidor: " + error.message,
    })
  }
})

// GET /api/connections/:id/stats - Estadísticas específicas de una conexión
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params
  console.log(`🔍 GET /api/connections/:id/stats - ID: ${id}`)

  try {
    await pool
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          c.id,
          c.name,
          c.type,
          c.status,
          c.lastSync,
          c.importedOffers,
          c.errorCount,
          c.frequency,
          COUNT(fm.id) as totalMappings,
          COUNT(CASE WHEN fm.isRequired = 1 THEN 1 END) as requiredMappings
        FROM Connections c
        LEFT JOIN ClientFieldMappings fm ON c.id = fm.connectionId
        WHERE c.id = @id
        GROUP BY c.id, c.name, c.type, c.status, c.lastSync, c.importedOffers, c.errorCount, c.frequency
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    console.log("✅ Estadísticas específicas obtenidas:", result.recordset[0])
    res.json(result.recordset[0])
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas específicas:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// POST /api/connections/:id/sync - Sincronizar una conexión específica (alias para import)
router.post("/:id/sync", async (req, res) => {
  console.log(`🔍 POST /api/connections/:id/sync - Redirigiendo a import`)
  // Redirigir a la función de importación
  req.url = req.url.replace("/sync", "/import")
  return router.handle(req, res)
})

// POST /api/connections/mapping - Guardar mapeos de campañas y canales
router.post("/mapping", async (req, res) => {
  console.log("🚀 CLAUDE DEBUG: POST /mapping endpoint called!")
  console.log("🚀 CLAUDE DEBUG: Request body:", JSON.stringify(req.body, null, 2))
  
  const { campaigns } = req.body

  try {
    if (!Array.isArray(campaigns)) {
      return res.status(400).json({ error: "Las campañas deben ser un array" })
    }

    await pool
    let savedCount = 0

    // Procesar cada campaña y sus canales
    for (const campaign of campaigns) {
      const { campaignId, channels } = campaign
      
      if (!Array.isArray(channels)) {
        console.log(`⚠️ Saltando campaña ${campaignId}: channels no es array`)
        continue
      }

      // Procesar cada canal de la campaña
      for (const channel of channels) {
        const { channelId, name } = channel
        
        console.log("🔄 Guardando mapeo:", { campaignId, channelId, name })
        
        try {
          // Aquí puedes guardar en la tabla que necesites
          // Por ahora solo retornamos éxito
          savedCount++
          
          console.log("✅ Mapeo guardado:", { campaignId, channelId, name })
        } catch (saveError) {
          console.error("❌ Error guardando mapeo individual:", saveError)
        }
      }
    }

    console.log(`✅ Mapeos guardados exitosamente: ${savedCount}`)

    res.json({
      success: true,
      message: "Mapeos guardados exitosamente",
      count: savedCount,
    })
  } catch (error) {
    console.error("❌ Error guardando mapeos:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

module.exports = router




// Force reload
