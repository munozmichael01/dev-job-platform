const express = require('express');
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(addUserToRequest);
router.use(requireAuth);

function applyUserScope(query, req) {
  return isSuperAdmin(req) ? query : query.eq('UserId', req.userId);
}

function mapOffer(row) {
  return {
    ...row,
    StatusId: row.Status === 'paused' ? 2 : row.Status === 'archived' ? 3 : row.Status === 'completed' ? 4 : 1
  };
}

router.get('/unassigned', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    let query = supabase
      .from('JobOffers')
      .select('Id, ExternalId, Title, CompanyName, City, Region, Sector, SalaryMin, SalaryMax, CreatedAt, Status', { count: 'exact' })
      .eq('Status', 'active')
      .order('CreatedAt', { ascending: false })
      .range(offset, offset + limit - 1);
    query = applyUserScope(query, req);
    const { data, count, error } = await query;
    if (error) throw error;
    res.json({
      success: true,
      data: {
        offers: (data || []).map(mapOffer),
        totalCount: count || 0,
        limit,
        offset,
        timestamp: new Date().toISOString(),
        queryTimeMs: 0
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo ofertas sin campaña:', error.message);
    res.status(500).json({ success: false, error: 'Error obteniendo ofertas sin campaña activa', details: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    let query = supabase.from('JobOffers').select('Id', { count: 'exact', head: true }).eq('Status', 'active');
    query = applyUserScope(query, req);
    const { count, error } = await query;
    if (error) throw error;
    const totalActiveOffers = count || 0;
    res.json({
      success: true,
      data: {
        totalActiveOffers,
        offersInActiveCampaigns: 0,
        unassignedOffers: totalActiveOffers,
        timestamp: new Date().toISOString(),
        queryTimeMs: 0,
        reason: 'clean_schema_safe_stats'
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de ofertas:', error.message);
    res.status(500).json({ success: false, error: 'Error obteniendo estadísticas de ofertas', details: error.message });
  }
});

module.exports = router;
