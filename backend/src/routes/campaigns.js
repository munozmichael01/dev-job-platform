const express = require('express');
const router = express.Router();
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');

const CHANNEL_DEFINITIONS = {
  jooble: { id: 'jooble', name: 'Jooble', type: 'CPC', defaultCPA: 15, cpaRange: [10, 25], supportedFormats: ['api', 'xml'] },
  talent: { id: 'talent', name: 'Talent.com', type: 'CPA', defaultCPA: 18, cpaRange: [12, 30], supportedFormats: ['xml'] },
  jobrapido: { id: 'jobrapido', name: 'JobRapido', type: 'Organic', defaultCPA: 12, cpaRange: [8, 20], supportedFormats: ['xml', 'json'] },
  whatjobs: { id: 'whatjobs', name: 'WhatJobs', type: 'XML Feed + CPC', defaultCPA: 14, cpaRange: [8, 24], supportedFormats: ['xml'] },
  infojobs: { id: 'infojobs', name: 'InfoJobs', type: 'API', defaultCPA: 20, cpaRange: [10, 35], supportedFormats: ['api'] },
  linkedin: { id: 'linkedin', name: 'LinkedIn', type: 'API', defaultCPA: 25, cpaRange: [15, 50], supportedFormats: ['api'] },
  indeed: { id: 'indeed', name: 'Indeed', type: 'XML Feed', defaultCPA: 18, cpaRange: [10, 35], supportedFormats: ['xml'] }
};

function parseArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

function applyUserFilter(query, req, column = 'UserId') {
  return isSuperAdmin(req) ? query : query.eq(column, req.userId);
}

async function getChannelIdsByCode(codes = []) {
  const cleanCodes = [...new Set(codes.map(c => String(c).split('-')[0]).filter(Boolean))];
  if (cleanCodes.length === 0) return [];
  const { data, error } = await supabase.from('DistributionChannels').select('Id, Code, Name').in('Code', cleanCodes);
  if (error) throw error;
  return data || [];
}

async function hydrateCampaign(row) {
  const [{ data: segmentRows }, { data: channelRows }] = await Promise.all([
    supabase
      .from('CampaignSegments')
      .select('Id, SegmentId, BudgetAllocation, Weight, Segments(Id, Name, Description, FilterDefinition, Status)')
      .eq('CampaignId', row.Id),
    supabase
      .from('CampaignChannels')
      .select('Id, Budget, BidStrategy, Status, Config, DistributionChannels(Id, Code, Name, Type, Country)')
      .eq('CampaignId', row.Id)
  ]);

  const segments = (segmentRows || []).map(s => ({
    id: s.SegmentId,
    segmentId: s.SegmentId,
    name: s.Segments?.Name || `Segmento #${s.SegmentId}`,
    budgetAllocation: s.BudgetAllocation,
    weight: s.Weight,
    segment: s.Segments
  }));

  const campaignChannels = (channelRows || []).map(cc => ({
    id: cc.Id,
    channelId: cc.ChannelId,
    code: cc.DistributionChannels?.Code,
    name: cc.DistributionChannels?.Name,
    budget: cc.Budget,
    bidStrategy: cc.BidStrategy,
    status: cc.Status,
    config: cc.Config,
    distributionChannel: cc.DistributionChannels
  }));

  const channelCodes = campaignChannels.map(c => c.code).filter(Boolean);
  const segmentNames = segments.map(s => s.name).join(', ');

  return {
    ...row,
    Budget: row.BudgetTotal, // shim
    TargetApplications: row.TargetApplications || row.Config?.targetApplications || 0,
    MaxCPA: row.MaxCPA || row.Config?.maxCPA || 0,
    DistributionType: row.DistributionType || row.Config?.distributionType || 'automatic',
    Channels: channelCodes,
    segment: segmentNames,
    SegmentId: segments[0]?.segmentId || null, // shim for legacy frontend displays
    SegmentName: segments[0]?.name || null,
    SegmentOffers: 0,
    offers: 0,
    segments,
    campaignChannels,
    segmentCount: segments.length
  };
}

router.use(addUserToRequest);
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    let query = supabase.from('Campaigns').select('*').order('CreatedAt', { ascending: false });
    query = applyUserFilter(query, req);
    const { data, error } = await query;
    if (error) throw error;
    const campaigns = [];
    for (const campaign of data || []) campaigns.push(await hydrateCampaign(campaign));
    res.json(campaigns);
  } catch (error) {
    console.error('❌ Error listando campañas:', error.message);
    res.status(500).json({ error: 'Error listando campañas', details: error.message });
  }
});

router.get('/available-channels', async (_req, res) => {
  res.json({ channels: Object.values(CHANNEL_DEFINITIONS), total: Object.keys(CHANNEL_DEFINITIONS).length });
});

