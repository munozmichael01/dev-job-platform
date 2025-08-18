/**
 * 📊 API Routes para Sincronización de Métricas
 * 
 * Endpoints para gestionar el sync de datos reales desde canales externos
 * 
 * @author Claude Code
 * @date 2025-01-17
 */

const express = require('express');
const router = express.Router();
const MetricsSync = require('../services/metricsSync');

// Instancia global del servicio de sync
const metricsSync = new MetricsSync();

/**
 * POST /api/metrics-sync/start
 * Inicia el servicio de sync automático
 */
router.post('/start', async (req, res) => {
  try {
    console.log('🔄 Iniciando servicio de sync automático de métricas');
    
    await metricsSync.startAutomaticSync();
    
    res.json({
      success: true,
      message: 'Servicio de sync automático iniciado',
      frequency: '5 minutos',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error iniciando sync automático:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/metrics-sync/stop
 * Detiene el servicio de sync automático
 */
router.post('/stop', async (req, res) => {
  try {
    console.log('⏹️ Deteniendo servicio de sync automático');
    
    metricsSync.stopAutomaticSync();
    
    res.json({
      success: true,
      message: 'Servicio de sync automático detenido',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error deteniendo sync automático:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/metrics-sync/sync-all
 * Fuerza sync inmediato de todas las campañas activas
 */
router.post('/sync-all', async (req, res) => {
  try {
    console.log('🔄 Forzando sync de todas las campañas activas');
    
    const result = await metricsSync.syncAllCampaignMetrics();
    
    res.json({
      success: true,
      message: 'Sync completo de todas las campañas',
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error sync completo:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/metrics-sync/campaign/:campaignId
 * Fuerza sync inmediato de una campaña específica
 */
router.post('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { userId } = req.body; // Usuario desde el body o auth

    console.log(`🔄 Forzando sync campaña ${campaignId}`);
    
    const result = await metricsSync.forceSyncCampaign(
      parseInt(campaignId), 
      userId || 1 // Default user para testing
    );
    
    res.json({
      success: true,
      message: `Sync completado para campaña ${campaignId}`,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error sync campaña ${req.params.campaignId}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      campaignId: req.params.campaignId
    });
  }
});

/**
 * GET /api/metrics-sync/campaign/:campaignId/metrics
 * Obtiene las métricas actuales de una campaña
 */
router.get('/campaign/:campaignId/metrics', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    console.log(`📊 Obteniendo métricas campaña ${campaignId}`);
    
    const metrics = await metricsSync.getCurrentMetrics(parseInt(campaignId));
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Campaña no encontrada'
      });
    }
    
    res.json({
      success: true,
      campaignId: parseInt(campaignId),
      metrics: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error obteniendo métricas campaña ${req.params.campaignId}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      campaignId: req.params.campaignId
    });
  }
});

/**
 * GET /api/metrics-sync/status
 * Obtiene el estado del servicio de sync
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      isRunning: metricsSync.isRunning,
      syncInterval: metricsSync.syncIntervalMinutes,
      lastSyncStatus: 'Available via individual campaign endpoints',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      status: status
    });

  } catch (error) {
    console.error('❌ Error obteniendo estado sync:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/metrics-sync/demo-metrics/:campaignId
 * Genera métricas demo para testing (desarrollo)
 */
router.post('/demo-metrics/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { channelId = 'jooble' } = req.body;
    
    console.log(`🎮 Generando métricas demo para campaña ${campaignId}, canal ${channelId}`);
    
    await metricsSync.generateDemoMetrics(parseInt(campaignId), channelId);
    
    // Obtener métricas actualizadas
    const metrics = await metricsSync.getCurrentMetrics(parseInt(campaignId));
    
    res.json({
      success: true,
      message: 'Métricas demo generadas',
      campaignId: parseInt(campaignId),
      channelId: channelId,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error generando métricas demo:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;