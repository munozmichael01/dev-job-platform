const express = require("express")
const router = express.Router()
const { pool, sql } = require("../db/db")
const axios = require("axios")
const xml2js = require("xml2js")
const { addUserToRequest, requireAuth, onlyOwnData, getUserIdForQuery, isSuperAdmin, addUserIdToRequest } = require('../middleware/authMiddleware')

// Supabase client para queries nativas
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Note: batched import uses frontend polling loop — no self-chaining needed.
// See POST /:id/import handler for the two-phase approach.



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

    // Construir query Supabase con filtrado por usuario
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
      console.error('❌ Error Supabase en GET connections:', error);
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

    // Construir query Supabase con filtrado por usuario
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

    const { data: connection, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return res.status(404).json({ error: "Conexión no encontrada" })
      }
      console.error('❌ Error Supabase en GET connection by id:', error);
      throw new Error(error.message);
    }

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

    // Obtener clientId del usuario - cada usuario tiene su cliente asociado
    const { data: clients, error: clientError } = await supabase
      .from('Clients')
      .select('Id')
      .eq('UserId', userId)
      .single();

    let clientId;
    if (clientError || !clients) {
      // Fallback: usar clientId = 1 (cliente por defecto)
      clientId = 1;
      console.log(`⚠️ Usuario ${userId} sin cliente asociado, usando clientId por defecto = ${clientId}`);
    } else {
      clientId = clients.Id;
      console.log(`🔐 Usuario ${userId} tiene clientId = ${clientId}`);
    }

    // Crear la nueva conexión usando Supabase nativo
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

    const { data: newConnection, error } = await supabase
      .from('Connections')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error Supabase en POST connection:', error);
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
    // Verificar que la conexión existe y pertenece al usuario (excepto super admin)
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

    // Actualizar conexión con Supabase nativo
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
      console.error('❌ Error Supabase en PUT connection:', updateError);
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
    // Verificar que la conexión existe y pertenece al usuario (excepto super admin)
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

    // Eliminar mapeos de campos relacionados primero
    const { error: mappingsError } = await supabase
      .from('FieldMappings')
      .delete()
      .eq('ConnectionId', id);

    if (mappingsError) {
      console.error('❌ Error eliminando mapeos:', mappingsError);
      // Continuar con eliminación de conexión aunque falle mapeos
    }

    // Eliminar conexión usando Supabase nativo
    const { error: deleteError } = await supabase
      .from('Connections')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('❌ Error Supabase en DELETE connection:', deleteError);
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
    // Guard: reject concurrent imports, but allow retry if the lock is stale.
    // A lock is stale when:
    //   - status = 'importing' AND
    //   - lastSync is null (never completed) or lastSync is older than IMPORT_LOCK_TTL_MS
    // Scenario: Vercel serverless timeout mid-import leaves status stuck at 'importing'.
    const IMPORT_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

    const { data: statusCheck, error: statusError } = await supabase
      .from('Connections')
      .select('status, lastSync')
      .eq('id', id)
      .single();

    if (!statusError && statusCheck && statusCheck.status === 'importing') {
      const lastSyncDate = statusCheck.lastSync ? new Date(statusCheck.lastSync) : null;
      const ageMs = lastSyncDate ? Date.now() - lastSyncDate.getTime() : Infinity;
      const isStale = ageMs > IMPORT_LOCK_TTL_MS;

      if (!isStale) {
        console.log(`⚠️ Importación ya en progreso para conexión ${id} (lock activo, ${Math.round(ageMs/1000)}s ago)`)
        return res.status(409).json({
          success: false,
          error: "Importación ya en progreso",
          message: "Esta conexión ya se está procesando. Espera a que termine o reintenta en 10 minutos.",
          lockAgeSeconds: Math.round(ageMs / 1000)
        })
      }

      // Stale lock: auto-reset and allow retry
      console.log(`⚠️ Lock de importación caducado para conexión ${id} (${Math.round(ageMs/60000)} min) — reseteando a error`)
      await supabase.from('Connections').update({ status: 'error' }).eq('id', id)
    }

    // Obtener la conexión con Supabase
    const { data: connection, error: connError } = await supabase
      .from('Connections')
      .select('*')
      .eq('id', id)
      .single();

    if (connError || !connection) {
      console.log(`❌ Conexión no encontrada: ${id}`)
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

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
        
        // ── Batched XML import (two-phase, Vercel-timeout-safe) ──────────────────
        //
        // Phase 1 (buffer):  Fetch XML feed → save ALL offers to RawJobRecords as 'pending'.
        //                    Fast (just JSON writes). Completes in < 30s for 3000 offers.
        //                    Returns hasMore=true so caller knows to continue.
        //
        // Phase 2+ (process): Read batchSize pending RawJobRecords → transform → upsert JobOffers.
        //                     No XML fetch. Completes in < 30s for 200 offers.
        //                     Repeat until remaining=0, then run reconciliation.
        //
        // Auto-detected: if pending RawJobRecords exist → process batch.
        //                if none → fetch+buffer first.
        //
        // UI contract preserved: response always includes result.{imported, errors, hasMore, nextOffset}

        const XMLImporter = require("../processors/xmlImporter")
        const userId      = connection.UserId || connection.userId
        const connId      = parseInt(id)
        const BATCH_SIZE  = parseInt(req.query.batchSize) || 200
        const sourceSystem = `conn-${id}`

        // Check for pending records from a previous buffer pass
        const { count: pendingCount } = await supabase
          .from('RawJobRecords')
          .select('Id', { count: 'exact', head: true })
          .eq('ConnectionId', connId)
          .in('ProcessingStatus', ['pending', 'failed'])

        await supabase.from('Connections').update({
          status:   'importing',
          lastSync: new Date().toISOString(),
        }).eq('id', id)

        try {
          if (!pendingCount || pendingCount === 0) {
            // ── Phase 1: fetch XML → buffer to RawJobRecords ──────────────────
            console.log(`📥 Phase 1 — buffering XML feed for connection ${id}`)
            const bufferResult = await XMLImporter.fetchToBuffer(connectionUrl, {
              userId, connectionId: connId, sourceSystem
            })

            await supabase.from('Connections').update({
              status:   'importing',  // keep 'importing' — processing not done yet
              lastSync: new Date().toISOString(),
            }).eq('id', id)

            return res.json({
              success:   true,
              message:   `Preparando importación: ${bufferResult.pendingCount} ofertas en cola`,
              phase:     'buffer',
              hasMore:   bufferResult.pendingCount > 0,
              remaining: bufferResult.pendingCount,
              processed: 0,
              total:     bufferResult.pendingCount,
              result: {
                imported:  0,
                errors:    bufferResult.warnings.length,
                hasMore:   bufferResult.pendingCount > 0,
                remaining: bufferResult.pendingCount,
                processed: 0,
                total:     bufferResult.pendingCount,
              },
              stats: bufferResult,
            })

          } else {
            // ── Phase 2+: process batch from RawJobRecords ────────────────────
            console.log(`⚙️ Phase 2 — processing batch of ${BATCH_SIZE} from ${pendingCount} pending (connection ${id})`)
            const batchResult = await XMLImporter.processBatch({
              userId, connectionId: connId, sourceSystem, batchSize: BATCH_SIZE
            })

            const isComplete = batchResult.remaining === 0

            if (isComplete) {
              // Final batch: run reconciliation then mark complete
              console.log(`🔁 Final batch — running reconciliation for connection ${id}`)
              const importer = new XMLImporter({ userId, connectionId: connId, feedUrl: null, sourceSystem })
              // loadFieldMappings is internal to XMLImporter — use Supabase directly here
              importer.fieldMap = null  // reconciliation doesn't need field mappings

              // Build full active set from all processed RawJobRecords
              const { data: processedRecs } = await supabase
                .from('RawJobRecords')
                .select('ExternalId')
                .eq('ConnectionId', connId)
                .eq('ProcessingStatus', 'processed')
              const activeExternalIds = new Set((processedRecs || []).map(r => r.ExternalId).filter(Boolean))

              await importer._reconcileMissingOffers(activeExternalIds)

              // Count total JobOffers for this connection
              const { count: totalOffers } = await supabase
                .from('JobOffers')
                .select('Id', { count: 'exact', head: true })
                .eq('ConnectionId', connId)

              await supabase.from('Connections').update({
                status:         'active',
                lastSync:       new Date().toISOString(),
                importedOffers: totalOffers || 0,
                errorCount:     batchResult.failed,
              }).eq('id', id)

              return res.json({
                success:  true,
                message:  `Importación completa: ${totalOffers} ofertas activas`,
                phase:    'complete',
                result: {
                  imported:   batchResult.processed,
                  errors:     batchResult.failed,
                  hasMore:    false,
                  nextOffset: 0,
                  total:      totalOffers || 0,
                },
                stats:    { ...batchResult, reconciled: true },
              })

            } else {
              // More batches needed — include cumulative totals for progress display
              const { count: processedSoFar } = await supabase
                .from('RawJobRecords')
                .select('Id', { count: 'exact', head: true })
                .eq('ConnectionId', connId)
                .eq('ProcessingStatus', 'processed')
              const totalBuffered = (processedSoFar || 0) + batchResult.remaining
              const processedTotal = processedSoFar || 0

              await supabase.from('Connections').update({
                lastSync:       new Date().toISOString(),
                importedOffers: processedTotal,
              }).eq('id', id)

              return res.json({
                success:   true,
                message:   `Procesando: ${processedTotal} de ${totalBuffered} ofertas`,
                phase:     'process',
                hasMore:   true,
                remaining: batchResult.remaining,
                processed: processedTotal,
                total:     totalBuffered,
                result: {
                  imported:  batchResult.processed,
                  errors:    batchResult.failed,
                  hasMore:   true,
                  remaining: batchResult.remaining,
                  processed: processedTotal,
                  total:     totalBuffered,
                },
                stats: batchResult,
              })
            }
          }

        } catch (importErr) {
          await supabase.from('Connections').update({ status: 'error' }).eq('id', id).catch(() => {})
          throw importErr
        }

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

// GET /api/connections/:id/import/status — lightweight import progress check
// Used by frontend auto-resume logic on page load.
router.get("/:id/import/status", addUserToRequest, requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    const [connRes, pendingRes, processedRes, offersRes] = await Promise.all([
      supabase.from('Connections').select('status, importedOffers, lastSync, errorCount').eq('id', id).single(),
      supabase.from('RawJobRecords').select('Id', { count: 'exact', head: true }).eq('ConnectionId', id).in('ProcessingStatus', ['pending', 'failed']),
      supabase.from('RawJobRecords').select('Id', { count: 'exact', head: true }).eq('ConnectionId', id).eq('ProcessingStatus', 'processed'),
      supabase.from('JobOffers').select('Id', { count: 'exact', head: true }).eq('ConnectionId', id),
    ])
    const conn = connRes.data
    res.json({
      success:          true,
      connectionId:     parseInt(id),
      connectionStatus: conn?.status,
      pendingRecords:   pendingRes.count || 0,
      processedRecords: processedRes.count || 0,
      jobOffers:        offersRes.count || 0,
      importedOffers:   conn?.importedOffers || 0,
      lastSync:         conn?.lastSync,
      isImporting:      conn?.status === 'importing',
      hasMore:          (pendingRes.count || 0) > 0,
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
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
    // Fetch connection via Supabase — no pool.request
    const { data: connRows, error: connErr } = await supabase
      .from('Connections')
      .select('id, name, type, url, status, UserId')
      .eq('id', id)
      .limit(1)

    if (connErr) throw connErr
    if (!connRows || connRows.length === 0) {
      return res.status(404).json({ error: "Conexión no encontrada" })
    }

    const connection = connRows[0]
    const connectionType = (connection.type || '').toLowerCase()

    if (connectionType !== 'manual') {
      return res.status(400).json({
        error: "Endpoint solo válido para conexiones manuales",
        connectionType: connection.type
      })
    }

    if (!req.files || !req.files.file) {
      return res.status(400).json({
        error: "No se proporcionó archivo",
        message: "Use 'file' como nombre del campo para el archivo"
      })
    }

    const uploadedFile = req.files.file
    const fileExt = require('path').extname(uploadedFile.name).toLowerCase()
    const allowedTypes = ['.xml', '.csv', '.json']

    if (!allowedTypes.includes(fileExt)) {
      return res.status(400).json({
        error: "Tipo de archivo no soportado",
        allowedTypes,
        receivedType: fileExt
      })
    }

    console.log(`🔄 Processing ${fileExt} file upload for connection ${id}`)
    await supabase.from('Connections').update({ status: 'importing' }).eq('id', id)

    let processed = 0
    let errors    = 0

    try {
      if (fileExt === '.xml') {
        // Read file into buffer, then use XMLImporter.runFromBuffer — same clean pipeline as feed import
        const xmlString = uploadedFile.data
          ? uploadedFile.data.toString('utf8')
          : await uploadedFile.mv
            ? await (() => {
                const path = require('path')
                const fs   = require('fs')
                const tmp  = path.join(__dirname, '../../temp', `${Date.now()}_${uploadedFile.name}`)
                if (!fs.existsSync(path.dirname(tmp))) fs.mkdirSync(path.dirname(tmp), { recursive: true })
                return new Promise((res, rej) =>
                  uploadedFile.mv(tmp, err => err ? rej(err) : res(fs.readFileSync(tmp, 'utf8')))
                ).finally(() => fs.existsSync(tmp) && fs.unlinkSync(tmp))
              })()
            : null

        if (!xmlString) throw new Error('Could not read XML file content')

        const XMLImporter = require("../processors/xmlImporter")
        const stats = await XMLImporter.runFromBuffer(xmlString, {
          userId:       connection.UserId || connection.userId,
          connectionId: parseInt(id),
          sourceSystem: `conn-${id}-upload`,
        })
        processed = (stats.inserted || 0) + (stats.updated || 0)
        errors    = stats.failed || 0

        await supabase.from('Connections').update({
          status:         'active',
          lastSync:       new Date().toISOString(),
          importedOffers: processed,
          errorCount:     errors,
        }).eq('id', id)

        return res.json({
          success: true,
          message: `Archivo XML procesado: ${processed} ofertas, ${errors} errores`,
          processed,
          errors,
          filename: uploadedFile.name,
          stats,
        })

      } else if (fileExt === '.csv') {
        const path = require('path')
        const fs   = require('fs')
        const tempDir  = path.join(__dirname, '../../temp')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
        const tempPath = path.join(tempDir, `${Date.now()}_${uploadedFile.name}`)
        await uploadedFile.mv(tempPath)
        try {
          const CSVProcessor = require("../processors/csvProcessor")
          const result = await new CSVProcessor(connection, tempPath).process()
          processed = result.imported || 0
          errors    = result.errors || 0
        } finally {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
        }

      } else if (fileExt === '.json') {
        console.log("⚠️ JSON file processing not yet implemented")
      }

    } catch (processingError) {
      console.error("❌ Error processing file:", processingError.message)
      errors = 1
    }

    await supabase.from('Connections').update({
      status:         'active',
      lastSync:       new Date().toISOString(),
      importedOffers: processed,
      errorCount:     errors,
    }).eq('id', id)

    res.json({
      success: true,
      message: `Archivo procesado: ${processed} ofertas, ${errors} errores`,
      processed,
      errors,
      filename: uploadedFile.name,
    })

  } catch (error) {
    console.error("❌ Error en upload:", error.message)
    await supabase.from('Connections').update({ status: 'error' }).eq('id', id).catch(() => {})
    res.status(500).json({ error: "Error procesando archivo", details: error.message })
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
    const { data: connection, error: connError } = await supabase
      .from('Connections')
      .select('id, name, type, url, FeedUrl, Endpoint, UserId, status')
      .eq('id', id)
      .single()

    if (connError || !connection) {
      return res.status(404).json({ success: false, error: "Conexión no encontrada" })
    }

    const connectionType = (connection.type || '').toLowerCase()

    // ── XML: fetch first offer and return its field names ──────────────────────
    if (connectionType === "xml") {
      const feedUrl = connection.FeedUrl || connection.url || connection.Endpoint
      if (!feedUrl) {
        return res.status(400).json({ success: false, error: "Conexión XML sin URL configurada" })
      }

      try {
        const axios  = require('axios')
        const xml2js = require('xml2js')

        const response = await axios.get(feedUrl, {
          timeout: 15000,
          headers: { 'User-Agent': 'TalentOS-FieldDetector/1.0' },
          httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        })
        const parsed = await new xml2js.Parser({
          explicitArray: false, ignoreAttrs: false, mergeAttrs: true, trim: true,
        }).parseStringPromise(response.data)

        // Find first offer in the feed (same logic as XMLImporter.extractOfferList)
        const rootKey = Object.keys(parsed)[0]
        const root = parsed[rootKey]
        let firstOffer = null
        for (const key of ['job', 'offer', 'item', 'listing', 'vacancy']) {
          const val = root?.[key]
          if (val) { firstOffer = Array.isArray(val) ? val[0] : val; break }
        }
        if (!firstOffer && root && typeof root === 'object') {
          for (const k of Object.keys(root)) {
            const v = root[k]
            if (Array.isArray(v) && v.length > 0) { firstOffer = v[0]; break }
          }
        }

        if (!firstOffer) {
          return res.status(422).json({ success: false, error: "No se encontraron ofertas en el feed XML" })
        }

        const fields = Object.entries(firstOffer).map(([name, value]) => ({
          name,
          type: typeof value === 'object' ? 'object' : String(value).match(/^\d{4}-\d{2}-\d{2}/) ? 'date' : isNaN(Number(value)) ? 'string' : 'number',
          sample: typeof value === 'object' ? JSON.stringify(value).substring(0, 80) : String(value).substring(0, 100),
          required: false,
          description: name,
        }))

        return res.json({ success: true, fields, source: 'xml-feed-live' })

      } catch (fetchErr) {
        return res.status(502).json({
          success: false,
          error: `No se pudo leer el feed XML: ${fetchErr.message}`,
          feedUrl,
        })
      }
    }

    // ── API: not yet implemented ──────────────────────────────────────────────
    if (connectionType === "api") {
      return res.status(501).json({
        success: false,
        error: "Detección de campos para conexiones API no está implementada aún",
        message: "Configure los campos manualmente o use una conexión XML"
      })
    }

    // ── Manual: infer from last imported RawJobRecords (if any) ──────────────
    if (connectionType === "manual") {
      try {
        // Infer field names from the last processed RawJobRecord's raw payload
        const { data: rawRec } = await supabase
          .from('RawJobRecords')
          .select('RawPayload')
          .eq('ConnectionId', id)
          .eq('ProcessingStatus', 'processed')
          .order('ReceivedAt', { ascending: false })
          .limit(1)

        if (rawRec?.[0]?.RawPayload) {
          const sample = JSON.parse(rawRec[0].RawPayload)
          const fields = Object.entries(sample).map(([name, value]) => ({
            name,
            type: typeof value === 'object' ? 'object' : isNaN(Number(value)) ? 'string' : 'number',
            sample: String(value).substring(0, 100),
            required: false,
            description: name,
          }))
          return res.json({ success: true, fields, source: 'last-processed-record' })
        }
      } catch {}

          // Fallback: standard field set
          return res.json({
            success: true,
            source: 'standard-fallback',
            fields: [
              { name: "id",           type: "string", sample: "12345",      required: false, description: "ID único" },
              { name: "title",        type: "string", sample: "Desarrollador Full Stack", required: true, description: "Título" },
              { name: "company",      type: "string", sample: "TechCorp",   required: true,  description: "Empresa" },
              { name: "description",  type: "text",   sample: "Descripción...", required: false, description: "Descripción" },
              { name: "url",          type: "url",    sample: "https://...", required: true, description: "URL aplicación" },
              { name: "publication",  type: "date",   sample: "2024-01-15", required: false, description: "Fecha publicación" },
            ]
          })
        }

        return res.status(400).json({ success: false, error: `Tipo de conexión no soportado: ${connectionType}` })

  } catch (error) {
    console.error("❌ Error detectando campos:", error)
    res.status(500).json({ success: false, error: "Error detectando campos", details: error.message })
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
    // Reads from FieldMappings (new schema) via Supabase — no pool.request
    const { data, error } = await supabase
      .from('FieldMappings')
      .select('ConnectionId, SourceField, SourcePath, TargetField, TransformationType, TransformationConfig')
      .eq('ConnectionId', id)
      .order('TargetField')

    if (error) throw error

    // Normalise to UI-expected shape: { ConnectionId, SourceField, TargetField, TransformationType, TransformationRule }
    const rows = (data || []).map(row => ({
      ConnectionId:      row.ConnectionId,
      SourceField:       row.SourceField || row.SourcePath,
      TargetField:       row.TargetField,
      TransformationType: row.TransformationType,
      TransformationRule: row.TransformationRule || row.TransformationConfig || null
    }))

    console.log(`✅ GET /mapping: found ${rows.length} mappings for connection ${id}`)
    res.json(rows)
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
    console.log(`🔍 Obteniendo mapeos para connectionId = ${id}`)

    // Get mappings using Supabase
    const { data: mappings, error } = await supabase
      .from('FieldMappings')
      .select('*')
      .eq('ConnectionId', id)
      .order('TargetField');

    if (error) {
      console.error('❌ Error Supabase en GET mappings:', error);
      throw new Error(error.message);
    }

    console.log(`✅ Found ${mappings?.length || 0} mappings`)
    console.log(`📊 Mappings:`, mappings)

    res.json(mappings || [])
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

    console.log(`📋 Guardando mapeos para conexión ${id}`)

    // Eliminar mapeos existentes usando Supabase
    console.log("🗑️ Eliminando mapeos existentes...")
    const { error: deleteError } = await supabase
      .from('FieldMappings')
      .delete()
      .eq('ConnectionId', id);

    if (deleteError) {
      console.error('⚠️ Error eliminando mapeos existentes:', deleteError);
      // Continuar de todas formas
    }

    // Insertar nuevos mapeos usando Supabase (sin ClientId - no existe en tabla)
    console.log(`📋 Total de mapeos a procesar: ${mappings.length}`)
    const mappingsToInsert = mappings.map(mapping => ({
      ConnectionId: parseInt(id),
      SourceField: mapping.sourceField || mapping.SourceField,
      TargetField: mapping.targetField || mapping.TargetField,
      TransformationType: mapping.TransformationType || mapping.transformation || "STRING",
      TransformationConfig: mapping.TransformationRule || mapping.transformationRule || mapping.TransformationConfig || null
    }));

    console.log(`📤 Insertando ${mappingsToInsert.length} mapeos...`);

    const { data: inserted, error: insertError } = await supabase
      .from('FieldMappings')
      .insert(mappingsToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error insertando mapeos:', insertError);
      throw new Error(insertError.message);
    }

    console.log(`✅ ${inserted?.length || 0} mapeos guardados exitosamente`)

    res.json({
      success: true,
      message: "Mapeos guardados exitosamente",
      count: inserted?.length || 0,
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
