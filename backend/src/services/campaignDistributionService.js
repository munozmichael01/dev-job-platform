const { pool, poolConnect, sql } = require('../db/db');
const ChannelFactory = require('./channels/channelFactory');

/**
 * Servicio para manejar la distribución inteligente de presupuesto por ofertas y canales
 * Implementa la lógica según especificación: distribución automática equitativa con tracking granular
 */
class CampaignDistributionService {
  
  /**
   * Instancia del factory de canales
   */
  static channelFactory = new ChannelFactory();

  /**
   * Definición de canales disponibles (Fase 1: Jooble y Talent)
   */
  static CHANNELS = {
    JOOBLE: {
      id: 'jooble',
      name: 'Jooble',
      type: 'aggregator',
      cpaRange: { min: 8, max: 25 },
      defaultCPA: 15,
      supportedFormats: ['xml', 'json']
    },
    TALENT: {
      id: 'talent',
      name: 'Talent.com',
      type: 'aggregator', 
      cpaRange: { min: 10, max: 30 },
      defaultCPA: 18,
      supportedFormats: ['xml', 'json']
    },
    WHATJOBS: {
      id: 'whatjobs',
      name: 'WhatJobs',
      type: 'aggregator',
      cpaRange: { min: 8, max: 20 },
      defaultCPA: 14,
      supportedFormats: ['xml', 's2s']
    },
    // Fase 2: InfoJobs, LinkedIn, Indeed (mantener compatibilidad)
    INFOJOBS: {
      id: 'infojobs',
      name: 'InfoJobs',
      type: 'portal',
      cpaRange: { min: 12, max: 35 },
      defaultCPA: 20,
      supportedFormats: ['api']
    },
    LINKEDIN: {
      id: 'linkedin',
      name: 'LinkedIn',
      type: 'social',
      cpaRange: { min: 15, max: 50 },
      defaultCPA: 25,
      supportedFormats: ['api']
    },
    INDEED: {
      id: 'indeed',
      name: 'Indeed',
      type: 'aggregator',
      cpaRange: { min: 10, max: 40 },
      defaultCPA: 22,
      supportedFormats: ['xml', 'api']
    },
    
    JOBRAPIDO: {
      id: 'jobrapido',
      name: 'JobRapido',
      type: 'feed_organic',
      cpaRange: { min: 8, max: 18 },
      defaultCPA: 12,
      supportedFormats: ['xml', 'json'],
      features: ['screening_questions', 'cv_base64', 'detailed_profiles']
    }
  };

  /**
   * Calcula la distribución automática de presupuesto por ofertas según especificación
   * @param {Object} campaignData - Datos de la campaña
   * @param {Array} offers - Array de ofertas del segmento
   * @returns {Object} Distribución calculada
   */
  static async calculateOfferDistribution(campaignData, offers) {
    console.log(`🎯 Calculando distribución automática para ${offers.length} ofertas`);
    
    const { budget, targetApplications, maxCPA, distributionType } = campaignData;
    
    if (distributionType === 'manual') {
      // Para manual, devolver estructura básica sin cálculos automáticos
      return {
        mode: 'manual',
        totalOffers: offers.length,
        totalBudget: budget,
        totalTarget: targetApplications,
        offers: offers.map(offer => ({
          offerId: offer.id || offer.Id,
          title: offer.title || offer.Title,
          defaultBudget: 0, // Manual = usuario define
          defaultTarget: 0,
          defaultCPA: maxCPA || 20
        }))
      };
    }

    // DISTRIBUCIÓN AUTOMÁTICA EQUITATIVA (según tu spec)
    const totalOffers = offers.length;
    const budgetPerOffer = Math.floor(budget / totalOffers);
    const targetPerOffer = Math.floor(targetApplications / totalOffers);
    const estimatedCPA = budget / targetApplications;

    // Validaciones de presupuesto mínimo
    const MIN_BUDGET_PER_OFFER = 50; // €50 mínimo por oferta
    const MIN_TARGET_PER_OFFER = 5;  // 5 aplicaciones mínimo por oferta

    if (budgetPerOffer < MIN_BUDGET_PER_OFFER) {
      console.warn(`⚠️ Presupuesto por oferta (€${budgetPerOffer}) menor al mínimo (€${MIN_BUDGET_PER_OFFER})`);
    }

    if (targetPerOffer < MIN_TARGET_PER_OFFER) {
      console.warn(`⚠️ Target por oferta (${targetPerOffer}) menor al mínimo (${MIN_TARGET_PER_OFFER})`);
    }

    const distribution = {
      mode: 'automatic',
      totalOffers: totalOffers,
      totalBudget: budget,
      totalTarget: targetApplications,
      budgetPerOffer: budgetPerOffer,
      targetPerOffer: targetPerOffer,
      estimatedCPA: estimatedCPA,
      offers: offers.map(offer => ({
        offerId: offer.id || offer.Id,
        title: offer.title || offer.Title,
        company: offer.company || offer.CompanyName,
        location: offer.location || offer.City,
        defaultBudget: budgetPerOffer,
        defaultTarget: targetPerOffer,
        defaultCPA: estimatedCPA
      }))
    };

    console.log(`✅ Distribución calculada: €${budgetPerOffer}/oferta, ${targetPerOffer} aplicaciones/oferta`);
    return distribution;
  }

