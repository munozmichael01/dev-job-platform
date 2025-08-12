const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db/db');
const CampaignDistributionService = require('../services/campaignDistributionService');

const parseJSON = (val) => {
  if (!val) return [];
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return []; }
};

router.get('/', async (_req, res) => {
  try {
    await poolConnect;
    const r = await pool.request().query(`
      SELECT 
        c.*,
        s.Name as SegmentName,
        s.OfferCount as SegmentOffers
      FROM Campaigns c
      LEFT JOIN Segments s ON c.SegmentId = s.Id 
      ORDER BY c.CreatedAt DESC
    `);
    
    // Para cada campaña, obtener todos sus segmentos
    const campaigns = [];
    for (const campaign of r.recordset) {
      // Obtener segmentos asociados
      const segmentsResult = await pool.request()
        .input('CampaignId', sql.Int, campaign.Id)
        .query(`
          SELECT cs.*, s.Name as SegmentName, s.OfferCount 
          FROM CampaignSegments cs
          INNER JOIN Segments s ON cs.SegmentId = s.Id
          WHERE cs.CampaignId = @CampaignId
          ORDER BY cs.CreatedAt
        `);
      
      const segments = segmentsResult.recordset;
      const totalOffers = segments.reduce((sum, seg) => sum + (seg.OfferCount || 0), 0);
      const segmentNames = segments.map(seg => seg.SegmentName).join(', ');
      
      campaigns.push({
        ...campaign,
        Channels: parseJSON(campaign.Channels),
        segments: segments, // Array completo de segmentos
        segment: segmentNames || campaign.SegmentName || `Segmento #${campaign.SegmentId}`, // Para compatibilidad
        offers: totalOffers || campaign.SegmentOffers || 0,
        segmentCount: segments.length
      });
    }
    
    res.json(campaigns);
  } catch (e) {
    res.status(500).json({ error: 'Error listando campañas', details: e.message });
  }
});

