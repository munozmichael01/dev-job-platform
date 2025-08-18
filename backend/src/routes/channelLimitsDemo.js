const express = require('express');
const router = express.Router();
const { ChannelLimitsMiddleware } = require('../middleware/channelLimitsMiddleware');

/**
 * Router de demostración para ChannelLimitsMiddleware
 * 
 * Demuestra cómo el middleware es extensible a cualquier canal
 * (Jooble, Indeed, LinkedIn, InfoJobs, etc.)
 */

const limitsMiddleware = new ChannelLimitsMiddleware();

/**
 * POST /api/channel-limits-demo/validate/:channel
 * Demuestra validación pre-envío para cualquier canal
 */
router.post('/validate/:channel', async (req, res) => {
  try {
    const channelName = req.params.channel;
    const { campaignData, payloadToChannel, internalData } = req.body;
    
    if (!campaignData || !payloadToChannel || !internalData) {
      return res.status(400).json({
        success: false,
        error: 'campaignData, payloadToChannel e internalData son requeridos'
      });
    }
    
    // Validar usando el middleware común
    const validation = await limitsMiddleware.validateBeforeSend(
      channelName,
      campaignData,
      payloadToChannel,
      internalData
    );
    
    res.json({
      success: true,
      channel: channelName,
      validation,
      message: validation.valid 
        ? 'Validación exitosa - listo para enviar'
        : 'Validación falló - revisar errores'
    });
    
  } catch (error) {
    console.error('❌ Error en demostración de validación:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/channel-limits-demo/monitor/:channel/:campaignId
 * Demuestra monitoreo post-envío para cualquier canal
 */
router.post('/monitor/:channel/:campaignId', async (req, res) => {
  try {
    const channelName = req.params.channel;
    const campaignId = parseInt(req.params.campaignId);
    const { channelResponse } = req.body;
    
    if (!campaignId || isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'campaignId debe ser un número válido'
      });
    }
    
    // Monitorear usando el middleware común
    const monitoring = await limitsMiddleware.monitorAfterSend(
      channelName,
      campaignId,
      channelResponse || {}
    );
    
    res.json({
      success: true,
      channel: channelName,
      campaignId,
      monitoring,
      message: `Monitoreo activo: ${monitoring.alerts.length} alertas, ${monitoring.actions.length} acciones`
    });
    
  } catch (error) {
    console.error('❌ Error en demostración de monitoreo:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/channel-limits-demo/policies
 * Muestra todas las políticas de canales registradas
 */
router.get('/policies', (req, res) => {
  try {
    const stats = limitsMiddleware.getUsageStats();
    
    res.json({
      success: true,
      data: {
        totalChannels: stats.channelsRegistered,
        policies: stats.channelPolicies,
        limitsController: stats.limitsController
      },
      message: 'Políticas de todos los canales registrados'
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo políticas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/channel-limits-demo/register-policy
 * Registra una nueva política para un canal personalizado
 */
router.post('/register-policy', (req, res) => {
  try {
    const { channelName, policy } = req.body;
    
    if (!channelName || !policy) {
      return res.status(400).json({
        success: false,
        error: 'channelName y policy son requeridos'
      });
    }
    
    // Registrar nueva política
    limitsMiddleware.registerChannelPolicy(channelName, policy);
    
    res.json({
      success: true,
      message: `Política registrada para canal: ${channelName}`,
      registeredPolicy: limitsMiddleware.getChannelPolicy(channelName)
    });
    
  } catch (error) {
    console.error('❌ Error registrando política:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/channel-limits-demo/simulate-indeed
 * Simula integración con Indeed usando el middleware común
 */
router.post('/simulate-indeed', async (req, res) => {
  try {
    const campaignData = {
      Id: 123,
      Name: 'Campaña Indeed Test',
      MaxCPA: 0.25,
      Status: 'active',
      InternalConfig: JSON.stringify({
        maxCPC: 0.25,
        dailyBudget: 50,
        startDate: '2025-01-08',
        endDate: '2025-02-08'
      })
    };
    
    const payloadToIndeed = {
      campaignName: 'Campaña Indeed Test',
      dailyBudget: 50,
      maxCpc: 0.25,
      keywords: ['developer', 'programador', 'software'],
      targeting: {
        locations: ['Madrid', 'Barcelona'],
        experienceLevel: 'mid'
      }
    };
    
    const internalData = {
      maxCPC: 0.25,
      dailyBudget: 50,
      totalBudget: 1500,
      startDate: '2025-01-08',
      endDate: '2025-02-08'
    };
    
    // Validar usando el middleware
    const validation = await limitsMiddleware.validateBeforeSend(
      'indeed',
      campaignData,
      payloadToIndeed,
      internalData
    );
    
    res.json({
      success: true,
      simulation: 'Indeed Campaign Creation',
      channel: 'indeed',
      campaignData,
      payloadToIndeed,
      internalData,
      validation,
      note: 'Esta es una simulación de cómo Indeed usaría el mismo middleware que Jooble'
    });
    
  } catch (error) {
    console.error('❌ Error en simulación de Indeed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error en simulación',
      details: error.message
    });
  }
});

/**
 * POST /api/channel-limits-demo/simulate-linkedin
 * Simula integración con LinkedIn usando el middleware común
 */
router.post('/simulate-linkedin', async (req, res) => {
  try {
    const campaignData = {
      Id: 456,
      Name: 'Campaña LinkedIn Test',
      MaxCPA: 1.50,
      Status: 'active',
      InternalConfig: JSON.stringify({
        maxCPC: 1.50,
        dailyBudget: 100,
        startDate: '2025-01-08',
        endDate: '2025-03-08'
      })
    };
    
    const payloadToLinkedIn = {
      name: 'Campaña LinkedIn Test',
      account: 'urn:li:sponsoredAccount:123456789',
      type: 'SPONSORED_UPDATES',
      costType: 'CPC',
      dailyBudget: {
        currencyCode: 'EUR',
        amount: '100.00'
      },
      bid: {
        currencyCode: 'EUR',
        amount: '1.50'
      },
      targeting: {
        includedTargetingFacets: {
          locations: ['es:0'],
          jobFunctions: ['4'], // Engineering
          seniorities: ['3', '4'] // Mid-level, Senior
        }
      }
    };
    
    const internalData = {
      maxCPC: 1.50,
      dailyBudget: 100,
      totalBudget: 6000,
      startDate: '2025-01-08',
      endDate: '2025-03-08'
    };
    
    // Validar usando el middleware
    const validation = await limitsMiddleware.validateBeforeSend(
      'linkedin',
      campaignData,
      payloadToLinkedIn,
      internalData
    );
    
    res.json({
      success: true,
      simulation: 'LinkedIn Campaign Creation',
      channel: 'linkedin',
      campaignData,
      payloadToLinkedIn,
      internalData,
      validation,
      note: 'LinkedIn maneja presupuesto nativamente pero respeta límites de CPC y fechas internos'
    });
    
  } catch (error) {
    console.error('❌ Error en simulación de LinkedIn:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error en simulación',
      details: error.message
    });
  }
});

/**
 * GET /api/channel-limits-demo/examples
 * Proporciona ejemplos de cómo integrar nuevos canales
 */
router.get('/examples', (req, res) => {
  const examples = {
    message: 'Ejemplos de integración del ChannelLimitsMiddleware',
    integration_steps: [
      '1. Instanciar ChannelLimitsMiddleware en el servicio del canal',
      '2. Llamar validateBeforeSend() antes de enviar payload al canal externo',
      '3. Llamar monitorAfterSend() después de crear la campaña',
      '4. Opcionalmente registrar política específica con registerChannelPolicy()'
    ],
    code_example: {
      service_constructor: `
// En YourChannelService.js
const { ChannelLimitsMiddleware } = require('../middleware/channelLimitsMiddleware');

class YourChannelService {
  constructor() {
    this.limitsMiddleware = new ChannelLimitsMiddleware();
  }
}`,
      pre_send_validation: `
// Antes de enviar a canal externo
const validation = await this.limitsMiddleware.validateBeforeSend(
  'your-channel',
  campaignData,
  payloadToChannel,
  internalData
);

if (!validation.valid) {
  throw new Error('Límites internos excedidos: ' + validation.errors.join(', '));
}`,
      post_send_monitoring: `
// Después de enviar a canal externo
const monitoring = await this.limitsMiddleware.monitorAfterSend(
  'your-channel',
  campaignId,
  channelResponse
);

console.log('Monitoreo iniciado:', monitoring);`,
      custom_policy: `
// Registrar política específica del canal
this.limitsMiddleware.registerChannelPolicy('your-channel', {
  enforceBudgetLimits: true,
  enforceDateLimits: false, // Si el canal maneja fechas nativamente
  enforceCPCLimits: true,
  allowOverrides: true,
  preValidation: true,
  postValidation: true,
  autoActions: false // Si requiere aprobación manual
});`
    },
    supported_channels: {
      jooble: 'Control total interno (implementado)',
      indeed: 'Control parcial - fechas nativas',
      linkedin: 'Control parcial - presupuesto nativo',
      infojobs: 'Control total interno',
      whatjobs: 'Control total interno',
      custom: 'Configurable según capacidades del canal'
    }
  };
  
  res.json(examples);
});

module.exports = router;
