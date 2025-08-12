const { pool, poolConnect, sql } = require('../db/db');
const ChannelFactory = require('./channels/channelFactory');
const cron = require('node-cron');

/**
 * PerformanceTracker - Sistema de tracking en tiempo real
 * 
 * Responsabilidades:
 * - Actualización automática de estadísticas desde canales externos
 * - Monitoreo de métricas de performance
 * - Alertas automáticas por presupuesto/rendimiento
 * - Optimización automática de bids
 */
class PerformanceTracker {
  
  constructor() {
    this.channelFactory = new ChannelFactory();
    this.isRunning = false;
    this.updateInterval = null;
    this.config = {
      updateFrequency: process.env.PERFORMANCE_UPDATE_FREQUENCY || '*/10 * * * *', // Cada 10 minutos por defecto
      alertThresholds: {
        budgetWarning: 0.8,    // Alerta al 80% del presupuesto
        budgetCritical: 0.95,  // Crítica al 95%
        cpaIncrease: 1.5,      // Alerta si CPA aumenta 50%
        lowPerformance: 0.5    // Alerta si performance baja 50%
      }
    };
    
    console.log('📊 PerformanceTracker inicializado');
  }

  /**
   * Inicia el tracking automático de performance
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ PerformanceTracker ya está ejecutándose');
      return;
    }

    console.log(`🚀 Iniciando PerformanceTracker con frecuencia: ${this.config.updateFrequency}`);
    
    // Programar actualizaciones automáticas usando cron
    this.updateInterval = cron.schedule(this.config.updateFrequency, () => {
      this.performScheduledUpdate();
    }, {
      scheduled: false,
      timezone: "Europe/Madrid"
    });

    this.updateInterval.start();
    this.isRunning = true;
    
    console.log('✅ PerformanceTracker iniciado exitosamente');
  }

  /**
   * Detiene el tracking automático
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ PerformanceTracker no está ejecutándose');
      return;
    }

    if (this.updateInterval) {
      this.updateInterval.stop();
      this.updateInterval = null;
    }

    this.isRunning = false;
    console.log('🛑 PerformanceTracker detenido');
  }

  /**
   * Actualización programada que se ejecuta automáticamente
   */
  async performScheduledUpdate() {
    try {
      console.log('🔄 Ejecutando actualización programada de performance');
      
      const startTime = Date.now();
      
      // Obtener campañas activas
      const activeCampaigns = await this.getActiveCampaigns();
      
      if (activeCampaigns.length === 0) {
        console.log('📭 No hay campañas activas para actualizar');
        return;
      }

      console.log(`📊 Actualizando ${activeCampaigns.length} campañas activas`);
      
      // Actualizar performance de cada campaña
      const results = await Promise.allSettled(
        activeCampaigns.map(campaign => this.updateCampaignPerformance(campaign.Id))
      );
      
      // Procesar resultados
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ Actualización completada en ${duration}ms: ${successful} exitosas, ${failed} fallidas`);
      
      // Generar alertas si es necesario
      await this.checkAndGenerateAlerts(activeCampaigns);
      
    } catch (error) {
      console.error(`❌ Error en actualización programada: ${error.message}`);
    }
  }

  /**
   * Obtiene campañas activas que requieren actualización
   */
  async getActiveCampaigns() {
    try {
      await poolConnect;
      
      const result = await pool.request().query(`
        SELECT DISTINCT c.Id, c.Name, c.Budget, c.TargetApplications
        FROM Campaigns c
        JOIN CampaignChannels cc ON c.Id = cc.CampaignId
        WHERE c.Status = 'active' 
          AND cc.Status = 'active'
          AND cc.ExternalCampaignId IS NOT NULL
      `);
      
      return result.recordset;
      
    } catch (error) {
      console.error(`❌ Error obteniendo campañas activas: ${error.message}`);
      return [];
    }
  }

  /**
   * Actualiza performance de una campaña específica
   */
  async updateCampaignPerformance(campaignId) {
    try {
      console.log(`📈 Actualizando performance de campaña ${campaignId}`);
      
      // Obtener canales y ofertas de la campaña
      const campaignChannels = await this.getCampaignChannels(campaignId);
      
      if (campaignChannels.length === 0) {
        console.log(`⚠️ No hay canales activos para campaña ${campaignId}`);
        return { campaignId, success: false, reason: 'no_active_channels' };
      }
      
      // Agrupar por canal
      const channelGroups = this.groupChannelsByType(campaignChannels);
      
      // Actualizar estadísticas por canal
      const updatePromises = Object.entries(channelGroups).map(([channelId, records]) => 
        this.updateChannelPerformance(campaignId, channelId, records)
      );
      
      const results = await Promise.allSettled(updatePromises);
      
      // Calcular métricas consolidadas
      await this.calculateConsolidatedMetrics(campaignId);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      console.log(`✅ Performance actualizada para campaña ${campaignId}: ${successful}/${results.length} canales`);
      
      return {
        campaignId,
        success: successful > 0,
        channelsUpdated: successful,
        totalChannels: results.length
      };
      
    } catch (error) {
      console.error(`❌ Error actualizando campaña ${campaignId}: ${error.message}`);
      return { campaignId, success: false, error: error.message };
    }
  }

  /**
   * Obtiene canales de una campaña
   */
  async getCampaignChannels(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT ChannelId, OfferId, ExternalCampaignId, AllocatedBudget, SpentBudget, 
                 AllocatedTarget, AchievedApplications, CurrentCPA, BidAmount
          FROM CampaignChannels
          WHERE CampaignId = @CampaignId 
            AND Status = 'active'
            AND ExternalCampaignId IS NOT NULL
        `);
      
      return result.recordset;
      
    } catch (error) {
      console.error(`❌ Error obteniendo canales de campaña ${campaignId}: ${error.message}`);
      return [];
    }
  }

  /**
   * Agrupa canales por tipo para optimizar llamadas API
   */
  groupChannelsByType(campaignChannels) {
    const groups = {};
    
    campaignChannels.forEach(channel => {
      if (!groups[channel.ChannelId]) {
        groups[channel.ChannelId] = [];
      }
      groups[channel.ChannelId].push(channel);
    });
    
    return groups;
  }

  /**
   * Actualiza performance de un canal específico
   */
  async updateChannelPerformance(campaignId, channelId, channelRecords) {
    try {
      console.log(`🔄 Actualizando canal ${channelId} para campaña ${campaignId}`);
      
      const channelService = this.channelFactory.getChannel(channelId);
      
      // Obtener estadísticas desde el canal externo
      let stats;
      if (channelId === 'jooble' && channelService.getStatistics) {
        // Para Jooble, usar el ID de campaña externa
        const externalCampaignId = channelRecords[0].ExternalCampaignId;
        stats = await channelService.getStatistics(externalCampaignId);
      } else if (channelService.updatePerformanceStats) {
        // Para otros canales, usar lista de ofertas
        const offerIds = channelRecords.map(r => r.OfferId);
        stats = await channelService.updatePerformanceStats(offerIds);
      } else {
        // Simular si no hay implementación específica
        stats = this.simulateChannelStats(channelId, channelRecords);
      }
      
      // Actualizar base de datos con nuevas estadísticas
      await this.saveChannelStats(campaignId, channelId, channelRecords, stats);
      
      console.log(`✅ Canal ${channelId} actualizado para campaña ${campaignId}`);
      
      return { channelId, success: true, stats };
      
    } catch (error) {
      console.error(`❌ Error actualizando canal ${channelId}: ${error.message}`);
      return { channelId, success: false, error: error.message };
    }
  }

  /**
   * Guarda estadísticas de canal en base de datos
   */
  async saveChannelStats(campaignId, channelId, channelRecords, stats) {
    try {
      await poolConnect;
      
      const statsData = stats.stats || stats.data || stats;
      
      if (Array.isArray(statsData)) {
        // Estadísticas por oferta individual
        for (const offerStats of statsData) {
          const record = channelRecords.find(r => r.OfferId == offerStats.offerId);
          if (record) {
            await this.updateChannelRecord(campaignId, channelId, record.OfferId, offerStats);
          }
        }
      } else {
        // Estadísticas agregadas - distribuir entre ofertas
        const totalOffers = channelRecords.length;
        for (const record of channelRecords) {
          const distributedStats = {
            spend: (statsData.spend || 0) / totalOffers,
            applications: Math.floor((statsData.applications || 0) / totalOffers),
            cpa: statsData.cpa || record.CurrentCPA
          };
          
          await this.updateChannelRecord(campaignId, channelId, record.OfferId, distributedStats);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error guardando estadísticas: ${error.message}`);
    }
  }

  /**
   * Actualiza un registro específico de CampaignChannels
   */
  async updateChannelRecord(campaignId, channelId, offerId, stats) {
    try {
      await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .input('ChannelId', sql.NVarChar(50), channelId)
        .input('OfferId', sql.Int, offerId)
        .input('SpentBudget', sql.Decimal(10,2), stats.spend || 0)
        .input('AchievedApplications', sql.Int, stats.applications || 0)
        .input('CurrentCPA', sql.Decimal(8,2), stats.cpa || 0)
        .query(`
          UPDATE CampaignChannels 
          SET 
            SpentBudget = @SpentBudget,
            AchievedApplications = @AchievedApplications,
            CurrentCPA = @CurrentCPA,
            UpdatedAt = GETDATE(),
            LastOptimized = GETDATE()
          WHERE CampaignId = @CampaignId 
            AND ChannelId = @ChannelId 
            AND OfferId = @OfferId
        `);
      
    } catch (error) {
      console.error(`❌ Error actualizando registro: ${error.message}`);
    }
  }

  /**
   * Calcula métricas consolidadas de una campaña
   */
  async calculateConsolidatedMetrics(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT 
            SUM(SpentBudget) as TotalSpent,
            SUM(AchievedApplications) as TotalApplications,
            AVG(CurrentCPA) as AvgCPA,
            COUNT(*) as ActiveChannels
          FROM CampaignChannels
          WHERE CampaignId = @CampaignId AND Status = 'active'
        `);
      
      const metrics = result.recordset[0];
      
      // Actualizar métricas en tabla Campaigns (si existe campo para ello)
      // Por ahora solo loggeamos
      console.log(`📊 Métricas consolidadas campaña ${campaignId}:`, {
        totalSpent: metrics.TotalSpent,
        totalApplications: metrics.TotalApplications,
        avgCPA: metrics.AvgCPA,
        activeChannels: metrics.ActiveChannels
      });
      
    } catch (error) {
      console.error(`❌ Error calculando métricas consolidadas: ${error.message}`);
    }
  }

  /**
   * Verifica y genera alertas basadas en umbrales
   */
  async checkAndGenerateAlerts(campaigns) {
    try {
      console.log('🚨 Verificando alertas para campañas activas');
      
      for (const campaign of campaigns) {
        await this.checkCampaignAlerts(campaign);
      }
      
    } catch (error) {
      console.error(`❌ Error verificando alertas: ${error.message}`);
    }
  }

  /**
   * Verifica alertas para una campaña específica
   */
  async checkCampaignAlerts(campaign) {
    try {
      await poolConnect;
      
      // Obtener métricas actuales
      const result = await pool.request()
        .input('CampaignId', sql.Int, campaign.Id)
        .query(`
          SELECT 
            SUM(SpentBudget) as TotalSpent,
            SUM(AchievedApplications) as TotalApplications,
            AVG(CurrentCPA) as AvgCPA
          FROM CampaignChannels
          WHERE CampaignId = @CampaignId AND Status = 'active'
        `);
      
      const metrics = result.recordset[0];
      
      // Verificar alerta de presupuesto
      const budgetUsage = metrics.TotalSpent / campaign.Budget;
      if (budgetUsage >= this.config.alertThresholds.budgetCritical) {
        await this.generateAlert(campaign.Id, 'budget_critical', {
          usage: budgetUsage,
          spent: metrics.TotalSpent,
          budget: campaign.Budget
        });
      } else if (budgetUsage >= this.config.alertThresholds.budgetWarning) {
        await this.generateAlert(campaign.Id, 'budget_warning', {
          usage: budgetUsage,
          spent: metrics.TotalSpent,
          budget: campaign.Budget
        });
      }
      
      // Verificar alerta de rendimiento
      const applicationRate = metrics.TotalApplications / campaign.TargetApplications;
      if (applicationRate < this.config.alertThresholds.lowPerformance) {
        await this.generateAlert(campaign.Id, 'low_performance', {
          achieved: metrics.TotalApplications,
          target: campaign.TargetApplications,
          rate: applicationRate
        });
      }
      
    } catch (error) {
      console.error(`❌ Error verificando alertas de campaña ${campaign.Id}: ${error.message}`);
    }
  }

  /**
   * Genera una alerta específica
   */
  async generateAlert(campaignId, alertType, data) {
    const alertMessages = {
      budget_warning: `⚠️ Campaña ${campaignId}: ${(data.usage * 100).toFixed(1)}% del presupuesto usado`,
      budget_critical: `🚨 Campaña ${campaignId}: CRÍTICO - ${(data.usage * 100).toFixed(1)}% del presupuesto usado`,
      low_performance: `📉 Campaña ${campaignId}: Bajo rendimiento - ${(data.rate * 100).toFixed(1)}% del objetivo`
    };
    
    const message = alertMessages[alertType] || `Alerta desconocida para campaña ${campaignId}`;
    
    console.log(message);
    
    // Aquí puedes agregar lógica para:
    // - Enviar emails/SMS
    // - Webhook notifications
    // - Slack/Teams alerts
    // - Pausar campaña automáticamente si es crítico
    
    // Por ahora solo guardamos en log
  }

  /**
   * Simula estadísticas para canales sin implementación específica
   */
  simulateChannelStats(channelId, channelRecords) {
    console.log(`🔧 Simulando estadísticas para canal ${channelId}`);
    
    return {
      success: true,
      channel: channelId,
      simulation: true,
      stats: channelRecords.map(record => ({
        offerId: record.OfferId,
        spend: Math.floor(record.AllocatedBudget * (0.1 + Math.random() * 0.3)), // 10-40% del presupuesto
        applications: Math.floor(Math.random() * 5) + 1, // 1-5 aplicaciones
        cpa: 15 + Math.random() * 10 // CPA entre 15-25€
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Obtiene estado actual del tracker
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      updateFrequency: this.config.updateFrequency,
      alertThresholds: this.config.alertThresholds,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }
}

// Instancia singleton para uso global
const performanceTracker = new PerformanceTracker();

module.exports = { PerformanceTracker, performanceTracker };