router.post('/', async (req, res) => {
  const {
    name, description = '', segmentId, segmentIds, // Soporte para ambos formatos
    distributionType = 'automatic',
    startDate = null, endDate = null,
    budget = null, targetApplications = null, maxCPA = null,
    channels = [], bidStrategy = 'automatic', manualBid = null,
    priority = 'medium', autoOptimization = true
  } = req.body || {};
  
  // Soporte para segmentId (legacy) o segmentIds (nuevo)
  const segments = segmentIds && Array.isArray(segmentIds) && segmentIds.length > 0 
    ? segmentIds 
    : (segmentId ? [segmentId] : []);
  
  if (!name || segments.length === 0) {
    return res.status(400).json({ 
      error: 'name y al menos un segmento son requeridos',
      received: { name: !!name, segmentsCount: segments.length }
    });
  }
  
  if (!budget || !targetApplications) {
    return res.status(400).json({ 
      error: 'budget y targetApplications son requeridos',
      received: { budget, targetApplications }
    });
  }

  if (distributionType === 'manual' && (!channels || channels.length === 0)) {
    return res.status(400).json({ 
      error: 'Para distribución manual, se requiere al menos un canal',
      received: { distributionType, channelsCount: channels.length }
    });
  }

  console.log(`🎯 Creando campaña con distribución ${distributionType} para ${channels.length} canales y ${segments.length} segmentos`);

  try {
    await poolConnect;
    
    // 1. Crear campaña base
    const now = new Date();
    const ins = await pool.request()
      .input('Name', sql.NVarChar(255), name)
      .input('Description', sql.NVarChar(sql.MAX), description)
      .input('SegmentId', sql.Int, segments[0]) // Usar primer segmento para compatibilidad
      .input('DistributionType', sql.NVarChar(50), distributionType)
      .input('StartDate', sql.DateTime, startDate ? new Date(startDate) : null)
      .input('EndDate', sql.DateTime, endDate ? new Date(endDate) : null)
      .input('Budget', sql.Decimal(12,2), budget)
      .input('TargetApplications', sql.Int, targetApplications)
      .input('MaxCPA', sql.Decimal(12,2), maxCPA)
      .input('Channels', sql.NVarChar(sql.MAX), JSON.stringify(parseJSON(channels)))
      .input('BidStrategy', sql.NVarChar(50), bidStrategy)
      .input('ManualBid', sql.Decimal(12,2), manualBid)
      .input('Priority', sql.NVarChar(20), priority)
      .input('AutoOptimization', sql.Bit, !!autoOptimization)
      .input('Status', sql.NVarChar(50), 'active')
      .input('CreatedAt', sql.DateTime, now)
      .input('UpdatedAt', sql.DateTime, now)
      .query(`
        INSERT INTO Campaigns
        (Name, Description, SegmentId, DistributionType, StartDate, EndDate, Budget, TargetApplications, MaxCPA, Channels, BidStrategy, ManualBid, Priority, AutoOptimization, Status, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES
        (@Name, @Description, @SegmentId, @DistributionType, @StartDate, @EndDate, @Budget, @TargetApplications, @MaxCPA, @Channels, @BidStrategy, @ManualBid, @Priority, @AutoOptimization, @Status, @CreatedAt, @UpdatedAt)
      `);
    
    const campaign = ins.recordset[0];
    console.log(`✅ Campaña creada con ID: ${campaign.Id}`);

    // 2. Insertar relaciones CampaignSegments para todos los segmentos
    const budgetPerSegment = segments.length > 1 ? (100 / segments.length) : 100; // Distribución equitativa
    
    for (let i = 0; i < segments.length; i++) {
      const segmentId = segments[i];
      await pool.request()
        .input('CampaignId', sql.Int, campaign.Id)
        .input('SegmentId', sql.Int, segmentId)
        .input('BudgetAllocation', sql.Decimal(5,2), budgetPerSegment)
        .input('Weight', sql.Decimal(5,2), 1.0)
        .input('CreatedAt', sql.DateTime, now)
        .input('UpdatedAt', sql.DateTime, now)
        .query(`
          INSERT INTO CampaignSegments (CampaignId, SegmentId, BudgetAllocation, Weight, CreatedAt, UpdatedAt)
          VALUES (@CampaignId, @SegmentId, @BudgetAllocation, @Weight, @CreatedAt, @UpdatedAt)
        `);
    }
    
    console.log(`✅ ${segments.length} segmentos asociados a la campaña`);

    // 3. Si es distribución automática, calcular y crear distribución por ofertas y canales
    if (distributionType === 'automatic') {
      try {
        // Obtener ofertas de todos los segmentos
        const offers = await CampaignDistributionService.getOffersFromSegment(segments);
        
        if (offers.length === 0) {
          console.warn(`⚠️ No se encontraron ofertas para los segmentos ${segments.join(', ')}`);
          return res.status(400).json({ 
            error: 'No se encontraron ofertas en los segmentos seleccionados',
            segmentIds: segments
          });
        }

        // Calcular distribución por ofertas
        const campaignData = {
          budget: budget,
          targetApplications: targetApplications,
          maxCPA: maxCPA,
          distributionType: distributionType,
          autoOptimization: autoOptimization
        };
        
        const offerDistribution = await CampaignDistributionService.calculateOfferDistribution(campaignData, offers);
        
        // Calcular distribución por canales
        const channelDistribution = await CampaignDistributionService.calculateChannelDistribution(
          campaignData, 
          offerDistribution, 
          channels
        );
        
        // Crear registros CampaignChannels
        await CampaignDistributionService.createCampaignChannels(campaign.Id, channelDistribution);
        
        console.log(`🎯 Distribución automática completada: ${offers.length} ofertas de ${segments.length} segmentos × ${channels.length} canales = ${channelDistribution.length} registros`);
        
        // Devolver campaña con información de distribución
        res.status(201).json({ 
          ...campaign, 
          Channels: parseJSON(campaign.Channels),
          distribution: {
            mode: 'automatic',
            totalOffers: offers.length,
            totalChannels: channels.length,
            budgetPerOffer: offerDistribution.budgetPerOffer,
            targetPerOffer: offerDistribution.targetPerOffer,
            estimatedCPA: offerDistribution.estimatedCPA
          }
        });
        
      } catch (distributionError) {
        console.error(`❌ Error en distribución automática: ${distributionError.message}`);
        // La campaña ya fue creada, pero falló la distribución
        res.status(201).json({ 
          ...campaign, 
          Channels: parseJSON(campaign.Channels),
          warning: 'Campaña creada pero falló la distribución automática',
          distributionError: distributionError.message
        });
      }
    } else {
      // Distribución manual - solo devolver campaña base
      res.status(201).json({ 
        ...campaign, 
        Channels: parseJSON(campaign.Channels),
        distribution: { mode: 'manual' }
      });
    }
    
  } catch (e) {
    console.error(`❌ Error creando campaña: ${e.message}`);
    res.status(500).json({ error: 'Error creando campaña', details: e.message });
  }
});

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const r = await pool.request().input('Id', sql.Int, id).query(`SELECT * FROM Campaigns WHERE Id=@Id`);
    if (r.recordset.length === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    const row = r.recordset[0];
    res.json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error obteniendo campaña', details: e.message });
  }
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const cur = await pool.request().input('Id', sql.Int, id).query(`SELECT * FROM Campaigns WHERE Id=@Id`);
    if (cur.recordset.length === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    const prev = cur.recordset[0];

    const body = req.body || {};
    const upd = {
      Name: body.name ?? prev.Name,
      Description: body.description ?? prev.Description,
      SegmentId: body.segmentId ?? prev.SegmentId,
      DistributionType: body.distributionType ?? prev.DistributionType,
      StartDate: body.startDate ? new Date(body.startDate) : prev.StartDate,
      EndDate: body.endDate ? new Date(body.endDate) : prev.EndDate,
      Budget: body.budget ?? prev.Budget,
      TargetApplications: body.targetApplications ?? prev.TargetApplications,
      MaxCPA: body.maxCPA ?? prev.MaxCPA,
      Channels: body.channels ? JSON.stringify(parseJSON(body.channels)) : prev.Channels,
      BidStrategy: body.bidStrategy ?? prev.BidStrategy,
      ManualBid: body.manualBid ?? prev.ManualBid,
      Priority: body.priority ?? prev.Priority,
      AutoOptimization: typeof body.autoOptimization === 'boolean' ? body.autoOptimization : prev.AutoOptimization,
      Status: body.status ?? prev.Status
    };

    const u = await pool.request()
      .input('Id', sql.Int, id)
      .input('Name', sql.NVarChar(255), upd.Name)
      .input('Description', sql.NVarChar(sql.MAX), upd.Description)
      .input('SegmentId', sql.Int, upd.SegmentId)
      .input('DistributionType', sql.NVarChar(50), upd.DistributionType)
      .input('StartDate', sql.DateTime, upd.StartDate)
      .input('EndDate', sql.DateTime, upd.EndDate)
      .input('Budget', sql.Decimal(12,2), upd.Budget)
      .input('TargetApplications', sql.Int, upd.TargetApplications)
      .input('MaxCPA', sql.Decimal(12,2), upd.MaxCPA)
      .input('Channels', sql.NVarChar(sql.MAX), upd.Channels)
      .input('BidStrategy', sql.NVarChar(50), upd.BidStrategy)
      .input('ManualBid', sql.Decimal(12,2), upd.ManualBid)
      .input('Priority', sql.NVarChar(20), upd.Priority)
      .input('AutoOptimization', sql.Bit, upd.AutoOptimization)
      .input('Status', sql.NVarChar(50), upd.Status)
      .query(`
        UPDATE Campaigns
        SET Name=@Name, Description=@Description, SegmentId=@SegmentId, DistributionType=@DistributionType,
            StartDate=@StartDate, EndDate=@EndDate, Budget=@Budget, TargetApplications=@TargetApplications, MaxCPA=@MaxCPA,
            Channels=@Channels, BidStrategy=@BidStrategy, ManualBid=@ManualBid, Priority=@Priority,
            AutoOptimization=@AutoOptimization, Status=@Status, UpdatedAt=GETDATE()
        WHERE Id=@Id;
        SELECT * FROM Campaigns WHERE Id=@Id;
      `);

    const row = u.recordset[0];
    res.json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error actualizando campaña', details: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const del = await pool.request().input('Id', sql.Int, id).query(`DELETE FROM Campaigns WHERE Id=@Id`);
    if (del.rowsAffected[0] === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Error eliminando campaña', details: e.message });
  }
});

