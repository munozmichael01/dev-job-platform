const { InternalLimitsController } = require('../services/internalLimitsController');

/**
 * ChannelLimitsMiddleware - Middleware común para control de límites internos
 * 
 * Este middleware es extensible a cualquier canal (Jooble, Indeed, LinkedIn, etc.)
 * y garantiza que todos los canales respeten los límites internos del sistema,
 * independientemente de las capacidades específicas de cada API externa.
 * 
 * Funcionalidades:
 * - Control de presupuesto (dailyBudget/totalBudget)
 * - Control de fechas (startDate/endDate)
 * - Control de CPC (maxCPC interno)
 * - Validación pre-envío a canales externos
 * - Acciones automáticas (pausado/reducción de pujas)
 * - Notificaciones y alertas
 */
class ChannelLimitsMiddleware {
  
  constructor() {
    this.limitsController = new InternalLimitsController();
    this.channelPolicies = this.initializeChannelPolicies();
    
    console.log('🛡️ ChannelLimitsMiddleware inicializado para todos los canales');
  }

  /**
   * Inicializa las políticas específicas por canal
   * Define qué límites internos aplicar según las capacidades de cada canal
   */
  initializeChannelPolicies() {
    return {
      // Jooble: No maneja presupuesto diario, fechas ni CPC internos
      jooble: {
        enforceBudgetLimits: true,
        enforceDateLimits: true,
        enforceCPCLimits: true,
        allowOverrides: false,
        preValidation: true,
        postValidation: true,
        autoActions: true
      },
      
      // Indeed: Maneja algunas fechas pero no presupuesto granular
      indeed: {
        enforceBudgetLimits: true,
        enforceDateLimits: false, // Indeed maneja fechas nativamente
        enforceCPCLimits: true,
        allowOverrides: true,
        preValidation: true,
        postValidation: true,
        autoActions: true
      },
      
      // LinkedIn: Maneja presupuesto pero no CPC detallado
      linkedin: {
        enforceBudgetLimits: false, // LinkedIn maneja presupuesto nativamente
        enforceDateLimits: true,
        enforceCPCLimits: true,
        allowOverrides: true,
        preValidation: true,
        postValidation: true,
        autoActions: false // LinkedIn requiere aprobación manual
      },
      
      // InfoJobs: Control total interno (API limitada)
      infojobs: {
        enforceBudgetLimits: true,
        enforceDateLimits: true,
        enforceCPCLimits: true,
        allowOverrides: false,
        preValidation: true,
        postValidation: true,
        autoActions: true
      },
      
      // WhatJobs: Similar a Jooble
      whatjobs: {
        enforceBudgetLimits: true,
        enforceDateLimits: true,
        enforceCPCLimits: true,
        allowOverrides: false,
        preValidation: true,
        postValidation: true,
        autoActions: true
      },
      
      // Configuración por defecto para nuevos canales
      default: {
        enforceBudgetLimits: true,
        enforceDateLimits: true,
        enforceCPCLimits: true,
        allowOverrides: false,
        preValidation: true,
        postValidation: true,
        autoActions: true
      }
    };
  }

