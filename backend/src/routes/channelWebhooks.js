const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../db/db');
const TalentService = require('../services/channels/talentService');
const ChannelFactory = require('../services/channels/channelFactory');

/**
 * Endpoints para webhooks de canales externos
 * Maneja aplicaciones, notificaciones y callbacks de Talent, Jooble, etc.
 */

const channelFactory = new ChannelFactory();

// Middleware para logging de webhooks
const logWebhook = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`📡 Webhook recibido: ${req.method} ${req.path} desde ${req.ip}`);
  console.log(`🔍 Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`📋 Body size: ${JSON.stringify(req.body).length} chars`);
  
  // Guardar timestamp para medir tiempo de procesamiento
  req.webhookStartTime = Date.now();
  next();
};

// Middleware para respuesta de webhook
const respondWebhook = (req, res, result) => {
  const processingTime = Date.now() - req.webhookStartTime;
  console.log(`✅ Webhook procesado en ${processingTime}ms`);
  
  // Responder con código de éxito apropiado
  if (result.success) {
    res.status(200).json({
      success: true,
      message: 'Webhook procesado exitosamente',
      processingTime: processingTime,
      data: result.data || {}
    });
  } else {
    res.status(400).json({
      success: false,
      message: result.error || 'Error procesando webhook',
      processingTime: processingTime
    });
  }
};

/**
 * POST /api/channels/talent/applications
 * Endpoint para recibir aplicaciones desde Talent.com vía PostURL
 * Basado en documentación: https://www.talent.com/integrations
 */
router.post('/talent/applications', logWebhook, async (req, res) => {
  try {
    console.log('📨 Aplicación recibida desde Talent.com');
    
    // Validar estructura básica del payload
    if (!req.body || !req.body.applicant || !req.body.job) {
      return respondWebhook(req, res, {
        success: false,
        error: 'Payload inválido: faltan campos obligatorios (applicant, job)'
      });
    }
    
    // Procesar aplicación usando TalentService
    const talentService = channelFactory.getChannel('talent');
    const processedApplication = talentService.processApplication(req.body);
    
    // Guardar aplicación en base de datos
    const savedApplication = await saveApplication(processedApplication);
    
    // Actualizar estadísticas de la oferta
    await updateOfferStats(processedApplication.job.externalJobId, 'application');
    
    // Notificar a sistemas internos (opcional)
    await notifyApplicationReceived(savedApplication);
    
    respondWebhook(req, res, {
      success: true,
      data: {
        applicationId: savedApplication.id,
        applicantEmail: processedApplication.applicant.email,
        jobId: processedApplication.job.externalJobId,
        source: 'talent'
      }
    });
    
  } catch (error) {
    console.error(`❌ Error procesando aplicación de Talent: ${error.message}`);
    respondWebhook(req, res, {
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/jobrapido/applications
 * Endpoint para recibir aplicaciones desde JobRapido vía HTTPS POST
 * Basado en documentación JobRapido Integration
 */
router.post('/jobrapido/applications', logWebhook, async (req, res) => {
  try {
    console.log('📨 Aplicación recibida desde JobRapido');
    
    // Validar estructura del payload JobRapido
    if (!req.body || !req.body.JobId || !req.body.Candidate) {
      return respondWebhook(req, res, {
        success: false,
        error: 'Payload inválido: faltan campos obligatorios (JobId, Candidate)'
      });
    }
    
    // Procesar aplicación usando JobRapidoService
    const JobRapidoService = require('../services/channels/jobRapidoService');
    const jobRapidoService = new JobRapidoService();
    const processedApplication = jobRapidoService.processApplication(req.body);
    
    // Guardar aplicación en base de datos
    const savedApplication = await saveJobRapidoApplication(processedApplication);
    
    // Actualizar estadísticas de la oferta
    await updateOfferStats(processedApplication.job.externalJobId, 'application');
    
    // Notificar a sistemas internos
    await notifyJobRapidoApplication(savedApplication);
    
    respondWebhook(req, res, {
      success: true,
      data: {
        applicationId: savedApplication.id,
        applicantEmail: processedApplication.applicant.email,
        jobId: processedApplication.job.externalJobId,
        source: 'jobrapido',
        screeningQuestions: req.body.questions ? 'included' : 'none'
      }
    });
    
  } catch (error) {
    console.error(`❌ Error procesando aplicación JobRapido: ${error.message}`);
    respondWebhook(req, res, {
      success: false,
      error: error.message
    });
  }
});

/**
 * GET/POST /api/channels/whatjobs/click
 * Endpoint para procesar clicks de WhatJobs y reportar conversiones vía S2S
 * Basado en documentación: WhatJobs S2S Integration
 */
router.get('/whatjobs/click', logWebhook, async (req, res) => {
  try {
    console.log('🔗 Click recibido desde WhatJobs (GET)');
    
    const { wjClickID, authKey, offerId } = req.query;
    
    if (!wjClickID) {
      return respondWebhook(req, res, {
        success: false,
        error: 'wjClickID es requerido'
      });
    }
    
    // Procesar click usando WhatJobsService
    const WhatJobsService = require('../services/channels/whatJobsService');
    const whatJobsService = new WhatJobsService({ authKey });
    
    const result = await whatJobsService.processWhatJobsClick(wjClickID, authKey, offerId);
    
    // Actualizar estadísticas de la oferta si tenemos offerId
    if (offerId) {
      await updateOfferStats(offerId, 'click');
    }
    
    respondWebhook(req, res, {
      success: true,
      data: {
        clickId: wjClickID,
        offerId: offerId,
        source: 'whatjobs',
        message: 'Click registrado exitosamente'
      }
    });
    
  } catch (error) {
    console.error(`❌ Error procesando click WhatJobs: ${error.message}`);
    respondWebhook(req, res, {
      success: false,
      error: error.message
    });
  }
});

// También soportar método POST para clicks
router.post('/whatjobs/click', logWebhook, async (req, res) => {
  try {
    console.log('🔗 Click recibido desde WhatJobs (POST)');
    
    const { wjClickID, authKey, offerId } = req.body;
    
    if (!wjClickID) {
      return respondWebhook(req, res, {
        success: false,
        error: 'wjClickID es requerido'
      });
    }
    
    // Procesar click usando WhatJobsService
    const WhatJobsService = require('../services/channels/whatJobsService');
    const whatJobsService = new WhatJobsService({ authKey });
    
    const result = await whatJobsService.processWhatJobsClick(wjClickID, authKey, offerId);
    
    // Actualizar estadísticas de la oferta
    if (offerId) {
      await updateOfferStats(offerId, 'click');
    }
    
    respondWebhook(req, res, {
      success: true,
      data: {
        clickId: wjClickID,
        offerId: offerId,
        source: 'whatjobs',
        message: 'Click registrado exitosamente'
      }
    });
    
  } catch (error) {
    console.error(`❌ Error procesando click WhatJobs: ${error.message}`);
    respondWebhook(req, res, {
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/whatjobs/conversion
 * Endpoint para reportar conversiones a WhatJobs cuando el usuario aplica
 */
router.post('/whatjobs/conversion', logWebhook, async (req, res) => {
  try {
    console.log('🎯 Conversión para reportar a WhatJobs');
    
    const { wjClickID, authKey, applicantData } = req.body;
    
    if (!wjClickID) {
      return respondWebhook(req, res, {
        success: false,
        error: 'wjClickID es requerido para reportar conversión'
      });
    }
    
    // Reportar conversión a WhatJobs vía S2S
    const WhatJobsService = require('../services/channels/whatJobsService');
    const whatJobsService = new WhatJobsService({ authKey });
    
    const result = await whatJobsService.reportConversion(wjClickID);
    
    // Guardar aplicación en base de datos si se proporcionan datos
    if (applicantData) {
      const applicationData = {
        applicant: applicantData.applicant,
        job: applicantData.job,
        channel: 'whatjobs',
        applicationId: wjClickID,
        receivedAt: new Date().toISOString()
      };
      
      await saveApplication(applicationData);
      
      // Actualizar estadísticas de la oferta
      if (applicantData.job?.externalJobId) {
        await updateOfferStats(applicantData.job.externalJobId, 'application');
      }
    }
    
    respondWebhook(req, res, {
      success: true,
      data: {
        clickId: wjClickID,
        conversionReported: result.success,
        whatjobsResponse: result.response || result.error,
        source: 'whatjobs'
      }
    });
    
  } catch (error) {
    console.error(`❌ Error reportando conversión WhatJobs: ${error.message}`);
    respondWebhook(req, res, {
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channels/whatjobs/feed/:userId
 * Endpoint para servir el feed XML de WhatJobs específico por usuario
 */
router.get('/whatjobs/feed/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { campaignId, segmentIds } = req.query;
    
    console.log(`📤 Generando feed XML WhatJobs para usuario ${userId}`);
    
    if (!userId) {
      return res.status(400).xml('<?xml version="1.0" encoding="utf-8"?><error>userId es requerido</error>');
    }
    
    // Obtener ofertas según segmentos o campaña
    let offers = [];
    if (segmentIds) {
      const CampaignDistributionService = require('../services/campaignDistributionService');
      const segmentIdArray = segmentIds.split(',').map(id => parseInt(id));
      offers = await CampaignDistributionService.getOffersFromSegment(segmentIdArray);
    } else if (campaignId) {
      // Obtener ofertas de una campaña específica
      offers = await getOffersFromCampaign(campaignId);
    } else {
      // Obtener todas las ofertas activas del usuario
      offers = await getAllActiveOffers(userId);
    }
    
    // Generar feed XML usando WhatJobsService
    const ChannelFactory = require('../services/channels/channelFactory');
    const channelFactory = new ChannelFactory();
    const whatJobsService = await channelFactory.getChannel('whatjobs', {}, userId);
    
    const xmlFeed = await whatJobsService.generateWhatJobsFeed(userId, offers, {
      maxCPA: 15.0,
      defaultCPC: 2.5
    });
    
    // Responder con XML
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
      'X-Offers-Count': offers.length.toString(),
      'X-Generated-At': new Date().toISOString()
    });
    
    res.send(xmlFeed);
    
    console.log(`✅ Feed XML WhatJobs servido: ${offers.length} ofertas para usuario ${userId}`);
    
  } catch (error) {
    console.error(`❌ Error generando feed WhatJobs: ${error.message}`);
    res.status(500).set('Content-Type', 'application/xml; charset=utf-8')
       .send(`<?xml version="1.0" encoding="utf-8"?><error>${error.message}</error>`);
  }
});

/**
 * POST /api/channels/jooble/notifications
 * Endpoint para notificaciones de Jooble (stats, cambios de estado, etc.)
 */
router.post('/jooble/notifications', logWebhook, async (req, res) => {
  try {
    console.log('📊 Notificación recibida desde Jooble');
    
    const notificationType = req.body.type || 'unknown';
    const campaignId = req.body.campaignId;
    
    let result;
    
    switch (notificationType) {
      case 'performance_update':
        result = await handleJooblePerformanceUpdate(req.body);
        break;
        
      case 'campaign_status_change':
        result = await handleJoobleStatusChange(req.body);
        break;
        
      case 'budget_alert':
        result = await handleJoobleBudgetAlert(req.body);
        break;
        
      default:
        console.log(`⚠️ Tipo de notificación Jooble desconocido: ${notificationType}`);
        result = { success: true, message: 'Notificación recibida pero no procesada' };
    }
    
    respondWebhook(req, res, result);
    
  } catch (error) {
    console.error(`❌ Error procesando notificación de Jooble: ${error.message}`);
    respondWebhook(req, res, {
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/channels/performance-callback
 * Endpoint genérico para callbacks de performance de múltiples canales
 */
router.post('/performance-callback', logWebhook, async (req, res) => {
  try {
    const channel = req.body.channel || req.query.channel;
    
    if (!channel) {
      return respondWebhook(req, res, {
        success: false,
        error: 'Canal no especificado'
      });
    }
    
    console.log(`📈 Performance callback recibido desde ${channel}`);
    
    // Procesar según el canal
    let result;
    switch (channel.toLowerCase()) {
      case 'talent':
        result = await handleTalentPerformanceCallback(req.body);
        break;
        
      case 'jooble':
        result = await handleJooblePerformanceCallback(req.body);
        break;
        
      default:
        result = await handleGenericPerformanceCallback(channel, req.body);
    }
    
    respondWebhook(req, res, result);
    
  } catch (error) {
    console.error(`❌ Error procesando performance callback: ${error.message}`);
    respondWebhook(req, res, {
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/channels/webhook-status
 * Endpoint de health check para verificar que los webhooks funcionan
 */
router.get('/webhook-status', (req, res) => {
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      talent_applications: '/api/channels/talent/applications',
      jooble_notifications: '/api/channels/jooble/notifications',
      jobrapido_applications: '/api/channels/jobrapido/applications',
      whatjobs_click: '/api/channels/whatjobs/click',
      whatjobs_conversion: '/api/channels/whatjobs/conversion',
      whatjobs_feed: '/api/channels/whatjobs/feed/:userId',
      performance_callback: '/api/channels/performance-callback'
    },
    uptime: process.uptime()
  });
});

// Funciones auxiliares para manejar webhooks

/**
 * Guarda una aplicación en la base de datos
 * @param {Object} applicationData - Datos procesados de la aplicación
 * @returns {Object} Aplicación guardada con ID
 */
async function saveApplication(applicationData) {
  try {
    await poolConnect;
    
    const result = await pool.request()
      .input('ApplicantName', sql.NVarChar(255), applicationData.applicant.fullName)
      .input('ApplicantEmail', sql.NVarChar(255), applicationData.applicant.email)
      .input('ApplicantPhone', sql.NVarChar(50), applicationData.applicant.phoneNumber)
      .input('ExternalJobId', sql.NVarChar(255), applicationData.job.externalJobId)
      .input('JobTitle', sql.NVarChar(255), applicationData.job.title)
      .input('CompanyName', sql.NVarChar(255), applicationData.job.company)
      .input('Source', sql.NVarChar(50), applicationData.channel)
      .input('SourceApplicationId', sql.NVarChar(255), applicationData.applicationId)
      .input('ReceivedAt', sql.DateTime, new Date(applicationData.receivedAt))
      .input('ApplicantData', sql.NVarChar(sql.MAX), JSON.stringify(applicationData))
      .query(`
        INSERT INTO Applications 
        (ApplicantName, ApplicantEmail, ApplicantPhone, ExternalJobId, JobTitle, CompanyName, Source, SourceApplicationId, ReceivedAt, ApplicantData, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.*
        VALUES 
        (@ApplicantName, @ApplicantEmail, @ApplicantPhone, @ExternalJobId, @JobTitle, @CompanyName, @Source, @SourceApplicationId, @ReceivedAt, @ApplicantData, GETDATE())
      `);
    
    const savedApplication = result.recordset[0];
    console.log(`💾 Aplicación guardada con ID: ${savedApplication.Id}`);
    
    return savedApplication;
    
  } catch (error) {
    console.error(`❌ Error guardando aplicación: ${error.message}`);
    throw error;
  }
}

/**
 * Actualiza estadísticas de una oferta
 * @param {String} externalJobId - ID externo de la oferta
 * @param {String} eventType - Tipo de evento: 'view', 'click', 'application'
 */
async function updateOfferStats(externalJobId, eventType) {
  try {
    await poolConnect;
    
    let updateField;
    switch (eventType) {
      case 'view':
        updateField = 'Views = Views + 1';
        break;
      case 'click':
        updateField = 'Clicks = Clicks + 1';
        break;
      case 'application':
        updateField = 'Applications = Applications + 1, ApplicationsReceived = ApplicationsReceived + 1';
        break;
      default:
        return;
    }
    
    await pool.request()
      .input('ExternalId', sql.NVarChar(255), externalJobId)
      .query(`
        UPDATE JobOffers 
        SET ${updateField}, UpdatedAt = GETDATE()
        WHERE ExternalId = @ExternalId
      `);
    
    console.log(`📊 Estadísticas actualizadas para oferta ${externalJobId}: ${eventType}`);
    
  } catch (error) {
    console.error(`❌ Error actualizando estadísticas: ${error.message}`);
  }
}

/**
 * Notifica internamente que se recibió una aplicación
 * @param {Object} application - Aplicación guardada
 */
async function notifyApplicationReceived(application) {
  try {
    // Aquí puedes agregar lógica para notificaciones:
    // - Enviar email al reclutador
    // - Webhook interno
    // - Push notification
    // - Slack/Teams notification
    
    console.log(`🔔 Notificando aplicación recibida: ${application.ApplicantEmail} -> ${application.JobTitle}`);
    
    // Por ahora solo log, pero aquí irían las notificaciones reales
    
  } catch (error) {
    console.error(`❌ Error enviando notificación: ${error.message}`);
  }
}

/**
 * Maneja actualizaciones de performance desde Jooble
 */
async function handleJooblePerformanceUpdate(data) {
  try {
    console.log(`📊 Actualizando performance de campaña Jooble ${data.campaignId}`);
    
    // Actualizar tabla CampaignChannels con nuevas estadísticas
    if (data.campaignId && data.stats) {
      await pool.request()
        .input('CampaignId', sql.Int, data.campaignId)
        .input('Impressions', sql.Int, data.stats.impressions || 0)
        .input('Clicks', sql.Int, data.stats.clicks || 0)
        .input('Applications', sql.Int, data.stats.applications || 0)
        .input('Spend', sql.Decimal(10,2), data.stats.spend || 0)
        .input('CurrentCPA', sql.Decimal(8,2), data.stats.cpa || 0)
        .query(`
          UPDATE CampaignChannels 
          SET 
            SpentBudget = @Spend,
            AchievedApplications = @Applications,
            CurrentCPA = @CurrentCPA,
            UpdatedAt = GETDATE()
          WHERE CampaignId = @CampaignId AND ChannelId = 'jooble'
        `);
    }
    
    return { success: true, message: 'Performance actualizada' };
    
  } catch (error) {
    console.error(`❌ Error actualizando performance Jooble: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Maneja cambios de estado de campaña en Jooble
 */
async function handleJoobleStatusChange(data) {
  try {
    console.log(`🔄 Cambio de estado en Jooble: campaña ${data.campaignId} -> ${data.newStatus}`);
    
    // Mapear estados de Jooble a nuestros estados
    const statusMapping = {
      0: 'active',     // InProgress
      1: 'paused',     // Stopped
      2: 'archived'    // Deleted
    };
    
    const ourStatus = statusMapping[data.newStatus] || 'unknown';
    
    // Actualizar estado en nuestra base de datos
    await pool.request()
      .input('CampaignId', sql.Int, data.campaignId)
      .input('Status', sql.NVarChar(20), ourStatus)
      .query(`
        UPDATE CampaignChannels 
        SET Status = @Status, UpdatedAt = GETDATE()
        WHERE CampaignId = @CampaignId AND ChannelId = 'jooble'
      `);
    
    return { success: true, message: `Estado actualizado a ${ourStatus}` };
    
  } catch (error) {
    console.error(`❌ Error actualizando estado Jooble: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Maneja alertas de presupuesto desde Jooble
 */
async function handleJoobleBudgetAlert(data) {
  try {
    console.log(`💰 Alerta de presupuesto Jooble: campaña ${data.campaignId}`);
    
    // Aquí puedes agregar lógica para:
    // - Pausar campaña automáticamente si se agotó el presupuesto
    // - Enviar notificación al usuario
    // - Ajustar bids automáticamente
    
    return { success: true, message: 'Alerta de presupuesto procesada' };
    
  } catch (error) {
    console.error(`❌ Error procesando alerta de presupuesto: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Maneja callbacks de performance de Talent
 */
async function handleTalentPerformanceCallback(data) {
  try {
    console.log('📈 Performance callback de Talent procesado');
    
    // Lógica específica para callbacks de Talent
    // (si los implementan en el futuro)
    
    return { success: true, message: 'Talent performance callback procesado' };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Maneja callbacks de performance de Jooble
 */
async function handleJooblePerformanceCallback(data) {
  try {
    console.log('📈 Performance callback de Jooble procesado');
    
    return await handleJooblePerformanceUpdate(data);
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Maneja callbacks genéricos de otros canales
 */
async function handleGenericPerformanceCallback(channel, data) {
  try {
    console.log(`📈 Performance callback genérico de ${channel} procesado`);
    
    // Lógica genérica para canales no específicamente implementados
    
    return { success: true, message: `Callback de ${channel} procesado` };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Funciones auxiliares específicas para JobRapido

/**
 * Guarda una aplicación de JobRapido en la base de datos
 * @param {Object} applicationData - Datos procesados de la aplicación JobRapido
 * @returns {Object} Aplicación guardada con ID
 */
async function saveJobRapidoApplication(applicationData) {
  try {
    await poolConnect;
    
    const result = await pool.request()
      .input('ApplicantName', sql.NVarChar(255), applicationData.applicant.fullName)
      .input('ApplicantEmail', sql.NVarChar(255), applicationData.applicant.email)
      .input('ApplicantPhone', sql.NVarChar(50), applicationData.applicant.phoneNumber)
      .input('ExternalJobId', sql.NVarChar(255), applicationData.job.externalJobId)
      .input('JobTitle', sql.NVarChar(255), applicationData.job.title)
      .input('CompanyName', sql.NVarChar(255), applicationData.job.company || 'JobRapido')
      .input('Source', sql.NVarChar(50), applicationData.channel)
      .input('SourceApplicationId', sql.NVarChar(255), applicationData.applicationId)
      .input('ReceivedAt', sql.DateTime, new Date(applicationData.receivedAt))
      .input('ApplicantData', sql.NVarChar(sql.MAX), JSON.stringify(applicationData))
      .query(`
        INSERT INTO Applications 
        (ApplicantName, ApplicantEmail, ApplicantPhone, ExternalJobId, JobTitle, CompanyName, Source, SourceApplicationId, ReceivedAt, ApplicantData, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.*
        VALUES 
        (@ApplicantName, @ApplicantEmail, @ApplicantPhone, @ExternalJobId, @JobTitle, @CompanyName, @Source, @SourceApplicationId, @ReceivedAt, @ApplicantData, GETDATE())
      `);
    
    const savedApplication = result.recordset[0];
    console.log(`💾 Aplicación JobRapido guardada con ID: ${savedApplication.Id}`);
    
    // Guardar CV en Base64 si está presente
    if (applicationData.applicant.cv && applicationData.applicant.cv.content) {
      await saveCVFile(savedApplication.Id, applicationData.applicant.cv);
    }
    
    return savedApplication;
    
  } catch (error) {
    console.error(`❌ Error guardando aplicación JobRapido: ${error.message}`);
    throw error;
  }
}

/**
 * Guarda archivo CV en Base64 (placeholder - implementar storage real)
 * @param {Number} applicationId - ID de la aplicación
 * @param {Object} cvData - Datos del CV
 */
async function saveCVFile(applicationId, cvData) {
  try {
    // Por ahora solo loggear - en implementación real guardarías en storage
    console.log(`📄 CV recibido para aplicación ${applicationId}: ${cvData.fileName} (${cvData.content?.length || 0} chars)`);
    
    // Aquí podrías:
    // 1. Decodificar Base64 y guardar en filesystem
    // 2. Subir a S3/Azure Blob Storage
    // 3. Guardar en base de datos como BLOB
    // 4. Integrar con sistema de gestión de CVs
    
    if (cvData.coverLetter?.content) {
      console.log(`📄 Cover letter recibida: ${cvData.coverLetter.fileName} (${cvData.coverLetter.content.length} chars)`);
    }
    
  } catch (error) {
    console.error(`❌ Error guardando CV: ${error.message}`);
  }
}

/**
 * Notifica que se recibió una aplicación de JobRapido
 * @param {Object} application - Aplicación guardada
 */
async function notifyJobRapidoApplication(application) {
  try {
    console.log(`🔔 Notificando aplicación JobRapido: ${application.ApplicantEmail} -> ${application.JobTitle}`);
    
    // Notificaciones específicas para JobRapido:
    // - CV con datos completos (más información que otros canales)
    // - Posible scoring/filtrado automático basado en screening questions
    // - Integración con ATS del cliente
    
    // Por ahora solo log
    
  } catch (error) {
    console.error(`❌ Error enviando notificación JobRapido: ${error.message}`);
  }
}

// Funciones auxiliares para WhatJobs

/**
 * Obtiene ofertas de una campaña específica
 * @param {Number} campaignId - ID de la campaña
 * @returns {Array} Array de ofertas
 */
async function getOffersFromCampaign(campaignId) {
  try {
    await poolConnect;
    
    const result = await pool.request()
      .input('CampaignId', sql.Int, campaignId)
      .query(`
        SELECT DISTINCT jo.*
        FROM JobOffers jo
        INNER JOIN CampaignChannels cc ON jo.Id = cc.OfferId
        WHERE cc.CampaignId = @CampaignId
          AND jo.StatusId = 1
        ORDER BY jo.CreatedAt DESC
      `);
    
    console.log(`📋 ${result.recordset.length} ofertas encontradas para campaña ${campaignId}`);
    return result.recordset;
    
  } catch (error) {
    console.error(`❌ Error obteniendo ofertas de campaña ${campaignId}: ${error.message}`);
    return [];
  }
}

/**
 * Obtiene todas las ofertas activas de un usuario
 * @param {Number} userId - ID del usuario
 * @returns {Array} Array de ofertas
 */
async function getAllActiveOffers(userId) {
  try {
    await poolConnect;
    
    // Por simplicidad, obtener ofertas de todas las conexiones del usuario
    // En implementación real, podrías filtrar por criterios específicos
    const result = await pool.request()
      .input('UserId', sql.BigInt, userId)
      .query(`
        SELECT TOP 1000 jo.*
        FROM JobOffers jo
        INNER JOIN Connections c ON jo.ConnectionId = c.Id
        WHERE c.UserId = @UserId
          AND jo.StatusId = 1
        ORDER BY jo.CreatedAt DESC
      `);
    
    console.log(`📋 ${result.recordset.length} ofertas activas encontradas para usuario ${userId}`);
    return result.recordset;
    
  } catch (error) {
    console.error(`❌ Error obteniendo ofertas del usuario ${userId}: ${error.message}`);
    return [];
  }
}

module.exports = router;