router.post('/:id/pause', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const u = await pool.request()
      .input('Id', sql.Int, id)
      .query(`UPDATE Campaigns SET Status='paused', UpdatedAt=GETDATE() WHERE Id=@Id; SELECT * FROM Campaigns WHERE Id=@Id`);
    if (u.recordset.length === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    const row = u.recordset[0];
    res.json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error al pausar campaña', details: e.message });
  }
});

router.post('/:id/resume', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await poolConnect;
    const u = await pool.request()
      .input('Id', sql.Int, id)
      .query(`UPDATE Campaigns SET Status='active', UpdatedAt=GETDATE() WHERE Id=@Id; SELECT * FROM Campaigns WHERE Id=@Id`);
    if (u.recordset.length === 0) return res.status(404).json({ error: 'Campaña no encontrada' });
    const row = u.recordset[0];
    res.json({ ...row, Channels: parseJSON(row.Channels) });
  } catch (e) {
    res.status(500).json({ error: 'Error al reanudar campaña', details: e.message });
  }
});

// Nuevo endpoint: Obtener distribución detallada de una campaña
router.get('/:id/distribution', async (req, res) => {
  const id = parseInt(req.params.id);
  
  try {
    const distributionDetail = await CampaignDistributionService.getCampaignDistributionDetail(id);
    res.json(distributionDetail);
  } catch (e) {
    console.error(`❌ Error obteniendo distribución de campaña ${id}: ${e.message}`);
    res.status(500).json({ error: 'Error obteniendo distribución', details: e.message });
  }
});

