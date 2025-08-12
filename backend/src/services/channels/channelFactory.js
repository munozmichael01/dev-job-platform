const TalentService = require('./talentService');
const JoobleService = require('./joobleService');
const JobRapidoService = require('./jobRapidoService');

/**
 * ChannelFactory - Factory pattern para manejo unificado de canales
 * 
 * Proporciona una interfaz común para interactuar con diferentes canales
 * de distribución de ofertas (Talent, Jooble, InfoJobs, LinkedIn, Indeed)
 */
class ChannelFactory {
  
  constructor() {
    this.channels = new Map();
    this.supportedChannels = ['talent', 'jooble', 'jobrapido', 'infojobs', 'linkedin', 'indeed'];
    
    console.log('🏭 ChannelFactory inicializado con soporte para:', this.supportedChannels.join(', '));
  }

  /**
   * Obtiene una instancia del servicio de un canal específico
   * @param {String} channelId - ID del canal (talent, jooble, etc.)
   * @param {Object} config - Configuración específica del canal
   * @param {Number} userId - ID del usuario (para credenciales específicas)
   * @returns {Object} Instancia del servicio del canal
   */
  async getChannel(channelId, config = {}, userId = null) {
    // Crear clave única que incluya userId para cache por usuario
    const cacheKey = userId ? `${channelId}_${userId}` : channelId;
    
    if (this.channels.has(cacheKey)) {
      return this.channels.get(cacheKey);
    }

    // Si hay userId, obtener credenciales específicas del usuario
    let finalConfig = { ...config };
    
    if (userId) {
      try {
        const CredentialsManager = require('../credentialsManager');
        const credentialsManager = new CredentialsManager();
        
        const userCredentials = await credentialsManager.getUserChannelCredentials(userId, channelId);
        
        // Combinar credenciales del usuario con config proporcionado
        finalConfig = {
          ...finalConfig,
          ...userCredentials.credentials,
          userLimits: userCredentials.limits,
          userConfiguration: userCredentials.configuration
        };
        
        console.log(`🔐 Usando credenciales específicas del usuario ${userId} para canal ${channelId}`);
        
      } catch (error) {
        console.warn(`⚠️ No se pudieron cargar credenciales del usuario ${userId} para ${channelId}: ${error.message}`);
        // Continuar con configuración por defecto
      }
    }

    let channelService;
    
    switch (channelId.toLowerCase()) {
      case 'talent':
        channelService = new TalentService(finalConfig);
        break;
        
      case 'jooble':
        channelService = new JoobleService(finalConfig);
        break;
        
      case 'jobrapido':
        channelService = new JobRapidoService(finalConfig);
        break;
        
      case 'infojobs':
        channelService = new InfoJobsService(finalConfig);
        break;
        
      case 'linkedin':
        channelService = new LinkedInService(finalConfig);
        break;
        
      case 'indeed':
        channelService = new IndeedService(finalConfig);
        break;
        
      default:
        throw new Error(`Canal no soportado: ${channelId}. Canales disponibles: ${this.supportedChannels.join(', ')}`);
    }
    
    this.channels.set(cacheKey, channelService);
    console.log(`✅ Servicio ${channelId} inicializado${userId ? ` para usuario ${userId}` : ''}`);
    
    return channelService;
  }

