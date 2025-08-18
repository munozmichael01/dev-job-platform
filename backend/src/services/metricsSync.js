/**
 * 📊 Servicio de Sincronización de Métricas desde Canales Externos
 * 
 * Responsabilidades:
 * - Obtener métricas reales desde APIs de canales (Jooble, Talent.com, etc.)
 * - Actualizar base de datos con datos de gasto real y aplicaciones
 * - Proporcionar datos actualizados al InternalLimitsController
 * - Manejar errores y reintentos automáticos
 * 
 * @author Claude Code
 * @date 2025-01-17
 */

const { poolConnect, pool, sql } = require('../db/bootstrap');
const ChannelFactory = require('./channels/channelFactory');

class MetricsSync {
  constructor() {
    this.syncIntervalMinutes = 5; // Sync cada 5 minutos
    this.retryAttempts = 3;
    this.isRunning = false;
  }

  /**
   * Inicia el servicio de sync automático
   */
  async startAutomaticSync() {
    if (this.isRunning) {
      console.log('⚠️ Sync de métricas ya está ejecutándose');
      return;
    }

    this.isRunning = true;
    console.log(`🔄 Iniciando sync automático de métricas cada ${this.syncIntervalMinutes} minutos`);

    // Ejecutar inmediatamente
    await this.syncAllCampaignMetrics();

    // Programar ejecuciones periódicas
    this.intervalId = setInterval(async () => {
      try {
        await this.syncAllCampaignMetrics();
      } catch (error) {
        console.error('❌ Error en sync automático:', error.message);
      }
    }, this.syncIntervalMinutes * 60 * 1000);
  }