  /**
   * Calcula la distribución automática por canales usando algoritmo inteligente
   * @param {Object} campaignData - Datos de la campaña
   * @param {Object} offerDistribution - Distribución por ofertas
   * @param {Array} selectedChannels - Canales seleccionados para la campaña
   * @returns {Object} Distribución por canales
   */
  static async calculateChannelDistribution(campaignData, offerDistribution, selectedChannels) {
    console.log(`🔄 Calculando distribución por canales para ${selectedChannels.length} canales`);
    
    if (!selectedChannels || selectedChannels.length === 0) {
      throw new Error('No hay canales seleccionados para la campaña');
    }

    // Obtener performance histórica de canales
    const channelPerformance = await this.getChannelPerformanceHistory(selectedChannels);
    
    const channelDistribution = [];
    const totalChannels = selectedChannels.length;
    
    for (const offer of offerDistribution.offers) {
      const offerBudget = offer.defaultBudget;
      const offerTarget = offer.defaultTarget;
      
      // Distribución equitativa por canal (Fase 1 - puede mejorarse en Fase 4 con algoritmo inteligente)
      const budgetPerChannel = Math.floor(offerBudget / totalChannels);
      const targetPerChannel = Math.floor(offerTarget / totalChannels);
      
      for (const channelData of selectedChannels) {
        // Handle both string and object formats
        const channelId = typeof channelData === 'string' ? channelData : (channelData.id || channelData.channelId);
        if (!channelId) {
          console.warn(`⚠️ Canal sin ID válido:`, channelData);
          continue;
        }
        const channelInfo = this.CHANNELS[channelId.toUpperCase()];
        
        if (!channelInfo) {
          console.warn(`⚠️ Canal desconocido: ${channelId}`);
          continue;
        }

        // Calcular CPA inicial basado en performance histórica o default
        const historicalCPA = channelPerformance[channelId]?.currentCPA;
        const estimatedCPA = historicalCPA || channelInfo.defaultCPA;
        
        // Calcular bid inicial (90% del CPA máximo para optimización)
        const maxCPA = campaignData.maxCPA || estimatedCPA;
        const initialBid = Math.min(estimatedCPA * 0.9, maxCPA * 0.9);

        channelDistribution.push({
          campaignId: null, // Se asignará al crear la campaña
          offerId: offer.offerId,
          channelId: channelId,
          channelName: channelInfo.name,
          allocatedBudget: budgetPerChannel,
          allocatedTarget: targetPerChannel,
          currentCPA: estimatedCPA,
          bidAmount: initialBid,
          qualityScore: channelPerformance[channelId]?.qualityScore || 0,
          conversionRate: channelPerformance[channelId]?.conversionRate || 0,
          status: 'active',
          autoOptimization: campaignData.autoOptimization !== false
        });
      }
    }

    console.log(`✅ Distribución por canales calculada: ${channelDistribution.length} registros`);
    return channelDistribution;
  }

