const express = require('express');
const router = express.Router();
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');

const emptyFilters = () => ({
  jobTitles: [],
  locations: [],
  sectors: [],
  experienceLevels: [],
  contractTypes: [],
  companies: []
});

function parseFilters(filters) {
  if (!filters) return emptyFilters();
  try {
    const parsed = typeof filters === 'string' ? JSON.parse(filters) : filters;
    return {
      ...emptyFilters(),
      ...parsed,
      jobTitles: parsed.jobTitles || parsed.titles || [],
      locations: parsed.locations || [],
      sectors: parsed.sectors || parsed.categories || [],
      experienceLevels: parsed.experienceLevels || [],
      contractTypes: parsed.contractTypes || [],
      companies: parsed.companies || []
    };
  } catch {
    return emptyFilters();
  }
}

function applyUserFilter(query, req, column = 'UserId') {
  return isSuperAdmin(req) ? query : query.eq(column, req.userId);
}

function applySegmentFilters(query, filters) {
  const f = parseFilters(filters);
  const searchParts = [];

  if (f.jobTitles.length > 0) {
    f.jobTitles.slice(0, 5).forEach(term => {
      searchParts.push(`Title.ilike.%${term}%`);
      searchParts.push(`CompanyName.ilike.%${term}%`);
    });
  }
  if (searchParts.length > 0) query = query.or(searchParts.join(','));

  if (f.locations.length > 0) {
    const loc = f.locations[0];
    query = query.or(`City.ilike.%${loc}%,Region.ilike.%${loc}%`);
  }
  if (f.sectors.length > 0) {
    const sector = f.sectors[0];
    query = query.or(`Sector.ilike.%${sector}%,Category.ilike.%${sector}%`);
  }
  if (f.companies.length > 0) {
    const company = f.companies[0];
    query = query.ilike('CompanyName', `%${company}%`);
  }

  return query.eq('Status', 'active');
}

async function countOffersForSegment(req, filters) {
  let query = supabase.from('JobOffers').select('Id', { count: 'exact', head: true });
  query = applyUserFilter(query, req);
  query = applySegmentFilters(query, filters);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function countCampaignsForSegment(req, segmentId) {
  let campaignQuery = supabase.from('CampaignSegments').select('CampaignId, Campaigns!inner(UserId, Status)', { count: 'exact' }).eq('SegmentId', segmentId);
  if (!isSuperAdmin(req)) campaignQuery = campaignQuery.eq('Campaigns.UserId', req.userId);
  const { count, error } = await campaignQuery;
  if (error) return 0;
  return count || 0;
}

function mapSegment(row, offerCount = 0, campaignCount = 0) {
  const filters = parseFilters(row.FilterDefinition || row.Filters);
  return {
    ...row,
    Filters: filters,
    FilterDefinition: filters,
    OfferCount: offerCount,
    Campaigns: campaignCount,
    HasCampaigns: campaignCount > 0
  };
}

router.use(addUserToRequest);
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    let query = supabase.from('Segments').select('*').order('UpdatedAt', { ascending: false });
    query = applyUserFilter(query, req);
    const { data, error } = await query;
    if (error) throw error;

    const rows = [];
    for (const segment of data || []) {
      const [offerCount, campaignCount] = await Promise.all([
        countOffersForSegment(req, segment.FilterDefinition),
        countCampaignsForSegment(req, segment.Id)
      ]);
      rows.push(mapSegment(segment, offerCount, campaignCount));
    }
    res.json(rows);
  } catch (error) {
    console.error('❌ Error listando segmentos:', error.message);
    res.status(500).json({ error: 'Error listando segmentos', details: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description = '', filters = {}, status = 'active', type = 'dynamic' } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Campo "name" es requerido' });
    const parsedFilters = parseFilters(filters);
    const insertData = {
      UserId: req.userId,
      Name: name,
      Description: description,
      Type: type,
      FilterDefinition: parsedFilters,
      Status: status,
      CreatedByUserId: req.userId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };
    const { data, error } = await supabase.from('Segments').insert(insertData).select().single();
    if (error) throw error;
    const offerCount = await countOffersForSegment(req, parsedFilters);
    res.status(201).json(mapSegment(data, offerCount, 0));
  } catch (error) {
    res.status(500).json({ error: 'Error creando segmento', details: error.message });
  }
});

