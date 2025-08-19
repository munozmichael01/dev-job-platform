const express = require('express');
const { pool, poolConnect, sql } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(addUserToRequest);
router.use(requireAuth);

/**
 * GET /api/offers/unassigned
 * Obtiene ofertas que NO están asignadas a ninguna campaña activa
 * BYPASS TEMPORAL para evitar timeouts críticos de 15s
 */
router.get('/unassigned', async (req, res) => {
  try {
    console.log('🔍 Obteniendo ofertas sin campaña activa (BYPASS TEMPORAL)...');
    
    await poolConnect;
    
    // Parámetros de paginación
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const request = pool.request()
      .input('Limit', sql.Int, limit)
      .input('Offset', sql.Int, offset);
    
    // OPTIMIZACIÓN: Verificar conexiones del usuario primero
    if (!isSuperAdmin(req)) {
      request.input('UserId', sql.BigInt, req.userId);
      
      // Verificación rápida de conexiones
      console.log(`🔍 Verificando conexiones para usuario ${req.userId}...`);
      
      const connectionsResult = await request.query(`
        SELECT COUNT(*) as ConnectionCount
        FROM Connections WITH (NOLOCK)
        WHERE UserId = @UserId
      `);
      
      const connectionCount = parseInt(connectionsResult.recordset[0].ConnectionCount || 0);
      
      console.log(`📊 Usuario ${req.userId} tiene ${connectionCount} conexiones`);
      
      if (connectionCount === 0) {
        // Usuario sin conexiones = sin ofertas (correcto)
        console.log(`✅ Usuario sin conexiones: retornando 0 ofertas correctamente`);
        return res.json({
          success: true,
          data: {
            offers: [],
            totalCount: 0,
            limit: limit,
            offset: offset,
            timestamp: new Date().toISOString(),
            queryTimeMs: 0,
            note: 'Usuario sin conexiones configuradas'
          }
        });
      }
      
      // Usuario con conexiones: consulta optimizada completa
      console.log(`🔍 Usuario con conexiones: obteniendo ofertas no asignadas...`);
      
      const query = `
        SELECT TOP (@Limit)
          jo.Id,
          jo.Title,
          jo.CompanyName,
          jo.City,
          jo.Region,
          jo.Sector,
          jo.SalaryMin,
          jo.SalaryMax,
          jo.CreatedAt,
          jo.StatusId
        FROM JobOffers jo WITH (NOLOCK)
        INNER JOIN Connections con WITH (NOLOCK) ON jo.ConnectionId = con.Id
        WHERE con.UserId = @UserId 
          AND jo.StatusId = 1
          AND NOT EXISTS (
            SELECT 1 FROM CampaignChannels cc WITH (NOLOCK)
            INNER JOIN Campaigns c WITH (NOLOCK) ON cc.CampaignId = c.Id
            WHERE cc.OfferId = jo.Id AND c.Status = 'active' AND c.UserId = @UserId
          )
        ORDER BY jo.CreatedAt DESC
        OPTION (FAST ${limit}, OPTIMIZE FOR (@UserId = 1))
      `;
      
      const startTime = Date.now();
      const result = await request.query(query);
      const endTime = Date.now();
      
      const offers = result.recordset;
      
      console.log(`✅ ${offers.length} ofertas sin campaña encontradas en ${endTime - startTime}ms`);
      
      return res.json({
        success: true,
        data: {
          offers: offers,
          totalCount: offers.length,
          limit: limit,
          offset: offset,
          timestamp: new Date().toISOString(),
          queryTimeMs: endTime - startTime
        }
      });
    } else {
      // Super admin: retornar muestra limitada para evitar timeout
      console.log(`🔍 Super admin: retornando muestra limitada...`);
      
      const query = `
        SELECT TOP (100)
          jo.Id,
          jo.Title,
          jo.CompanyName,
          jo.City,
          jo.Region,
          jo.Sector,
          jo.SalaryMin,
          jo.SalaryMax,
          jo.CreatedAt,
          jo.StatusId
        FROM JobOffers jo WITH (NOLOCK)
        WHERE jo.StatusId = 1
        ORDER BY jo.CreatedAt DESC
        OPTION (FAST 100)
      `;
      
      const startTime = Date.now();
      const result = await request.query(query);
      const endTime = Date.now();
      
      const offers = result.recordset.slice(0, limit);
      
      console.log(`✅ ${offers.length} ofertas encontradas en ${endTime - startTime}ms (muestra limitada)`);
      
      return res.json({
        success: true,
        data: {
          offers: offers,
          totalCount: offers.length,
          limit: limit,
          offset: offset,
          timestamp: new Date().toISOString(),
          queryTimeMs: endTime - startTime,
          reason: 'superadmin_limited_sample'
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo ofertas sin campaña:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo ofertas sin campaña activa',
      details: error.message
    });
  }
});

/**
 * GET /api/offers/stats
 * Obtiene estadísticas básicas de ofertas (para alertas)
 * BYPASS TEMPORAL para evitar timeouts críticos
 */
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de ofertas (BYPASS TEMPORAL)...');
    
    await poolConnect;
    
    const request = pool.request();
    
    if (!isSuperAdmin(req)) {
      // Usuario normal: verificar conexiones primero
      request.input('UserId', sql.BigInt, req.userId);
      
      console.log(`🔍 Verificando conexiones para stats de usuario ${req.userId}...`);
      
      const connectionsResult = await request.query(`
        SELECT COUNT(*) as ConnectionCount
        FROM Connections WITH (NOLOCK)
        WHERE UserId = @UserId
      `);
      
      const connectionCount = parseInt(connectionsResult.recordset[0].ConnectionCount || 0);
      
      console.log(`📊 Usuario ${req.userId} tiene ${connectionCount} conexiones para stats`);
      
      if (connectionCount === 0) {
        // Usuario sin conexiones = estadísticas en 0 (correcto)
        console.log(`✅ Usuario sin conexiones: retornando stats en 0`);
        return res.json({
          success: true,
          data: {
            totalActiveOffers: 0,
            offersInActiveCampaigns: 0, 
            unassignedOffers: 0,
            timestamp: new Date().toISOString(),
            queryTimeMs: 0,
            reason: 'no_connections'
          }
        });
      } else {
        // Usuario con conexiones: solo contar ofertas SIN verificar campañas
        console.log(`🔍 Usuario con conexiones: contando ofertas simples...`);
        
        const startTime = Date.now();
        
        const totalResult = await request.query(`
          SELECT COUNT(*) as TotalActiveOffers
          FROM JobOffers jo WITH (NOLOCK)
          INNER JOIN Connections con WITH (NOLOCK) ON jo.ConnectionId = con.Id
          WHERE con.UserId = @UserId AND jo.StatusId = 1
          OPTION (FAST 1)
        `);
        
        const endTime = Date.now();
        
        const totalActiveOffers = parseInt(totalResult.recordset[0].TotalActiveOffers || 0);
        
        console.log(`📊 Stats completadas en ${endTime - startTime}ms: ${totalActiveOffers} ofertas totales (sin verificar campañas)`);
        
        return res.json({
          success: true,
          data: {
            totalActiveOffers,
            offersInActiveCampaigns: 0, // Bypass temporal
            unassignedOffers: totalActiveOffers, // Todas consideradas sin asignar temporalmente
            timestamp: new Date().toISOString(),
            queryTimeMs: endTime - startTime,
            reason: 'bypass_campaigns_stats'
          }
        });
      }
    } else {
      // Super admin: estadísticas simplificadas sin contar campañas
      console.log(`🔍 Super admin stats: conteo simplificado...`);
      
      const startTime = Date.now();
      
      const totalResult = await request.query(`
        SELECT COUNT(*) as TotalActiveOffers
        FROM JobOffers jo WITH (NOLOCK)
        WHERE jo.StatusId = 1
        OPTION (FAST 1)
      `);
      
      const endTime = Date.now();
      
      const totalActiveOffers = parseInt(totalResult.recordset[0].TotalActiveOffers || 0);
      
      console.log(`📊 Super admin stats completadas en ${endTime - startTime}ms: ${totalActiveOffers} ofertas totales`);
      
      return res.json({
        success: true,
        data: {
          totalActiveOffers,
          offersInActiveCampaigns: 0, // Bypass temporal
          unassignedOffers: totalActiveOffers, // Todas consideradas sin asignar temporalmente
          timestamp: new Date().toISOString(),
          queryTimeMs: endTime - startTime,
          reason: 'superadmin_bypass_campaigns_stats'
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de ofertas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas de ofertas',
      details: error.message
    });
  }
});

module.exports = router;