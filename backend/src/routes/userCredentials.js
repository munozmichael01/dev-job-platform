const express = require('express');
const router = express.Router();
const { pool, poolPromise } = require('../db/db');
const CredentialsManager = require('../services/credentialsManager');
const JoobleService = require('../services/channels/joobleService');

// Instancia del manager de credenciales
const credentialsManager = new CredentialsManager();

// GET /api/users/:userId/credentials - Obtener credenciales del usuario
router.get('/:userId/credentials', 
  require('../middleware/authMiddleware').addUserToRequest,
  require('../middleware/authMiddleware').requireAuth,
  async (req, res) => {
  try {
    const { userId } = req.params;
    
    // ✅ VALIDAR QUE EL USUARIO SOLO VEA SUS PROPIAS CREDENCIALES (o sea superadmin)
    const { isSuperAdmin } = require('../middleware/authMiddleware');
    if (!isSuperAdmin(req) && parseInt(userId) !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para ver estas credenciales'
      });
    }
    
    await poolPromise;
    const result = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT 
          ChannelId,
          ChannelName,
          IsActive,
          IsValidated,
          LastValidated,
          ValidationError,
          DailyBudgetLimit,
          MonthlyBudgetLimit,
          MaxCPA,
          CreatedAt,
          UpdatedAt
        FROM UserChannelCredentials 
        WHERE UserId = @userId
        ORDER BY CreatedAt DESC
      `);

    const channels = result.recordset.map(row => ({
      channelId: row.ChannelId,
      channelName: row.ChannelName,
      isActive: row.IsActive,
      isValidated: row.IsValidated,
      lastValidated: row.LastValidated,
      validationError: row.ValidationError,
      limits: {
        dailyBudgetLimit: row.DailyBudgetLimit,
        monthlyBudgetLimit: row.MonthlyBudgetLimit,
        maxCPA: row.MaxCPA
      },
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt
    }));

    res.json({
      success: true,
      channels
    });

  } catch (error) {
    console.error('Error obteniendo credenciales:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// GET /api/credentials - Obtener credenciales del usuario actual (desde JWT)
router.get('/', 
  require('../middleware/authMiddleware').addUserToRequest,
  require('../middleware/authMiddleware').requireAuth,
  async (req, res) => {
  try {
    console.log(`🔍 Obteniendo credenciales para usuario ${req.userId} (${req.user.role})`);
    
    await poolPromise;
    const result = await pool.request()
      .input('userId', req.userId)
      .query(`
        SELECT 
          ChannelId,
          ChannelName,
          IsActive,
          IsValidated,
          LastValidated,
          ValidationError,
          DailyBudgetLimit,
          MonthlyBudgetLimit,
          MaxCPA,
          CreatedAt,
          UpdatedAt
        FROM UserChannelCredentials 
        WHERE UserId = @userId
        ORDER BY CreatedAt DESC
      `);

    const channels = result.recordset.map(row => ({
      channelId: row.ChannelId,
      channelName: row.ChannelName,
      isActive: row.IsActive,
      isValidated: row.IsValidated,
      lastValidated: row.LastValidated,
      validationError: row.ValidationError,
      limits: {
        dailyBudgetLimit: row.DailyBudgetLimit,
        monthlyBudgetLimit: row.MonthlyBudgetLimit,
        maxCPA: row.MaxCPA
      },
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt
    }));

    console.log(`✅ Credenciales obtenidas: ${channels.length} canales para usuario ${req.userId}`);

    res.json({
      success: true,
      channels
    });

  } catch (error) {
    console.error('Error obteniendo credenciales:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// POST /api/users/:userId/credentials/:channelId - Guardar/actualizar credenciales
router.post('/:userId/credentials/:channelId', async (req, res) => {
  try {
    const { userId, channelId } = req.params;
    const { credentials, limits, configuration } = req.body;

    if (!credentials || typeof credentials !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Credenciales requeridas'
      });
    }

    // Encriptar credenciales
    const encryptedCredentials = credentialsManager.encryptCredentials(credentials);
    
    // Obtener información del canal
    const channelNames = {
      'jooble': 'Jooble',
      'talent': 'Talent.com',
      'jobrapido': 'JobRapido',
      'whatjobs': 'WhatJobs',
      'infojobs': 'InfoJobs',
      'linkedin': 'LinkedIn',
      'indeed': 'Indeed'
    };

    const channelName = channelNames[channelId] || channelId;

    await poolPromise;
    
    // Verificar si ya existe
    const existing = await pool.request()
      .input('userId', userId)
      .input('channelId', channelId)
      .query('SELECT Id FROM UserChannelCredentials WHERE UserId = @userId AND ChannelId = @channelId');

    if (existing.recordset.length > 0) {
      // Actualizar existente
      await pool.request()
        .input('userId', userId)
        .input('channelId', channelId)
        .input('encryptedCredentials', encryptedCredentials)
        .input('configurationData', configuration ? JSON.stringify(configuration) : null)
        .input('dailyBudgetLimit', limits?.dailyBudgetLimit || null)
        .input('monthlyBudgetLimit', limits?.monthlyBudgetLimit || null)
        .input('maxCPA', limits?.maxCPA || null)
        .query(`
          UPDATE UserChannelCredentials 
          SET 
            EncryptedCredentials = @encryptedCredentials,
            ConfigurationData = @configurationData,
            DailyBudgetLimit = @dailyBudgetLimit,
            MonthlyBudgetLimit = @monthlyBudgetLimit,
            MaxCPA = @maxCPA,
            IsValidated = 0,
            ValidationError = NULL,
            UpdatedAt = GETDATE()
          WHERE UserId = @userId AND ChannelId = @channelId
        `);
    } else {
      // Crear nuevo
      await pool.request()
        .input('userId', userId)
        .input('channelId', channelId)
        .input('channelName', channelName)
        .input('encryptedCredentials', encryptedCredentials)
        .input('configurationData', configuration ? JSON.stringify(configuration) : null)
        .input('dailyBudgetLimit', limits?.dailyBudgetLimit || null)
        .input('monthlyBudgetLimit', limits?.monthlyBudgetLimit || null)
        .input('maxCPA', limits?.maxCPA || null)
        .input('createdBy', userId)
        .query(`
          INSERT INTO UserChannelCredentials 
          (UserId, ChannelId, ChannelName, EncryptedCredentials, ConfigurationData, 
           DailyBudgetLimit, MonthlyBudgetLimit, MaxCPA, CreatedBy)
          VALUES 
          (@userId, @channelId, @channelName, @encryptedCredentials, @configurationData,
           @dailyBudgetLimit, @monthlyBudgetLimit, @maxCPA, @createdBy)
        `);
    }

    res.json({
      success: true,
      message: 'Credenciales guardadas exitosamente'
    });

  } catch (error) {
    console.error('Error guardando credenciales:', error);
    res.status(500).json({
      success: false,
      error: 'Error guardando credenciales: ' + error.message
    });
  }
});

// DELETE /api/users/:userId/credentials/:channelId - Eliminar credenciales
router.delete('/:userId/credentials/:channelId', async (req, res) => {
  try {
    const { userId, channelId } = req.params;

    await poolPromise;
    await pool.request()
      .input('userId', userId)
      .input('channelId', channelId)
      .query('DELETE FROM UserChannelCredentials WHERE UserId = @userId AND ChannelId = @channelId');

    res.json({
      success: true,
      message: 'Credenciales eliminadas exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando credenciales:', error);
    res.status(500).json({
      success: false,
      error: 'Error eliminando credenciales'
    });
  }
});

// POST /api/users/:userId/credentials/:channelId/validate - Validar credenciales
router.post('/:userId/credentials/:channelId/validate', async (req, res) => {
  try {
    const { userId, channelId } = req.params;

    console.log(`🔍 Iniciando validación de credenciales para usuario ${userId}, canal ${channelId}`);

    await poolPromise;
    
    // Obtener las credenciales existentes
    const credentialsResult = await pool.request()
      .input('userId', userId)
      .input('channelId', channelId)
      .query('SELECT EncryptedCredentials FROM UserChannelCredentials WHERE UserId = @userId AND ChannelId = @channelId');

    if (credentialsResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Credenciales no encontradas'
      });
    }

    // Desencriptar credenciales
    const encryptedCredentials = credentialsResult.recordset[0].EncryptedCredentials;
    const credentials = credentialsManager.decryptCredentials(encryptedCredentials);

    let validationResult;

    // Validación específica por canal
    switch (channelId) {
      case 'jooble':
        console.log('🎯 Validando credenciales Jooble con API real...');
        const joobleService = new JoobleService({
          apiKey: credentials.apiKey,
          countryCode: credentials.countryCode,
          timeout: credentials.timeout
        });
        validationResult = await joobleService.validateCredentials(credentials);
        break;
        
      default:
        // Para otros canales, usar validación simulada por ahora
        console.log(`⚠️ Usando validación simulada para canal ${channelId}`);
        validationResult = await simulateChannelValidation(channelId, credentials);
        if (validationResult) {
          validationResult = {
            success: true,
            message: 'Credenciales validadas exitosamente (simulación)',
            validatedAt: new Date().toISOString()
          };
        } else {
          validationResult = {
            success: false,
            error: 'Credenciales inválidas (simulación)',
            code: 'SIMULATION_ERROR'
          };
        }
        break;
    }

    console.log('📋 Resultado de validación:', validationResult.success ? '✅ Exitosa' : '❌ Falló');
    
    if (validationResult.success) {
      // Actualizar estado en base de datos
      await pool.request()
        .input('userId', userId)
        .input('channelId', channelId)
        .query(`
          UPDATE UserChannelCredentials 
          SET 
            IsValidated = 1,
            ValidationError = NULL,
            LastValidated = GETDATE(),
            UpdatedAt = GETDATE()
          WHERE UserId = @userId AND ChannelId = @channelId
        `);

      res.json({
        success: true,
        message: validationResult.message || 'Credenciales validadas exitosamente',
        validation: {
          isValid: true,
          validatedAt: validationResult.validatedAt || new Date().toISOString(),
          details: validationResult.details
        }
      });
    } else {
      // Guardar error de validación
      await pool.request()
        .input('userId', userId)
        .input('channelId', channelId)
        .input('validationError', validationResult.error)
        .query(`
          UPDATE UserChannelCredentials 
          SET 
            IsValidated = 0,
            ValidationError = @validationError,
            LastValidated = GETDATE(),
            UpdatedAt = GETDATE()
          WHERE UserId = @userId AND ChannelId = @channelId
        `);

      res.json({
        success: false,
        message: 'Error en validación de credenciales',
        validation: {
          isValid: false,
          error: validationResult.error,
          code: validationResult.code,
          details: validationResult.details
        }
      });
    }

  } catch (error) {
    console.error('❌ Error validando credenciales:', error);
    res.status(500).json({
      success: false,
      error: 'Error validando credenciales: ' + error.message
    });
  }
});

// GET /api/users/:userId/credentials/:channelId/details - Obtener credenciales para edición
router.get('/:userId/credentials/:channelId/details', async (req, res) => {
  try {
    const { userId, channelId } = req.params;

    console.log(`🔍 Obteniendo detalles de credenciales para usuario ${userId}, canal ${channelId}`);

    await poolPromise;
    
    // Obtener las credenciales existentes
    const credentialsResult = await pool.request()
      .input('userId', userId)
      .input('channelId', channelId)
      .query(`
        SELECT 
          EncryptedCredentials, 
          ConfigurationData,
          DailyBudgetLimit,
          MonthlyBudgetLimit,
          MaxCPA,
          IsValidated,
          ValidationError,
          LastValidated
        FROM UserChannelCredentials 
        WHERE UserId = @userId AND ChannelId = @channelId
      `);

    if (credentialsResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Credenciales no encontradas'
      });
    }

    const row = credentialsResult.recordset[0];
    
    // Desencriptar credenciales
    let credentials = {};
    try {
      credentials = credentialsManager.decryptCredentials(row.EncryptedCredentials);
    } catch (error) {
      console.error('❌ Error desencriptando credenciales para edición:', error);
      return res.status(500).json({
        success: false,
        error: 'Error desencriptando credenciales'
      });
    }

    // Parsear configuración
    let configuration = {};
    if (row.ConfigurationData) {
      try {
        configuration = JSON.parse(row.ConfigurationData);
      } catch (error) {
        console.warn('⚠️ Error parseando configuración:', error);
      }
    }

    console.log(`✅ Credenciales obtenidas para edición: ${Object.keys(credentials).join(', ')}`);

    res.json({
      success: true,
      data: {
        credentials: credentials,
        limits: {
          dailyBudgetLimit: row.DailyBudgetLimit?.toString() || '',
          monthlyBudgetLimit: row.MonthlyBudgetLimit?.toString() || '',
          maxCPA: row.MaxCPA?.toString() || ''
        },
        configuration: configuration,
        status: {
          isValidated: row.IsValidated,
          validationError: row.ValidationError,
          lastValidated: row.LastValidated
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo detalles de credenciales:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo detalles de credenciales: ' + error.message
    });
  }
});

// GET /api/credentials/channels - Obtener información de canales disponibles  
router.get('/channels', async (req, res) => {
  try {
    const channels = {
      jooble: {
        name: 'Jooble',
        type: 'CPC',
        description: 'Motor de búsqueda de empleo global con modelo CPC',
        requiredCredentials: ['apiKey', 'countryCode'],
        optionalCredentials: ['timeout'],
        setupInstructions: 'Contacta a tu manager de Jooble para obtener tu API Key única'
      },
      talent: {
        name: 'Talent.com',
        type: 'CPA',
        description: 'Plataforma de reclutamiento con modelo de costo por aplicación',
        requiredCredentials: ['publisherName', 'publisherUrl', 'partnerEmail'],
        optionalCredentials: ['feedUrl', 'postbackUrl'],
        setupInstructions: 'Regístrate como publisher en Talent.com y configura tu feed XML'
      },
      jobrapido: {
        name: 'JobRapido',
        type: 'Organic',
        description: 'Agregador de ofertas con distribución orgánica y webhooks',
        requiredCredentials: ['partnerId', 'partnerEmail'],
        optionalCredentials: ['partnerUsername', 'partnerPassword', 'webhookUrl', 'feedFormat'],
        setupInstructions: 'Solicita credenciales de partner a JobRapido y configura tu webhook'
      },
      whatjobs: {
        name: 'WhatJobs',
        type: 'XML Feed + CPC',
        description: 'Motor de búsqueda global con optimización automática via S2S tracking',
        requiredCredentials: ['authKey', 'country'],
        optionalCredentials: ['defaultCPC', 'feedUrl'],
        setupInstructions: 'Contacta a WhatJobs para obtener tu Authentication Key y selecciona el país objetivo'
      },
      infojobs: {
        name: 'InfoJobs',
        type: 'CPA',
        description: 'Portal de empleo líder en España',
        requiredCredentials: ['apiKey', 'clientId'],
        optionalCredentials: ['secret'],
        setupInstructions: 'Registra tu aplicación en el portal de desarrolladores de InfoJobs'
      },
      linkedin: {
        name: 'LinkedIn',
        type: 'CPC',
        description: 'Red profesional global con API de ofertas de trabajo',
        requiredCredentials: ['clientId', 'clientSecret', 'accessToken'],
        optionalCredentials: ['organizationId'],
        setupInstructions: 'Crea una aplicación en LinkedIn Developer Portal'
      },
      indeed: {
        name: 'Indeed',
        type: 'CPC',
        description: 'Portal de empleo global con API de publisher',
        requiredCredentials: ['publisherId', 'apiKey'],
        optionalCredentials: [],
        setupInstructions: 'Regístrate como publisher en Indeed y obtén tu Publisher ID'
      }
    };

    res.json({
      success: true,
      channels
    });

  } catch (error) {
    console.error('Error obteniendo canales:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// GET /api/users/:userId/credentials/stats - Estadísticas de credenciales del usuario
router.get('/:userId/credentials/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    await poolPromise;
    const result = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT 
          COUNT(*) as TotalChannels,
          SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as ActiveChannels,
          SUM(CASE WHEN IsValidated = 1 THEN 1 ELSE 0 END) as ValidatedChannels,
          SUM(CASE WHEN ValidationError IS NOT NULL THEN 1 ELSE 0 END) as ErrorChannels
        FROM UserChannelCredentials 
        WHERE UserId = @userId
      `);

    const stats = result.recordset[0] || {
      TotalChannels: 0,
      ActiveChannels: 0,
      ValidatedChannels: 0,
      ErrorChannels: 0
    };

    res.json({
      success: true,
      stats: {
        total: stats.TotalChannels,
        active: stats.ActiveChannels,
        validated: stats.ValidatedChannels,
        errors: stats.ErrorChannels
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Función auxiliar para simular validación de canales
async function simulateChannelValidation(channelId, credentials) {
  // En implementación real, aquí se harían las llamadas a las APIs externas
  // Por ahora simulamos validación básica
  
  switch (channelId) {
    case 'jooble':
      return credentials.apiKey && credentials.countryCode;
    case 'talent':
      return credentials.publisherName && credentials.publisherUrl && credentials.partnerEmail;
    case 'jobrapido':
      return credentials.partnerId && credentials.partnerEmail;
    case 'whatjobs':
      return credentials.authKey && credentials.country;
    case 'infojobs':
      return credentials.apiKey && credentials.clientId;
    case 'linkedin':
      return credentials.clientId && credentials.clientSecret && credentials.accessToken;
    case 'indeed':
      return credentials.publisherId && credentials.apiKey;
    default:
      return false;
  }
}

module.exports = router;
