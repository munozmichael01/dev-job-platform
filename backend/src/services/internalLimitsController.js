const { pool, poolConnect, sql } = require('../db/db');
const { updateOfferStatusByGoals } = require('../utils/statusUpdater');
const { NotificationService } = require('./notificationService');
const MetricsSync = require('./metricsSync');

/**
 * InternalLimitsController - Controlador de límites internos
 * 
 * Responsabilidad de controlar límites que NO enviamos a canales externos:
 * - Control de presupuesto (dailyBudget/totalBudget)
 * - Control de fechas (startDate/endDate) 
 * - Control de CPC (maxCPC interno)
 * - Pausado automático cuando se exceden límites
 * - Sistema de alertas para notificar al usuario
 * 
 * Este sistema es especialmente importante para Jooble donde no enviamos
 * estos campos de control, pero necesitamos aplicarlos internamente.
 */
class InternalLimitsController {
  
  constructor() {
    this.config = {
      // Frecuencia de verificación de límites (cada 5 minutos)
      checkFrequency: process.env.LIMITS_CHECK_FREQUENCY || '*/5 * * * *',
      
      // Umbrales de alerta
      alertThresholds: {
        budgetWarning: 0.8,    // Alertar al 80% del presupuesto
        budgetCritical: 0.95,  // Crítico al 95%
        timeWarning: 0.9,      // Alertar cuando quede 10% del tiempo
        timeCritical: 0.98     // Crítico cuando quede 2% del tiempo
      },
      
      // Configuración de timezone por defecto
      defaultTimezone: 'Europe/Madrid'
    };
    
    // Inicializar servicio de notificaciones y sync de métricas
    this.notificationService = new NotificationService();
    this.metricsSync = new MetricsSync();
    
    console.log('🛡️ InternalLimitsController inicializado con sistema de notificaciones y sync de métricas');
  }

