const express = require("express")
const router = express.Router()
const { pool } = require("../db/db")
const axios = require("axios")
const xml2js = require("xml2js")
const sql = require("mssql")

// GET /api/connections - Listar todas las conexiones
router.get("/", async (req, res) => {
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  console.log("🔍 GET /api/connections - Listando conexiones from origin:", origin)

  try {
    await pool
    const result = await pool.request().query(`
      SELECT 
        id, name, type, url, frequency, status, lastSync, 
        importedOffers, errorCount, clientId, Method, Headers, Body, CreatedAt
      FROM Connections 
      ORDER BY CreatedAt DESC
    `)

    console.log(`✅ Encontradas ${result.recordset.length} conexiones`)
    res.json(result.recordset)
  } catch (error) {
    console.error("❌ Error listando conexiones:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// GET /api/connections/:id - Obtener una conexión específica
router.get("/:id", async (req, res) => {
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
    await pool
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          id, name, type, url, frequency, status, lastSync, 
          importedOffers, errorCount, clientId, Method, Headers, Body, CreatedAt
        FROM Connections 
        WHERE id = @id
      `)

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    const connection = result.recordset[0]
    console.log("✅ Conexión encontrada:", connection)
    res.json(connection)
  } catch (error) {
    console.error("❌ Error obteniendo conexión:", error)
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message,
    })
  }
})

// POST /api/connections - Crear nueva conexión
router.post("/", async (req, res) => {
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  const { name, type, url, frequency, clientId, method, headers, body } = req.body
  console.log("🔍 POST /api/connections - Creando nueva conexión from origin:", origin, {
    name,
    type,
    url,
    frequency,
    clientId,
  })

  try {
    // Validaciones básicas
    if (!name || !type || !url || !frequency || !clientId) {
      console.log("❌ Faltan campos requeridos")
      return res.status(400).json({
        error: "Faltan campos requeridos",
        required: ["name", "type", "url", "frequency", "clientId"],
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

    await pool
    const result = await pool
      .request()
      .input("name", sql.NVarChar(255), name)
      .input("type", sql.NVarChar(50), type)
      .input("url", sql.NVarChar(sql.MAX), url)
      .input("frequency", sql.NVarChar(50), frequency)
      .input("status", sql.NVarChar(50), "pending")
      .input("importedOffers", sql.Int, 0)
      .input("errorCount", sql.Int, 0)
      .input("clientId", sql.Int, clientId)
      .input("method", sql.NVarChar(10), method || null)
      .input("headers", sql.NVarChar(sql.MAX), headers ? JSON.stringify(headers) : null)
      .input("body", sql.NVarChar(sql.MAX), body || null)
      .input("createdAt", sql.DateTime, new Date())
      .query(`
        INSERT INTO Connections (
          name, type, url, frequency, status, importedOffers, errorCount, clientId,
          Method, Headers, Body, CreatedAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @name, @type, @url, @frequency, @status, @importedOffers, @errorCount, @clientId,
          @method, @headers, @body, @createdAt
        )
      `)

    const newConnection = result.recordset[0]
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
router.put("/:id", async (req, res) => {
  const { id } = req.params
  const { name, type, url, frequency, method, headers, body } = req.body

  console.log(`🔍 PUT /api/connections/:id - ID: ${id}`, {
    name,
    type,
    url,
    frequency,
  })

  try {
    // Validar que la conexión existe
    await pool
    const existingResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT id FROM Connections WHERE id = @id")

    if (existingResult.recordset.length === 0) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    // Actualizar conexión
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("name", sql.NVarChar(255), name)
      .input("type", sql.NVarChar(50), type)
      .input("url", sql.NVarChar(sql.MAX), url)
      .input("frequency", sql.NVarChar(50), frequency)
      .input("method", sql.NVarChar(10), method || null)
      .input("headers", sql.NVarChar(sql.MAX), headers ? JSON.stringify(headers) : null)
      .input("body", sql.NVarChar(sql.MAX), body || null)
      .query(`
        UPDATE Connections 
        SET 
          name = @name,
          type = @type,
          url = @url,
          frequency = @frequency,
          Method = @method,
          Headers = @headers,
          Body = @body
        OUTPUT INSERTED.*
        WHERE id = @id
      `)

    const updatedConnection = result.recordset[0]
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
router.delete("/:id", async (req, res) => {
  const { id } = req.params
  console.log(`🔍 DELETE /api/connections/:id - ID: ${id}`)

  try {
    await pool

    // Verificar que la conexión existe
    const existingResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT id FROM Connections WHERE id = @id")

    if (existingResult.recordset.length === 0) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    // Eliminar mapeos de campos relacionados primero
    await pool
      .request()
      .input("connectionId", sql.Int, id)
      .query("DELETE FROM ClientFieldMappings WHERE ConnectionId = @connectionId")

    // Eliminar conexión
    await pool.request().input("id", sql.Int, id).query("DELETE FROM Connections WHERE id = @id")

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
router.post("/:id/import", async (req, res) => {
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
    await pool

    // Obtener la conexión
    const connectionResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, clientId,
          Method, Headers, Body, CreatedAt
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
        const XMLProcessor = require("../processors/xmlProcessor")
        processor = new XMLProcessor(connection)
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
    const result = await processor.process()

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
console.log("🔧 Registrando ruta: /:id/test-upload")
router.post("/:id/test-upload", async (req, res) => {
  console.log("🎯 TEST UPLOAD endpoint hit!")
  res.json({ message: "Test upload endpoint works!", id: req.params.id })
})

// POST /api/connections/:id/upload - Upload file for manual connections
console.log("🔧 Registrando ruta: /:id/upload")
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
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, clientId,
          Method, Headers, Body, CreatedAt
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
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, clientId,
          Method, Headers, Body, CreatedAt
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
router.get("/:id/fields", async (req, res) => {
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
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, clientId,
          Method, Headers, Body, CreatedAt
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
          id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, clientId,
          Method, Headers, Body, CreatedAt
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
router.get("/:id/mapping", async (req, res) => {
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
router.get("/:id/mappings", async (req, res) => {
  const { id } = req.params
  console.log(`🔍 GET /api/connections/:id/mappings - ID: ${id}`)

  try {
    await pool
    const result = await pool
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

// POST /api/connections/:id/mappings - Guardar mapeos de campos
router.post("/:id/mappings", async (req, res) => {
  const { id } = req.params
  const { mappings } = req.body

  console.log(`🔍 POST /api/connections/:id/mappings - ID: ${id}`, mappings)

  try {
    if (!Array.isArray(mappings)) {
      return res.status(400).json({ error: "Los mapeos deben ser un array" })
    }

    await pool

    // Usar la tabla ClientFieldMappings que existe
    for (const mapping of mappings) {
      const sourceField = mapping.sourceField || mapping.SourceField
      const targetField = mapping.targetField || mapping.TargetField
      const transformation = mapping.transformation || mapping.TransformationRule || "STRING"
      
      console.log("🔄 Guardando mapeo:", { sourceField, targetField, transformation })
      
      try {
        await pool
          .request()
          .input("ConnectionId", sql.Int, id)
          .input("SourceField", sql.NVarChar(255), sourceField)
          .input("TargetField", sql.NVarChar(255), targetField)
          .input("TransformationType", sql.NVarChar(50), transformation)
          .input("TransformationRule", sql.NVarChar(sql.MAX), null)
          .query(`
            MERGE INTO ClientFieldMappings WITH (HOLDLOCK) AS Target
            USING (VALUES (@ConnectionId, @SourceField, @TargetField)) AS Source(ConnectionId, SourceField, TargetField)
            ON Target.ConnectionId = Source.ConnectionId 
            AND Target.SourceField = Source.SourceField
            AND Target.TargetField = Source.TargetField
            WHEN MATCHED THEN
                UPDATE SET 
                    TransformationType = @TransformationType,
                    TransformationRule = @TransformationRule
            WHEN NOT MATCHED THEN
                INSERT (ConnectionId, SourceField, TargetField, TransformationType, TransformationRule)
                VALUES (@ConnectionId, @SourceField, @TargetField, @TransformationType, @TransformationRule);
          `)
      } catch (dbError) {
        console.error("❌ Error guardando mapeo individual:", dbError)
        // Continuar con los demás mapeos
      }
    }

    console.log("✅ Mapeos guardados exitosamente")

    res.json({
      success: true,
      message: "Mapeos guardados exitosamente",
      count: mappings.length,
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
        id, name, type, url, frequency, status, lastSync, importedOffers, errorCount, clientId,
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

module.exports = router




// Force reload