router.post('/preview-distribution', async (req, res) => {
  const { segmentId, segmentIds, budget, targetApplications, channels = [] } = req.body || {};
  const segments = segmentIds?.length ? segmentIds : (segmentId ? [segmentId] : []);
  res.json({
    preview: true,
    segmentIds: segments,
    totalOffers: 0,
    totalChannels: channels.length,
    totalBudget: budget || 0,
    totalTarget: targetApplications || 0,
    budgetPerOffer: 0,
    targetPerOffer: 0,
    estimatedCPA: 0,
    channelSummary: channels.map(code => ({ channelId: code, channelName: CHANNEL_DEFINITIONS[String(code).split('-')[0]]?.name || code, totalBudget: 0, totalTarget: 0, offerCount: 0, avgCPA: 0 })),
    sampleOffers: []
  });
});

router.post('/repopulate-channels', async (_req, res) => {
  res.json({ success: true, message: 'No hay datos legacy que repoblar en el schema limpio', campaignsProcessed: 0, totalChannelRecords: 0, campaignsFound: 0 });
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      description = '',
      segmentId,
      segmentIds,
      distributionType = 'automatic',
      startDate = null,
      endDate = null,
      budget = null,
      targetApplications = null,
      maxCPA = null,
      channels = [],
      bidStrategy = 'automatic',
      manualBid = null,
      priority = 'medium',
      autoOptimization = true
    } = req.body || {};

    const segments = Array.isArray(segmentIds) && segmentIds.length > 0 ? segmentIds : (segmentId ? [segmentId] : []);
    const selectedChannels = parseArray(channels);

    if (!name || segments.length === 0) return res.status(400).json({ error: 'name y al menos un segmento son requeridos' });
    if (!budget || !targetApplications) return res.status(400).json({ error: 'budget y targetApplications son requeridos' });

    const config = { distributionType, targetApplications, maxCPA, manualBid, priority, autoOptimization };
    const { data: campaign, error } = await supabase
      .from('Campaigns')
      .insert({
        UserId: req.userId,
        Name: name,
        Description: description,
        Objective: targetApplications ? `${targetApplications} aplicaciones` : null,
        BudgetTotal: budget,
        BudgetCurrency: 'EUR',
        StartDate: startDate ? new Date(startDate).toISOString() : null,
        EndDate: endDate ? new Date(endDate).toISOString() : null,
        Status: 'draft',
        CreatedByUserId: req.userId,
        Config: config,
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;

    const budgetPerSegment = Number((100 / segments.length).toFixed(2));
    const segmentRows = segments.map(id => ({ CampaignId: campaign.Id, SegmentId: Number(id), BudgetAllocation: budgetPerSegment, Weight: 1, CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString() }));
    const { error: segmentError } = await supabase.from('CampaignSegments').insert(segmentRows);
    if (segmentError) throw segmentError;

    const channelDefs = await getChannelIdsByCode(selectedChannels);
    if (channelDefs.length > 0) {
      const budgetPerChannel = Number((Number(budget) / channelDefs.length).toFixed(2));
      const channelRows = channelDefs.map(ch => ({
        CampaignId: campaign.Id,
        ChannelId: ch.Id,
        Budget: budgetPerChannel,
        BidStrategy: bidStrategy,
        Status: 'active',
        Config: { manualBid, priority, autoOptimization, sourceCodes: selectedChannels },
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString()
      }));
      const { error: channelError } = await supabase.from('CampaignChannels').insert(channelRows);
      if (channelError) throw channelError;
    }

    res.status(201).json(await hydrateCampaign(campaign));
  } catch (error) {
    console.error('❌ Error creando campaña:', error.message);
    res.status(500).json({ error: 'Error creando campaña', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let query = supabase.from('Campaigns').select('*').eq('Id', id);
    query = applyUserFilter(query, req);
    const { data, error } = await query.single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Campaña no encontrada' });
      throw error;
    }
    res.json(await hydrateCampaign(data));
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo campaña', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let currentQ = supabase.from('Campaigns').select('*').eq('Id', id);
    currentQ = applyUserFilter(currentQ, req);
    const { data: current, error: currentError } = await currentQ.single();
    if (currentError) {
      if (currentError.code === 'PGRST116') return res.status(404).json({ error: 'Campaña no encontrada' });
      throw currentError;
    }

    const body = req.body || {};
    const segments = Array.isArray(body.segmentIds) && body.segmentIds.length > 0 ? body.segmentIds : (body.segmentId ? [body.segmentId] : null);
    const channels = body.channels ? parseArray(body.channels) : null;
    const config = { ...(current.Config || {}), distributionType: body.distributionType, targetApplications: body.targetApplications, maxCPA: body.maxCPA, manualBid: body.manualBid, priority: body.priority, autoOptimization: body.autoOptimization };

    const { data: updated, error } = await supabase
      .from('Campaigns')
      .update({
        Name: body.name ?? current.Name,
        Description: body.description ?? current.Description,
        BudgetTotal: body.budget ?? current.BudgetTotal,
        StartDate: body.startDate ? new Date(body.startDate).toISOString() : current.StartDate,
        EndDate: body.endDate ? new Date(body.endDate).toISOString() : current.EndDate,
        Status: body.status ?? current.Status,
        Config: config,
        UpdatedAt: new Date().toISOString()
      })
      .eq('Id', id)
      .select()
      .single();
    if (error) throw error;

    if (segments) {
      await supabase.from('CampaignSegments').delete().eq('CampaignId', id);
      const budgetPerSegment = Number((100 / segments.length).toFixed(2));
      await supabase.from('CampaignSegments').insert(segments.map(segId => ({ CampaignId: id, SegmentId: Number(segId), BudgetAllocation: budgetPerSegment, Weight: 1, CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString() })));
    }

    if (channels) {
      await supabase.from('CampaignChannels').delete().eq('CampaignId', id);
      const channelDefs = await getChannelIdsByCode(channels);
      if (channelDefs.length > 0) {
        const budgetPerChannel = Number((Number(body.budget ?? updated.BudgetTotal ?? 0) / channelDefs.length).toFixed(2));
        await supabase.from('CampaignChannels').insert(channelDefs.map(ch => ({ CampaignId: id, ChannelId: ch.Id, Budget: budgetPerChannel, BidStrategy: body.bidStrategy || 'automatic', Status: 'active', Config: { sourceCodes: channels }, CreatedAt: new Date().toISOString(), UpdatedAt: new Date().toISOString() })));
      }
    }

    res.json(await hydrateCampaign(updated));
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando campaña', details: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let query = supabase.from('Campaigns').delete().eq('Id', id);
    query = applyUserFilter(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ success: true, message: 'Campaña eliminada exitosamente', campaignId: id });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando campaña', details: error.message });
  }
});

