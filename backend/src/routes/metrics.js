const express = require('express');
const { pool, poolConnect, sql } = require('../db/db');
const { addUserToRequest, requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas  
router.use(addUserToRequest);
router.use(requireAuth);

/**
 * GET /api/metrics/dashboard
 * Obtiene métricas agregadas para el dashboard principal
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`📊 Obteniendo métricas del dashboard para usuario ${userId}...`);
    
    await poolConnect;
    
    // 1. Distribución de presupuesto por canal (filtrado por UserId)
    const budgetDistributionQuery = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
      SELECT 
        cc.ChannelId,
        SUM(cc.AllocatedBudget) as TotalBudget,
        SUM(cc.SpentBudget) as SpentBudget,
        COUNT(*) as ActiveCampaigns
      FROM CampaignChannels cc
      INNER JOIN Campaigns c ON cc.CampaignId = c.Id
      WHERE cc.Status = 'active' AND c.UserId = @userId
      GROUP BY cc.ChannelId
      ORDER BY TotalBudget DESC
    `);
    
    // 2. Métricas generales (filtrado por UserId)
    const generalMetricsQuery = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
      SELECT 
        COUNT(DISTINCT cc.CampaignId) as ActiveCampaigns,
        COUNT(DISTINCT cc.OfferId) as ActiveOffers,
        SUM(cc.AllocatedBudget) as TotalBudget,
        SUM(cc.SpentBudget) as TotalSpent,
        SUM(cc.AchievedApplications) as TotalApplications,
        AVG(CASE WHEN cc.CurrentCPA > 0 THEN cc.CurrentCPA END) as AvgCPA
      FROM CampaignChannels cc
      INNER JOIN Campaigns c ON cc.CampaignId = c.Id
      WHERE cc.Status = 'active' AND c.UserId = @userId
    `);
    
    // 3. Performance por canal (filtrado por UserId)
    const channelPerformanceQuery = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
      SELECT 
        cc.ChannelId,
        AVG(CASE WHEN cc.CurrentCPA > 0 THEN cc.CurrentCPA END) as AvgCPA,
        AVG(CASE WHEN cc.ConversionRate > 0 THEN cc.ConversionRate END) as AvgConversionRate,
        SUM(cc.AchievedApplications) as TotalApplications,
        COUNT(*) as ActiveCampaigns
      FROM CampaignChannels cc
      INNER JOIN Campaigns c ON cc.CampaignId = c.Id
      WHERE cc.Status = 'active' AND c.UserId = @userId AND cc.CurrentCPA IS NOT NULL
      GROUP BY cc.ChannelId
    `);
    
    // Procesar datos de distribución de presupuesto
    let budgetDistribution = budgetDistributionQuery.recordset.map(row => ({
      name: getChannelDisplayName(row.ChannelId),
      value: parseFloat(row.TotalBudget || 0),
      spent: parseFloat(row.SpentBudget || 0),
      campaigns: row.ActiveCampaigns,
      color: getChannelColor(row.ChannelId)
    }));

    // Crear distribución de aplicaciones basada en performance por canal
    let applicationsDistribution = channelPerformanceQuery.recordset.map(row => ({
      name: getChannelDisplayName(row.ChannelId),
      value: parseInt(row.TotalApplications || 0),
      campaigns: row.ActiveCampaigns,
      color: getChannelColor(row.ChannelId)
    }));
    
    // Si no hay datos reales de campañas, usar datos simulados
    if (budgetDistribution.length === 0) {
      console.log('⚠️ No hay datos reales de campañas, usando datos simulados para demo');
      budgetDistribution = [
        { name: 'Talent.com', value: 1850, spent: 650, campaigns: 3, color: '#3b82f6' },
        { name: 'Jooble', value: 1200, spent: 420, campaigns: 2, color: '#10b981' },
        { name: 'WhatJobs', value: 950, spent: 280, campaigns: 2, color: '#f59e0b' },
        { name: 'JobRapido', value: 800, spent: 150, campaigns: 1, color: '#8b5cf6' }
      ];
      
      applicationsDistribution = [
        { name: 'Talent.com', value: 145, campaigns: 3, color: '#3b82f6' },
        { name: 'Jooble', value: 98, campaigns: 2, color: '#10b981' },
        { name: 'WhatJobs', value: 76, campaigns: 2, color: '#f59e0b' },
        { name: 'JobRapido', value: 52, campaigns: 1, color: '#8b5cf6' }
      ];
    }
    
    // Si tenemos distribución de presupuesto pero no aplicaciones reales, mostrar 0 aplicaciones por canal
    const hasApplicationsData = applicationsDistribution.some(app => app.value > 0);
    if (budgetDistribution.length > 0 && !hasApplicationsData) {
      console.log('📊 Usando datos reales de campañas, mostrando 0 aplicaciones por canal (aún no hay aplicaciones)');
      applicationsDistribution = budgetDistribution.map(budget => ({
        name: budget.name,
        value: 0,
        campaigns: budget.campaigns,
        color: budget.color
      }));
    }
    
    // Calcular ofertas activas reales del usuario
    const activeOffersQuery = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
      SELECT COUNT(DISTINCT jo.Id) as ActiveOffers
      FROM JobOffers jo
      INNER JOIN CampaignChannels cc ON jo.Id = cc.OfferId
      INNER JOIN Campaigns c ON cc.CampaignId = c.Id
      WHERE cc.Status = 'active' AND c.UserId = @userId
    `);
    
    // Procesar métricas generales con datos reales
    const generalMetricsRaw = generalMetricsQuery.recordset[0];
    const activeOffersCount = activeOffersQuery.recordset[0]?.ActiveOffers || 0;
    
    const generalMetrics = {
      ActiveCampaigns: parseInt(generalMetricsRaw?.ActiveCampaigns || 0),
      ActiveOffers: parseInt(activeOffersCount),
      TotalBudget: parseFloat(generalMetricsRaw?.TotalBudget || 0),
      TotalSpent: parseFloat(generalMetricsRaw?.TotalSpent || 0),
      TotalApplications: parseInt(generalMetricsRaw?.TotalApplications || 0),
      AvgCPA: parseFloat(generalMetricsRaw?.AvgCPA || 0)
    };
    
    // Procesar performance por canal
    const channelPerformance = channelPerformanceQuery.recordset.map(row => ({
      channelId: row.ChannelId,
      name: getChannelDisplayName(row.ChannelId),
      avgCPA: parseFloat(row.AvgCPA || 0),
      conversionRate: parseFloat(row.AvgConversionRate || 0),
      applications: row.TotalApplications,
      campaigns: row.ActiveCampaigns
    }));
    
    console.log(`✅ Métricas obtenidas para usuario ${userId}: ${budgetDistribution.length} canales, ${generalMetrics.ActiveCampaigns} campañas activas, ${generalMetrics.ActiveOffers} ofertas activas`);
    
    res.json({
      success: true,
      data: {
        budgetDistribution,
        applicationsDistribution,
        generalMetrics: {
          activeCampaigns: parseInt(generalMetrics.ActiveCampaigns || 0),
          activeOffers: parseInt(generalMetrics.ActiveOffers || 0),
          totalBudget: parseFloat(generalMetrics.TotalBudget || 0),
          totalSpent: parseFloat(generalMetrics.TotalSpent || 0),
          totalApplications: parseInt(generalMetrics.TotalApplications || 0),
          avgCPA: parseFloat(generalMetrics.AvgCPA || 0),
          spentPercentage: generalMetrics.TotalBudget > 0 ? 
            Math.round((generalMetrics.TotalSpent / generalMetrics.TotalBudget) * 100) : 0
        },
        channelPerformance,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo métricas del dashboard:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo métricas del dashboard',
      details: error.message
    });
  }
});

// Funciones auxiliares
function getChannelDisplayName(channelId) {
  const names = {
    'talent': 'Talent.com',
    'jooble': 'Jooble',
    'jobrapido': 'JobRapido',
    'whatjobs': 'WhatJobs',
    'infojobs': 'InfoJobs',
    'linkedin': 'LinkedIn',
    'indeed': 'Indeed'
  };
  return names[channelId?.toLowerCase()] || channelId;
}

function getChannelColor(channelId) {
  const colors = {
    'talent': '#3b82f6',    // Blue
    'jooble': '#10b981',    // Green
    'jobrapido': '#8b5cf6', // Purple
    'whatjobs': '#f59e0b',  // Orange
    'infojobs': '#ef4444',  // Red
    'linkedin': '#0077b5',  // LinkedIn Blue
    'indeed': '#2557a7'     // Indeed Blue
  };
  return colors[channelId?.toLowerCase()] || '#6b7280';
}

module.exports = router;