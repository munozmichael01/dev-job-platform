const axios = require('axios');
const { ChannelLimitsMiddleware } = require('../../middleware/channelLimitsMiddleware');

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
    // Manejar formato multi-país joobleApiKeys
    let apiKey = config.apiKey || process.env.JOOBLE_API_KEY;
    let countryCode = config.countryCode || process.env.JOOBLE_COUNTRY || 'es';
    
    // Si config tiene joobleApiKeys (formato multi-país), usar el primer país como default
    if (config.joobleApiKeys && Array.isArray(config.joobleApiKeys) && config.joobleApiKeys.length > 0) {
      const firstCountry = config.joobleApiKeys[0];
      apiKey = firstCountry.apiKey;
      countryCode = firstCountry.countryCode;
      console.log(`🌍 Usando credenciales multi-país: ${config.joobleApiKeys.length} países disponibles, default: ${countryCode}`);
    }
    
    this.config = {
      apiKey: apiKey,
      countryCode: countryCode,
      baseUrl: `https://${countryCode}.jooble.org/auction/api`,
      defaultTimeout: config.timeout || 30000,
      ...config
    };
    
    // Inicializar middleware de límites internos
    this.limitsMiddleware = new ChannelLimitsMiddleware();
    
    if (!this.config.apiKey) {
      console.warn('⚠️ JOOBLE_API_KEY no configurada. Funcionará en modo simulación.');
    } else {
      console.log(`✅ JoobleService configurado: ${countryCode} con API key ${this.config.apiKey.substring(0, 10)}...`);
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
      // Aplicar UTMs a las ofertas para tracking real
      const offersWithTracking = this.applyTrackingToOffers(offers, campaignData);
      
      // Construir payload-to-jooble incluyendo segmentationRules derivadas de ofertas
      const payloadToJooble = this.buildJooblePayload(campaignData, offers, budgetInfo);
      
      // Construir datos internos (NO se envían a Jooble)
      const internalData = this.buildInternalData(campaignData, offers, budgetInfo);
      
      // Validar segmentationRules antes de enviar
      const validation = this.validateSegmentationRules(payloadToJooble.segmentationRules);
      if (!validation.valid) {
        console.error('❌ SegmentationRules inválidas:', validation.errors);
        throw new Error(`Validación de segmentationRules falló: ${validation.errors.join(', ')}`);
      }
      
      // ✨ MIDDLEWARE: Validar límites internos antes de enviar a Jooble
      const limitsValidation = await this.limitsMiddleware.validateBeforeSend(
        'jooble', 
        campaignData, 
        payloadToJooble, 
        internalData
      );
      
      if (!limitsValidation.valid) {
        console.error('❌ Validación de límites internos falló:', limitsValidation.errors);
        console.warn('⚠️ Warnings:', limitsValidation.warnings);
        console.log('🎯 Acciones automáticas aplicadas:', limitsValidation.actions);
        
        // Si hay errores críticos, no enviar a Jooble
        const criticalErrors = limitsValidation.errors.filter(error => 
          error.includes('excede límite') || error.includes('fuera del rango')
        );
        
        if (criticalErrors.length > 0) {
          throw new Error(`Límites internos excedidos: ${criticalErrors.join(', ')}`);
        }
      } else {
        console.log('✅ Validación de límites internos exitosa');
        if (limitsValidation.warnings.length > 0) {
          console.warn('⚠️ Warnings de límites:', limitsValidation.warnings);
        }
      }
      
      console.log(`📤 Payload-to-jooble: ${JSON.stringify(payloadToJooble, null, 2)}`);
      console.log(`🗄️ Datos internos conservados para control: ${Object.keys(internalData).join(', ')}`);
      console.log(`✅ SegmentationRules validadas: ${payloadToJooble.segmentationRules.length} reglas`);
      
      if (!this.config.apiKey) {
        // Modo simulación - mostrar ambos payloads y ejemplo de URL
        const exampleUrl = offersWithTracking[0]?.trackingUrl;
        return this.simulateCreateCampaign(payloadToJooble, internalData, exampleUrl);
      }
      
      // 🎆 ¡CREDENCIALES REALES ENCONTRADAS! - Usar API real de Jooble
      console.log('🎆 Enviando campaña REAL a Jooble API...');
      
      // DEBUG: Log payload exacto antes de enviar
      console.log(`🐛 DEBUG - Payload completo a Jooble:`, JSON.stringify(payloadToJooble, null, 2));
      
      // Enviar SOLO el payload mínimo a Jooble
      const response = await this.httpClient.post(`/createCampaign/${this.config.apiKey}`, payloadToJooble);
      
      console.log(`✅ Campaña creada en Jooble con ID: ${response.data.campaignId || 'unknown'}`);
      
      // Log de verificación: payload y URL final
      console.log(`🔍 Verificación - Payload enviado: ${JSON.stringify(payloadToJooble)}`);
      if (offersWithTracking.length > 0) {
        console.log(`🔍 Verificación - URL ejemplo con UTMs: ${offersWithTracking[0].trackingUrl}`);
      }
      
      // Guardar internalData en nuestra BD para control de límites
      await this.saveInternalCampaignData(campaignData.id, internalData);
      
      // ✨ MIDDLEWARE: Iniciar monitoreo post-envío
      const monitoringResult = await this.limitsMiddleware.monitorAfterSend(
        'jooble', 
        campaignData.id, 
        response.data
      );
      
      console.log('📊 Monitoreo post-envío iniciado:', {
        alerts: monitoringResult.alerts.length,
        actions: monitoringResult.actions.length
      });
      
      return {
        success: true,
        channel: 'jooble',
        campaignId: response.data.campaignId,
        data: response.data,
        internalData: internalData, // Para referencia en logs
        payloadSent: payloadToJooble, // Para auditoría
        offersWithTracking: offersWithTracking, // Ofertas con UTMs aplicados
        exampleTrackingUrl: offersWithTracking[0]?.trackingUrl, // URL ejemplo para verificación
        limitsValidation: limitsValidation, // Resultado de validación de límites
        monitoring: monitoringResult, // Resultado de monitoreo inicial
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error creando campaña en Jooble: ${error.message}`);
      throw error;
    }
  }



  /**
   * Construye el payload que va a Jooble con campos requeridos + segmentationRules
   * @param {Object} campaignData - Datos de campaña
   * @param {Array} offers - Ofertas pre-filtradas para derivar segmentationRules
   * @param {Object} budgetInfo - Info de presupuesto
   * @returns {Object} Payload para Jooble API
   */
  buildJooblePayload(campaignData, offers, budgetInfo) {
    // Calcular Budget total desde dailyBudget si es necesario
    const budget = this.calculateTotalBudget(campaignData, budgetInfo);
    
    // Construir UTM string serializado
    const utmString = this.buildUtmString(campaignData);
    
    // Determinar SiteUrl 
    const siteUrl = this.determineSiteUrl(campaignData);
    
    // Construir segmentationRules derivadas de las ofertas pre-filtradas
    const segmentationRules = this.buildSegmentationRulesForJooble(offers);
    
    return {
      // Campos requeridos por Jooble API según documentación oficial
      CampaignName: campaignData.name || 'Campaña Job Platform',
      Status: String(this.mapInternalStatusToJooble(campaignData.status)),
      ClickPrice: String(budgetInfo.maxCPC || campaignData.maxCPA || 25),
      Budget: String(budget),
      MonthlyBudget: String(campaignData.monthlyBudget || false),
      Utm: utmString,
      SiteUrl: siteUrl,
      
      // Rules (no segmentationRules) según documentación
      Rules: segmentationRules
    };
  }

  /**
   * Construye datos internos que NO se envían a Jooble pero necesitamos para control
   * @param {Object} campaignData - Datos de campaña
   * @param {Array} offers - Ofertas
   * @param {Object} budgetInfo - Info de presupuesto
   * @returns {Object} Datos para nuestro control interno
   */
  buildInternalData(campaignData, offers, budgetInfo) {
    return {
      // Campos internos para nuestro control
      maxCPC: budgetInfo.maxCPC || campaignData.maxCPA || 25, // alias interno
      dailyBudget: budgetInfo.dailyBudget,
      totalBudget: campaignData.budget,
      startDate: campaignData.startDate,
      endDate: campaignData.endDate || this.calculateEndDate(campaignData),
      timezone: campaignData.timezone || 'Europe/Madrid',
      bidStrategy: campaignData.bidStrategy || 'automatic',
      
      // Targeting interno (para decidir qué ofertas incluir)
      targeting: {
        locations: this.extractLocations(offers),
        companies: this.extractCompanies(offers),
        jobTitles: this.extractJobTitles(offers)
      },
      
      // Segmentación interna (NO se envía a Jooble)
      segmentationRules: this.buildInternalSegmentationRules(offers, campaignData),
      
      // Tracking estructurado para reporting interno
      trackingParams: {
        source: 'jooble',
        medium: 'cpc',
        campaign: this.normalizeCampaignName(campaignData.name)
      }
    };
  }

  /**
   * Calcula Budget total desde dailyBudget si es necesario
   * @param {Object} campaignData - Datos de campaña
   * @param {Object} budgetInfo - Info de presupuesto
   * @returns {Number} Budget total para Jooble
   */
  calculateTotalBudget(campaignData, budgetInfo) {
    // Si tenemos totalBudget, usarlo directamente
    if (campaignData.budget) {
      return campaignData.budget;
    }
    
    // Si tenemos dailyBudget y fechas, calcular total
    if (budgetInfo.dailyBudget && campaignData.startDate && campaignData.endDate) {
      const startDate = new Date(campaignData.startDate);
      const endDate = new Date(campaignData.endDate);
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      return budgetInfo.dailyBudget * daysDiff;
    }
    
    // Si solo tenemos dailyBudget, asumir 30 días
    if (budgetInfo.dailyBudget) {
      return budgetInfo.dailyBudget * 30;
    }
    
    // Default fallback
    return 3000;
  }

  /**
   * Construye string UTM serializado para Jooble
   * @param {Object} campaignData - Datos de campaña
   * @returns {String} UTM string con formato ?utm_source=...
   */
  buildUtmString(campaignData) {
    const source = 'jooble';
    const medium = 'cpc';
    const campaign = this.normalizeCampaignName(campaignData.name);
    
    return `?utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`;
  }

  /**
   * Normaliza el nombre de campaña para UTM
   * @param {String} campaignName - Nombre de campaña
   * @returns {String} Nombre normalizado
   */
  normalizeCampaignName(campaignName) {
    if (!campaignName) return 'campaign_default';
    
    return campaignName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 50); // Límite para UTM
  }

  /**
   * Determina SiteUrl para Jooble
   * @param {Object} campaignData - Datos de campaña
   * @returns {String} URL del sitio
   */
  determineSiteUrl(campaignData) {
    // Si hay SiteId configurado en credenciales, Jooble lo manejará automáticamente
    // Si no, usar SiteUrl
    return campaignData.siteUrl || process.env.FRONTEND_URL || 'https://www.turijobs.com';
  }

  /**
   * Mapea estado interno a formato Jooble
   * @param {String} internalStatus - Estado interno
   * @returns {Number} Estado para Jooble (0=InProgress, 1=Stopped, 2=Deleted)
   */
  mapInternalStatusToJooble(internalStatus) {
    const statusMap = {
      'active': 0,      // InProgress
      'paused': 1,      // Stopped
      'stopped': 1,     // Stopped
      'deleted': 2,     // Deleted
      'archived': 2     // Deleted
    };
    
    return statusMap[internalStatus] || 0; // Default: InProgress
  }

  /**
   * Genera URL de oferta con UTMs de Jooble aplicados
   * @param {Object} offer - Oferta
   * @param {Object} campaignData - Datos de campaña
   * @returns {String} URL final con UTMs para tracking
   */
  buildOfferTrackingUrl(offer, campaignData) {
    // URL base de la oferta
    const baseUrl = offer.ExternalUrl || offer.ApplicationUrl || 
                   `${process.env.FRONTEND_URL || 'https://www.turijobs.com'}/ofertas/${offer.Id}`;
    
    // Construir parámetros UTM según especificación
    const utmParams = {
      utm_source: 'jooble',
      utm_medium: 'cpc',
      utm_campaign: this.normalizeCampaignName(campaignData.name)
    };
    
    // Crear URLSearchParams para manejo correcto de encoding
    const params = new URLSearchParams(utmParams);
    
    // Si la URL ya tiene querystring, usar & en lugar de ?
    const separator = baseUrl.includes('?') ? '&' : '?';
    const finalUrl = `${baseUrl}${separator}${params.toString()}`;
    
    console.log(`🔗 URL final con UTMs: ${finalUrl}`);
    return finalUrl;
  }

  /**
   * Aplica UTMs a un array de ofertas para distribución por Jooble
   * @param {Array} offers - Ofertas
   * @param {Object} campaignData - Datos de campaña
   * @returns {Array} Ofertas con URLs de tracking aplicadas
   */
  applyTrackingToOffers(offers, campaignData) {
    console.log(`🏷️ Aplicando UTMs de Jooble a ${offers.length} ofertas`);
    
    return offers.map(offer => ({
      ...offer,
      trackingUrl: this.buildOfferTrackingUrl(offer, campaignData),
      // Conservar URL original para referencia
      originalUrl: offer.ExternalUrl || offer.ApplicationUrl,
      // Metadatos de tracking
      trackingApplied: true,
      trackingSource: 'jooble',
      appliedAt: new Date().toISOString()
    }));
  }

  /**
   * Construye segmentationRules para Jooble respetando límites de la API
   * Derivadas automáticamente de las ofertas pre-filtradas que ya hemos segmentado internamente
   * @param {Array} offers - Ofertas pre-filtradas (ya segmentadas internamente)
   * @returns {Array} SegmentationRules válidas para Jooble API
   */
  buildSegmentationRulesForJooble(offers) {
    console.log(`🎯 Construyendo segmentationRules para Jooble desde ${offers.length} ofertas pre-filtradas`);
    
    const rules = [];
    
    // TIPO 1: Títulos de trabajo (máx 5, operator=contains)
    const uniqueTitles = [...new Set(offers.map(o => o.Title).filter(Boolean))];
    if (uniqueTitles.length > 0) {
      const titlesToSend = uniqueTitles.slice(0, 5); // Límite de Jooble
      titlesToSend.forEach(title => {
        rules.push({
          type: "1",
          value: title
        });
      });
      console.log(`📋 Agregados ${titlesToSend.length}/5 títulos: ${titlesToSend.join(', ')}`);
      if (uniqueTitles.length > 5) {
        console.log(`⚠️ ${uniqueTitles.length - 5} títulos omitidos por límite de Jooble`);
      }
    }
    
    // TIPO 2: Empresas (máx 3, operator=equals)
    const uniqueCompanies = [...new Set(offers.map(o => o.CompanyName).filter(Boolean))];
    if (uniqueCompanies.length > 0) {
      const companiesToSend = uniqueCompanies.slice(0, 3); // Límite de Jooble
      companiesToSend.forEach(company => {
        rules.push({
          type: "2",
          value: company
        });
      });
      console.log(`🏢 Agregadas ${companiesToSend.length}/3 empresas: ${companiesToSend.join(', ')}`);
      if (uniqueCompanies.length > 3) {
        console.log(`⚠️ ${uniqueCompanies.length - 3} empresas omitidas por límite de Jooble`);
      }
    }
    
    // TIPO 4: Regiones (operator=in, sin límite explícito pero deduplicado)
    const uniqueRegions = [...new Set(offers.map(o => o.location || o.City || o.Region).filter(Boolean))];
    if (uniqueRegions.length > 0) {
      // Deduplicar y mantener razonable (máx 10 para performance)
      const regionsToSend = uniqueRegions.slice(0, 10);
      rules.push({
        type: 4,
        value: regionsToSend.join(','), // Jooble espera múltiples separadas por coma
        operator: 'in'
      });
      console.log(`📍 Agregadas ${regionsToSend.length} regiones: ${regionsToSend.join(', ')}`);
      if (uniqueRegions.length > 10) {
        console.log(`⚠️ ${uniqueRegions.length - 10} ubicaciones omitidas por performance`);
      }
    }
    
    console.log(`✅ SegmentationRules para Jooble: ${rules.length} reglas generadas`);
    return rules;
  }

  /**
   * Valida que las segmentationRules cumplan con los límites de Jooble
   * @param {Array} rules - Reglas de segmentación a validar
   * @returns {Object} Resultado de validación
   */
  validateSegmentationRules(rules) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    const titleRules = rules.filter(r => r.type === 1);
    const companyRules = rules.filter(r => r.type === 2);
    const locationRules = rules.filter(r => r.type === 4);
    
    // Validar límite de títulos
    if (titleRules.length > 5) {
      validation.valid = false;
      validation.errors.push(`Demasiados títulos: ${titleRules.length}/5. Máximo permitido: 5`);
    }
    
    // Validar límite de empresas
    if (companyRules.length > 3) {
      validation.valid = false;
      validation.errors.push(`Demasiadas empresas: ${companyRules.length}/3. Máximo permitido: 3`);
    }
    
    // Validar operadores
    titleRules.forEach((rule, index) => {
      if (rule.operator !== 'contains') {
        validation.errors.push(`Título ${index + 1}: operador debe ser 'contains', encontrado '${rule.operator}'`);
        validation.valid = false;
      }
    });
    
    companyRules.forEach((rule, index) => {
      if (rule.operator !== 'equals') {
        validation.errors.push(`Empresa ${index + 1}: operador debe ser 'equals', encontrado '${rule.operator}'`);
        validation.valid = false;
      }
    });
    
    locationRules.forEach((rule, index) => {
      if (rule.operator !== 'in') {
        validation.errors.push(`Ubicación ${index + 1}: operador debe ser 'in', encontrado '${rule.operator}'`);
        validation.valid = false;
      }
    });
    
    return validation;
  }

  /**
   * Construye reglas de segmentación INTERNAS (para nuestro control y reporting)
   * @param {Array} offers - Ofertas
   * @param {Object} campaignData - Datos de campaña
   * @returns {Array} Reglas de segmentación para uso interno
   */
  buildInternalSegmentationRules(offers, campaignData) {
    console.log('🗄️ Construyendo reglas de segmentación INTERNAS (no se envían a Jooble)');
    
    const rules = [];
    
    // Regla 1: Títulos de trabajo (Title) - SOLO para uso interno
    const uniqueTitles = [...new Set(offers.map(o => o.Title).filter(Boolean))];
    if (uniqueTitles.length > 0) {
      uniqueTitles.slice(0, 5).forEach(title => {
        rules.push({
          type: 1, // Title
          value: title,
          operator: 'contains',
          internal: true // Marcador de uso interno
        });
      });
    }
    
    // Regla 2: Empresas (CompanyName) - SOLO para uso interno
    const uniqueCompanies = [...new Set(offers.map(o => o.CompanyName).filter(Boolean))];
    if (uniqueCompanies.length > 0) {
      uniqueCompanies.slice(0, 3).forEach(company => {
        rules.push({
          type: 2, // CompanyName
          value: company,
          operator: 'equals',
          internal: true
        });
      });
    }
    
    // Regla 4: Regiones incluidas (Region) - SOLO para uso interno
    const uniqueRegions = [...new Set(offers.map(o => o.location || o.City || o.Region).filter(Boolean))];
    if (uniqueRegions.length > 0) {
      rules.push({
        type: 4, // Region
        value: uniqueRegions.slice(0, 5).join(','),
        operator: 'in',
        internal: true
      });
    }
    
    // Regla 64: Regex en título si hay patrones específicos - SOLO para uso interno
    if (campaignData.titlePattern) {
      rules.push({
        type: 64, // TitleRegex
        value: campaignData.titlePattern,
        operator: 'regex',
        internal: true
      });
    }
    
    console.log(`🗄️ Generadas ${rules.length} reglas de segmentación para uso interno`);
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
      
      // 🎆 ¡CREDENCIALES REALES ENCONTRADAS! - Obtener métricas reales de Jooble
      console.log('🎆 Obteniendo métricas REALES de Jooble API...');
      
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
  simulateCreateCampaign(payloadToJooble, internalData, exampleUrl) {
    console.log('🔧 Modo simulación: Creando campaña Jooble');
    console.log('📤 PAYLOAD ENVIADO A JOOBLE:', JSON.stringify(payloadToJooble, null, 2));
    console.log('🗄️ DATOS INTERNOS (NO ENVIADOS):', JSON.stringify(internalData, null, 2));
    
    if (exampleUrl) {
      console.log('🔍 URL EJEMPLO CON UTMs:', exampleUrl);
    }
    
    return {
      success: true,
      channel: 'jooble',
      campaignId: `jooble_sim_${Date.now()}`,
      simulation: true,
      data: {
        campaignId: `jooble_sim_${Date.now()}`,
        status: payloadToJooble.Status,
        name: payloadToJooble.CampaignName,
        budget: payloadToJooble.Budget,
        clickPrice: payloadToJooble.ClickPrice,
        estimatedReach: Math.floor(Math.random() * 10000) + 1000
      },
      payloadSent: payloadToJooble,
      internalData: internalData,
      exampleTrackingUrl: exampleUrl,
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

  /**
   * Guarda datos internos de la campaña en BD para control de límites
   * @param {number} campaignId - ID de la campaña en nuestra BD
   * @param {Object} internalData - Datos internos que NO se envían a Jooble
   */
  async saveInternalCampaignData(campaignId, internalData) {
    if (!campaignId) {
      console.warn('⚠️ No se puede guardar internalData: campaignId no proporcionado');
      return;
    }

    try {
      const { pool, sql } = require('../db/db');
      await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .input('InternalConfig', sql.NVarChar(sql.MAX), JSON.stringify(internalData))
        .query(`
          UPDATE Campaigns 
          SET InternalConfig = @InternalConfig,
              UpdatedAt = GETDATE()
          WHERE Id = @CampaignId
        `);

      console.log(`💾 Datos internos guardados para campaña ${campaignId}`);
      console.log(`🗄️ InternalConfig: ${JSON.stringify(internalData, null, 2)}`);

    } catch (error) {
      console.error(`❌ Error guardando datos internos de campaña ${campaignId}: ${error.message}`);
      // No lanzar error para que no falle la creación de campaña
    }
  }

  /**
   * Valida las credenciales API haciendo una petición real a Jooble
   * @param {Object} credentials - Credenciales a validar
   * @returns {Object} Resultado de la validación
   */
  async validateCredentials(credentials) {
    console.log('🔍 Validando credenciales Jooble...');
    
    try {
      if (!credentials.apiKey) {
        return {
          success: false,
          error: 'API Key es requerida',
          code: 'MISSING_API_KEY'
        };
      }

      if (!credentials.countryCode) {
        return {
          success: false,
          error: 'Código de país es requerido',
          code: 'MISSING_COUNTRY_CODE'
        };
      }

      // Manejar múltiples códigos de país separados por comas
      const countryCodes = credentials.countryCode.split(',').map(code => code.trim());
      console.log(`🌍 Validando TODOS los países: ${countryCodes.join(', ')}`);

      // Probar TODOS los países y recopilar resultados
      const countryResults = [];
      let hasAuthError = false;
      
      for (const countryCode of countryCodes) {
        try {
          console.log(`🔍 Probando país: ${countryCode}`);
          
          const tempConfig = {
            apiKey: credentials.apiKey,
            countryCode: countryCode,
            baseUrl: `https://${countryCode}.jooble.org/auction/api`,
            timeout: credentials.timeout || 30000
          };

          // Crear cliente temporal
          const testClient = axios.create({
            baseURL: tempConfig.baseUrl,
            timeout: tempConfig.timeout,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'JobPlatform-Integration/1.0'
            }
          });

          // Hacer una petición simple para validar las credenciales
          const today = new Date().toISOString().split('T')[0];
          const testPayload = {
            from: today,
            to: today
          };

          console.log(`🔍 Probando conexión a ${tempConfig.baseUrl} con API key ${credentials.apiKey.substring(0, 8)}...`);

          const response = await testClient.post(`/${credentials.apiKey}`, testPayload);
          
          console.log(`✅ Respuesta exitosa de Jooble ${countryCode}:`, response.status);
          
          // País validado exitosamente
          countryResults.push({
            country: countryCode,
            success: true,
            status: response.status,
            baseUrl: tempConfig.baseUrl
          });

        } catch (countryError) {
          console.log(`❌ Error en país ${countryCode}:`, countryError.message);
          
          // Registrar resultado del país
          countryResults.push({
            country: countryCode,
            success: false,
            error: countryError.message,
            status: countryError.response?.status,
            baseUrl: `https://${countryCode}.jooble.org/auction/api`
          });
          
          // Si es un error de autenticación (401/403), marcar para todos los países
          if (countryError.response && [401, 403].includes(countryError.response.status)) {
            console.log(`🚫 Error de autenticación en ${countryCode} - API key inválida para todos los países`);
            hasAuthError = true;
            break; // No tiene sentido probar otros países con API key inválida
          }
        }
      }

      // Analizar resultados
      const successfulCountries = countryResults.filter(r => r.success);
      const failedCountries = countryResults.filter(r => !r.success);

      if (successfulCountries.length > 0) {
        // Al menos un país funciona
        console.log(`✅ Países exitosos: ${successfulCountries.map(c => c.country).join(', ')}`);
        if (failedCountries.length > 0) {
          console.log(`⚠️ Países con problemas: ${failedCountries.map(c => c.country).join(', ')}`);
        }

        return {
          success: true,
          message: `Credenciales Jooble validadas exitosamente para: ${successfulCountries.map(c => c.country).join(', ')}${failedCountries.length > 0 ? ` (fallaron: ${failedCountries.map(c => c.country).join(', ')})` : ''}`,
          validatedAt: new Date().toISOString(),
          details: {
            apiKey: credentials.apiKey.substring(0, 8) + '...',
            allCountries: credentials.countryCode,
            successfulCountries: successfulCountries.map(c => c.country),
            failedCountries: failedCountries.map(c => c.country),
            countryResults: countryResults
          }
        };
      }

      // Si llegamos aquí, ningún país funcionó
      console.error('❌ Falló validación en todos los países');
      
      // Analizar el tipo de errores para dar un mensaje específico
      let errorMessage = 'Error validando credenciales en todos los países';
      let errorCode = 'VALIDATION_ERROR';

      if (hasAuthError || failedCountries.some(c => [401, 403].includes(c.status))) {
        errorMessage = 'API Key inválida o sin permisos para ningún país';
        errorCode = 'INVALID_API_KEY';
      } else if (failedCountries.some(c => c.status === 404)) {
        errorMessage = 'Endpoints no encontrados - verifica los códigos de país';
        errorCode = 'INVALID_COUNTRY_CODE';
      } else if (failedCountries.some(c => c.status === 429)) {
        errorMessage = 'Demasiadas peticiones - API Key puede estar limitada';
        errorCode = 'RATE_LIMITED';
      } else if (failedCountries.some(c => [500, 502, 503].includes(c.status))) {
        errorMessage = 'Error del servidor Jooble - intenta más tarde';
        errorCode = 'SERVER_ERROR';
      }

      return {
        success: false,
        error: errorMessage,
        code: errorCode,
        details: {
          allCountries: credentials.countryCode,
          testedCountries: countryCodes,
          countryResults: countryResults,
          failedCountries: failedCountries.map(c => c.country)
        }
      };

    } catch (error) {
      console.error('❌ Error general validando credenciales Jooble:', error.message);
      return {
        success: false,
        error: 'Error general de validación',
        code: 'GENERAL_ERROR',
        details: {
          originalError: error.message
        }
      };
    }
  }
}

module.exports = JoobleService;