  /**
   * Verifica y aplica todos los límites internos para una campaña específica
   * @param {number} campaignId - ID de la campaña 
   * @returns {Promise<Object>} Resultado de verificación
   */
  async checkCampaignLimits(campaignId) {
    console.log(`🔍 Verificando límites internos para campaña ${campaignId}`);
    
    try {
      // Sync métricas antes de verificar límites
      await this.syncCampaignMetricsIfNeeded(campaignId);
      
      // Obtener datos de la campaña y sus límites internos
      const campaignData = await this.getCampaignInternalData(campaignId);
      
      if (!campaignData) {
        return { success: false, error: 'Campaña no encontrada' };
      }
      
      const results = {
        campaignId,
        budgetCheck: await this.checkBudgetLimits(campaignData),
        dateCheck: await this.checkDateLimits(campaignData),
        cpcCheck: await this.checkCPCLimits(campaignData),
        actions: []
      };
      
      // Aplicar acciones automáticas si es necesario
      await this.applyAutomaticActions(campaignData, results);
      
      return results;
      
    } catch (error) {
      console.error(`❌ Error verificando límites de campaña ${campaignId}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sincroniza métricas si es necesario (no más de una vez cada 5 minutos)
   * @param {number} campaignId - ID de la campaña
   */
  async syncCampaignMetricsIfNeeded(campaignId) {
    try {
      const campaignData = await this.getCampaignInternalData(campaignId);
      
      if (!campaignData || !campaignData.LastMetricsSync) {
        // Primera vez, hacer sync
        console.log(`📊 Primer sync de métricas para campaña ${campaignId}`);
        await this.metricsSync.forceSyncCampaign(campaignId, campaignData.UserId);
        return;
      }
      
      // Verificar si han pasado más de 5 minutos desde último sync
      const lastSync = new Date(campaignData.LastMetricsSync);
      const now = new Date();
      const minutesSinceSync = (now - lastSync) / (1000 * 60);
      
      if (minutesSinceSync >= 5) {
        console.log(`📊 Actualizando métricas para campaña ${campaignId} (${minutesSinceSync.toFixed(1)} min desde último sync)`);
        await this.metricsSync.forceSyncCampaign(campaignId, campaignData.UserId);
      }
      
    } catch (error) {
      console.log(`⚠️ Error sync métricas campaña ${campaignId}: ${error.message} - continuando con datos existentes`);
    }
  }

  /**
   * Obtiene datos internos de la campaña (límites que NO se envían a canales)
   * @param {number} campaignId - ID de la campaña
   * @returns {Promise<Object>} Datos internos de la campaña
   */
  async getCampaignInternalData(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT 
            c.Id,
            c.Name,
            c.Status,
            c.Budget as totalBudget,
            c.TargetApplications,
            c.CreatedAt,
            
            -- Campos internos que NO se envían a canales externos
            JSON_VALUE(c.InternalConfig, '$.maxCPC') as maxCPC,
            JSON_VALUE(c.InternalConfig, '$.dailyBudget') as dailyBudget,
            JSON_VALUE(c.InternalConfig, '$.startDate') as startDate,
            JSON_VALUE(c.InternalConfig, '$.endDate') as endDate,
            JSON_VALUE(c.InternalConfig, '$.timezone') as timezone,
            JSON_VALUE(c.InternalConfig, '$.bidStrategy') as bidStrategy,
            
            -- Métricas actuales
            COALESCE(SUM(cc.SpentBudget), 0) as currentSpend,
            COALESCE(SUM(cc.AchievedApplications), 0) as currentApplications,
            COALESCE(AVG(cc.CurrentCPA), 0) as currentCPA
            
          FROM Campaigns c
          LEFT JOIN CampaignChannels cc ON c.Id = cc.CampaignId AND cc.Status = 'active'
          WHERE c.Id = @CampaignId
          GROUP BY c.Id, c.Name, c.Status, c.Budget, c.TargetApplications, c.CreatedAt, c.InternalConfig
        `);
      
      return result.recordset[0] || null;
      
    } catch (error) {
      console.error(`❌ Error obteniendo datos internos de campaña ${campaignId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Verifica límites de presupuesto (totalBudget/dailyBudget)
   * @param {Object} campaignData - Datos de la campaña
   * @returns {Promise<Object>} Resultado de verificación de presupuesto
   */
  async checkBudgetLimits(campaignData) {
    const result = {
      type: 'budget',
      withinLimits: true,
      alerts: [],
      actions: []
    };
    
    try {
      const currentSpend = parseFloat(campaignData.currentSpend) || 0;
      const totalBudget = parseFloat(campaignData.totalBudget) || 0;
      const dailyBudget = parseFloat(campaignData.dailyBudget) || null;
      
      // Verificar presupuesto total
      if (totalBudget > 0) {
        const budgetUsage = currentSpend / totalBudget;
        
        if (budgetUsage >= 1.0) {
          result.withinLimits = false;
          result.actions.push({
            type: 'pause_campaign',
            reason: 'budget_exceeded',
            data: { spent: currentSpend, budget: totalBudget, usage: budgetUsage }
          });
        } else if (budgetUsage >= this.config.alertThresholds.budgetCritical) {
          result.alerts.push({
            level: 'critical',
            message: `Presupuesto crítico: ${(budgetUsage * 100).toFixed(1)}% usado`,
            data: { spent: currentSpend, budget: totalBudget, usage: budgetUsage }
          });
          
          // Enviar notificación crítica
          await this.sendBudgetAlert(campaignData, 'budget_critical', {
            campaignName: campaignData.Name,
            percentage: (budgetUsage * 100).toFixed(1),
            spent: currentSpend.toFixed(2),
            budget: totalBudget.toFixed(2)
          });
          
        } else if (budgetUsage >= this.config.alertThresholds.budgetWarning) {
          result.alerts.push({
            level: 'warning',
            message: `Presupuesto advertencia: ${(budgetUsage * 100).toFixed(1)}% usado`,
            data: { spent: currentSpend, budget: totalBudget, usage: budgetUsage }
          });
          
          // Enviar notificación de advertencia
          await this.sendBudgetAlert(campaignData, 'budget_warning', {
            campaignName: campaignData.Name,
            percentage: (budgetUsage * 100).toFixed(1),
            spent: currentSpend.toFixed(2),
            budget: totalBudget.toFixed(2)
          });
        }
      }
      
      // Verificar presupuesto diario si está configurado
      if (dailyBudget && dailyBudget > 0) {
        const todaySpend = await this.getTodaySpend(campaignData.Id);
        const dailyUsage = todaySpend / dailyBudget;
        
        if (dailyUsage >= 1.0) {
          result.withinLimits = false;
          result.actions.push({
            type: 'pause_campaign_daily',
            reason: 'daily_budget_exceeded',
            data: { todaySpend, dailyBudget, usage: dailyUsage }
          });
          
          // Enviar notificación de presupuesto diario agotado
          await this.sendDailyBudgetAlert(campaignData, {
            todaySpend,
            dailyBudget
          });
          
        } else if (dailyUsage >= this.config.alertThresholds.budgetCritical) {
          result.alerts.push({
            level: 'critical',
            message: `Presupuesto diario crítico: ${(dailyUsage * 100).toFixed(1)}% usado hoy`,
            data: { todaySpend, dailyBudget, usage: dailyUsage }
          });
        }
      }
      
      console.log(`💰 Budget check campaña ${campaignData.Id}: €${currentSpend}/€${totalBudget} (${((currentSpend/totalBudget)*100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error(`❌ Error verificando límites de presupuesto: ${error.message}`);
      result.error = error.message;
    }
    
    return result;
  }

  /**
   * Verifica límites de fechas (startDate/endDate)
   * @param {Object} campaignData - Datos de la campaña
   * @returns {Promise<Object>} Resultado de verificación de fechas
   */
  async checkDateLimits(campaignData) {
    const result = {
      type: 'dates',
      withinLimits: true,
      alerts: [],
      actions: []
    };
    
    try {
      const now = new Date();
      const startDate = campaignData.startDate ? new Date(campaignData.startDate) : null;
      const endDate = campaignData.endDate ? new Date(campaignData.endDate) : null;
      
      // Verificar si la campaña ya debería haber empezado
      if (startDate && now < startDate) {
        result.actions.push({
          type: 'pause_campaign',
          reason: 'not_started_yet',
          data: { startDate: startDate.toISOString(), currentDate: now.toISOString() }
        });
        result.withinLimits = false;
      }
      
      // Verificar si la campaña ya debería haber terminado
      if (endDate && now > endDate) {
        result.actions.push({
          type: 'pause_campaign',
          reason: 'campaign_ended',
          data: { endDate: endDate.toISOString(), currentDate: now.toISOString() }
        });
        result.withinLimits = false;
      }
      
      // Alertas de tiempo restante
      if (endDate && now < endDate) {
        const totalDuration = endDate.getTime() - (startDate ? startDate.getTime() : campaignData.CreatedAt);
        const elapsed = now.getTime() - (startDate ? startDate.getTime() : new Date(campaignData.CreatedAt).getTime());
        const timeUsage = elapsed / totalDuration;
        
        if (timeUsage >= this.config.alertThresholds.timeCritical) {
          result.alerts.push({
            level: 'critical',
            message: `Campaña termina pronto: ${(timeUsage * 100).toFixed(1)}% del tiempo transcurrido`,
            data: { endDate: endDate.toISOString(), timeUsage }
          });
        } else if (timeUsage >= this.config.alertThresholds.timeWarning) {
          result.alerts.push({
            level: 'warning',
            message: `Queda poco tiempo: ${(timeUsage * 100).toFixed(1)}% del tiempo transcurrido`,
            data: { endDate: endDate.toISOString(), timeUsage }
          });
        }
      }
      
      console.log(`📅 Date check campaña ${campaignData.Id}: ${startDate ? startDate.toISOString().split('T')[0] : 'sin inicio'} - ${endDate ? endDate.toISOString().split('T')[0] : 'sin fin'}`);
      
    } catch (error) {
      console.error(`❌ Error verificando límites de fechas: ${error.message}`);
      result.error = error.message;
    }
    
    return result;
  }

  /**
   * Verifica límites de CPC (maxCPC interno)
   * @param {Object} campaignData - Datos de la campaña
   * @returns {Promise<Object>} Resultado de verificación de CPC
   */
  async checkCPCLimits(campaignData) {
    const result = {
      type: 'cpc',
      withinLimits: true,
      alerts: [],
      actions: []
    };
    
    try {
      // Obtener configuración interna de la campaña
      const internalConfig = this.parseInternalConfig(campaignData.InternalConfig);
      const maxCPC = parseFloat(internalConfig.maxCPC || campaignData.MaxCPA) || null;
      
      if (!maxCPC || maxCPC <= 0) {
        console.log(`💳 CPC check campaña ${campaignData.Id}: Sin límite de CPC configurado`);
        return result;
      }
      
      // Obtener CPA actual real desde la base de datos
      const currentCPA = await this.getCurrentCPA(campaignData.Id);
      const avgCPC = await this.getAverageCPC(campaignData.Id);
      const lastDayCPA = await this.getLastDayAverageCPA(campaignData.Id);
      
      // Verificar límite principal
      if (currentCPA > maxCPC) {
        result.withinLimits = false;
        result.actions.push({
          type: 'reduce_bids',
          reason: 'cpc_exceeded',
          data: { 
            currentCPA: currentCPA.toFixed(2), 
            maxCPC: maxCPC.toFixed(2), 
            excess: (currentCPA - maxCPC).toFixed(2),
            avgCPC: avgCPC.toFixed(2),
            lastDayCPA: lastDayCPA.toFixed(2)
          }
        });
        
        // Enviar notificación de CPC excedido
        await this.sendCPCExceededAlert(campaignData, {
          currentCPA: currentCPA.toFixed(2),
          maxCPC: maxCPC.toFixed(2),
          excess: (currentCPA - maxCPC).toFixed(2)
        });
        
      } else if (currentCPA > maxCPC * 0.9) {
        result.alerts.push({
          level: 'warning',
          message: `CPA cerca del límite: €${currentCPA.toFixed(2)} (máx: €${maxCPC.toFixed(2)})`,
          data: { currentCPA: currentCPA.toFixed(2), maxCPC: maxCPC.toFixed(2) }
        });
      }
      
      // Verificar tendencia de CPC (si está aumentando rápidamente)
      if (lastDayCPA > 0 && currentCPA > lastDayCPA * 1.2) {
        result.alerts.push({
          level: 'warning',
          message: `CPA tendencia al alza: +${((currentCPA/lastDayCPA - 1) * 100).toFixed(1)}% vs ayer`,
          data: { 
            currentCPA: currentCPA.toFixed(2), 
            lastDayCPA: lastDayCPA.toFixed(2),
            increase: ((currentCPA/lastDayCPA - 1) * 100).toFixed(1)
          }
        });
      }
      
      // Validar que las pujas actuales en canales no excedan el maxCPC
      const channelValidation = await this.validateChannelBids(campaignData.Id, maxCPC);
      if (!channelValidation.valid) {
        result.alerts.push({
          level: 'critical',
          message: `Pujas en canales exceden límite interno`,
          data: channelValidation
        });
      }
      
      console.log(`💳 CPC check campaña ${campaignData.Id}: €${currentCPA.toFixed(2)} actual vs €${maxCPC.toFixed(2)} límite (avg 24h: €${avgCPC.toFixed(2)})`);
      
    } catch (error) {
      console.error(`❌ Error verificando límites de CPC: ${error.message}`);
      result.error = error.message;
    }
    
    return result;
  }

  /**
   * Aplica acciones automáticas basadas en los resultados de verificación
   * @param {Object} campaignData - Datos de la campaña
   * @param {Object} checkResults - Resultados de verificación
   */
  async applyAutomaticActions(campaignData, checkResults) {
    const allActions = [
      ...checkResults.budgetCheck.actions,
      ...checkResults.dateCheck.actions,
      ...checkResults.cpcCheck.actions
    ];
    
    for (const action of allActions) {
      try {
        console.log(`🎯 Aplicando acción automática: ${action.type} - ${action.reason}`);
        
        switch (action.type) {
          case 'pause_campaign':
          case 'pause_campaign_daily':
            await this.pauseCampaignDueToLimits(campaignData.Id, action.reason, action.data);
            checkResults.actions.push(`Campaña pausada: ${action.reason}`);
            break;
            
          case 'reduce_bids':
            const cpcData = action.data;
            const maxCPC = parseFloat(cpcData.maxCPC);
            const reductionResult = await this.enforceCPCLimits(campaignData.Id, maxCPC, action.reason);
            checkResults.actions.push(`Pujas reducidas: ${reductionResult.reduced} canales ajustados`);
            
            // Enviar notificación de pujas reducidas
            await this.sendBidsReducedAlert(campaignData, {
              oldBid: parseFloat(cpcData.currentCPA),
              newBid: maxCPC * 0.95,
              maxCPC: maxCPC,
              channelsAffected: reductionResult.reduced
            });
            break;
            
          default:
            console.warn(`⚠️ Acción desconocida: ${action.type}`);
        }
        
      } catch (error) {
        console.error(`❌ Error aplicando acción ${action.type}: ${error.message}`);
        checkResults.actions.push(`Error en ${action.type}: ${error.message}`);
      }
    }
  }

  /**
   * Pausa una campaña debido a límites internos excedidos
   * @param {number} campaignId - ID de la campaña
   * @param {string} reason - Razón del pausado
   * @param {Object} data - Datos adicionales
   */
  async pauseCampaignDueToLimits(campaignId, reason, data) {
    try {
      await poolConnect;
      
      // Pausar campaña en nuestra base de datos
      await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .input('Reason', sql.NVarChar(500), `Auto-pausada: ${reason}`)
        .query(`
          UPDATE Campaigns 
          SET Status = 'paused',
              UpdatedAt = GETDATE(),
              InternalConfig = JSON_MODIFY(
                ISNULL(InternalConfig, '{}'), 
                '$.autoPausedReason', 
                @Reason
              )
          WHERE Id = @CampaignId
        `);
      
      // Pausar en todos los canales externos
      await this.pauseCampaignInExternalChannels(campaignId);
      
      console.log(`⏸️ Campaña ${campaignId} pausada automáticamente: ${reason}`);
      
      // Enviar notificación de campaña pausada
      const campaignInfo = await this.getCampaignBasicInfo(campaignId);
      if (campaignInfo) {
        await this.sendCampaignPausedAlert(campaignInfo, reason, data);
      }
      
    } catch (error) {
      console.error(`❌ Error pausando campaña ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pausa campaña en todos los canales externos
   * @param {number} campaignId - ID de la campaña
   */
  async pauseCampaignInExternalChannels(campaignId) {
    try {
      const ChannelFactory = require('./channels/channelFactory');
      const channelFactory = new ChannelFactory();
      
      // Obtener canales activos de la campaña
      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT DISTINCT ChannelId, ExternalCampaignId
          FROM CampaignChannels
          WHERE CampaignId = @CampaignId 
            AND Status = 'active'
            AND ExternalCampaignId IS NOT NULL
        `);
      
      // Pausar en cada canal
      for (const channel of result.recordset) {
        try {
          const channelService = await channelFactory.getChannel(channel.ChannelId, {}, 1); // TODO: usar userId real
          
          if (channelService && channelService.pauseCampaign) {
            await channelService.pauseCampaign(channel.ExternalCampaignId);
            console.log(`⏸️ Pausada en ${channel.ChannelId}: ${channel.ExternalCampaignId}`);
          }
          
        } catch (channelError) {
          console.error(`❌ Error pausando en canal ${channel.ChannelId}: ${channelError.message}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error pausando en canales externos: ${error.message}`);
    }
  }

  /**
   * Reduce pujas de una campaña cuando excede maxCPC
   * @param {number} campaignId - ID de la campaña
   * @param {Object} data - Datos del exceso de CPC
   */
  async reduceCampaignBids(campaignId, data) {
    try {
      // Calcular nueva puja (reducir 20% o hasta maxCPC)
      const reductionFactor = 0.8;
      const newBid = Math.min(data.maxCPC, data.currentCPA * reductionFactor);
      
      console.log(`📉 Reduciendo pujas campaña ${campaignId}: €${data.currentCPA.toFixed(2)} → €${newBid.toFixed(2)}`);
      
      // TODO: Implementar actualización de pujas en canales externos
      // Esto requerirá llamar a updateBids() en cada canal
      
      // Enviar notificación de pujas reducidas
      const campaignInfo = await this.getCampaignBasicInfo(campaignId);
      if (campaignInfo) {
        await this.sendBidsReducedAlert(campaignInfo, { 
          oldBid: data.currentCPA, 
          newBid, 
          maxCPC: data.maxCPC 
        });
      }
      
    } catch (error) {
      console.error(`❌ Error reduciendo pujas campaña ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene el gasto de hoy para una campaña
   * @param {number} campaignId - ID de la campaña
   * @returns {Promise<number>} Gasto de hoy
   */
  async getTodaySpend(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT COALESCE(SUM(SpentBudget), 0) as TodaySpend
          FROM CampaignChannels cc
          WHERE CampaignId = @CampaignId
            AND CAST(UpdatedAt as DATE) = CAST(GETDATE() as DATE)
        `);
      
      return parseFloat(result.recordset[0].TodaySpend) || 0;
      
    } catch (error) {
      console.error(`❌ Error obteniendo gasto de hoy: ${error.message}`);
      return 0;
    }
  }

  /**
   * Genera alerta de límite interno (método legacy - mantenido para compatibilidad)
   * @param {number} campaignId - ID de la campaña
   * @param {string} alertType - Tipo de alerta
   * @param {Object} data - Datos de la alerta
   */
  async generateLimitAlert(campaignId, alertType, data) {
    const alertMessage = {
      campaign_paused: `🛑 Campaña ${campaignId} pausada automáticamente: ${data.reason}`,
      bids_reduced: `📉 Pujas reducidas campaña ${campaignId}: €${data.oldBid.toFixed(2)} → €${data.newBid.toFixed(2)}`,
      budget_warning: `⚠️ Campaña ${campaignId}: Presupuesto al ${(data.usage * 100).toFixed(1)}%`,
      budget_critical: `🚨 Campaña ${campaignId}: Presupuesto CRÍTICO al ${(data.usage * 100).toFixed(1)}%`
    };
    
    const message = alertMessage[alertType] || `Alerta límite interno: ${alertType}`;
    
    console.log(message);
    
    // Ahora se usan los métodos específicos de notificación
  }

  /**
   * Obtiene información básica de una campaña para notificaciones
   * @param {number} campaignId - ID de la campaña
   * @returns {Promise<Object|null>} Información básica de la campaña
   */
  async getCampaignBasicInfo(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT Id, Name, Status
          FROM Campaigns 
          WHERE Id = @CampaignId
        `);
      
      return result.recordset[0] || null;
      
    } catch (error) {
      console.error(`❌ Error obteniendo info básica de campaña ${campaignId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Envía alerta de presupuesto
   * @param {Object} campaignData - Datos de la campaña
   * @param {string} alertType - Tipo de alerta (budget_warning, budget_critical)
   * @param {Object} data - Datos para la notificación
   */
  async sendBudgetAlert(campaignData, alertType, data) {
    try {
      await this.notificationService.sendNotification(alertType, data, {
        userId: campaignData.UserId || 1, // TODO: obtener userId real de la campaña
        campaignId: campaignData.Id
      });
    } catch (error) {
      console.error(`❌ Error enviando alerta de presupuesto: ${error.message}`);
    }
  }

  /**
   * Envía notificación de campaña pausada
   * @param {Object} campaignData - Datos de la campaña
   * @param {string} reason - Razón del pausado
   * @param {Object} data - Datos adicionales
   */
  async sendCampaignPausedAlert(campaignData, reason, data) {
    try {
      await this.notificationService.sendNotification('campaign_paused', {
        campaignName: campaignData.Name,
        reason: reason,
        ...data
      }, {
        userId: campaignData.UserId || 1,
        campaignId: campaignData.Id
      });
    } catch (error) {
      console.error(`❌ Error enviando alerta de campaña pausada: ${error.message}`);
    }
  }

  /**
   * Envía notificación de CPC excedido
   * @param {Object} campaignData - Datos de la campaña
   * @param {Object} data - Datos del CPC
   */
  async sendCPCAlert(campaignData, data) {
    try {
      await this.notificationService.sendNotification('cpc_exceeded', {
        campaignName: campaignData.Name,
        currentCPA: data.currentCPA.toFixed(2),
        maxCPC: data.maxCPC.toFixed(2)
      }, {
        userId: campaignData.UserId || 1,
        campaignId: campaignData.Id
      });
    } catch (error) {
      console.error(`❌ Error enviando alerta de CPC: ${error.message}`);
    }
  }

  /**
   * Envía notificación de pujas reducidas
   * @param {Object} campaignData - Datos de la campaña  
   * @param {Object} data - Datos de las pujas
   */
  async sendBidsReducedAlert(campaignData, data) {
    try {
      await this.notificationService.sendNotification('bids_reduced', {
        campaignName: campaignData.Name,
        oldBid: data.oldBid.toFixed(2),
        newBid: data.newBid.toFixed(2),
        maxCPC: data.maxCPC.toFixed(2)
      }, {
        userId: campaignData.UserId || 1,
        campaignId: campaignData.Id
      });
    } catch (error) {
      console.error(`❌ Error enviando alerta de pujas reducidas: ${error.message}`);
    }
  }

  /**
   * Envía notificación de campaña próxima a finalizar
   * @param {Object} campaignData - Datos de la campaña
   * @param {Object} data - Datos de la fecha
   */
  async sendCampaignEndingAlert(campaignData, data) {
    try {
      await this.notificationService.sendNotification('campaign_ending', {
        campaignName: campaignData.Name,
        endDate: data.endDate,
        daysLeft: data.daysLeft
      }, {
        userId: campaignData.UserId || 1,
        campaignId: campaignData.Id
      });
    } catch (error) {
      console.error(`❌ Error enviando alerta de campaña próxima a finalizar: ${error.message}`);
    }
  }

  /**
   * Envía notificación de presupuesto diario agotado
   * @param {Object} campaignData - Datos de la campaña
   * @param {Object} data - Datos del presupuesto diario
   */
  async sendDailyBudgetAlert(campaignData, data) {
    try {
      await this.notificationService.sendNotification('daily_budget_exceeded', {
        campaignName: campaignData.Name,
        todaySpend: data.todaySpend.toFixed(2),
        dailyBudget: data.dailyBudget.toFixed(2)
      }, {
        userId: campaignData.UserId || 1,
        campaignId: campaignData.Id
      });
    } catch (error) {
      console.error(`❌ Error enviando alerta de presupuesto diario: ${error.message}`);
    }
  }

  /**
   * Obtiene el CPA actual real de una campaña desde la base de datos
   * @param {number} campaignId - ID de la campaña
   * @returns {Promise<number>} CPA actual
   */
  async getCurrentCPA(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('campaignId', sql.Int, campaignId)
        .query(`
          SELECT 
            COALESCE(SUM(CAST(BudgetSpent AS DECIMAL(12,2))), 0) as totalSpent,
            COALESCE(SUM(CAST(Applications AS INT)), 0) as totalApplications
          FROM CampaignDistribution 
          WHERE CampaignId = @campaignId 
            AND Status = 'active'
            AND CreatedAt >= DATEADD(DAY, -7, GETDATE())
        `);
      
      const totalSpent = parseFloat(result.recordset[0]?.totalSpent) || 0;
      const totalApplications = parseInt(result.recordset[0]?.totalApplications) || 0;
      
      return totalApplications > 0 ? (totalSpent / totalApplications) : 0;
      
    } catch (error) {
      console.error(`❌ Error obteniendo CPA actual: ${error.message}`);
      return 0;
    }
  }

  /**
   * Obtiene el CPC promedio de los últimos 7 días
   * @param {number} campaignId - ID de la campaña
   * @returns {Promise<number>} CPC promedio
   */
  async getAverageCPC(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('campaignId', sql.Int, campaignId)
        .query(`
          SELECT 
            COALESCE(AVG(CAST(BudgetSpent AS DECIMAL(12,2)) / NULLIF(CAST(Applications AS DECIMAL(12,2)), 0)), 0) as avgCPC
          FROM CampaignDistribution 
          WHERE CampaignId = @campaignId 
            AND Status = 'active'
            AND Applications > 0
            AND CreatedAt >= DATEADD(DAY, -7, GETDATE())
        `);
      
      return parseFloat(result.recordset[0]?.avgCPC) || 0;
      
    } catch (error) {
      console.error(`❌ Error obteniendo CPC promedio: ${error.message}`);
      return 0;
    }
  }

  /**
   * Obtiene el CPA promedio del último día
   * @param {number} campaignId - ID de la campaña
   * @returns {Promise<number>} CPA del último día
   */
  async getLastDayAverageCPA(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('campaignId', sql.Int, campaignId)
        .query(`
          SELECT 
            COALESCE(SUM(CAST(BudgetSpent AS DECIMAL(12,2))), 0) as totalSpent,
            COALESCE(SUM(CAST(Applications AS INT)), 0) as totalApplications
          FROM CampaignDistribution 
          WHERE CampaignId = @campaignId 
            AND Status = 'active'
            AND CreatedAt >= DATEADD(DAY, -1, GETDATE())
        `);
      
      const totalSpent = parseFloat(result.recordset[0]?.totalSpent) || 0;
      const totalApplications = parseInt(result.recordset[0]?.totalApplications) || 0;
      
      return totalApplications > 0 ? (totalSpent / totalApplications) : 0;
      
    } catch (error) {
      console.error(`❌ Error obteniendo CPA último día: ${error.message}`);
      return 0;
    }
  }

  /**
   * Valida que las pujas actuales en canales no excedan el límite interno
   * @param {number} campaignId - ID de la campaña
   * @param {number} maxCPC - Límite máximo de CPC interno
   * @returns {Promise<Object>} Resultado de validación
   */
  async validateChannelBids(campaignId, maxCPC) {
    try {
      await poolConnect;
      
      // Obtener distribuciones activas de la campaña
      const result = await pool.request()
        .input('campaignId', sql.Int, campaignId)
        .query(`
          SELECT Channel, CAST(BidAmount AS DECIMAL(12,2)) as BidAmount
          FROM CampaignDistribution 
          WHERE CampaignId = @campaignId 
            AND Status = 'active'
            AND BidAmount IS NOT NULL
        `);
      
      const violations = [];
      let valid = true;
      
      for (const distribution of result.recordset) {
        const bidAmount = parseFloat(distribution.BidAmount) || 0;
        if (bidAmount > maxCPC) {
          violations.push({
            channel: distribution.Channel,
            currentBid: bidAmount.toFixed(2),
            maxAllowed: maxCPC.toFixed(2),
            excess: (bidAmount - maxCPC).toFixed(2)
          });
          valid = false;
        }
      }
      
      return {
        valid,
        violations,
        totalChannels: result.recordset.length,
        violationsCount: violations.length
      };
      
    } catch (error) {
      console.error(`❌ Error validando pujas de canales: ${error.message}`);
      return { valid: true, violations: [], error: error.message };
    }
  }

  /**
   * Reduce automáticamente las pujas que exceden el límite interno
   * @param {number} campaignId - ID de la campaña
   * @param {number} maxCPC - Límite máximo de CPC
   * @param {string} reason - Razón de la reducción
   * @returns {Promise<Object>} Resultado de la reducción
   */
  async enforceCPCLimits(campaignId, maxCPC, reason = 'cpc_exceeded') {
    try {
      await poolConnect;
      
      // Primero validar qué pujas exceden el límite
      const validation = await this.validateChannelBids(campaignId, maxCPC);
      
      if (validation.valid) {
        return { reduced: 0, message: 'Todas las pujas están dentro del límite' };
      }
      
      // Reducir pujas que exceden el límite
      const reducedBids = [];
      
      for (const violation of validation.violations) {
        const newBid = Math.min(maxCPC * 0.95, maxCPC - 0.01); // 5% por debajo del límite como margen
        
        await pool.request()
          .input('campaignId', sql.Int, campaignId)
          .input('channel', sql.NVarChar, violation.channel)
          .input('newBid', sql.Decimal(12,2), newBid)
          .query(`
            UPDATE CampaignDistribution 
            SET BidAmount = @newBid,
                UpdatedAt = GETDATE()
            WHERE CampaignId = @campaignId 
              AND Channel = @channel
              AND Status = 'active'
          `);
        
        reducedBids.push({
          channel: violation.channel,
          oldBid: violation.currentBid,
          newBid: newBid.toFixed(2),
          reduction: (parseFloat(violation.currentBid) - newBid).toFixed(2)
        });
      }
      
      // Log de la acción
      console.log(`🔧 Pujas reducidas en campaña ${campaignId} por ${reason}: ${reducedBids.length} canales`);
      
      return {
        reduced: reducedBids.length,
        details: reducedBids,
        reason,
        maxCPC: maxCPC.toFixed(2)
      };
      
    } catch (error) {
      console.error(`❌ Error aplicando límites de CPC: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parsea la configuración interna JSON de la campaña
   * @param {string|null} internalConfigJson - JSON string de configuración interna
   * @returns {Object} Configuración parseada o objeto vacío
   */
  parseInternalConfig(internalConfigJson) {
    try {
      if (!internalConfigJson || typeof internalConfigJson !== 'string') {
        return {};
      }
      
      const config = JSON.parse(internalConfigJson);
      return config || {};
      
    } catch (error) {
      console.warn(`⚠️ Error parseando InternalConfig: ${error.message}. Usando configuración vacía.`);
      return {};
    }
  }

  /**
   * Verifica límites para todas las campañas activas
   * @returns {Promise<Object>} Resultados consolidados
   */
  async checkAllActiveCampaigns() {
    try {
      console.log('🔍 Verificando límites internos para todas las campañas activas');
      
      // Obtener campañas activas
      const result = await pool.request().query(`
        SELECT Id FROM Campaigns 
        WHERE Status IN ('active', 'running')
      `);
      
      const campaigns = result.recordset;
      console.log(`📊 Verificando ${campaigns.length} campañas activas`);
      
      const results = await Promise.allSettled(
        campaigns.map(campaign => this.checkCampaignLimits(campaign.Id))
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Verificación completada: ${successful} exitosas, ${failed} fallidas`);
      
      return {
        total: campaigns.length,
        successful,
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
      };
      
    } catch (error) {
      console.error(`❌ Error verificando todas las campañas: ${error.message}`);
      return { error: error.message };
    }
  }
}

module.exports = { InternalLimitsController };

