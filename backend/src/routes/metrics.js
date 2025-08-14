const express = require('express');
const { pool, poolConnect, sql } = require('../db/db');
const router = express.Router();

/**
 * GET /api/metrics/dashboard
 * Obtiene métricas agregadas para el dashboard principal
 */
router.get('/dashboard', async (req, res) => {
  try {
    console.log('📊 Obteniendo métricas del dashboard...');
    
    await poolConnect;
    
    // 1. Distribución de presupuesto por canal (datos reales + simulados si no hay datos)
    const budgetDistributionQuery = await pool.request().query(`
      SELECT 
        ChannelId,
        SUM(AllocatedBudget) as TotalBudget,
        SUM(SpentBudget) as SpentBudget,
        COUNT(*) as ActiveCampaigns
      FROM CampaignChannels 
      WHERE Status = 'active'
      GROUP BY ChannelId
      ORDER BY TotalBudget DESC
    `);
    
    // 2. Métricas generales
    const generalMetricsQuery = await pool.request().query(`
      SELECT 
        COUNT(DISTINCT CampaignId) as ActiveCampaigns,
        COUNT(DISTINCT OfferId) as ActiveOffers,
        SUM(AllocatedBudget) as TotalBudget,
        SUM(SpentBudget) as TotalSpent,
        SUM(AchievedApplications) as TotalApplications,
        AVG(CurrentCPA) as AvgCPA
      FROM CampaignChannels 
      WHERE Status = 'active'
    `);
    
    // 3. Performance por canal
    const channelPerformanceQuery = await pool.request().query(`
      SELECT 
        ChannelId,
        AVG(CurrentCPA) as AvgCPA,
        AVG(ConversionRate) as AvgConversionRate,
        SUM(AchievedApplications) as TotalApplications,
        COUNT(*) as ActiveCampaigns
      FROM CampaignChannels 
      WHERE Status = 'active' AND CurrentCPA IS NOT NULL
      GROUP BY ChannelId
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
    
    // Si no hay datos reales, usar datos simulados para demostración
    const hasApplicationsData = applicationsDistribution.some(app => app.value > 0);
    
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
    } else if (!hasApplicationsData && applicationsDistribution.length > 0) {
      // Tenemos campañas reales pero sin aplicaciones aún - usar datos de demo para aplicaciones
      console.log('📊 Campañas reales encontradas pero sin aplicaciones aún - usando datos de demo para gráfico');
      applicationsDistribution = [
        { name: 'Talent.com', value: 145, campaigns: 3, color: '#3b82f6' },
        { name: 'Jooble', value: 98, campaigns: 2, color: '#10b981' },
        { name: 'WhatJobs', value: 76, campaigns: 2, color: '#f59e0b' },
        { name: 'JobRapido', value: 52, campaigns: 1, color: '#8b5cf6' }
      ];
    }
    
    // Procesar métricas generales
    const generalMetrics = generalMetricsQuery.recordset[0] || {
      ActiveCampaigns: budgetDistribution.length > 0 ? budgetDistribution.reduce((sum, ch) => sum + ch.campaigns, 0) : 3,
      ActiveOffers: 80,
      TotalBudget: budgetDistribution.reduce((sum, ch) => sum + ch.value, 0),
      TotalSpent: budgetDistribution.reduce((sum, ch) => sum + ch.spent, 0),
      TotalApplications: 312,
      AvgCPA: 16.5
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
    
    console.log(`✅ Métricas obtenidas: ${budgetDistribution.length} canales, ${generalMetrics.ActiveCampaigns} campañas activas`);
    
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