const express = require('express');
const router = express.Router();
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');

// ─── In-memory cache (5-10 min TTL, same pattern as index.js) ────────────────

const filterCache = {
  locations:  { data: null, timestamp: 0, ttl: 5  * 60 * 1000 },
  sectors:    { data: null, timestamp: 0, ttl: 5  * 60 * 1000 },
  companies:  { data: null, timestamp: 0, ttl: 5  * 60 * 1000 },
  externalIds:{ data: null, timestamp: 0, ttl: 10 * 60 * 1000 }
};

function getCache(key) {
  const c = filterCache[key];
  if (c?.data && Date.now() - c.timestamp < c.ttl) {
    console.log(`📦 Cache HIT para ${key}`);
    return c.data;
  }
  return null;
}

function setCache(key, data) {
  filterCache[key].data = data;
  filterCache[key].timestamp = Date.now();
  console.log(`💾 Cache SET para ${key} con ${data.length} elementos`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_MAP = { active: 1, pending: 3, paused: 2, archived: 5 };
// NOTE: locations/sectors/external-ids filters in the legacy code used pending=2, paused=3
// (inconsistent with the main GET). Preserved here as STATUS_MAP (main GET values)
// to be consistent. Codex should decide canonical mapping before agents read these.

function mapStatus(statusId) {
  if (statusId === 1) return 'active';
  if (statusId === 2) return 'paused';
  if (statusId === 5) return 'archived';
  return 'pending';
}

function formatSalary(min, max) {
  if (min && max && min > 0 && max > 0) return `${Math.round(min).toLocaleString('es')}-${Math.round(max).toLocaleString('es')}€`;
  if (min && min > 0) return `Desde ${Math.round(min).toLocaleString('es')}€`;
  if (max && max > 0) return `Hasta ${Math.round(max).toLocaleString('es')}€`;
  return 'No especificado';
}

function formatLocation(city, region) {
  if (city && region && region.trim()) return `${city}, ${region}`;
  return city || region || null;
}

function mapOffer(row) {
  return {
    id: row.Id,
    ExternalId: row.ExternalId,
    title: row.Title,
    company: row.CompanyName,
    sector: row.Sector,
    City: row.City,
    Region: row.Region,
    location: formatLocation(row.City, row.Region),
    SalaryMin: row.SalaryMin,
    SalaryMax: row.SalaryMax,
    salary: formatSalary(row.SalaryMin, row.SalaryMax),
    type: row.JobType || 'No especificado',
    publishDate: row.PublicationDate,
    CreatedAt: row.CreatedAt,
    StatusId: row.StatusId,
    status: mapStatus(row.StatusId),
    campaignCount: 0,
    segmentCount: 0,
    promotion: 'Sin campañas',
    campaigns: null,
    segments: null,
    totalBudget: row.Budget || 10,
    budgetSpent: row.BudgetSpent || 0,
    targetApplications: row.ApplicationsGoal || 50,
    applicationsReceived: row.ApplicationsReceived || 0,
    performance: row.Budget > 0
      ? `€${Math.round(row.BudgetSpent || 0)}/${Math.round(row.Budget || 0)}, ${row.ApplicationsReceived || 0}/${row.ApplicationsGoal || 0} inscr.`
      : 'Sin datos'
  };
}

function emptyState(page, limit, filters) {
  return {
    success: true,
    data: [], items: [],
    hasMore: false, total: 0, next: null,
    pagination: { page, limit, total: 0, pages: 0, hasMore: false, lastCreatedAt: null, lastId: null },
    stats: { totalOffers: 0, activeOffers: 0, pendingOffers: 0, pausedOffers: 0, totalSectors: 0, totalCities: 0 },
    filters
  };
}

// Apply user filter to a Supabase query (non-superadmin sees only own offers)
function applyUserFilter(query, req) {
  if (!isSuperAdmin(req)) {
    return query.eq('UserId', req.userId);
  }
  return query;
}

// ─── GET /job-offers/locations ────────────────────────────────────────────────

router.get('/job-offers/locations', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const { status, sector, company, externalId, q } = req.query;
    const hasFilters = status || sector || company || externalId || q;

    if (!hasFilters) {
      const cached = getCache('locations');
      if (cached) return res.json({ success: true, data: cached });
    }

    let query = supabase
      .from('JobOffers')
      .select('City, Region')
      .or('City.not.is.null,Region.not.is.null');

    query = applyUserFilter(query, req);

    if (status && status !== 'all' && STATUS_MAP[status]) {
      query = query.eq('StatusId', STATUS_MAP[status]);
    }
    if (sector && sector !== 'all') query = query.eq('Sector', sector);
    if (externalId && externalId !== 'all') query = query.ilike('ExternalId', `%${externalId.trim()}%`);
    if (company && company !== 'all') query = query.ilike('CompanyName', `%${company.trim()}%`);
    if (q?.trim()) query = query.or(`Title.ilike.%${q.trim()}%,CompanyName.ilike.%${q.trim()}%`);

    const { data, error } = await query;
    if (error) throw error;

    const locations = [...new Set(
      (data || []).map(r => formatLocation(r.City, r.Region)).filter(Boolean)
    )].sort();

    if (!hasFilters) setCache('locations', locations);
    res.json({ success: true, data: locations });

  } catch (error) {
    console.error('Error getting locations:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── GET /job-offers/sectors ──────────────────────────────────────────────────

router.get('/job-offers/sectors', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const { status, location, company, externalId, q } = req.query;
    const hasFilters = status || location || company || externalId || q;

    if (!hasFilters) {
      const cached = getCache('sectors');
      if (cached) return res.json({ success: true, data: cached });
    }

    let query = supabase
      .from('JobOffers')
      .select('Sector')
      .not('Sector', 'is', null)
      .neq('Sector', '');

    query = applyUserFilter(query, req);

    if (status && status !== 'all' && STATUS_MAP[status]) query = query.eq('StatusId', STATUS_MAP[status]);
    if (location && location !== 'all') query = query.or(`City.ilike.%${location}%,Region.ilike.%${location}%`);
    if (externalId && externalId !== 'all') query = query.ilike('ExternalId', `%${externalId.trim()}%`);
    if (company && company !== 'all') query = query.ilike('CompanyName', `%${company.trim()}%`);
    if (q?.trim()) query = query.or(`Title.ilike.%${q.trim()}%,CompanyName.ilike.%${q.trim()}%`);

    const { data, error } = await query;
    if (error) throw error;

    const sectors = [...new Set((data || []).map(r => r.Sector).filter(Boolean))].sort();

    if (!hasFilters) setCache('sectors', sectors);
    res.json({ success: true, data: sectors });

  } catch (error) {
    console.error('Error getting sectors:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── GET /job-offers/external-ids ────────────────────────────────────────────

router.get('/job-offers/external-ids', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const { status, location, sector, company, q } = req.query;
    const hasFilters = status || location || sector || company || q;

    if (!hasFilters) {
      const cached = getCache('externalIds');
      if (cached) return res.json({ success: true, data: cached });
    }

    let query = supabase
      .from('JobOffers')
      .select('ExternalId')
      .not('ExternalId', 'is', null)
      .neq('ExternalId', '');

    query = applyUserFilter(query, req);

    if (status && status !== 'all' && STATUS_MAP[status]) query = query.eq('StatusId', STATUS_MAP[status]);
    if (location && location !== 'all') query = query.or(`City.ilike.%${location}%,Region.ilike.%${location}%`);
    if (sector && sector !== 'all') query = query.eq('Sector', sector);
    if (company && company !== 'all') query = query.ilike('CompanyName', `%${company.trim()}%`);
    if (q?.trim()) query = query.or(`Title.ilike.%${q.trim()}%,CompanyName.ilike.%${q.trim()}%`);

    const { data, error } = await query;
    if (error) throw error;

    const externalIds = [...new Set((data || []).map(r => r.ExternalId).filter(Boolean))].sort();

    if (!hasFilters) setCache('externalIds', externalIds);
    res.json({ success: true, data: externalIds });

  } catch (error) {
    console.error('Error getting external IDs:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── GET /job-offers/job-types ────────────────────────────────────────────────

router.get('/job-offers/job-types', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('JobOffers')
      .select('JobType')
      .eq('StatusId', 1)
      .not('JobType', 'is', null)
      .neq('JobType', '');

    if (error) throw error;

    const types = [...new Set((data || []).map(r => r.JobType).filter(Boolean))].sort();
    res.json({ success: true, data: types });

  } catch (error) {
    console.error('Error getting job types:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── GET /job-offers/companies ────────────────────────────────────────────────

router.get('/job-offers/companies', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const { status, location, sector, externalId, q } = req.query;
    const hasFilters = status || location || sector || externalId || q;

    if (!hasFilters) {
      const cached = getCache('companies');
      if (cached) return res.json({ success: true, data: cached });
    }

    let query = supabase
      .from('JobOffers')
      .select('CompanyName')
      .not('CompanyName', 'is', null)
      .neq('CompanyName', '');

    query = applyUserFilter(query, req);

    if (status && status !== 'all' && STATUS_MAP[status]) query = query.eq('StatusId', STATUS_MAP[status]);
    if (location && location !== 'all') query = query.or(`City.ilike.%${location}%,Region.ilike.%${location}%`);
    if (sector && sector !== 'all') query = query.ilike('Sector', `%${sector}%`);
    if (externalId && externalId !== 'all') query = query.ilike('ExternalId', `%${externalId.trim()}%`);
    if (q?.trim()) query = query.or(`Title.ilike.%${q.trim()}%,CompanyName.ilike.%${q.trim()}%`);

    const { data, error } = await query;
    if (error) throw error;

    const companies = [...new Set((data || []).map(r => r.CompanyName).filter(Boolean))].sort();

    if (!hasFilters) setCache('companies', companies);
    res.json({ success: true, data: companies });

  } catch (error) {
    console.error('Error getting companies:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── GET /job-offers ──────────────────────────────────────────────────────────

router.get('/job-offers', addUserToRequest, requireAuth, async (req, res) => {
  req.setTimeout(30000);
  res.setTimeout(30000);

  try {
    const {
      q: search, status, location, sector, company, externalId, promocion,
      sortBy = 'CreatedAt', sortOrder = 'DESC',
      limit = 20, page = 1,
      lastCreatedAt, lastId
    } = req.query;

    const cleanSearch    = search?.trim()     || null;
    const cleanStatus    = status && status !== 'all'       ? status    : null;
    const cleanLocation  = location && location !== 'all'   ? location.trim()  : null;
    const cleanSector    = sector && sector !== 'all'       ? sector.trim()    : null;
    const cleanCompany   = company && company !== 'all'     ? company.trim()   : null;
    const cleanExternalId = externalId && externalId !== 'all' ? externalId.trim() : null;
    const cleanPromocion = promocion && promocion !== 'all' ? promocion : null;

    const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const validatedPage  = Math.max(parseInt(page) || 1, 1);
    const offset         = (validatedPage - 1) * validatedLimit;

    const usingKeyset = Boolean(lastCreatedAt && lastId);

    console.log(`🔍 GET /job-offers - Usuario: ${req.user.email} (${req.user.role}) - Page: ${validatedPage}`);

    // ── Early empty state for non-superadmin users with no offers ──────────────
    if (!isSuperAdmin(req)) {
      const { count: userTotal, error: countErr } = await supabase
        .from('JobOffers')
        .select('Id', { count: 'exact', head: true })
        .eq('UserId', req.userId);

      if (!countErr && (userTotal || 0) === 0) {
        console.log(`✅ Usuario ${req.userId} sin ofertas: devolviendo empty state`);
        return res.json(emptyState(validatedPage, validatedLimit, {
          search: cleanSearch, status: cleanStatus || 'all',
          location: cleanLocation || 'all', sector: cleanSector || 'all',
          externalId: cleanExternalId || 'all'
        }));
      }
    }

    // ── Build base query ───────────────────────────────────────────────────────
    const SELECT_FIELDS = 'Id, ExternalId, Title, CompanyName, Sector, City, Region, SalaryMin, SalaryMax, JobType, PublicationDate, CreatedAt, StatusId, Budget, BudgetSpent, ApplicationsGoal, ApplicationsReceived, Vacancies';

    function buildFilters(q) {
      if (!isSuperAdmin(req)) q = q.eq('UserId', req.userId);
      if (cleanStatus && STATUS_MAP[cleanStatus]) q = q.eq('StatusId', STATUS_MAP[cleanStatus]);
      if (cleanLocation) q = q.or(`City.ilike.%${cleanLocation}%,Region.ilike.%${cleanLocation}%`);
      if (cleanSector)   q = q.ilike('Sector', `%${cleanSector}%`);
      if (cleanCompany)  q = q.ilike('CompanyName', `%${cleanCompany}%`);
      if (cleanExternalId) q = q.ilike('ExternalId', `%${cleanExternalId}%`);
      if (cleanSearch) {
        q = q.or(`Title.ilike.%${cleanSearch}%,CompanyName.ilike.%${cleanSearch}%,Sector.ilike.%${cleanSearch}%,City.ilike.%${cleanSearch}%,Region.ilike.%${cleanSearch}%`);
      }
      return q;
    }

    // ── Promocion filter (two-step: get eligible offer IDs first) ──────────────
    let promocionIds = null;
    if (cleanPromocion) {
      const { data: campaigns } = await supabase.from('Campaigns').select('Id, Status');
      const activeCampaignIds   = (campaigns || []).filter(c => c.Status === 'active').map(c => c.Id);
      const inactiveCampaignIds = (campaigns || []).filter(c => c.Status !== 'active').map(c => c.Id);

      if (cleanPromocion === 'promocionandose') {
        const { data: rels } = await supabase.from('CampaignChannels').select('OfferId').in('CampaignId', activeCampaignIds.length ? activeCampaignIds : [-1]);
        promocionIds = { in: [...new Set((rels || []).map(r => r.OfferId))] };
      } else if (cleanPromocion === 'preparada') {
        const { data: rels } = await supabase.from('CampaignChannels').select('OfferId').in('CampaignId', inactiveCampaignIds.length ? inactiveCampaignIds : [-1]);
        promocionIds = { in: [...new Set((rels || []).map(r => r.OfferId))] };
      } else if (cleanPromocion === 'categorizada') {
        const [{ data: activeRels }, { data: inactiveRels }] = await Promise.all([
          supabase.from('CampaignChannels').select('OfferId').in('CampaignId', activeCampaignIds.length ? activeCampaignIds : [-1]),
          supabase.from('CampaignChannels').select('OfferId').in('CampaignId', inactiveCampaignIds.length ? inactiveCampaignIds : [-1])
        ]);
        const activeSet   = new Set((activeRels  || []).map(r => r.OfferId));
        const inactiveSet = new Set((inactiveRels || []).map(r => r.OfferId));
        const categorized = [...inactiveSet].filter(id => !activeSet.has(id));
        promocionIds = { in: categorized };
      } else if (cleanPromocion === 'sin-promocion') {
        const { data: allRels } = await supabase.from('CampaignChannels').select('OfferId');
        const inCampaign = new Set((allRels || []).map(r => r.OfferId));
        promocionIds = { notIn: [...inCampaign] };
      }
    }

    // ── Count query ────────────────────────────────────────────────────────────
    let countQ = buildFilters(supabase.from('JobOffers').select('Id', { count: 'exact', head: true }));
    if (promocionIds?.in?.length)    countQ = countQ.in('Id', promocionIds.in);
    if (promocionIds?.notIn?.length) countQ = countQ.not('Id', 'in', `(${promocionIds.notIn.join(',')})`);
    if (promocionIds?.in?.length === 0 && cleanPromocion) {
      return res.json(emptyState(validatedPage, validatedLimit, {
        search: cleanSearch, status: cleanStatus || 'all',
        location: cleanLocation || 'all', sector: cleanSector || 'all',
        externalId: cleanExternalId || 'all'
      }));
    }

    const { count: totalCount, error: countError } = await countQ;
    if (countError) throw countError;
    const total = totalCount || 0;

    // ── Main data query ────────────────────────────────────────────────────────
    const allowedSortFields = { CreatedAt: 'CreatedAt', Title: 'Title', CompanyName: 'CompanyName', StatusId: 'StatusId', PublicationDate: 'PublicationDate' };
    const validSortBy    = allowedSortFields[sortBy] || 'CreatedAt';
    const ascending      = sortOrder.toUpperCase() === 'ASC';

    let dataQ = buildFilters(supabase.from('JobOffers').select(SELECT_FIELDS));

    if (promocionIds?.in?.length)    dataQ = dataQ.in('Id', promocionIds.in);
    if (promocionIds?.notIn?.length) dataQ = dataQ.not('Id', 'in', `(${promocionIds.notIn.join(',')})`);

    dataQ = dataQ.order(validSortBy, { ascending }).order('Id', { ascending: false });

    if (usingKeyset && lastCreatedAt && lastId) {
      const parsedDate = new Date(decodeURIComponent(lastCreatedAt));
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid lastCreatedAt parameter' });
      }
      // Cursor: rows older than cursor (simplified — handles common case, not tied timestamps)
      dataQ = dataQ.lt('CreatedAt', parsedDate.toISOString()).limit(validatedLimit);
    } else {
      dataQ = dataQ.range(offset, offset + validatedLimit - 1);
    }

    const { data: rawOffers, error: dataError } = await dataQ;
    if (dataError) throw dataError;

    const offers = (rawOffers || []).map(mapOffer);

    // ── Stats (parallel count queries) ────────────────────────────────────────
    const statsBase = () => {
      const q = supabase.from('JobOffers').select('Id', { count: 'exact', head: true });
      return isSuperAdmin(req) ? q : q.eq('UserId', req.userId);
    };

    const [statTotal, statActive, statPending, statPaused] = await Promise.all([
      statsBase(),
      statsBase().eq('StatusId', 1),
      statsBase().eq('StatusId', 3),
      statsBase().eq('StatusId', 2)
    ]);

    const stats = {
      totalOffers:   statTotal.count  || 0,
      activeOffers:  statActive.count || 0,
      pendingOffers: statPending.count || 0,
      pausedOffers:  statPaused.count || 0,
      totalSectors:  0, // computed client-side or deferred
      totalCities:   0
    };

    // ── Pagination cursors ─────────────────────────────────────────────────────
    const hasMore = usingKeyset ? offers.length === validatedLimit : offset + offers.length < total;
    const lastOffer = offers.length > 0 ? offers[offers.length - 1] : null;
    const nextCursor = hasMore && lastOffer
      ? { lastCreatedAt: lastOffer.CreatedAt, lastId: lastOffer.id }
      : null;

    console.log(`✅ Encontradas ${offers.length} ofertas (${total} total)`);

    res.json({
      success: true,
      data: offers, items: offers,
      hasMore, total,
      next: nextCursor,
      pagination: {
        page: validatedPage, limit: validatedLimit, total,
        pages: Math.ceil(total / validatedLimit),
        hasMore,
        lastCreatedAt: nextCursor?.lastCreatedAt || null,
        lastId: nextCursor?.lastId || null
      },
      stats,
      filters: {
        search: cleanSearch || null,
        status: cleanStatus || 'all',
        location: cleanLocation || 'all',
        sector: cleanSector || 'all',
        externalId: cleanExternalId || 'all'
      }
    });

  } catch (error) {
    console.error('❌ Error listando ofertas:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── PUT /job-offers/:id/status ───────────────────────────────────────────────

router.put('/job-offers/:id/status', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const offerId  = parseInt(req.params.id);
    const newStatus = parseInt(req.body.status);

    if (!offerId || isNaN(offerId)) {
      return res.status(400).json({ success: false, error: 'ID de oferta inválido' });
    }
    if (![1, 2, 3].includes(newStatus)) {
      return res.status(400).json({ success: false, error: 'Estado inválido. Use: 1=activa, 2=pausada, 3=archivada' });
    }

    let checkQ = supabase.from('JobOffers').select('Id, Title, StatusId').eq('Id', offerId);
    if (!isSuperAdmin(req)) checkQ = checkQ.eq('UserId', req.userId);

    const { data: found, error: checkErr } = await checkQ.limit(1);
    if (checkErr) throw checkErr;
    if (!found || found.length === 0) {
      return res.status(404).json({ success: false, error: 'Oferta no encontrada' });
    }

    const current = found[0];
    const { error: updateErr } = await supabase
      .from('JobOffers')
      .update({ StatusId: newStatus, UpdatedAt: new Date().toISOString() })
      .eq('Id', offerId);

    if (updateErr) throw updateErr;

    const statusNames = { 1: 'activada', 2: 'pausada', 3: 'archivada' };
    console.log(`✅ Oferta "${current.Title}" ${statusNames[newStatus]}`);

    res.json({
      success: true,
      message: `Oferta "${current.Title}" ${statusNames[newStatus]} correctamente`,
      data: { id: offerId, previousStatus: current.StatusId, newStatus, title: current.Title }
    });

  } catch (error) {
    console.error('❌ Error al cambiar estado de oferta:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── POST /job-offers ─────────────────────────────────────────────────────────

router.post('/job-offers', async (req, res) => {
  try {
    const {
      ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address,
      Country, CountryId, Region, RegionId, City, CityId, Postcode,
      Latitude, Longitude, Vacancies, SalaryMin, SalaryMax, JobType,
      ExternalUrl, ApplicationUrl, Budget, ApplicationsGoal, PublicationDate,
      UserId = 1
    } = req.body;

    const { error } = await supabase.from('JobOffers').insert({
      ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address,
      Country, CountryId, Region, RegionId, City, CityId, Postcode,
      Latitude, Longitude, Vacancies, SalaryMin, SalaryMax, JobType,
      ExternalUrl, ApplicationUrl, Budget, ApplicationsGoal,
      PublicationDate: PublicationDate ? new Date(PublicationDate).toISOString() : null,
      UserId,
      CreatedAt: new Date().toISOString()
    });

    if (error) throw error;
    res.status(201).json({ message: 'Job offer created successfully' });

  } catch (error) {
    console.error('❌ Error insertando oferta:', error.message);
    res.status(500).json({ error: 'Failed to insert job offer', details: error.message });
  }
});

module.exports = router;
