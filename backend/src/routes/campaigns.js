const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db/db');
const CampaignDistributionService = require('../services/campaignDistributionService');
const { addUserToRequest, requireAuth, onlyOwnData, isSuperAdmin } = require('../middleware/authMiddleware');

const parseJSON = (val) => {
  if (!val) return [];
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch { return []; }
};

// Aplicar middleware de autenticación a todas las rutas
router.use(addUserToRequest);
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    await poolConnect;
    
    // Construir query con filtrado por usuario o super admin
    let query = `
      SELECT 
        c.*,
        s.Name as SegmentName,
        s.OfferCount as SegmentOffers,
        u.FirstName + ' ' + u.LastName as UserName,
        u.Email as UserEmail,
        u.Company as UserCompany
      FROM Campaigns c
      LEFT JOIN Segments s ON c.SegmentId = s.Id 
      LEFT JOIN Users u ON c.UserId = u.Id`;
    
    const request = pool.request();
    
    console.log(`🔍 Campaigns DEBUG: req.userId = ${req.userId}, req.user.role = ${req.user.role}`);
    console.log(`🔍 Campaigns DEBUG: isSuperAdmin(req) = ${isSuperAdmin(req)}`);
    
    // Super admin puede ver todas las campañas, usuarios normales solo las suyas
    if (!isSuperAdmin(req)) {
      query += ` WHERE c.UserId = @UserId`;
      request.input('UserId', sql.BigInt, req.userId);
      console.log(`🔍 Campaigns: Agregando filtro WHERE c.UserId = ${req.userId}`);
    } else {
      console.log(`🔍 Campaigns: Super admin - sin filtro WHERE`);
    }
    
    query += ` ORDER BY c.CreatedAt DESC`;
    
    console.log(`🔍 Campaigns query para usuario ${req.userId} (${req.user.role}): ${isSuperAdmin(req) ? 'TODOS' : 'FILTRADO'}`);
    console.log(`🔍 Campaigns query final:`, query);
    
    const r = await request.query(query);
    
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
  
  // Usar el userId del middleware de autenticación
  const userId = req.userId;
  
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
      .input('Status', sql.NVarChar(50), 'draft')
      .input('UserId', sql.BigInt, userId)
      .input('CreatedAt', sql.DateTime, now)
      .input('UpdatedAt', sql.DateTime, now)
      .query(`
        INSERT INTO Campaigns
        (Name, Description, SegmentId, DistributionType, StartDate, EndDate, Budget, TargetApplications, MaxCPA, Channels, BidStrategy, ManualBid, Priority, AutoOptimization, Status, UserId, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.*
        VALUES
        (@Name, @Description, @SegmentId, @DistributionType, @StartDate, @EndDate, @Budget, @TargetApplications, @MaxCPA, @Channels, @BidStrategy, @ManualBid, @Priority, @AutoOptimization, @Status, @UserId, @CreatedAt, @UpdatedAt)
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

// 🔧 ENDPOINT DE REPARACIÓN: Repoblar CampaignChannels para campañas automáticas existentes
router.post('/repopulate-channels', async (req, res) => {
  try {
    await poolConnect;
    console.log('🔧 Iniciando repoblación de CampaignChannels para campañas automáticas...');
    
    // Obtener campañas automáticas activas
    const campaignsResult = await pool.request()
      .query(`
        SELECT c.Id, c.Name, c.DistributionType, c.Channels, c.Budget, c.TargetApplications, c.MaxCPA,
               c.BidStrategy, c.ManualBid, c.Priority, c.AutoOptimization
        FROM Campaigns c 
        WHERE c.DistributionType = 'automatic' AND c.Status = 'active'
      `);
    
    const campaigns = campaignsResult.recordset;
    console.log(`🔍 Encontradas ${campaigns.length} campañas automáticas para procesar`);
    
    let totalProcessed = 0;
    let totalChannels = 0;
    
    for (const campaign of campaigns) {
      try {
        console.log(`📝 Procesando campaña ${campaign.Id}: "${campaign.Name}"`);
        
        // Obtener segmentos de la campaña
        const segmentsResult = await pool.request()
          .input('CampaignId', sql.Int, campaign.Id)
          .query('SELECT SegmentId FROM CampaignSegments WHERE CampaignId = @CampaignId');
        
        const segmentIds = segmentsResult.recordset.map(s => s.SegmentId);
        console.log(`🎯 Segmentos: ${segmentIds.join(', ')}`);
        
        if (segmentIds.length === 0) {
          console.log(`⚠️ Campaña ${campaign.Id} no tiene segmentos asignados`);
          continue;
        }
        
        // Obtener ofertas de los segmentos
        const offers = await CampaignDistributionService.getOffersFromSegment(segmentIds);
        console.log(`📊 Ofertas encontradas: ${offers.length}`);
        
        if (offers.length === 0) {
          console.log(`⚠️ No se encontraron ofertas para campaña ${campaign.Id}`);
          continue;
        }
        
        // Preparar datos de campaña
        const campaignData = {
          id: campaign.Id,
          budget: campaign.Budget,
          targetApplications: campaign.TargetApplications,
          maxCPA: campaign.MaxCPA,
          bidStrategy: campaign.BidStrategy,
          manualBid: campaign.ManualBid,
          priority: campaign.Priority,
          autoOptimization: campaign.AutoOptimization
        };
        
        const channels = parseJSON(campaign.Channels);
        console.log(`📺 Canales: ${channels.join(', ')}`);
        
        // Calcular distribución
        const offerDistribution = await CampaignDistributionService.calculateOfferDistribution(campaignData, offers);
        const channelDistribution = await CampaignDistributionService.calculateChannelDistribution(
          campaignData, 
          offerDistribution, 
          channels
        );
        
        // Limpiar registros existentes
        await pool.request()
          .input('CampaignId', sql.Int, campaign.Id)
          .query('DELETE FROM CampaignChannels WHERE CampaignId = @CampaignId');
        
        // Crear nuevos registros
        await CampaignDistributionService.createCampaignChannels(campaign.Id, channelDistribution);
        
        console.log(`✅ Campaña ${campaign.Id}: ${offers.length} ofertas × ${channels.length} canales = ${channelDistribution.length} registros`);
        totalProcessed++;
        totalChannels += channelDistribution.length;
        
      } catch (error) {
        console.error(`❌ Error procesando campaña ${campaign.Id}:`, error.message);
      }
    }
    
    console.log(`🎉 Repoblación completada: ${totalProcessed} campañas, ${totalChannels} registros CampaignChannels`);
    
    res.json({
      success: true,
      message: `Repoblación completada exitosamente`,
      campaignsProcessed: totalProcessed,
      totalChannelRecords: totalChannels,
      campaignsFound: campaigns.length
    });
    
  } catch (error) {
    console.error('❌ Error en repoblación de CampaignChannels:', error);
    res.status(500).json({
      success: false,
      error: 'Error repoblando CampaignChannels',
      details: error.message
    });
  }
});

// POST /api/campaigns/:id/activate - Activar campaña (enviar a canales)
router.post('/:id/activate', async (req, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.userId;
    
    console.log(`🚀 Activando campaña ${campaignId} para usuario ${userId}...`);
    
    await poolConnect;
    
    // 1. Obtener datos de la campaña
    const campaignResult = await pool.request()
      .input('Id', sql.Int, campaignId)
      .input('UserId', sql.BigInt, userId)
      .query(`
        SELECT c.*, s.Name as SegmentName
        FROM Campaigns c
        LEFT JOIN Segments s ON c.SegmentId = s.Id
        WHERE c.Id = @Id ${!isSuperAdmin(req) ? 'AND c.UserId = @UserId' : ''}
      `);
    
    if (campaignResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    
    const campaign = campaignResult.recordset[0];
    
    // Verificar que está en estado draft
    if (campaign.Status !== 'draft') {
      return res.status(400).json({ 
        error: `Campaña ya está en estado '${campaign.Status}'. Solo se pueden activar campañas en estado 'draft'` 
      });
    }
    
    // 2. Obtener segmentos asociados a la campaña
    const segmentsResult = await pool.request()
      .input('CampaignId', sql.Int, campaignId)
      .query(`
        SELECT cs.SegmentId, s.Name as SegmentName
        FROM CampaignSegments cs
        INNER JOIN Segments s ON cs.SegmentId = s.Id
        WHERE cs.CampaignId = @CampaignId
        ORDER BY cs.CreatedAt
      `);
    
    const segmentIds = segmentsResult.recordset.map(s => s.SegmentId);
    
    if (segmentIds.length === 0) {
      return res.status(400).json({ error: 'Campaña no tiene segmentos asociados' });
    }
    
    // 3. Obtener ofertas de todos los segmentos
    const offers = await CampaignDistributionService.getOffersFromSegment(segmentIds);
    
    if (offers.length === 0) {
      return res.status(400).json({ 
        error: 'No se encontraron ofertas en los segmentos de la campaña',
        segmentIds: segmentIds
      });
    }
    
    // 4. Obtener canales configurados del usuario
    const channels = parseJSON(campaign.Channels);
    const results = [];
    let hasSuccess = false;
    
    // 5. Enviar a cada canal configurado
    for (const channelId of channels) {
      console.log(`📤 Enviando campaña ${campaignId} a canal ${channelId}...`);
      
      try {
        let channelResult = null;
        
        if (channelId === 'jooble' || channelId.startsWith('jooble-')) {
          // Obtener credenciales de Jooble del usuario
          const credentialsResult = await pool.request()
            .input('UserId', sql.BigInt, userId)
            .input('ChannelId', sql.NVarChar(50), 'jooble')
            .query('SELECT EncryptedCredentials FROM UserChannelCredentials WHERE UserId = @UserId AND ChannelId = @ChannelId AND IsActive = 1');
          
          if (credentialsResult.recordset.length === 0) {
            throw new Error('Credenciales de Jooble no encontradas o no están activas');
          }
          
          // Desencriptar credenciales
          const CredentialsManager = require('../services/credentialsManager');
          const credentialsManager = new CredentialsManager();
          const credentials = credentialsManager.decryptCredentials(credentialsResult.recordset[0].EncryptedCredentials);
          
          // Usar JoobleService para crear campaña
          const JoobleService = require('../services/channels/joobleService');
          
          // Preparar datos para Jooble
          const campaignData = {
            id: campaign.Id,
            name: campaign.Name,
            description: campaign.Description,
            startDate: campaign.StartDate,
            endDate: campaign.EndDate,
            budget: campaign.Budget,
            maxCPA: campaign.MaxCPA,
            status: 'active'
          };
          
          const budgetInfo = {
            maxCPC: campaign.MaxCPA,
            dailyBudget: campaign.Budget ? Math.round(campaign.Budget / 30) : null,
            targetApplications: campaign.TargetApplications
          };
          
          // Determinar qué API key usar según el país especificado
          let targetApiKey;
          
          // Validar estructura de credenciales
          if (!credentials.joobleApiKeys || !Array.isArray(credentials.joobleApiKeys) || credentials.joobleApiKeys.length === 0) {
            throw new Error(`Credenciales de Jooble malformadas o vacías. Estructura recibida: ${JSON.stringify(credentials, null, 2)}`);
          }
          
          if (channelId.startsWith('jooble-')) {
            const countryCode = channelId.split('-')[1].toUpperCase(); // jooble-es -> ES
            console.log(`🔍 Buscando API key para país: ${countryCode}`);
            console.log(`🔍 Credenciales disponibles:`, credentials.joobleApiKeys);
            targetApiKey = credentials.joobleApiKeys.find(key => key.countryCode.toUpperCase() === countryCode);
            if (!targetApiKey) {
              throw new Error(`No se encontró API key para Jooble ${countryCode}. Países disponibles: ${credentials.joobleApiKeys.map(k => k.countryCode).join(', ')}`);
            }
            console.log(`🌍 Enviando campaña a Jooble ${countryCode.toUpperCase()}`);
          } else {
            // Jooble genérico - usar primer API key disponible
            targetApiKey = credentials.joobleApiKeys[0];
            if (!targetApiKey) {
              throw new Error('No se encontraron API keys de Jooble configuradas');
            }
            console.log(`🌍 Enviando campaña a Jooble (genérico) - ${targetApiKey.countryCode.toUpperCase()}`);
          }
          
          // Crear instancia de JoobleService con las credenciales específicas del país
          const joobleService = new JoobleService({
            apiKey: targetApiKey.apiKey,
            countryCode: targetApiKey.countryCode
          });
          
          channelResult = await joobleService.createCampaign(campaignData, offers, budgetInfo);
          
        } else {
          // Para otros canales, simular por ahora
          console.log(`⚠️ Canal ${channelId} no implementado aún, simulando...`);
          channelResult = {
            success: true,
            channel: channelId,
            campaignId: `${channelId}_sim_${Date.now()}`,
            message: `Simulación exitosa para ${channelId}`,
            simulation: true
          };
        }
        
        results.push({
          channel: channelId,
          success: channelResult.success,
          data: channelResult,
          error: null
        });
        
        if (channelResult.success) {
          hasSuccess = true;
          console.log(`✅ Campaña enviada exitosamente a ${channelId}`);
        }
        
      } catch (channelError) {
        console.error(`❌ Error enviando a ${channelId}: ${channelError.message}`);
        results.push({
          channel: channelId,
          success: false,
          data: null,
          error: channelError.message
        });
      }
    }
    
    // 6. Actualizar estado de la campaña
    if (hasSuccess) {
      await pool.request()
        .input('Id', sql.Int, campaignId)
        .query(`UPDATE Campaigns SET Status='active', UpdatedAt=GETDATE() WHERE Id=@Id`);
      
      console.log(`✅ Campaña ${campaignId} activada exitosamente`);
      
      res.json({
        success: true,
        message: `Campaña activada y enviada a ${results.filter(r => r.success).length}/${results.length} canales`,
        campaignId: campaignId,
        status: 'active',
        channels: results,
        offers: offers.length,
        timestamp: new Date().toISOString()
      });
    } else {
      // Todos los canales fallaron
      const errors = results.map(r => r.error).filter(Boolean);
      res.status(400).json({
        success: false,
        error: 'Error enviando campaña a todos los canales',
        details: errors,
        channels: results,
        campaignId: campaignId,
        status: 'draft' // Mantener en draft
      });
    }
    
  } catch (error) {
    console.error(`❌ Error activando campaña: ${error.message}`);
    res.status(500).json({ 
      error: 'Error interno activando campaña',
      details: error.message 
    });
  }
});

module.exports = router;