  /**
   * Obtiene el historial de performance por canal para optimización inteligente
   * @param {Array} channels - Canales a consultar
   * @returns {Object} Performance histórica por canal
   */
  static async getChannelPerformanceHistory(channels) {
    try {
      await poolConnect;
      
      const channelIds = channels.map(ch => ch.id || ch.channelId);
      const placeholders = channelIds.map((_, index) => `@channel${index}`).join(',');
      
      const request = pool.request();
      channelIds.forEach((channelId, index) => {
        request.input(`channel${index}`, sql.NVarChar(50), channelId);
      });

      const result = await request.query(`
        SELECT 
          ChannelId,
          AVG(CurrentCPA) as avgCPA,
          AVG(QualityScore) as avgQualityScore,
          AVG(ConversionRate) as avgConversionRate,
          COUNT(*) as totalCampaigns,
          SUM(AchievedApplications) as totalApplications,
          SUM(SpentBudget) as totalSpent
        FROM CampaignChannels 
        WHERE ChannelId IN (${placeholders})
          AND CreatedAt >= DATEADD(DAY, -30, GETDATE()) -- Últimos 30 días
        GROUP BY ChannelId
      `);

      const performance = {};
      for (const row of result.recordset) {
        performance[row.ChannelId] = {
          currentCPA: row.avgCPA,
          qualityScore: row.avgQualityScore,
          conversionRate: row.avgConversionRate,
          totalCampaigns: row.totalCampaigns,
          totalApplications: row.totalApplications,
          totalSpent: row.totalSpent
        };
      }

      console.log(`📊 Performance histórica obtenida para ${Object.keys(performance).length} canales`);
      return performance;
      
    } catch (error) {
      console.warn(`⚠️ Error obteniendo performance histórica: ${error.message}`);
      return {}; // Devolver objeto vacío para usar defaults
    }
  }

