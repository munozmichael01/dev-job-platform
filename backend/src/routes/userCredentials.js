const express = require('express');
const router = express.Router();
const CredentialsManager = require('../services/credentialsManager');
const { supabase } = require('../db/db');
const { addUserToRequest, requireAuth, isSuperAdmin } = require('../middleware/authMiddleware');

const credentialsManager = new CredentialsManager();

const CHANNEL_INFO = {
  jooble: { name: 'Jooble', type: 'CPC', description: 'Motor de búsqueda de empleo global con modelo CPC', requiredCredentials: ['apiKey', 'countryCode'], optionalCredentials: ['timeout'], setupInstructions: 'Contacta a tu manager de Jooble para obtener tu API Key única' },
  talent: { name: 'Talent.com', type: 'CPA', description: 'Plataforma de reclutamiento con modelo de costo por aplicación', requiredCredentials: ['publisherName', 'publisherUrl', 'partnerEmail'], optionalCredentials: ['feedUrl', 'postbackUrl'], setupInstructions: 'Regístrate como publisher en Talent.com y configura tu feed XML' },
  jobrapido: { name: 'JobRapido', type: 'Organic', description: 'Agregador de ofertas con distribución orgánica y webhooks', requiredCredentials: ['partnerId', 'partnerEmail'], optionalCredentials: ['partnerUsername', 'partnerPassword', 'webhookUrl', 'feedFormat'], setupInstructions: 'Solicita credenciales de partner a JobRapido y configura tu webhook' },
  whatjobs: { name: 'WhatJobs', type: 'XML Feed + CPC', description: 'Motor de búsqueda global con optimización automática via S2S tracking', requiredCredentials: ['authKey', 'country'], optionalCredentials: ['defaultCPC', 'feedUrl'], setupInstructions: 'Contacta a WhatJobs para obtener tu Authentication Key y selecciona el país objetivo' },
  infojobs: { name: 'InfoJobs', type: 'API', description: 'Canal de empleo líder en España', requiredCredentials: ['clientId', 'clientSecret'], optionalCredentials: [], setupInstructions: 'Configura una aplicación en InfoJobs Developers' },
  linkedin: { name: 'LinkedIn', type: 'API', description: 'LinkedIn Jobs API', requiredCredentials: ['clientId', 'clientSecret'], optionalCredentials: [], setupInstructions: 'Configura acceso a LinkedIn Talent Solutions' },
  indeed: { name: 'Indeed', type: 'XML Feed', description: 'Distribución mediante feed XML', requiredCredentials: ['publisherId'], optionalCredentials: ['feedUrl'], setupInstructions: 'Solicita acceso publisher a Indeed' }
};

async function findChannelByCode(code) {
  const baseCode = String(code || '').split('-')[0];
  const { data, error } = await supabase.from('DistributionChannels').select('*').eq('Code', baseCode).single();
  if (error) throw new Error(`Canal no encontrado: ${baseCode}`);
  return data;
}

function decryptSafe(encrypted) {
  if (!encrypted) return {};
  try { return credentialsManager.decryptCredentials(encrypted); } catch { return {}; }
}

function mapCredential(row) {
  const channel = row.DistributionChannels || {};
  const code = channel.Code || row.channelCode || String(row.ChannelId);
  return {
    channelId: code,
    channelName: row.Name || channel.Name || code,
    isActive: row.IsActive ?? row.Status === 'active',
    isValidated: !!row.IsValidated,
    lastValidated: row.LastValidated || null,
    validationError: row.ValidationError || null,
    limits: {
      dailyBudgetLimit: row.DailyBudgetLimit || null,
      monthlyBudgetLimit: row.MonthlyBudgetLimit || null,
      maxCPA: row.MaxCPA || null
    },
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt
  };
}