async function updateCampaignStatus(req, res, statusOverride) {
  try {
    const id = parseInt(req.params.id);
    const status = statusOverride || req.body?.status;
    if (!['draft', 'active', 'paused', 'completed', 'archived'].includes(status)) return res.status(400).json({ error: 'Estado inválido' });
    let query = supabase.from('Campaigns').update({ Status: status, UpdatedAt: new Date().toISOString() }).eq('Id', id);
    query = applyUserFilter(query, req);
    const { error } = await query;
    if (error) throw error;
    res.json({ success: true, campaignId: id, newStatus: status, message: 'Estado actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error cambiando estado de campaña', details: error.message });
  }
}

router.post('/:id/pause', async (req, res) => updateCampaignStatus(req, res, 'paused'));

router.post('/:id/resume', async (req, res) => updateCampaignStatus(req, res, 'active'));

router.patch('/:id/status', async (req, res) => updateCampaignStatus(req, res));

router.get('/:id/distribution', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data: runs, error: runsError } = await supabase.from('DistributionRuns').select('Id, Status, ChannelId, StartedAt, FinishedAt').eq('CampaignId', id);
    if (runsError) throw runsError;
    const runIds = (runs || []).map(r => r.Id);
    let items = [];
    if (runIds.length > 0) {
      const { data, error } = await supabase.from('DistributionItems').select('*').in('DistributionRunId', runIds);
      if (error) throw error;
      items = data || [];
    }
    res.json({ campaignId: id, runs: runs || [], items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo distribución', details: error.message });
  }
});

router.post('/:id/activate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaign = await (async () => {
      let q = supabase.from('Campaigns').select('*').eq('Id', id);
      q = applyUserFilter(q, req);
      const { data, error } = await q.single();
      if (error) throw error;
      return data;
    })();
    if (campaign.Status !== 'draft') return res.status(400).json({ error: `Campaña ya está en estado '${campaign.Status}'` });

    await supabase.from('Campaigns').update({ Status: 'active', UpdatedAt: new Date().toISOString() }).eq('Id', id);
    res.json({
      success: true,
      message: 'Campaña activada. La publicación externa se ejecutará cuando el flujo de distribución esté conectado al nuevo schema.',
      campaignId: id,
      status: 'active',
      channels: [],
      offers: 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno activando campaña', details: error.message });
  }
});

router.post('/:id/publish-external', async (req, res) => {
  res.json({ success: false, message: 'Publicación externa pendiente de conectar al nuevo pipeline DistributionRuns/DistributionItems', data: { campaignId: parseInt(req.params.id), requestedChannels: req.body?.channels || [] } });
});

router.post('/:id/update-performance', async (req, res) => {
  res.json({ success: true, message: 'Performance pendiente de conectar al nuevo pipeline', data: { campaignId: parseInt(req.params.id), channelsUpdated: 0, totalChannels: 0 } });
});

router.post('/:id/control-external', async (req, res) => {
  res.json({ success: true, message: `Acción ${req.body?.action || 'unknown'} registrada localmente`, data: { campaignId: parseInt(req.params.id), action: req.body?.action } });
});

module.exports = router;