  /**
   * Crea los registros de CampaignChannels basado en la distribución calculada
   * @param {number} campaignId - ID de la campaña creada
   * @param {Array} channelDistribution - Distribución por canales
   * @returns {Array} Registros creados
   */
  static async createCampaignChannels(campaignId, channelDistribution) {
    console.log(`💾 Creando ${channelDistribution.length} registros CampaignChannels para campaña ${campaignId}`);
    
    try {
      await poolConnect;
      const createdRecords = [];
      
      for (const distribution of channelDistribution) {
        const result = await pool.request()
          .input('CampaignId', sql.Int, campaignId)
          .input('OfferId', sql.Int, distribution.offerId)
          .input('ChannelId', sql.NVarChar(50), distribution.channelId)
          .input('AllocatedBudget', sql.Decimal(10,2), distribution.allocatedBudget)
          .input('AllocatedTarget', sql.Int, distribution.allocatedTarget)
          .input('CurrentCPA', sql.Decimal(8,2), distribution.currentCPA)
          .input('BidAmount', sql.Decimal(8,2), distribution.bidAmount)
          .input('QualityScore', sql.Int, distribution.qualityScore)
          .input('ConversionRate', sql.Decimal(5,2), distribution.conversionRate)
          .input('Status', sql.NVarChar(20), distribution.status)
          .input('AutoOptimization', sql.Bit, distribution.autoOptimization)
          .query(`
            INSERT INTO CampaignChannels 
            (CampaignId, OfferId, ChannelId, AllocatedBudget, AllocatedTarget, CurrentCPA, BidAmount, QualityScore, ConversionRate, Status, AutoOptimization)
            OUTPUT INSERTED.*
            VALUES 
            (@CampaignId, @OfferId, @ChannelId, @AllocatedBudget, @AllocatedTarget, @CurrentCPA, @BidAmount, @QualityScore, @ConversionRate, @Status, @AutoOptimization)
          `);
        
        createdRecords.push(result.recordset[0]);
      }
      
      console.log(`✅ ${createdRecords.length} registros CampaignChannels creados exitosamente`);
      return createdRecords;
      
    } catch (error) {
      console.error(`❌ Error creando CampaignChannels: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene las ofertas de uno o múltiples segmentos para la campaña
   * @param {number|Array<number>} segmentIds - ID del segmento o array de IDs
   * @returns {Array} Ofertas de los segmentos
   */
  static async getOffersFromSegment(segmentIds) {
    // Normalizar entrada: siempre trabajar con array
    const segments = Array.isArray(segmentIds) ? segmentIds : [segmentIds];
    try {
      await poolConnect;
      
      if (segments.length === 0) {
        throw new Error('Se requiere al menos un segmento');
      }
      
      // Obtener filtros de todos los segmentos
      const segmentPlaceholders = segments.map((_, index) => `@SegmentId${index}`).join(',');
      const segmentRequest = pool.request();
      segments.forEach((segmentId, index) => {
        segmentRequest.input(`SegmentId${index}`, sql.Int, segmentId);
      });
      
      const segmentResult = await segmentRequest.query(`
        SELECT Id, Filters FROM Segments WHERE Id IN (${segmentPlaceholders})
      `);
      
      if (segmentResult.recordset.length === 0) {
        throw new Error(`Segmentos ${segments.join(', ')} no encontrados`);
      }
      
      console.log(`🔍 Obteniendo ofertas para ${segments.length} segmentos: ${segments.join(', ')}`);
      
      // Combinar todos los filtros de todos los segmentos
      const allJobTitles = [];
      const allLocations = [];
      const allSectors = [];
      const allCompanies = [];
      
      segmentResult.recordset.forEach(segment => {
        const filters = JSON.parse(segment.Filters || '{}');
        if (filters.jobTitles && filters.jobTitles.length > 0) {
          allJobTitles.push(...filters.jobTitles);
        }
        if (filters.locations && filters.locations.length > 0) {
          allLocations.push(...filters.locations);
        }
        if (filters.sectors && filters.sectors.length > 0) {
          allSectors.push(...filters.sectors);
        }
        if (filters.companies && filters.companies.length > 0) {
          allCompanies.push(...filters.companies);
        }
      });
      
      // Eliminar duplicados
      const uniqueJobTitles = [...new Set(allJobTitles)];
      const uniqueLocations = [...new Set(allLocations)];
      const uniqueSectors = [...new Set(allSectors)];
      const uniqueCompanies = [...new Set(allCompanies)];
      
      // Construir query dinámico basado en filtros combinados
      let whereConditions = ['jo.StatusId = 1']; // Solo ofertas activas
      const request = pool.request();
      
      if (uniqueJobTitles.length > 0) {
        const titleConditions = uniqueJobTitles.map((title, index) => {
          request.input(`title${index}`, sql.NVarChar(255), `%${title.toLowerCase()}%`);
          return `(LOWER(jo.Title) LIKE @title${index} OR LOWER(jo.JobTitle) LIKE @title${index})`;
        }).join(' OR ');
        whereConditions.push(`(${titleConditions})`);
      }
      
      if (uniqueLocations.length > 0) {
        const locationConditions = uniqueLocations.map((location, index) => {
          // Extraer solo la ciudad de strings como "Valencia, Valencia, Valencia"
          const cityName = location.split(',')[0].trim().toLowerCase();
          request.input(`location${index}`, sql.NVarChar(255), `%${cityName}%`);
          return `(LOWER(jo.City) LIKE @location${index} OR LOWER(jo.Region) LIKE @location${index} OR LOWER(jo.Address) LIKE @location${index})`;
        }).join(' OR ');
        whereConditions.push(`(${locationConditions})`);
      }
      
      if (uniqueSectors.length > 0) {
        const sectorConditions = uniqueSectors.map((sector, index) => {
          request.input(`sector${index}`, sql.NVarChar(255), `%${sector.toLowerCase()}%`);
          return `LOWER(jo.Sector) LIKE @sector${index}`;
        }).join(' OR ');
        whereConditions.push(`(${sectorConditions})`);
      }
      
      if (uniqueCompanies.length > 0) {
        const companyConditions = uniqueCompanies.map((company, index) => {
          request.input(`company${index}`, sql.NVarChar(255), `%${company.toLowerCase()}%`);
          return `LOWER(jo.CompanyName) LIKE @company${index}`;
        }).join(' OR ');
        whereConditions.push(`(${companyConditions})`);
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      const result = await request.query(`
        SELECT TOP 1000
          jo.Id,
          jo.Title,
          jo.CompanyName,
          jo.City,
          jo.Region,
          jo.Sector,
          jo.SalaryMin,
          jo.SalaryMax,
          jo.Budget,
          jo.ApplicationsGoal
        FROM JobOffers jo
        WHERE ${whereClause}
        ORDER BY jo.CreatedAt DESC
      `);
      
      console.log(`✅ ${result.recordset.length} ofertas encontradas para segmentos ${segments.join(', ')}`);
      return result.recordset;
      
    } catch (error) {
      console.error(`❌ Error obteniendo ofertas del segmento: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene el detalle completo de distribución de una campaña existente
   * @param {number} campaignId - ID de la campaña
   * @returns {Object} Detalle de distribución
   */
  static async getCampaignDistributionDetail(campaignId) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT 
            cc.*,
            jo.Title as OfferTitle,
            jo.CompanyName as OfferCompany,
            jo.City as OfferLocation
          FROM CampaignChannels cc
          JOIN JobOffers jo ON cc.OfferId = jo.Id
          WHERE cc.CampaignId = @CampaignId
          ORDER BY jo.Title, cc.ChannelId
        `);
      
      // Agrupar por ofertas
      const offerGroups = {};
      for (const row of result.recordset) {
        const offerId = row.OfferId;
        if (!offerGroups[offerId]) {
          offerGroups[offerId] = {
            offerId: offerId,
            title: row.OfferTitle,
            company: row.OfferCompany,
            location: row.OfferLocation,
            channels: []
          };
        }
        
        offerGroups[offerId].channels.push({
          channelId: row.ChannelId,
          allocatedBudget: row.AllocatedBudget,
          spentBudget: row.SpentBudget,
          allocatedTarget: row.AllocatedTarget,
          achievedApplications: row.AchievedApplications,
          currentCPA: row.CurrentCPA,
          bidAmount: row.BidAmount,
          qualityScore: row.QualityScore,
          conversionRate: row.ConversionRate,
          status: row.Status
        });
      }
      
      return {
        campaignId: campaignId,
        offers: Object.values(offerGroups),
        totalRecords: result.recordset.length
      };
      
    } catch (error) {
      console.error(`❌ Error obteniendo detalle de campaña: ${error.message}`);
      throw error;
    }
  }

  /**
   * Publica una campaña en canales externos utilizando ChannelFactory
   * @param {number} campaignId - ID de la campaña
   * @param {Array} selectedChannels - Canales seleccionados
   * @returns {Object} Resultados de publicación por canal
   */
  static async publishCampaignToExternalChannels(campaignId, selectedChannels) {
    console.log(`🚀 Publicando campaña ${campaignId} en canales externos: ${selectedChannels.map(c => c.id).join(', ')}`);
    
    try {
      // Obtener datos de la campaña
      const campaignData = await this.getCampaignData(campaignId);
      
      // Obtener ofertas de la campaña
      const offers = await this.getCampaignOffers(campaignId);
      
      if (offers.length === 0) {
        throw new Error(`No se encontraron ofertas para la campaña ${campaignId}`);
      }
      
      // Publicar en múltiples canales usando ChannelFactory
      const channelIds = selectedChannels.map(c => c.id || c.channelId);
      const results = await this.channelFactory.publishToMultipleChannels(
        channelIds,
        offers,
        campaignData
      );
      
      // Guardar IDs de campañas externas en CampaignChannels
      await this.saveExternalCampaignIds(campaignId, results.results);
      
      console.log(`✅ Campaña ${campaignId} publicada: ${results.successful}/${results.totalChannels} canales exitosos`);
      
      return {
        success: results.successful > 0,
        campaignId: campaignId,
        totalChannels: results.totalChannels,
        successfulChannels: results.successful,
        failedChannels: results.failed,
        results: results.results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error publicando campaña ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualiza estadísticas de performance desde canales externos
   * @param {number} campaignId - ID de la campaña
   * @returns {Object} Estadísticas actualizadas
   */
  static async updateCampaignPerformanceFromChannels(campaignId) {
    console.log(`📊 Actualizando performance de campaña ${campaignId} desde canales externos`);
    
    try {
      await poolConnect;
      
      // Obtener canales activos de la campaña
      const channelsResult = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT DISTINCT ChannelId, OfferId 
          FROM CampaignChannels 
          WHERE CampaignId = @CampaignId AND Status = 'active'
        `);
      
      if (channelsResult.recordset.length === 0) {
        return { success: false, message: 'No hay canales activos para la campaña' };
      }
      
      // Agrupar por canal
      const channelOffers = {};
      channelsResult.recordset.forEach(row => {
        if (!channelOffers[row.ChannelId]) {
          channelOffers[row.ChannelId] = [];
        }
        channelOffers[row.ChannelId].push(row.OfferId);
      });
      
      // Actualizar estadísticas por canal
      const channelIds = Object.keys(channelOffers);
      const results = await this.channelFactory.updatePerformanceStats(channelIds, Object.values(channelOffers).flat());
      
      // Procesar resultados y actualizar base de datos
      for (const result of results.results) {
        if (result.success && result.stats) {
          await this.updateChannelStatsInDatabase(campaignId, result.channelId, result.stats);
        }
      }
      
      console.log(`✅ Performance actualizada para campaña ${campaignId}`);
      
      return {
        success: true,
        campaignId: campaignId,
        channelsUpdated: results.results.filter(r => r.success).length,
        totalChannels: channelIds.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error actualizando performance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Controla el estado de campañas en canales externos
   * @param {number} campaignId - ID de la campaña
   * @param {string} action - Acción: 'pause', 'resume', 'delete'
   * @returns {Object} Resultados por canal
   */
  static async controlCampaignInExternalChannels(campaignId, action) {
    console.log(`🔄 ${action} campaña ${campaignId} en canales externos`);
    
    try {
      await poolConnect;
      
      // Obtener campañas externas asociadas
      const externalCampaigns = await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .query(`
          SELECT DISTINCT ChannelId, ExternalCampaignId 
          FROM CampaignChannels 
          WHERE CampaignId = @CampaignId 
            AND ExternalCampaignId IS NOT NULL
            AND Status != 'archived'
        `);
      
      if (externalCampaigns.recordset.length === 0) {
        return { success: false, message: 'No hay campañas externas asociadas' };
      }
      
      // Preparar array para ChannelFactory
      const channelCampaigns = externalCampaigns.recordset.map(row => ({
        channelId: row.ChannelId,
        campaignId: row.ExternalCampaignId
      }));
      
      // Ejecutar acción en múltiples canales
      const results = await this.channelFactory.controlMultipleChannelCampaigns(channelCampaigns, action);
      
      // Actualizar estado en nuestra base de datos
      const newStatus = action === 'pause' ? 'paused' : 
                       action === 'resume' ? 'active' : 'archived';
      
      await pool.request()
        .input('CampaignId', sql.Int, campaignId)
        .input('Status', sql.NVarChar(20), newStatus)
        .query(`
          UPDATE CampaignChannels 
          SET Status = @Status, UpdatedAt = GETDATE()
          WHERE CampaignId = @CampaignId
        `);
      
      console.log(`✅ Acción ${action} completada para campaña ${campaignId}`);
      
      return {
        success: results.results.filter(r => r.success).length > 0,
        action: action,
        campaignId: campaignId,
        results: results.results,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error controlando campaña ${campaignId}: ${error.message}`);
      throw error;
    }
  }

  // Métodos auxiliares para sincronización

  /**
   * Obtiene datos completos de una campaña
   */
  static async getCampaignData(campaignId) {
    await poolConnect;
    
    const result = await pool.request()
      .input('CampaignId', sql.Int, campaignId)
      .query('SELECT * FROM Campaigns WHERE Id = @CampaignId');
    
    if (result.recordset.length === 0) {
      throw new Error(`Campaña ${campaignId} no encontrada`);
    }
    
    const campaign = result.recordset[0];
    return {
      id: campaign.Id,
      name: campaign.Name,
      description: campaign.Description,
      budget: campaign.Budget,
      targetApplications: campaign.TargetApplications,
      maxCPA: campaign.MaxCPA,
      distributionType: campaign.DistributionType,
      startDate: campaign.StartDate,
      endDate: campaign.EndDate,
      autoOptimization: campaign.AutoOptimization,
      channels: JSON.parse(campaign.Channels || '[]')
    };
  }

  /**
   * Obtiene ofertas de una campaña específica
   */
  static async getCampaignOffers(campaignId) {
    await poolConnect;
    
    const result = await pool.request()
      .input('CampaignId', sql.Int, campaignId)
      .query(`
        SELECT DISTINCT jo.*
        FROM JobOffers jo
        JOIN CampaignChannels cc ON jo.Id = cc.OfferId
        WHERE cc.CampaignId = @CampaignId
      `);
    
    return result.recordset;
  }

  /**
   * Guarda IDs de campañas externas en la base de datos
   */
  static async saveExternalCampaignIds(campaignId, publishResults) {
    try {
      await poolConnect;
      
      for (const result of publishResults) {
        if (result.success && result.result && result.result.campaignId) {
          await pool.request()
            .input('CampaignId', sql.Int, campaignId)
            .input('ChannelId', sql.NVarChar(50), result.channelId)
            .input('ExternalCampaignId', sql.NVarChar(255), result.result.campaignId)
            .query(`
              UPDATE CampaignChannels 
              SET ExternalCampaignId = @ExternalCampaignId, UpdatedAt = GETDATE()
              WHERE CampaignId = @CampaignId AND ChannelId = @ChannelId
            `);
        }
      }
      
      console.log(`💾 IDs de campañas externas guardados para campaña ${campaignId}`);
      
    } catch (error) {
      console.error(`❌ Error guardando IDs externos: ${error.message}`);
    }
  }

  /**
   * Actualiza estadísticas de canal en base de datos
   */
  static async updateChannelStatsInDatabase(campaignId, channelId, stats) {
    try {
      await poolConnect;
      
      // Estadísticas pueden venir en diferentes formatos según el canal
      const statsData = stats.stats || stats.data || stats;
      
      if (Array.isArray(statsData)) {
        // Estadísticas por oferta individual
        for (const offerStats of statsData) {
          await pool.request()
            .input('CampaignId', sql.Int, campaignId)
            .input('ChannelId', sql.NVarChar(50), channelId)
            .input('OfferId', sql.Int, offerStats.offerId)
            .input('SpentBudget', sql.Decimal(10,2), offerStats.spend || 0)
            .input('AchievedApplications', sql.Int, offerStats.applications || 0)
            .input('CurrentCPA', sql.Decimal(8,2), offerStats.cpa || 0)
            .query(`
              UPDATE CampaignChannels 
              SET 
                SpentBudget = @SpentBudget,
                AchievedApplications = @AchievedApplications,
                CurrentCPA = @CurrentCPA,
                UpdatedAt = GETDATE()
              WHERE CampaignId = @CampaignId 
                AND ChannelId = @ChannelId 
                AND OfferId = @OfferId
            `);
        }
      } else {
        // Estadísticas agregadas para todo el canal
        await pool.request()
          .input('CampaignId', sql.Int, campaignId)
          .input('ChannelId', sql.NVarChar(50), channelId)
          .input('SpentBudget', sql.Decimal(10,2), statsData.spend || 0)
          .input('AchievedApplications', sql.Int, statsData.applications || 0)
          .input('CurrentCPA', sql.Decimal(8,2), statsData.cpa || 0)
          .query(`
            UPDATE CampaignChannels 
            SET 
              SpentBudget = @SpentBudget,
              AchievedApplications = @AchievedApplications,
              CurrentCPA = @CurrentCPA,
              UpdatedAt = GETDATE()
            WHERE CampaignId = @CampaignId AND ChannelId = @ChannelId
          `);
      }
      
    } catch (error) {
      console.error(`❌ Error actualizando estadísticas en BD: ${error.message}`);
    }
  }
}

module.exports = CampaignDistributionService;
