const axios = require('axios');

/**
 * JoobleService - Integración con Jooble Auction API
 * Basado en documentación Jooble Auction Controller
 * 
 * Funcionalidades:
 * - Gestión de campañas de subastas CPC
 * - Control de bids y presupuestos por oferta
 * - Tracking de performance y estadísticas detalladas
 * - Reglas de segmentación avanzadas
 */
class JoobleService {
  
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.JOOBLE_API_KEY,
      countryCode: config.countryCode || process.env.JOOBLE_COUNTRY || 'es', // España por defecto
      baseUrl: `https://${config.countryCode || 'es'}.jooble.org/auction/api`,
      defaultTimeout: config.timeout || 30000,
      ...config
    };
    
    if (!this.config.apiKey) {
      console.warn('⚠️ JOOBLE_API_KEY no configurada. Funcionará en modo simulación.');
    }

    // Configuración de axios para Jooble API
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.defaultTimeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'JobPlatform-Integration/1.0'
      }
    });
  }

  /**
   * Crea una campaña de subastas en Jooble
   * @param {Object} campaignData - Datos de la campaña
   * @param {Array} offers - Ofertas incluidas en la campaña
   * @param {Object} budgetInfo - Información de presupuesto y bids
   * @returns {Object} Resultado de la creación
   */
  async createCampaign(campaignData, offers, budgetInfo) {
    console.log(`🎯 Creando campaña en Jooble: "${campaignData.name}" con ${offers.length} ofertas`);
    
    try {
      const campaignPayload = this.buildCampaignPayload(campaignData, offers, budgetInfo);
      
      if (!this.config.apiKey) {
        // Modo simulación
        return this.simulateCreateCampaign(campaignPayload);
      }
      
      const response = await this.httpClient.post(`/createCampaign/${this.config.apiKey}`, campaignPayload);
      
      console.log(`✅ Campaña creada en Jooble con ID: ${response.data.campaignId || 'unknown'}`);
      return {
        success: true,
        channel: 'jooble',
        campaignId: response.data.campaignId,
        data: response.data,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error creando campaña en Jooble: ${error.message}`);
      throw error;
    }
  }

  /**
   * Construye el payload para crear campaña según especificaciones de Jooble
   * @param {Object} campaignData - Datos de la campaña
   * @param {Array} offers - Ofertas
   * @param {Object} budgetInfo - Info de presupuesto
   * @returns {Object} Payload para API de Jooble
   */
  buildCampaignPayload(campaignData, offers, budgetInfo) {
    const segmentationRules = this.buildSegmentationRules(offers, campaignData);
    
    return {
      name: campaignData.name || 'Campaña Job Platform',
      dailyBudget: budgetInfo.dailyBudget || Math.floor(campaignData.budget / 30),
      maxCPC: budgetInfo.maxCPC || campaignData.maxCPA || 25,
      startDate: campaignData.startDate || new Date().toISOString().split('T')[0],
      endDate: campaignData.endDate || this.calculateEndDate(campaignData),
      status: 0, // InProgress
      segmentationRules: segmentationRules,
      timezone: 'Europe/Madrid',
      bidStrategy: campaignData.bidStrategy || 'automatic',
      
      // Configuraciones adicionales
      targeting: {
        locations: this.extractLocations(offers),
        companies: this.extractCompanies(offers),
        jobTitles: this.extractJobTitles(offers)
      },
      
      // Tracking y analytics
      trackingParams: {
        source: 'job_platform',
        campaign_id: campaignData.id,
        utm_campaign: campaignData.name?.toLowerCase().replace(/\s+/g, '_')
      }
    };
  }

  /**
   * Construye reglas de segmentación para Jooble según tipos disponibles
   * @param {Array} offers - Ofertas
   * @param {Object} campaignData - Datos de campaña
   * @returns {Array} Reglas de segmentación
   */
  buildSegmentationRules(offers, campaignData) {
    const rules = [];
    
    // Regla 1: Títulos de trabajo (Title)
    const uniqueTitles = [...new Set(offers.map(o => o.Title).filter(Boolean))];
    if (uniqueTitles.length > 0) {
      // Para múltiples títulos, crear regla por cada uno
      uniqueTitles.slice(0, 5).forEach(title => { // Límite de 5 para evitar sobrecarga
        rules.push({
          type: 1, // Title
          value: title,
          operator: 'contains'
        });
      });
    }
    
    // Regla 2: Empresas (CompanyName)
    const uniqueCompanies = [...new Set(offers.map(o => o.CompanyName).filter(Boolean))];
    if (uniqueCompanies.length > 0) {
      uniqueCompanies.slice(0, 3).forEach(company => {
        rules.push({
          type: 2, // CompanyName
          value: company,
          operator: 'equals'
        });
      });
    }
    
    // Regla 4: Regiones incluidas (Region)
    const uniqueRegions = [...new Set(offers.map(o => o.City || o.Region).filter(Boolean))];
    if (uniqueRegions.length > 0) {
      rules.push({
        type: 4, // Region
        value: uniqueRegions.slice(0, 5).join(','), // Jooble permite múltiples separadas por coma
        operator: 'in'
      });
    }
    
    // Regla 64: Regex en título si hay patrones específicos
    if (campaignData.titlePattern) {
      rules.push({
        type: 64, // TitleRegex
        value: campaignData.titlePattern,
        operator: 'regex'
      });
    }
    
    return rules;
  }

  /**
   * Extrae ubicaciones únicas de las ofertas
   * @param {Array} offers - Ofertas
   * @returns {Array} Ubicaciones únicas
   */
  extractLocations(offers) {
    const locations = new Set();
    offers.forEach(offer => {
      if (offer.City) locations.add(offer.City);
      if (offer.Region) locations.add(offer.Region);
    });
    return Array.from(locations);
  }

  /**
   * Extrae empresas únicas de las ofertas
   * @param {Array} offers - Ofertas
   * @returns {Array} Empresas únicas
   */
  extractCompanies(offers) {
    return [...new Set(offers.map(o => o.CompanyName).filter(Boolean))];
  }

  /**
   * Extrae títulos de trabajo únicos
   * @param {Array} offers - Ofertas
   * @returns {Array} Títulos únicos
   */
  extractJobTitles(offers) {
    return [...new Set(offers.map(o => o.Title).filter(Boolean))];
  }

  /**
   * Calcula fecha de fin de campaña (por defecto 30 días)
   * @param {Object} campaignData - Datos de campaña
   * @returns {String} Fecha en formato YYYY-MM-DD
   */
  calculateEndDate(campaignData) {
    const startDate = new Date(campaignData.startDate || Date.now());
    const endDate = new Date(startDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // +30 días
    return endDate.toISOString().split('T')[0];
  }

  /**
   * Edita una campaña existente en Jooble
   * @param {String} campaignId - ID de la campaña en Jooble
   * @param {Object} updates - Actualizaciones a aplicar
   * @returns {Object} Resultado de la edición
   */
  async editCampaign(campaignId, updates) {
    console.log(`🔧 Editando campaña Jooble ${campaignId}`);
    
    try {
      const payload = {
        campaignId: campaignId,
        ...updates,
        lastModified: new Date().toISOString()
      };
      
      if (!this.config.apiKey) {
        return this.simulateEditCampaign(campaignId, payload);
      }
      
      const response = await this.httpClient.post(`/editCampaign/${this.config.apiKey}`, payload);
      
      console.log(`✅ Campaña ${campaignId} editada exitosamente`);
      return {
        success: true,
        channel: 'jooble',
        campaignId: campaignId,
        updates: updates,
        data: response.data,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error editando campaña ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de una campaña para un período específico
   * @param {String} campaignId - ID de la campaña (opcional)
   * @param {String} fromDate - Fecha de inicio (YYYY-MM-DD)
   * @param {String} toDate - Fecha de fin (YYYY-MM-DD)
   * @returns {Object} Estadísticas detalladas
   */
  async getStatistics(campaignId = null, fromDate, toDate) {
    console.log(`📊 Obteniendo estadísticas Jooble ${campaignId ? `para campaña ${campaignId}` : 'generales'}`);
    
    try {
      const payload = {
        from: fromDate || this.getDateDaysAgo(7), // Últimos 7 días por defecto
        to: toDate || this.getDateDaysAgo(0), // Hasta hoy
        ...(campaignId && { campaignId: campaignId })
      };
      
      if (!this.config.apiKey) {
        return this.simulateStatistics(payload);
      }
      
      const response = await this.httpClient.post(`/${this.config.apiKey}`, payload);
      
      console.log(`✅ Estadísticas obtenidas para período ${payload.from} - ${payload.to}`);
      return {
        success: true,
        channel: 'jooble',
        period: { from: payload.from, to: payload.to },
        data: response.data,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error obteniendo estadísticas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Controla el estado de una campaña (pausar, reanudar, eliminar)
   * @param {String} campaignId - ID de la campaña
   * @param {Number} status - Estado: 0=InProgress, 1=Stopped, 2=Deleted
   * @returns {Object} Resultado del control
   */
  async controlCampaign(campaignId, status) {
    const statusNames = { 0: 'InProgress', 1: 'Stopped', 2: 'Deleted' };
    console.log(`🔄 Cambiando estado de campaña ${campaignId} a ${statusNames[status]}`);
    
    try {
      const result = await this.editCampaign(campaignId, { status: status });
      
      console.log(`✅ Campaña ${campaignId} ahora está en estado ${statusNames[status]}`);
      return {
        ...result,
        action: statusNames[status],
        oldStatus: 'unknown', // En implementación real, obtener estado anterior
        newStatus: status
      };
      
    } catch (error) {
      console.error(`❌ Error controlando campaña ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pausa una campaña
   * @param {String} campaignId - ID de la campaña
   * @returns {Object} Resultado
   */
  async pauseCampaign(campaignId) {
    return await this.controlCampaign(campaignId, 1); // Status 1 = Stopped
  }

  /**
   * Reanuda una campaña
   * @param {String} campaignId - ID de la campaña
   * @returns {Object} Resultado
   */
  async resumeCampaign(campaignId) {
    return await this.controlCampaign(campaignId, 0); // Status 0 = InProgress
  }

  /**
   * Elimina una campaña
   * @param {String} campaignId - ID de la campaña
   * @returns {Object} Resultado
   */
  async deleteCampaign(campaignId) {
    return await this.controlCampaign(campaignId, 2); // Status 2 = Deleted
  }

  /**
   * Actualiza bids de una campaña
   * @param {String} campaignId - ID de la campaña
   * @param {Object} bidUpdates - Nuevos valores de bid
   * @returns {Object} Resultado
   */
  async updateBids(campaignId, bidUpdates) {
    console.log(`💰 Actualizando bids para campaña ${campaignId}`);
    
    const updates = {
      maxCPC: bidUpdates.maxCPC,
      dailyBudget: bidUpdates.dailyBudget,
      bidStrategy: bidUpdates.bidStrategy || 'manual'
    };
    
    return await this.editCampaign(campaignId, updates);
  }

  /**
   * Calcula métricas de performance basadas en estadísticas
   * @param {Object} stats - Estadísticas raw de Jooble
   * @returns {Object} Métricas calculadas
   */
  calculatePerformanceMetrics(stats) {
    if (!stats || !stats.data) return null;
    
    const data = stats.data;
    const metrics = {
      impressions: data.impressions || 0,
      clicks: data.clicks || 0,
      applications: data.applications || 0,
      spend: data.spend || 0,
      
      // Métricas calculadas
      ctr: data.clicks && data.impressions ? (data.clicks / data.impressions * 100).toFixed(2) : 0,
      cpa: data.applications && data.spend ? (data.spend / data.applications).toFixed(2) : 0,
      cpc: data.clicks && data.spend ? (data.spend / data.clicks).toFixed(2) : 0,
      conversionRate: data.applications && data.clicks ? (data.applications / data.clicks * 100).toFixed(2) : 0,
      
      // Eficiencia
      efficiency: data.applications && data.spend ? (data.applications / data.spend * 100).toFixed(2) : 0,
      qualityScore: this.calculateQualityScore(data)
    };
    
    return metrics;
  }

  /**
   * Calcula un score de calidad basado en métricas
   * @param {Object} data - Datos de performance
   * @returns {Number} Score de calidad 0-100
   */
  calculateQualityScore(data) {
    if (!data.clicks || !data.impressions) return 0;
    
    const ctr = data.clicks / data.impressions;
    const conversionRate = data.applications ? data.applications / data.clicks : 0;
    
    // Score basado en CTR y conversion rate
    let score = (ctr * 1000) + (conversionRate * 500); // Fórmula simplificada
    score = Math.min(100, Math.max(0, score)); // Clamp entre 0-100
    
    return Math.round(score);
  }

  /**
   * Obtiene fecha de hace X días en formato YYYY-MM-DD
   * @param {Number} daysAgo - Días hacia atrás
   * @returns {String} Fecha formateada
   */
  getDateDaysAgo(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  // Métodos de simulación para desarrollo sin API key

  /**
   * Simula creación de campaña (para desarrollo)
   */
  simulateCreateCampaign(payload) {
    console.log('🔧 Modo simulación: Creando campaña Jooble');
    return {
      success: true,
      channel: 'jooble',
      campaignId: `jooble_sim_${Date.now()}`,
      simulation: true,
      data: {
        campaignId: `jooble_sim_${Date.now()}`,
        status: 0,
        name: payload.name,
        dailyBudget: payload.dailyBudget,
        maxCPC: payload.maxCPC,
        estimatedReach: Math.floor(Math.random() * 10000) + 1000
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simula edición de campaña
   */
  simulateEditCampaign(campaignId, payload) {
    console.log(`🔧 Modo simulación: Editando campaña ${campaignId}`);
    return {
      success: true,
      channel: 'jooble',
      campaignId: campaignId,
      simulation: true,
      updates: payload,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simula estadísticas
   */
  simulateStatistics(payload) {
    console.log('🔧 Modo simulación: Obteniendo estadísticas Jooble');
    return {
      success: true,
      channel: 'jooble',
      simulation: true,
      period: { from: payload.from, to: payload.to },
      data: {
        impressions: Math.floor(Math.random() * 50000) + 10000,
        clicks: Math.floor(Math.random() * 2000) + 500,
        applications: Math.floor(Math.random() * 100) + 20,
        spend: Math.floor(Math.random() * 1000) + 200
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = JoobleService;
