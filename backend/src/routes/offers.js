const express = require('express');
const { pool, poolConnect, sql } = require('../db/db');
const router = express.Router();

/**
 * GET /api/offers/unassigned
 * Obtiene ofertas que NO están asignadas a ninguna campaña activa
 */
router.get('/unassigned', async (req, res) => {
  try {
    console.log('🔍 Obteniendo ofertas sin campaña activa...');
    
    await poolConnect;
    
    // Parámetros de paginación
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    // Query optimizado: primero obtenemos los IDs de ofertas en campañas activas
    // y luego hacemos LEFT JOIN para excluirlas
    const result = await pool.request()
      .input('Limit', sql.Int, limit)
      .input('Offset', sql.Int, offset)
      .query(`
        WITH OffersInActiveCampaigns AS (
          SELECT DISTINCT cc.OfferId
          FROM CampaignChannels cc
          INNER JOIN Campaigns c ON cc.CampaignId = c.Id
          WHERE c.Status = 'active'
        )
        SELECT 
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
        FROM JobOffers jo
        LEFT JOIN OffersInActiveCampaigns oiac ON jo.Id = oiac.OfferId
        WHERE jo.StatusId = 1  -- Solo ofertas activas
          AND oiac.OfferId IS NULL  -- No están en ninguna campaña activa
        ORDER BY jo.CreatedAt DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
      `);
    
    const unassignedOffers = result.recordset;
    
    console.log(`✅ ${unassignedOffers.length} ofertas reales sin campaña activa encontradas`);
    
    res.json({
      success: true,
      data: {
        offers: unassignedOffers,
        totalCount: unassignedOffers.length,
        limit: limit,
        offset: offset,
        timestamp: new Date().toISOString()
      }
    });
    
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
 */
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de ofertas...');
    
    await poolConnect;
    
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalActiveOffers,
        COUNT(DISTINCT cc.OfferId) as OffersInActiveCampaigns,
        (COUNT(*) - COUNT(DISTINCT cc.OfferId)) as UnassignedOffers
      FROM JobOffers jo
      LEFT JOIN CampaignChannels cc ON jo.Id = cc.OfferId 
        AND cc.CampaignId IN (
          SELECT Id FROM Campaigns WHERE Status = 'active'
        )
      WHERE jo.StatusId = 1  -- Solo ofertas activas
    `);
    
    const stats = result.recordset[0];
    
    console.log(`📊 Estadísticas: ${stats.TotalActiveOffers} total, ${stats.UnassignedOffers} sin campaña`);
    
    res.json({
      success: true,
      data: {
        totalActiveOffers: parseInt(stats.TotalActiveOffers || 0),
        offersInActiveCampaigns: parseInt(stats.OffersInActiveCampaigns || 0), 
        unassignedOffers: parseInt(stats.UnassignedOffers || 0),
        timestamp: new Date().toISOString()
      }
    });
    
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