  /**
   * Detiene el servicio de sync automático
   */
  stopAutomaticSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('⏹️ Sync automático de métricas detenido');
  }

  /**
   * Sincroniza métricas de todas las campañas activas
   */
  async syncAllCampaignMetrics() {
    try {
      console.log('📊 Iniciando sync de métricas para todas las campañas...');
      
      const campaigns = await this.getActiveCampaigns();
      console.log(`🎯 Encontradas ${campaigns.length} campañas activas para sync`);

      let successCount = 0;
      let errorCount = 0;

      for (const campaign of campaigns) {
        try {
          await this.syncCampaignMetrics(campaign.Id, campaign.UserId);
          successCount++;
        } catch (error) {
          console.error(`❌ Error sync campaña ${campaign.Id}: ${error.message}`);
          errorCount++;
        }
      }

      console.log(`✅ Sync completado: ${successCount} exitosos, ${errorCount} errores`);
      return { success: successCount, errors: errorCount };

    } catch (error) {
      console.error('❌ Error en sync general de métricas:', error.message);
      throw error;
    }
  }

  /**
   * Sincroniza métricas de una campaña específica
   * @param {number} campaignId - ID de la campaña
   * @param {number} userId - ID del usuario propietario
   */
  async syncCampaignMetrics(campaignId, userId) {
    try {
      // Obtener configuración de canales de la campaña
      const campaignChannels = await this.getCampaignChannels(campaignId);
      
      for (const channelConfig of campaignChannels) {
        await this.syncChannelMetrics(campaignId, userId, channelConfig);
      }

    } catch (error) {
      console.error(`❌ Error sync campaña ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sincroniza métricas de un canal específico
   * @param {number} campaignId - ID de la campaña
   * @param {number} userId - ID del usuario
   * @param {Object} channelConfig - Configuración del canal
   */
  async syncChannelMetrics(campaignId, userId, channelConfig) {
    const { channelId, externalCampaignId } = channelConfig;
    
    try {
      console.log(`📊 Sync métricas ${channelId} para campaña ${campaignId}`);

      // Obtener servicio del canal
      const channelService = await ChannelFactory.getChannel(channelId, userId);
      
      if (!channelService.getStatistics) {
        console.log(`⚠️ Canal ${channelId} no soporta sync de métricas`);
        return;
      }

      // Obtener métricas de los últimos 7 días
      const fromDate = this.getDateDaysAgo(7);
      const toDate = this.getDateDaysAgo(0);
      
      const metrics = await channelService.getStatistics(
        externalCampaignId, 
        fromDate, 
        toDate
      );

      if (!metrics.success) {
        throw new Error(`Error obteniendo métricas: ${metrics.error}`);
      }

      // Procesar y guardar métricas
      await this.saveMetricsToDatabase(campaignId, channelId, metrics.data);
      
      console.log(`✅ Métricas sync ${channelId} campaña ${campaignId}: ${metrics.data.spend}€ gastados, ${metrics.data.applications} aplicaciones`);

    } catch (error) {
      // Si es modo simulación, no es error real
      if (error.message.includes('simulación') || error.message.includes('simulation')) {
        console.log(`🔧 Canal ${channelId} en modo simulación - usando datos demo`);
        await this.generateDemoMetrics(campaignId, channelId);
      } else {
        console.error(`❌ Error sync ${channelId} campaña ${campaignId}: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Guarda métricas en la base de datos
   * @param {number} campaignId - ID de la campaña
   * @param {string} channelId - ID del canal
   * @param {Object} metrics - Métricas obtenidas
   */
  async saveMetricsToDatabase(campaignId, channelId, metrics) {
    try {
      await poolConnect;

      // Actualizar métricas en CampaignChannels
      await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .input('ChannelId', sql.NVarChar(50), channelId)
        .input('ActualSpend', sql.Decimal(10, 2), metrics.spend || 0)
        .input('ActualClicks', sql.Int, metrics.clicks || 0)
        .input('ActualImpressions', sql.Int, metrics.impressions || 0)
        .input('ActualApplications', sql.Int, metrics.applications || 0)
        .input('LastSyncAt', sql.DateTime2, new Date())
        .query(`
          UPDATE CampaignChannels 
          SET 
            ActualSpend = @ActualSpend,
            ActualClicks = @ActualClicks,
            ActualImpressions = @ActualImpressions,
            ActualApplications = @ActualApplications,
            LastSyncAt = @LastSyncAt,
            UpdatedAt = GETDATE()
          WHERE CampaignId = @CampaignId AND ChannelId = @ChannelId
        `);

      // Calcular totales para la campaña
      await this.updateCampaignTotals(campaignId);

    } catch (error) {
      console.error('❌ Error guardando métricas en BD:', error.message);
      throw error;
    }
  }

  /**
   * Actualiza totales calculados de la campaña
   * @param {number} campaignId - ID de la campaña
   */
  async updateCampaignTotals(campaignId) {
    try {
      await poolConnect;

      await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          UPDATE Campaigns 
          SET 
            ActualSpend = ISNULL((
              SELECT SUM(ActualSpend) 
              FROM CampaignChannels 
              WHERE CampaignId = @CampaignId
            ), 0),
            ActualApplications = ISNULL((
              SELECT SUM(ActualApplications) 
              FROM CampaignChannels 
              WHERE CampaignId = @CampaignId
            ), 0),
            LastMetricsSync = GETDATE(),
            UpdatedAt = GETDATE()
          WHERE Id = @CampaignId
        `);

    } catch (error) {
      console.error('❌ Error actualizando totales de campaña:', error.message);
      throw error;
    }
  }

  /**
   * Genera métricas demo para desarrollo/testing
   * @param {number} campaignId - ID de la campaña
   * @param {string} channelId - ID del canal
   */
  async generateDemoMetrics(campaignId, channelId) {
    // Simular datos realistas basados en el tiempo transcurrido
    const hoursRunning = Math.min(24, Math.random() * 24); // Máx 24 horas
    const baseSpend = Math.random() * 50; // €0-50
    const baseApplications = Math.floor(Math.random() * 10); // 0-10 apps
    
    const demoMetrics = {
      spend: parseFloat(baseSpend.toFixed(2)),
      clicks: Math.floor(baseSpend * 10), // Aprox 10 clicks por euro
      impressions: Math.floor(baseSpend * 100), // Aprox 100 impressions por euro
      applications: baseApplications
    };

    await this.saveMetricsToDatabase(campaignId, channelId, demoMetrics);
    console.log(`🎮 Métricas demo ${channelId}: ${demoMetrics.spend}€, ${demoMetrics.applications} apps`);
  }

  /**
   * Obtiene campañas activas que necesitan sync
   */
  async getActiveCampaigns() {
    try {
      await poolConnect;

      const result = await pool.request().query(`
        SELECT DISTINCT 
          c.Id,
          c.UserId,
          c.Name,
          c.Status
        FROM Campaigns c
        INNER JOIN CampaignChannels cc ON c.Id = cc.CampaignId
        WHERE c.Status IN ('active', 'running')
        AND cc.ChannelId IN ('jooble', 'talent', 'jobrapido', 'whatjobs')
        ORDER BY c.CreatedAt DESC
      `);

      return result.recordset;

    } catch (error) {
      console.error('❌ Error obteniendo campañas activas:', error.message);
      return [];
    }
  }

  /**
   * Obtiene configuración de canales de una campaña
   * @param {number} campaignId - ID de la campaña
   */
  async getCampaignChannels(campaignId) {
    try {
      await poolConnect;

      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT 
            ChannelId,
            ExternalCampaignId,
            BudgetAllocation,
            EstimatedCPC,
            EstimatedApplications
          FROM CampaignChannels
          WHERE CampaignId = @CampaignId
          AND IsActive = 1
        `);

      return result.recordset;

    } catch (error) {
      console.error('❌ Error obteniendo canales de campaña:', error.message);
      return [];
    }
  }

  /**
   * Obtiene fecha de hace X días en formato YYYY-MM-DD
   * @param {number} daysAgo - Días hacia atrás
   * @returns {string} Fecha formateada
   */
  getDateDaysAgo(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  /**
   * Obtiene métricas actuales de una campaña desde la BD
   * @param {number} campaignId - ID de la campaña
   * @returns {Promise<Object>} Métricas actuales
   */
  async getCurrentMetrics(campaignId) {
    try {
      await poolConnect;

      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT 
            c.ActualSpend,
            c.ActualApplications,
            c.Budget,
            c.TargetApplications,
            c.LastMetricsSync,
            COUNT(cc.Id) as ChannelCount,
            SUM(cc.ActualSpend) as TotalChannelSpend,
            SUM(cc.ActualApplications) as TotalChannelApplications
          FROM Campaigns c
          LEFT JOIN CampaignChannels cc ON c.Id = cc.CampaignId
          WHERE c.Id = @CampaignId
          GROUP BY c.Id, c.ActualSpend, c.ActualApplications, c.Budget, c.TargetApplications, c.LastMetricsSync
        `);

      return result.recordset[0] || null;

    } catch (error) {
      console.error('❌ Error obteniendo métricas actuales:', error.message);
      return null;
    }
  }

  /**
   * Fuerza sync inmediato de una campaña específica
   * @param {number} campaignId - ID de la campaña
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Resultado del sync
   */
  async forceSyncCampaign(campaignId, userId) {
    try {
      console.log(`🔄 Forzando sync inmediato campaña ${campaignId}`);
      
      await this.syncCampaignMetrics(campaignId, userId);
      const metrics = await this.getCurrentMetrics(campaignId);
      
      console.log(`✅ Sync forzado completado campaña ${campaignId}`);
      return {
        success: true,
        campaignId,
        metrics,
        syncedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Error sync forzado campaña ${campaignId}: ${error.message}`);
      return {
        success: false,
        campaignId,
        error: error.message
      };
    }
  }
}

module.exports = MetricsSync;