  /**
   * Publica ofertas en múltiples canales de forma paralela
   * @param {Array} channelIds - IDs de canales donde publicar
   * @param {Array} offers - Ofertas a publicar
   * @param {Object} campaignData - Datos de la campaña
   * @param {Number} userId - ID del usuario (para credenciales específicas)
   * @returns {Object} Resultados de publicación por canal
   */
  async publishToMultipleChannels(channelIds, offers, campaignData, userId = null) {
    console.log(`🚀 Publicando ${offers.length} ofertas en ${channelIds.length} canales: ${channelIds.join(', ')}`);
    
    const publishPromises = channelIds.map(async (channelId) => {
      try {
        const channel = await this.getChannel(channelId, {}, userId);
        const result = await this.publishToChannel(channel, channelId, offers, campaignData);
        
        return {
          channelId: channelId,
          success: true,
          result: result
        };
        
      } catch (error) {
        console.error(`❌ Error publicando en ${channelId}: ${error.message}`);
        return {
          channelId: channelId,
          success: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.allSettled(publishPromises);
    
    const summary = {
      totalChannels: channelIds.length,
      successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
      failed: results.filter(r => r.status === 'rejected' || !r.value.success).length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason.message }),
      timestamp: new Date().toISOString()
    };
    
    console.log(`✅ Publicación completada: ${summary.successful}/${summary.totalChannels} canales exitosos`);
    return summary;
  }

  /**
   * Publica en un canal específico usando su método apropiado
   * @param {Object} channelService - Instancia del servicio del canal
   * @param {String} channelId - ID del canal
   * @param {Array} offers - Ofertas
   * @param {Object} campaignData - Datos de campaña
   * @returns {Object} Resultado de la publicación
   */
  async publishToChannel(channelService, channelId, offers, campaignData) {
    switch (channelId.toLowerCase()) {
      case 'talent':
        return await channelService.publishOffers(offers, campaignData);
        
      case 'jooble':
        const budgetInfo = this.calculateChannelBudget(campaignData, channelId);
        return await channelService.createCampaign(campaignData, offers, budgetInfo);
        
      case 'jobrapido':
        return await channelService.publishOffers(offers, campaignData);
        
      case 'infojobs':
      case 'linkedin':
      case 'indeed':
        // Por ahora simular - implementar cuando tengamos APIs
        return this.simulatePublication(channelId, offers, campaignData);
        
      default:
        throw new Error(`Método de publicación no definido para canal: ${channelId}`);
    }
  }

  /**
   * Calcula presupuesto específico para un canal
   * @param {Object} campaignData - Datos de campaña
   * @param {String} channelId - ID del canal
   * @returns {Object} Información de presupuesto para el canal
   */
  calculateChannelBudget(campaignData, channelId) {
    const totalBudget = campaignData.budget || 0;
    const totalChannels = campaignData.channels ? campaignData.channels.length : 1;
    
    // Distribución básica equitativa (puede mejorarse con algoritmo inteligente)
    const channelBudget = Math.floor(totalBudget / totalChannels);
    
    // CPAs específicos por canal (basado en históricos)
    const channelCPAs = {
      'talent': 18,
      'jooble': 15,
      'jobrapido': 12,  // Organic, mejor CPA por no tener costo directo
      'infojobs': 20,
      'linkedin': 25,
      'indeed': 22
    };
    
    const maxCPA = channelCPAs[channelId] || 20;
    const dailyBudget = Math.floor(channelBudget / 30); // Asumir 30 días
    
    return {
      totalBudget: channelBudget,
      dailyBudget: dailyBudget,
      maxCPA: maxCPA,
      maxCPC: Math.floor(maxCPA * 0.8), // CPC = 80% del CPA
      targetApplications: Math.floor(channelBudget / maxCPA)
    };
  }

  /**
   * Actualiza estadísticas de performance en múltiples canales
   * @param {Array} channelIds - IDs de canales
   * @param {Array} offerIds - IDs de ofertas
   * @returns {Object} Estadísticas consolidadas
   */
  async updatePerformanceStats(channelIds, offerIds) {
    console.log(`📊 Actualizando estadísticas para ${channelIds.length} canales`);
    
    const updatePromises = channelIds.map(async (channelId) => {
      try {
        const channel = this.getChannel(channelId);
        
        let stats;
        if (channel.updatePerformanceStats) {
          stats = await channel.updatePerformanceStats(offerIds);
        } else if (channel.getStatistics) {
          stats = await channel.getStatistics();
        } else {
          stats = this.simulatePerformanceStats(channelId, offerIds);
        }
        
        return {
          channelId: channelId,
          success: true,
          stats: stats
        };
        
      } catch (error) {
        console.error(`❌ Error actualizando stats de ${channelId}: ${error.message}`);
        return {
          channelId: channelId,
          success: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.allSettled(updatePromises);
    
    return {
      totalChannels: channelIds.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason.message }),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Controla el estado de campañas en múltiples canales
   * @param {Array} channelCampaigns - Array de {channelId, campaignId}
   * @param {String} action - Acción: 'pause', 'resume', 'delete'
   * @returns {Object} Resultados por canal
   */
  async controlMultipleChannelCampaigns(channelCampaigns, action) {
    console.log(`🔄 ${action} en ${channelCampaigns.length} campañas de canales`);
    
    const controlPromises = channelCampaigns.map(async ({ channelId, campaignId }) => {
      try {
        const channel = this.getChannel(channelId);
        let result;
        
        switch (action) {
          case 'pause':
            result = channel.pauseCampaign ? await channel.pauseCampaign(campaignId) : 
                     channel.controlOffers ? await channel.controlOffers([campaignId], 'pause') :
                     this.simulateControl(channelId, campaignId, action);
            break;
            
          case 'resume':
            result = channel.resumeCampaign ? await channel.resumeCampaign(campaignId) :
                     channel.controlOffers ? await channel.controlOffers([campaignId], 'resume') :
                     this.simulateControl(channelId, campaignId, action);
            break;
            
          case 'delete':
            result = channel.deleteCampaign ? await channel.deleteCampaign(campaignId) :
                     this.simulateControl(channelId, campaignId, action);
            break;
            
          default:
            throw new Error(`Acción no soportada: ${action}`);
        }
        
        return {
          channelId: channelId,
          campaignId: campaignId,
          success: true,
          result: result
        };
        
      } catch (error) {
        console.error(`❌ Error en ${action} de ${channelId}/${campaignId}: ${error.message}`);
        return {
          channelId: channelId,
          campaignId: campaignId,
          success: false,
          error: error.message
        };
      }
    });
    
    const results = await Promise.allSettled(controlPromises);
    
    return {
      action: action,
      totalCampaigns: channelCampaigns.length,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason.message }),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtiene información de configuración de todos los canales
   * @returns {Object} Información de canales disponibles
   */
  getChannelsInfo() {
    return {
      supported: this.supportedChannels,
      initialized: Array.from(this.channels.keys()),
      configurations: {
        talent: {
          type: 'xml_feed',
          features: ['xml_publishing', 'application_tracking', 'screening_questions'],
          costModel: 'cpa',
          avgCPA: 18
        },
        jooble: {
          type: 'auction_api',
          features: ['campaign_management', 'bidding', 'performance_analytics'],
          costModel: 'cpc',
          avgCPA: 15
        },
        jobrapido: {
          type: 'feed_based',
          features: ['xml_json_feeds', 'custom_screening_questions', 'cv_base64_delivery', 'detailed_candidate_data'],
          costModel: 'organic',
          avgCPA: 12
        },
        infojobs: {
          type: 'api',
          features: ['job_posting', 'application_management'],
          costModel: 'cpa',
          avgCPA: 20,
          status: 'pending_implementation'
        },
        linkedin: {
          type: 'api',
          features: ['job_posting', 'promoted_jobs', 'analytics'],
          costModel: 'cpc',
          avgCPA: 25,
          status: 'pending_implementation'
        },
        indeed: {
          type: 'xml_api',
          features: ['xml_feed', 'sponsored_jobs', 'analytics'],
          costModel: 'cpc',
          avgCPA: 22,
          status: 'pending_implementation'
        }
      }
    };
  }

  // Métodos de simulación para canales no implementados

  /**
   * Simula publicación en canal no implementado
   */
  simulatePublication(channelId, offers, campaignData) {
    console.log(`🔧 Simulando publicación en ${channelId}`);
    return {
      success: true,
      channel: channelId,
      simulation: true,
      publishedOffers: offers.length,
      estimatedReach: Math.floor(Math.random() * 10000) + 1000,
      estimatedCost: Math.floor(Math.random() * 500) + 100,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simula estadísticas de performance
   */
  simulatePerformanceStats(channelId, offerIds) {
    console.log(`🔧 Simulando estadísticas de ${channelId}`);
    return {
      success: true,
      channel: channelId,
      simulation: true,
      stats: offerIds.map(offerId => ({
        offerId: offerId,
        views: Math.floor(Math.random() * 1000) + 100,
        clicks: Math.floor(Math.random() * 100) + 10,
        applications: Math.floor(Math.random() * 20) + 1,
        spend: Math.floor(Math.random() * 100) + 20
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simula control de campaña
   */
  simulateControl(channelId, campaignId, action) {
    console.log(`🔧 Simulando ${action} en ${channelId}/${campaignId}`);
    return {
      success: true,
      channel: channelId,
      campaignId: campaignId,
      action: action,
      simulation: true,
      timestamp: new Date().toISOString()
    };
  }
}

// Placeholders para servicios no implementados (InfoJobs, LinkedIn, Indeed)
// Estas clases se implementarán cuando tengamos acceso a sus APIs

class InfoJobsService {
  constructor(config) {
    this.config = config;
    console.log('🔧 InfoJobsService en modo placeholder - implementación pendiente');
  }
}

class LinkedInService {
  constructor(config) {
    this.config = config;
    console.log('🔧 LinkedInService en modo placeholder - implementación pendiente');
  }
}

class IndeedService {
  constructor(config) {
    this.config = config;
    console.log('🔧 IndeedService en modo placeholder - implementación pendiente');
  }
}

module.exports = ChannelFactory;
