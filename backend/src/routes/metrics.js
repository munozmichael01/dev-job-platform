const express = require('express');
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(addUserToRequest);
router.use(requireAuth);

const CHANNEL_META = {
  talent: { name: 'Talent.com', color: '#3b82f6' },
  jooble: { name: 'Jooble', color: '#10b981' },
  jobrapido: { name: 'JobRapido', color: '#8b5cf6' },
  whatjobs: { name: 'WhatJobs', color: '#f59e0b' },
  infojobs: { name: 'InfoJobs', color: '#ef4444' },
  linkedin: { name: 'LinkedIn', color: '#0077b5' },
  indeed: { name: 'Indeed', color: '#2557a7' }
};

function channelName(code) {
  return CHANNEL_META[String(code || '').toLowerCase()]?.name || code || 'Canal';
}

function channelColor(code) {
  return CHANNEL_META[String(code || '').toLowerCase()]?.color || '#6b7280';
}

async function scopedCount(table, req, filters = {}) {
  let query = supabase.from(table).select('Id', { count: 'exact', head: true });
  if (!isSuperAdmin(req)) query = query.eq('UserId', req.userId);
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query = query.eq(key, value);
  });
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

router.get('/dashboard', async (req, res) => {
  try {
    let campaignsQuery = supabase.from('Campaigns').select('Id, BudgetTotal, Status');
    let offersQuery = supabase.from('JobOffers').select('Id', { count: 'exact', head: true }).eq('Status', 'active');
    let channelQuery = supabase
      .from('CampaignChannels')
      .select('Id, CampaignId, Budget, Status, DistributionChannels(Code, Name)');

    if (!isSuperAdmin(req)) {
      campaignsQuery = campaignsQuery.eq('UserId', req.userId);
      offersQuery = offersQuery.eq('UserId', req.userId);
      const { data: userCampaigns, error: campaignIdError } = await supabase.from('Campaigns').select('Id').eq('UserId', req.userId);
      if (campaignIdError) throw campaignIdError;
      const ids = (userCampaigns || []).map(c => c.Id);
      channelQuery = ids.length > 0 ? channelQuery.in('CampaignId', ids) : null;
    }

    const [{ data: campaigns, error: campaignsError }, { count: activeOffers, error: offersError }] = await Promise.all([
      campaignsQuery,
      offersQuery
    ]);
    if (campaignsError) throw campaignsError;
    if (offersError) throw offersError;

    const { data: channels, error: channelsError } = channelQuery
      ? await channelQuery.eq('Status', 'active')
      : { data: [], error: null };
    if (channelsError) throw channelsError;

    const activeCampaigns = (campaigns || []).filter(c => c.Status === 'active').length;
    const totalBudget = (campaigns || []).reduce((sum, c) => sum + Number(c.BudgetTotal || 0), 0);
    const byChannel = new Map();
    (channels || []).forEach(row => {
      const code = row.DistributionChannels?.Code || String(row.ChannelId || 'unknown');
      const prev = byChannel.get(code) || { value: 0, campaigns: 0 };
      byChannel.set(code, { value: prev.value + Number(row.Budget || 0), campaigns: prev.campaigns + 1 });
    });

    const budgetDistribution = Array.from(byChannel.entries()).map(([code, item]) => ({
      name: channelName(code),
      value: item.value,
      spent: 0,
      campaigns: item.campaigns,
      color: channelColor(code)
    }));

    const applicationsDistribution = budgetDistribution.map(item => ({
      name: item.name,
      value: 0,
      campaigns: item.campaigns,
      color: item.color
    }));

    res.json({
      success: true,
      data: {
        budgetDistribution,
        applicationsDistribution,
        generalMetrics: {
          activeCampaigns,
          activeOffers: activeOffers || 0,
          totalBudget,
          totalSpent: 0,
          totalApplications: 0,
          avgCPA: 0,
          spentPercentage: 0
        },
        channelPerformance: [],
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Error obteniendo métricas del dashboard:', error.message);
    res.status(500).json({ success: false, error: 'Error obteniendo métricas del dashboard', details: error.message });
  }
});

module.exports = router;