  /**
   * Middleware pre-envío: Valida límites antes de enviar campaña a canal externo
   * @param {string} channelName - Nombre del canal (jooble, indeed, etc.)
   * @param {Object} campaignData - Datos de la campaña
   * @param {Object} payloadToChannel - Payload que se enviará al canal
   * @param {Object} internalData - Datos internos que no se envían
   * @returns {Promise<Object>} Resultado de validación
   */
  async validateBeforeSend(channelName, campaignData, payloadToChannel, internalData) {
    const result = {
      valid: true,
      warnings: [],
      errors: [],
      actions: [],
      channel: channelName,
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`🔍 Validando límites pre-envío para canal: ${channelName}`);
      
      const policy = this.getChannelPolicy(channelName);
      
      if (!policy.preValidation) {
        result.warnings.push('Validación pre-envío deshabilitada para este canal');
        return result;
      }

      // 1. Validar límites de presupuesto
      if (policy.enforceBudgetLimits) {
        const budgetValidation = await this.validateBudgetLimits(campaignData, internalData);
        this.mergeValidationResults(result, budgetValidation);
      }

      // 2. Validar límites de fechas
      if (policy.enforceDateLimits) {
        const dateValidation = await this.validateDateLimits(campaignData, internalData);
        this.mergeValidationResults(result, dateValidation);
      }

      // 3. Validar límites de CPC
      if (policy.enforceCPCLimits) {
        const cpcValidation = await this.validateCPCLimits(campaignData, internalData, payloadToChannel);
        this.mergeValidationResults(result, cpcValidation);
      }

      // 4. Validaciones específicas del canal
      const channelSpecificValidation = await this.validateChannelSpecificLimits(
        channelName, 
        campaignData, 
        payloadToChannel, 
        internalData
      );
      this.mergeValidationResults(result, channelSpecificValidation);

      // 5. Aplicar acciones automáticas si están habilitadas
      if (policy.autoActions && !result.valid) {
        const autoActions = await this.applyAutomaticActions(channelName, campaignData, result);
        result.actions = [...result.actions, ...autoActions];
      }

      console.log(`${result.valid ? '✅' : '❌'} Validación pre-envío ${channelName}: ${result.errors.length} errores, ${result.warnings.length} warnings`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Error en validación pre-envío ${channelName}: ${error.message}`);
      result.valid = false;
      result.errors.push(`Error interno: ${error.message}`);
      return result;
    }
  }

  /**
   * Middleware post-envío: Monitorea y controla campaña activa en canal externo
   * @param {string} channelName - Nombre del canal
   * @param {number} campaignId - ID de la campaña
   * @param {Object} channelResponse - Respuesta del canal externo
   * @returns {Promise<Object>} Resultado de monitoreo
   */
  async monitorAfterSend(channelName, campaignId, channelResponse) {
    const result = {
      monitored: true,
      alerts: [],
      actions: [],
      channel: channelName,
      campaignId,
      timestamp: new Date().toISOString()
    };

    try {
      console.log(`👁️ Monitoreando campaña ${campaignId} en canal: ${channelName}`);
      
      const policy = this.getChannelPolicy(channelName);
      
      if (!policy.postValidation) {
        result.alerts.push('Monitoreo post-envío deshabilitado para este canal');
        return result;
      }

      // Obtener datos actualizados de la campaña
      const campaignData = await this.limitsController.getCampaignBasicInfo(campaignId);
      
      // Ejecutar verificación completa de límites
      const limitsCheck = await this.limitsController.checkCampaignLimits(campaignData);
      
      // Procesar alertas
      result.alerts = [
        ...limitsCheck.budgetCheck.alerts,
        ...limitsCheck.dateCheck.alerts,
        ...limitsCheck.cpcCheck.alerts
      ];

      // Procesar acciones automáticas si están habilitadas
      if (policy.autoActions) {
        const allActions = [
          ...limitsCheck.budgetCheck.actions,
          ...limitsCheck.dateCheck.actions,
          ...limitsCheck.cpcCheck.actions
        ];
        
        for (const action of allActions) {
          const executed = await this.executeChannelAction(channelName, campaignId, action);
          result.actions.push(executed);
        }
      }

      console.log(`👁️ Monitoreo ${channelName} campaña ${campaignId}: ${result.alerts.length} alertas, ${result.actions.length} acciones`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Error en monitoreo post-envío ${channelName}: ${error.message}`);
      result.monitored = false;
      result.alerts.push(`Error de monitoreo: ${error.message}`);
      return result;
    }
  }

  /**
   * Obtiene la política de límites para un canal específico
   * @param {string} channelName - Nombre del canal
   * @returns {Object} Política del canal
   */
  getChannelPolicy(channelName) {
    return this.channelPolicies[channelName] || this.channelPolicies.default;
  }

  /**
   * Valida límites de presupuesto específicos para el middleware
   */
  async validateBudgetLimits(campaignData, internalData) {
    const result = { valid: true, warnings: [], errors: [] };
    
    try {
      const budgetCheck = await this.limitsController.checkBudgetLimits(campaignData);
      
      if (!budgetCheck.withinLimits) {
        result.valid = false;
        result.errors.push('Presupuesto excedido o próximo a excederse');
      }
      
      if (budgetCheck.alerts.length > 0) {
        result.warnings.push(...budgetCheck.alerts.map(alert => alert.message));
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Error validando presupuesto: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Valida límites de fechas específicos para el middleware
   */
  async validateDateLimits(campaignData, internalData) {
    const result = { valid: true, warnings: [], errors: [] };
    
    try {
      const dateCheck = await this.limitsController.checkDateLimits(campaignData);
      
      if (!dateCheck.withinLimits) {
        result.valid = false;
        result.errors.push('Campaña fuera del rango de fechas permitido');
      }
      
      if (dateCheck.alerts.length > 0) {
        result.warnings.push(...dateCheck.alerts.map(alert => alert.message));
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Error validando fechas: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Valida límites de CPC específicos para el middleware
   */
  async validateCPCLimits(campaignData, internalData, payloadToChannel) {
    const result = { valid: true, warnings: [], errors: [] };
    
    try {
      const cpcCheck = await this.limitsController.checkCPCLimits(campaignData);
      
      if (!cpcCheck.withinLimits) {
        result.valid = false;
        result.errors.push('CPC excede límite interno configurado');
      }
      
      if (cpcCheck.alerts.length > 0) {
        result.warnings.push(...cpcCheck.alerts.map(alert => alert.message));
      }
      
      // Validación específica: ClickPrice en payload vs maxCPC interno
      if (payloadToChannel.ClickPrice && internalData.maxCPC) {
        const payloadCPC = parseFloat(payloadToChannel.ClickPrice);
        const maxCPC = parseFloat(internalData.maxCPC);
        
        if (payloadCPC > maxCPC) {
          result.valid = false;
          result.errors.push(`ClickPrice en payload (${payloadCPC}) excede maxCPC interno (${maxCPC})`);
        }
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Error validando CPC: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Validaciones específicas por canal
   */
  async validateChannelSpecificLimits(channelName, campaignData, payloadToChannel, internalData) {
    const result = { valid: true, warnings: [], errors: [] };
    
    try {
      switch (channelName) {
        case 'jooble':
          return await this.validateJoobleSpecific(campaignData, payloadToChannel, internalData);
        
        case 'indeed':
          return await this.validateIndeedSpecific(campaignData, payloadToChannel, internalData);
        
        case 'linkedin':
          return await this.validateLinkedInSpecific(campaignData, payloadToChannel, internalData);
        
        default:
          result.warnings.push(`Sin validaciones específicas para canal: ${channelName}`);
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Error en validación específica ${channelName}: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Validaciones específicas para Jooble
   */
  async validateJoobleSpecific(campaignData, payloadToChannel, internalData) {
    const result = { valid: true, warnings: [], errors: [] };
    
    // Validar que segmentationRules no excedan límites de Jooble
    if (payloadToChannel.segmentationRules) {
      const titles = payloadToChannel.segmentationRules.filter(rule => rule.type === 1);
      const companies = payloadToChannel.segmentationRules.filter(rule => rule.type === 2);
      
      if (titles.length > 5) {
        result.valid = false;
        result.errors.push(`Jooble: Máximo 5 job titles, enviando ${titles.length}`);
      }
      
      if (companies.length > 3) {
        result.valid = false;
        result.errors.push(`Jooble: Máximo 3 companies, enviando ${companies.length}`);
      }
    }
    
    // Validar Budget mínimo
    if (payloadToChannel.Budget && payloadToChannel.Budget < 10) {
      result.warnings.push('Jooble: Budget muy bajo, mínimo recomendado €10');
    }
    
    return result;
  }

  /**
   * Validaciones específicas para Indeed
   */
  async validateIndeedSpecific(campaignData, payloadToChannel, internalData) {
    const result = { valid: true, warnings: [], errors: [] };
    
    // Indeed tiene sus propias validaciones específicas
    result.warnings.push('Indeed: Validaciones específicas pendientes de implementar');
    
    return result;
  }

  /**
   * Validaciones específicas para LinkedIn
   */
  async validateLinkedInSpecific(campaignData, payloadToChannel, internalData) {
    const result = { valid: true, warnings: [], errors: [] };
    
    // LinkedIn tiene sus propias validaciones específicas
    result.warnings.push('LinkedIn: Validaciones específicas pendientes de implementar');
    
    return result;
  }

  /**
   * Combina resultados de validación
   */
  mergeValidationResults(mainResult, validationResult) {
    if (!validationResult.valid) {
      mainResult.valid = false;
    }
    
    mainResult.warnings = [...mainResult.warnings, ...validationResult.warnings];
    mainResult.errors = [...mainResult.errors, ...validationResult.errors];
  }

  /**
   * Aplica acciones automáticas según la política del canal
   */
  async applyAutomaticActions(channelName, campaignData, validationResult) {
    const actions = [];
    
    try {
      const policy = this.getChannelPolicy(channelName);
      
      if (!policy.autoActions) {
        actions.push({ type: 'skip', reason: 'Acciones automáticas deshabilitadas para este canal' });
        return actions;
      }
      
      // Aplicar acciones según errores detectados
      for (const error of validationResult.errors) {
        if (error.includes('Presupuesto')) {
          const action = await this.limitsController.pauseCampaignDueToLimits(
            campaignData.Id, 
            'budget_exceeded_pre_validation', 
            { channel: channelName }
          );
          actions.push({ type: 'pause_campaign', reason: 'budget_exceeded', executed: true });
        }
        
        if (error.includes('CPC')) {
          const internalConfig = this.limitsController.parseInternalConfig(campaignData.InternalConfig);
          const maxCPC = parseFloat(internalConfig.maxCPC || campaignData.MaxCPA);
          
          if (maxCPC) {
            const action = await this.limitsController.enforceCPCLimits(campaignData.Id, maxCPC, 'pre_validation');
            actions.push({ type: 'reduce_bids', reason: 'cpc_exceeded', details: action });
          }
        }
      }
      
    } catch (error) {
      actions.push({ type: 'error', reason: error.message });
    }
    
    return actions;
  }

  /**
   * Ejecuta una acción específica para un canal
   */
  async executeChannelAction(channelName, campaignId, action) {
    try {
      console.log(`🎯 Ejecutando acción automática en ${channelName}: ${action.type}`);
      
      const executed = {
        channel: channelName,
        campaignId,
        action: action.type,
        reason: action.reason,
        timestamp: new Date().toISOString(),
        success: false
      };
      
      switch (action.type) {
        case 'pause_campaign':
        case 'pause_campaign_daily':
          await this.limitsController.pauseCampaignDueToLimits(campaignId, action.reason, action.data);
          executed.success = true;
          executed.message = 'Campaña pausada automáticamente';
          break;
          
        case 'reduce_bids':
          const cpcData = action.data;
          const maxCPC = parseFloat(cpcData.maxCPC);
          const result = await this.limitsController.enforceCPCLimits(campaignId, maxCPC, action.reason);
          executed.success = true;
          executed.message = `${result.reduced} pujas reducidas`;
          executed.details = result;
          break;
          
        default:
          executed.message = `Acción no implementada: ${action.type}`;
      }
      
      return executed;
      
    } catch (error) {
      console.error(`❌ Error ejecutando acción ${action.type} en ${channelName}: ${error.message}`);
      return {
        channel: channelName,
        campaignId,
        action: action.type,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Registra nueva política para un canal
   * @param {string} channelName - Nombre del canal
   * @param {Object} policy - Política del canal
   */
  registerChannelPolicy(channelName, policy) {
    this.channelPolicies[channelName] = {
      ...this.channelPolicies.default,
      ...policy
    };
    
    console.log(`📋 Política registrada para canal: ${channelName}`);
  }

  /**
   * Obtiene estadísticas de uso del middleware
   */
  getUsageStats() {
    return {
      channelsRegistered: Object.keys(this.channelPolicies).length,
      channelPolicies: this.channelPolicies,
      limitsController: {
        initialized: !!this.limitsController,
        configuredThresholds: this.limitsController.config?.alertThresholds
      }
    };
  }
}

module.exports = { ChannelLimitsMiddleware };