// Nuevo endpoint: Preview de distribución antes de crear campaña
router.post('/preview-distribution', async (req, res) => {
  const {
    segmentId, budget, targetApplications, maxCPA, 
    channels = [], distributionType = 'automatic'
  } = req.body || {};
  
  if (!segmentId || !budget || !targetApplications || channels.length === 0) {
    return res.status(400).json({ 
      error: 'segmentId, budget, targetApplications y channels son requeridos',
      received: { segmentId, budget, targetApplications, channelsCount: channels.length }
    });
  }
  
  try {
    console.log(`🔍 Generando preview de distribución para segmento ${segmentId}`);
    
    // Obtener ofertas del segmento
    const offers = await CampaignDistributionService.getOffersFromSegment(segmentId);
    
    if (offers.length === 0) {
      return res.status(400).json({ 
        error: 'No se encontraron ofertas en el segmento seleccionado',
        segmentId: segmentId
      });
    }

    // Calcular distribución por ofertas
    const campaignData = {
      budget: budget,
      targetApplications: targetApplications,
      maxCPA: maxCPA,
      distributionType: distributionType,
      autoOptimization: true
    };
    
    const offerDistribution = await CampaignDistributionService.calculateOfferDistribution(campaignData, offers);
    
    // Calcular distribución por canales (sin crear registros)
    const channelDistribution = await CampaignDistributionService.calculateChannelDistribution(
      campaignData, 
      offerDistribution, 
      channels
    );
    
    // Agrupar por canales para resumen
    const channelSummary = {};
    channelDistribution.forEach(dist => {
      if (!channelSummary[dist.channelId]) {
        channelSummary[dist.channelId] = {
          channelId: dist.channelId,
          channelName: dist.channelName,
          totalBudget: 0,
          totalTarget: 0,
          offerCount: 0,
          avgCPA: dist.currentCPA
        };
      }
      channelSummary[dist.channelId].totalBudget += dist.allocatedBudget;
      channelSummary[dist.channelId].totalTarget += dist.allocatedTarget;
      channelSummary[dist.channelId].offerCount++;
    });
    
    res.json({
      preview: true,
      segmentId: segmentId,
      totalOffers: offers.length,
      totalChannels: channels.length,
      totalBudget: budget,
      totalTarget: targetApplications,
      budgetPerOffer: offerDistribution.budgetPerOffer,
      targetPerOffer: offerDistribution.targetPerOffer,
      estimatedCPA: offerDistribution.estimatedCPA,
      channelSummary: Object.values(channelSummary),
      sampleOffers: offers.slice(0, 5).map(offer => ({
        id: offer.Id,
        title: offer.Title,
        company: offer.CompanyName,
        location: offer.City,
        allocatedBudget: offerDistribution.budgetPerOffer,
        allocatedTarget: offerDistribution.targetPerOffer
      }))
    });
    
  } catch (e) {
    console.error(`❌ Error generando preview: ${e.message}`);
    res.status(500).json({ error: 'Error generando preview', details: e.message });
  }
});

// Nuevo endpoint: Obtener canales disponibles con información
router.get('/available-channels', async (req, res) => {
  try {
    const channels = Object.values(CampaignDistributionService.CHANNELS).map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      defaultCPA: channel.defaultCPA,
      cpaRange: channel.cpaRange,
      supportedFormats: channel.supportedFormats
    }));
    
    res.json({
      channels: channels,
      total: channels.length
    });
  } catch (e) {
    res.status(500).json({ error: 'Error obteniendo canales', details: e.message });
  }
});

// Nuevos endpoints para integración con canales externos