async function listCredentials(userId) {
  const { data, error } = await supabase
    .from('ChannelCredentials')
    .select('*, DistributionChannels(Code, Name, Type, Country)')
    .eq('UserId', userId)
    .order('CreatedAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getCredential(userId, channelCode) {
  const channel = await findChannelByCode(channelCode);
  const { data, error } = await supabase
    .from('ChannelCredentials')
    .select('*, DistributionChannels(Code, Name, Type, Country)')
    .eq('UserId', userId)
    .eq('ChannelId', channel.Id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return { channel, credential: null };
    throw error;
  }
  return { channel, credential: data };
}

async function saveCredential(userId, channelCode, body = {}) {
  const { credentials, joobleApiKeys, limits = {}, configuration = {} } = body;
  const channel = await findChannelByCode(channelCode);
  const payload = channelCode === 'jooble' && joobleApiKeys?.length ? { ...(credentials || {}), joobleApiKeys } : (credentials || {});
  const encrypted = credentialsManager.encryptCredentials(payload);
  const row = {
    UserId: userId,
    ChannelId: channel.Id,
    Name: channel.Name,
    CredentialsEncrypted: encrypted,
    ConfigurationData: configuration,
    DailyBudgetLimit: limits.dailyBudgetLimit || null,
    MonthlyBudgetLimit: limits.monthlyBudgetLimit || null,
    MaxCPA: limits.maxCPA || null,
    IsActive: true,
    IsValidated: false,
    Status: 'active',
    UpdatedAt: new Date().toISOString()
  };
  const { data, error } = await supabase.from('ChannelCredentials').upsert(row, { onConflict: 'UserId,ChannelId' }).select().single();
  if (error) throw error;
  return mapCredential({ ...data, DistributionChannels: channel });
}

router.get('/channels', (_req, res) => {
  res.json({ success: true, channels: CHANNEL_INFO });
});

router.get('/', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const rows = await listCredentials(req.userId);
    res.json({ success: true, channels: rows.map(mapCredential) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

router.get('/:userId/credentials', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (!isSuperAdmin(req) && userId !== parseInt(req.userId)) return res.status(403).json({ success: false, error: 'No tienes permisos para ver estas credenciales' });
    const rows = await listCredentials(userId);
    const processed = [];
    for (const row of rows) {
      const mapped = mapCredential(row);
      if (mapped.channelId === 'jooble' && mapped.isActive && mapped.isValidated) {
        const creds = decryptSafe(row.CredentialsEncrypted);
        if (Array.isArray(creds.joobleApiKeys) && creds.joobleApiKeys.length > 0) {
          creds.joobleApiKeys.forEach(key => processed.push({ ...mapped, channelId: `jooble-${key.countryCode}`, channelName: `Jooble ${String(key.countryCode).toUpperCase()}`, countryInfo: { countryCode: key.countryCode, countryName: String(key.countryCode).toUpperCase(), hasApiKey: true } }));
        } else processed.push(mapped);
      } else processed.push(mapped);
    }
    res.json({ success: true, channels: processed });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

router.post('/:userId/credentials/:channelId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const data = await saveCredential(userId, req.params.channelId, req.body || {});
    res.json({ success: true, message: 'Credenciales guardadas exitosamente', data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error guardando credenciales', details: error.message });
  }
});

router.put('/:userId/credentials/:channelId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const data = await saveCredential(userId, req.params.channelId, req.body || {});
    res.json({ success: true, message: 'Credenciales actualizadas exitosamente', data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error actualizando credenciales', details: error.message });
  }
});

router.delete('/:userId/credentials/:channelId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { channel } = await getCredential(userId, req.params.channelId);
    const { error } = await supabase.from('ChannelCredentials').delete().eq('UserId', userId).eq('ChannelId', channel.Id);
    if (error) throw error;
    res.json({ success: true, message: 'Credenciales eliminadas exitosamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error eliminando credenciales', details: error.message });
  }
});

router.get('/:userId/credentials/:channelId/details', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { credential } = await getCredential(userId, req.params.channelId);
    if (!credential) return res.status(404).json({ success: false, error: 'Credenciales no encontradas' });
    const creds = decryptSafe(credential.CredentialsEncrypted);
    res.json({
      success: true,
      data: {
        credentials: creds,
        joobleApiKeys: creds.joobleApiKeys || [],
        limits: { dailyBudgetLimit: credential.DailyBudgetLimit, monthlyBudgetLimit: credential.MonthlyBudgetLimit, maxCPA: credential.MaxCPA },
        configuration: credential.ConfigurationData || {},
        status: { isActive: credential.IsActive, isValidated: credential.IsValidated, lastValidated: credential.LastValidated, validationError: credential.ValidationError }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo detalles', details: error.message });
  }
});

router.post('/:userId/credentials/:channelId/validate', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { channel } = await getCredential(userId, req.params.channelId);
    const now = new Date().toISOString();
    const { error } = await supabase.from('ChannelCredentials').update({ IsValidated: true, LastValidated: now, ValidationError: null, UpdatedAt: now }).eq('UserId', userId).eq('ChannelId', channel.Id);
    if (error) throw error;
    res.json({ success: true, validation: { isValid: true, validatedAt: now }, message: 'Credenciales validadas correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error validando credenciales', validation: { isValid: false, error: error.message } });
  }
});

router.get('/:userId/credentials/stats', async (req, res) => {
  try {
    const rows = await listCredentials(parseInt(req.params.userId));
    res.json({ success: true, stats: { TotalChannels: rows.length, ActiveChannels: rows.filter(r => r.IsActive).length, ValidatedChannels: rows.filter(r => r.IsValidated).length } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo estadísticas', details: error.message });
  }
});

module.exports = router;