router.post('/estimate-preview', async (req, res) => {
  try {
    const count = await countOffersForSegment(req, req.body?.filters || {});
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: 'Error en estimate-preview', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let query = supabase.from('Segments').select('*').eq('Id', id);
    query = applyUserFilter(query, req);
    const { data, error } = await query.single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Segmento no encontrado' });
      throw error;
    }
    const [offerCount, campaignCount] = await Promise.all([
      countOffersForSegment(req, data.FilterDefinition),
      countCampaignsForSegment(req, id)
    ]);
    res.json(mapSegment(data, offerCount, campaignCount));
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo segmento', details: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let existingQ = supabase.from('Segments').select('*').eq('Id', id);
    existingQ = applyUserFilter(existingQ, req);
    const { data: existing, error: existingError } = await existingQ.single();
    if (existingError) {
      if (existingError.code === 'PGRST116') return res.status(404).json({ error: 'Segmento no encontrado' });
      throw existingError;
    }
    const filters = req.body.filters ? parseFilters(req.body.filters) : parseFilters(existing.FilterDefinition);
    const updateData = {
      Name: req.body.name ?? existing.Name,
      Description: req.body.description ?? existing.Description,
      FilterDefinition: filters,
      Status: req.body.status ?? existing.Status,
      Type: req.body.type ?? existing.Type ?? 'dynamic',
      UpdatedAt: new Date().toISOString()
    };
    const { data, error } = await supabase.from('Segments').update(updateData).eq('Id', id).select().single();
    if (error) throw error;
    const [offerCount, campaignCount] = await Promise.all([
      countOffersForSegment(req, data.FilterDefinition),
      countCampaignsForSegment(req, id)
    ]);
    res.json(mapSegment(data, offerCount, campaignCount));
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando segmento', details: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const campaignCount = await countCampaignsForSegment(req, id);
    if (campaignCount > 0) return res.status(409).json({ error: 'No se puede eliminar: hay campañas asociadas' });
    let deleteQ = supabase.from('Segments').delete().eq('Id', id);
    deleteQ = applyUserFilter(deleteQ, req);
    const { error } = await deleteQ;
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando segmento', details: error.message });
  }
});

router.get('/:id/estimate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let query = supabase.from('Segments').select('FilterDefinition').eq('Id', id);
    query = applyUserFilter(query, req);
    const { data, error } = await query.single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Segmento no encontrado' });
      throw error;
    }
    const count = await countOffersForSegment(req, data.FilterDefinition);
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: 'Error estimando ofertas', details: error.message });
  }
});

router.post('/:id/recalculate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let query = supabase.from('Segments').select('*').eq('Id', id);
    query = applyUserFilter(query, req);
    const { data: segment, error } = await query.single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Segmento no encontrado' });
      throw error;
    }
    const newCount = await countOffersForSegment(req, segment.FilterDefinition);
    await supabase.from('Segments').update({ UpdatedAt: new Date().toISOString() }).eq('Id', id);
    res.json({
      success: true,
      message: `Segmento "${segment.Name}" recalculado exitosamente`,
      data: { id, name: segment.Name, oldCount: 0, newCount, updatedAt: new Date().toISOString() }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error recalculando segmento', details: error.message });
  }
});

router.get('/:id/detail', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let query = supabase.from('Segments').select('*').eq('Id', id);
    query = applyUserFilter(query, req);
    const { data: segment, error } = await query.single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Segmento no encontrado' });
      throw error;
    }

    const { data: campaignSegments } = await supabase
      .from('CampaignSegments')
      .select('CampaignId, Campaigns(Id, Name, Status, StartDate, EndDate, CreatedAt)')
      .eq('SegmentId', id);

    let offersQ = applySegmentFilters(supabase.from('JobOffers').select('Id, ExternalId, Title, CompanyName, City, Region, Sector, Category, JobType, SalaryMin, SalaryMax, CreatedAt').limit(100), segment.FilterDefinition);
    offersQ = applyUserFilter(offersQ, req);
    const { data: offers, error: offersError } = await offersQ;
    if (offersError) throw offersError;

    const totalOffers = await countOffersForSegment(req, segment.FilterDefinition);
    res.json({
      segment: mapSegment(segment, totalOffers, campaignSegments?.length || 0),
      campaigns: (campaignSegments || []).map(cs => cs.Campaigns).filter(Boolean),
      sampleOffers: offers || [],
      totalOffers
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo detalle del segmento', details: error.message });
  }
});

router.post('/:id/duplicate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let query = supabase.from('Segments').select('*').eq('Id', id);
    query = applyUserFilter(query, req);
    const { data: original, error } = await query.single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Segmento no encontrado' });
      throw error;
    }
    const duplicateName = req.body?.name || `${original.Name} (Copia)`;
    const insertData = {
      UserId: req.userId,
      Name: duplicateName,
      Description: `${original.Description || ''} (Duplicado)`.trim(),
      Type: original.Type || 'dynamic',
      FilterDefinition: parseFilters(original.FilterDefinition),
      Status: 'active',
      CreatedByUserId: req.userId,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };
    const { data, error: insertError } = await supabase.from('Segments').insert(insertData).select().single();
    if (insertError) throw insertError;
    const offerCount = await countOffersForSegment(req, data.FilterDefinition);
    res.status(201).json({ success: true, message: `Segmento duplicado exitosamente como "${duplicateName}"`, data: mapSegment(data, offerCount, 0) });
  } catch (error) {
    res.status(500).json({ error: 'Error duplicando segmento', details: error.message });
  }
});

module.exports = router;