// POST /api/campaigns/:id/publish-external
// Publica una campaña en canales externos
router.post('/:id/publish-external', async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { channels } = req.body || {};
  
  if (!channels || !Array.isArray(channels) || channels.length === 0) {
    return res.status(400).json({
      error: 'Se requiere un array de canales para publicar',
      example: { channels: [{ id: 'talent' }, { id: 'jooble' }] }
    });
  }
  
  try {
    console.log(`🚀 Publicando campaña ${campaignId} en canales externos`);
    
    const result = await CampaignDistributionService.publishCampaignToExternalChannels(campaignId, channels);
    
    res.json({
      success: result.success,
      message: `Campaña publicada en ${result.successfulChannels}/${result.totalChannels} canales`,
      data: result
    });
    
  } catch (error) {
    console.error(`❌ Error publicando campaña ${campaignId}: ${error.message}`);
    res.status(500).json({
      error: 'Error publicando en canales externos',
      details: error.message
    });
  }
});

// POST /api/campaigns/:id/update-performance
// Actualiza estadísticas de performance desde canales externos
router.post('/:id/update-performance', async (req, res) => {
  const campaignId = parseInt(req.params.id);
  
  try {
    console.log(`📊 Actualizando performance de campaña ${campaignId}`);
    
    const result = await CampaignDistributionService.updateCampaignPerformanceFromChannels(campaignId);
    
    res.json({
      success: result.success,
      message: result.success ? 
        `Performance actualizada en ${result.channelsUpdated}/${result.totalChannels} canales` :
        result.message,
      data: result
    });
    
  } catch (error) {
    console.error(`❌ Error actualizando performance ${campaignId}: ${error.message}`);
    res.status(500).json({
      error: 'Error actualizando performance',
      details: error.message
    });
  }
});

// POST /api/campaigns/:id/control-external
// Controla estado de campaña en canales externos (pause, resume, delete)
router.post('/:id/control-external', async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { action } = req.body || {};
  
  if (!action || !['pause', 'resume', 'delete'].includes(action)) {
    return res.status(400).json({
      error: 'Acción requerida',
      validActions: ['pause', 'resume', 'delete']
    });
  }
  
  try {
    console.log(`🔄 ${action} campaña ${campaignId} en canales externos`);
    
    const result = await CampaignDistributionService.controlCampaignInExternalChannels(campaignId, action);
    
    res.json({
      success: result.success,
      message: result.success ? 
        `Acción ${action} completada exitosamente` :
        result.message,
      data: result
    });
    
  } catch (error) {
    console.error(`❌ Error controlando campaña ${campaignId}: ${error.message}`);
    res.status(500).json({
      error: `Error ejecutando acción ${action}`,
      details: error.message
    });
  }
});

