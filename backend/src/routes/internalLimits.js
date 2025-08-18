const express = require('express');
const router = express.Router();
const { InternalLimitsController } = require('../services/internalLimitsController');

// Instancia del controlador
const limitsController = new InternalLimitsController();

/**
 * POST /api/internal-limits/check/:campaignId
 * Verifica límites internos para una campaña específica
 */
router.post('/check/:campaignId', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    
    if (!campaignId || campaignId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'ID de campaña inválido'
      });
    }
    
    console.log(`🔍 API: Verificando límites internos para campaña ${campaignId}`);
    
    const result = await limitsController.checkCampaignLimits(campaignId);
    
    return res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error(`❌ Error en API check límites: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/internal-limits/enforce-cpc/:campaignId
 * Fuerza el cumplimiento del límite de CPC para una campaña específica
 */
router.post('/enforce-cpc/:campaignId', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const { maxCPC, dryRun = false } = req.body;
    
    if (!campaignId || isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de campaña inválido'
      });
    }
    
    if (!maxCPC || maxCPC <= 0) {
      return res.status(400).json({
        success: false,
        error: 'maxCPC es requerido y debe ser mayor a 0'
      });
    }
    
    // Validar pujas actuales
    const validation = await limitsController.validateChannelBids(campaignId, maxCPC);
    
    if (dryRun) {
      // Solo mostrar qué se haría sin ejecutar cambios
      return res.json({
        success: true,
        dryRun: true,
        maxCPC: parseFloat(maxCPC).toFixed(2),
        validation,
        message: validation.valid 
          ? 'Todas las pujas están dentro del límite'
          : `${validation.violationsCount} pujas exceden el límite`
      });
    }
    
    // Aplicar enforcement si hay violaciones
    if (!validation.valid) {
      const result = await limitsController.enforceCPCLimits(campaignId, maxCPC, 'manual_enforcement');
      
      res.json({
        success: true,
        enforcement: result,
        maxCPC: parseFloat(maxCPC).toFixed(2),
        message: `${result.reduced} pujas reducidas automáticamente`
      });
    } else {
      res.json({
        success: true,
        maxCPC: parseFloat(maxCPC).toFixed(2),
        message: 'Todas las pujas ya están dentro del límite'
      });
    }
    
  } catch (error) {
    console.error('❌ Error aplicando límites de CPC:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/internal-limits/cpc-analysis/:campaignId
 * Obtiene análisis detallado del CPC para una campaña
 */
router.get('/cpc-analysis/:campaignId', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    
    if (!campaignId || isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de campaña inválido'
      });
    }
    
    // Obtener métricas de CPC detalladas
    const currentCPA = await limitsController.getCurrentCPA(campaignId);
    const avgCPC = await limitsController.getAverageCPC(campaignId);
    const lastDayCPA = await limitsController.getLastDayAverageCPA(campaignId);
    
    // Obtener configuración interna
    const campaignData = await limitsController.getCampaignBasicInfo(campaignId);
    const internalConfig = limitsController.parseInternalConfig(campaignData.InternalConfig);
    const maxCPC = parseFloat(internalConfig.maxCPC || campaignData.MaxCPA) || null;
    
    // Validar pujas actuales si hay límite configurado
    let channelValidation = null;
    if (maxCPC && maxCPC > 0) {
      channelValidation = await limitsController.validateChannelBids(campaignId, maxCPC);
    }
    
    res.json({
      success: true,
      data: {
        campaignId,
        metrics: {
          currentCPA: currentCPA.toFixed(2),
          avgCPC: avgCPC.toFixed(2),
          lastDayCPA: lastDayCPA.toFixed(2),
          maxCPC: maxCPC ? maxCPC.toFixed(2) : 'No configurado'
        },
        limits: {
          hasLimit: maxCPC > 0,
          maxCPC: maxCPC ? maxCPC.toFixed(2) : null,
          withinLimit: maxCPC ? currentCPA <= maxCPC : true,
          usage: maxCPC ? ((currentCPA / maxCPC) * 100).toFixed(1) + '%' : 'N/A'
        },
        channelValidation,
        trends: {
          vs24h: lastDayCPA > 0 ? {
            change: ((currentCPA / lastDayCPA - 1) * 100).toFixed(1) + '%',
            increasing: currentCPA > lastDayCPA * 1.05
          } : null
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo análisis de CPC:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/internal-limits/check-all
 * Verifica límites internos para todas las campañas activas
 */
router.post('/check-all', async (req, res) => {
  try {
    console.log('🔍 API: Verificando límites internos para todas las campañas activas');
    
    const result = await limitsController.checkAllActiveCampaigns();
    
    return res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error(`❌ Error en API check-all límites: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/internal-limits/status
 * Obtiene el estado del controlador de límites
 */
router.get('/status', (req, res) => {
  try {
    const status = {
      service: 'InternalLimitsController',
      active: true,
      checkFrequency: limitsController.config.checkFrequency,
      alertThresholds: limitsController.config.alertThresholds,
      lastCheck: new Date().toISOString()
    };
    
    return res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error(`❌ Error obteniendo status: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/internal-limits/force-pause/:campaignId
 * Fuerza el pausado de una campaña por límites internos
 */
router.post('/force-pause/:campaignId', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const { reason, data } = req.body;
    
    if (!campaignId || campaignId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'ID de campaña inválido'
      });
    }
    
    console.log(`⏸️ API: Forzando pausa de campaña ${campaignId} por: ${reason}`);
    
    await limitsController.pauseCampaignDueToLimits(campaignId, reason, data);
    
    return res.json({
      success: true,
      message: `Campaña ${campaignId} pausada por: ${reason}`
    });
    
  } catch (error) {
    console.error(`❌ Error forzando pausa: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