// GET /api/campaigns/:id - Obtener una campaña específica
router.get('/:id', async (req, res) => {
  const campaignId = parseInt(req.params.id);
  
  try {
    await poolConnect;
    const r = await pool.request()
      .input('Id', sql.Int, campaignId)
      .query(`
        SELECT 
          c.*,
          s.Name as SegmentName,
          s.OfferCount as SegmentOffers
        FROM Campaigns c
        LEFT JOIN Segments s ON c.SegmentId = s.Id 
        WHERE c.Id = @Id
      `);
      
    if (r.recordset.length === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    
    const campaign = {
      ...r.recordset[0],
      Channels: parseJSON(r.recordset[0].Channels),
      segment: r.recordset[0].SegmentName || `Segmento #${r.recordset[0].SegmentId}`,
      offers: r.recordset[0].SegmentOffers || 0
    };
    
    res.json(campaign);
  } catch (e) {
    res.status(500).json({ error: 'Error obteniendo campaña', details: e.message });
  }
});

// PUT /api/campaigns/:id - Actualizar una campaña
router.put('/:id', async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const {
    name, description = '', segmentId,
    distributionType = 'automatic',
    startDate = null, endDate = null,
    budget = null, targetApplications = null, maxCPA = null,
    channels = [], bidStrategy = 'automatic', manualBid = null,
    priority = 'medium', autoOptimization = true
  } = req.body || {};
  
  if (!name || !segmentId) {
    return res.status(400).json({ error: 'name y segmentId son requeridos' });
  }
  
  try {
    await poolConnect;
    
    const updateResult = await pool.request()
      .input('Id', sql.Int, campaignId)
      .input('Name', sql.NVarChar(255), name)
      .input('Description', sql.NVarChar(sql.MAX), description)
      .input('SegmentId', sql.Int, segmentId)
      .input('DistributionType', sql.NVarChar(50), distributionType)
      .input('StartDate', sql.DateTime, startDate ? new Date(startDate) : null)
      .input('EndDate', sql.DateTime, endDate ? new Date(endDate) : null)
      .input('Budget', sql.Decimal(10,2), budget)
      .input('TargetApplications', sql.Int, targetApplications)
      .input('MaxCPA', sql.Decimal(8,2), maxCPA)
      .input('Channels', sql.NVarChar(sql.MAX), JSON.stringify(channels))
      .input('BidStrategy', sql.NVarChar(50), bidStrategy)
      .input('ManualBid', sql.Decimal(8,2), manualBid)
      .input('Priority', sql.NVarChar(20), priority)
      .input('AutoOptimization', sql.Bit, autoOptimization)
      .input('UpdatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE Campaigns SET
          Name = @Name,
          Description = @Description,
          SegmentId = @SegmentId,
          DistributionType = @DistributionType,
          StartDate = @StartDate,
          EndDate = @EndDate,
          Budget = @Budget,
          TargetApplications = @TargetApplications,
          MaxCPA = @MaxCPA,
          Channels = @Channels,
          BidStrategy = @BidStrategy,
          ManualBid = @ManualBid,
          Priority = @Priority,
          AutoOptimization = @AutoOptimization,
          UpdatedAt = @UpdatedAt
        WHERE Id = @Id
      `);
    
    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    
    console.log(`✅ Campaña ${campaignId} actualizada exitosamente`);
    res.json({ 
      success: true, 
      message: 'Campaña actualizada exitosamente',
      campaignId: campaignId 
    });
    
  } catch (error) {
    console.error(`❌ Error actualizando campaña ${campaignId}:`, error);
    res.status(500).json({ 
      error: 'Error actualizando campaña', 
      details: error.message 
    });
  }
});

// PATCH /api/campaigns/:id/status - Cambiar estado de campaña (pausar/reanudar)
router.patch('/:id/status', async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { status } = req.body || {};
  
  if (!status || !['active', 'paused', 'completed', 'archived'].includes(status)) {
    return res.status(400).json({
      error: 'Estado requerido',
      validStatuses: ['active', 'paused', 'completed', 'archived']
    });
  }
  
  try {
    await poolConnect;
    
    const updateResult = await pool.request()
      .input('Id', sql.Int, campaignId)
      .input('Status', sql.NVarChar(50), status)
      .input('UpdatedAt', sql.DateTime, new Date())
      .query(`
        UPDATE Campaigns SET
          Status = @Status,
          UpdatedAt = @UpdatedAt
        WHERE Id = @Id
      `);
    
    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    
    console.log(`🔄 Campaña ${campaignId} cambió estado a: ${status}`);
    res.json({ 
      success: true, 
      message: `Campaña ${status === 'paused' ? 'pausada' : status === 'active' ? 'reactivada' : 'actualizada'} exitosamente`,
      campaignId: campaignId,
      newStatus: status
    });
    
  } catch (error) {
    console.error(`❌ Error cambiando estado de campaña ${campaignId}:`, error);
    res.status(500).json({ 
      error: 'Error cambiando estado de campaña', 
      details: error.message 
    });
  }
});

// DELETE /api/campaigns/:id - Eliminar una campaña
router.delete('/:id', async (req, res) => {
  const campaignId = parseInt(req.params.id);
  
  try {
    await poolConnect;
    
    // Primero verificar que la campaña existe
    const checkResult = await pool.request()
      .input('Id', sql.Int, campaignId)
      .query('SELECT Id, Name FROM Campaigns WHERE Id = @Id');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    
    const campaignName = checkResult.recordset[0].Name;
    
    // Eliminar registros relacionados primero (CampaignChannels)
    await pool.request()
      .input('CampaignId', sql.Int, campaignId)
      .query('DELETE FROM CampaignChannels WHERE CampaignId = @CampaignId');
    
    // Eliminar la campaña
    const deleteResult = await pool.request()
      .input('Id', sql.Int, campaignId)
      .query('DELETE FROM Campaigns WHERE Id = @Id');
    
    console.log(`🗑️ Campaña ${campaignId} ("${campaignName}") eliminada exitosamente`);
    res.json({ 
      success: true, 
      message: `Campaña "${campaignName}" eliminada exitosamente`,
      campaignId: campaignId 
    });
    
  } catch (error) {
    console.error(`❌ Error eliminando campaña ${campaignId}:`, error);
    res.status(500).json({ 
      error: 'Error eliminando campaña', 
      details: error.message 
    });
  }
});

module.exports = router;
