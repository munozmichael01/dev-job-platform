const express = require('express');
const router = express.Router();
const { NotificationService } = require('../services/notificationService');

const notificationService = new NotificationService();

/**
 * Router para sistema de notificaciones
 * 
 * Endpoints disponibles:
 * - GET /api/notifications - Obtener notificaciones del usuario
 * - POST /api/notifications/:id/read - Marcar notificación como leída
 * - POST /api/notifications/test - Enviar notificación de prueba
 * - GET /api/notifications/stats - Estadísticas de notificaciones
 */

/**
 * GET /api/notifications
 * Obtiene notificaciones del usuario con filtros opcionales
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId || 1; // TODO: obtener de sesión real
    
    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      unreadOnly: req.query.unreadOnly === 'true',
      priority: req.query.priority || null,
      type: req.query.type || null
    };

    const notifications = await notificationService.getUserNotifications(userId, options);
    
    // Obtener estadísticas adicionales
    const allNotifications = await notificationService.getUserNotifications(userId, { limit: 1000 });
    const unreadCount = allNotifications.filter(n => !n.ReadAt).length;
    const totalCount = allNotifications.length;
    
    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: totalCount,
          hasMore: (options.offset + options.limit) < totalCount
        },
        stats: {
          unread: unreadCount,
          total: totalCount
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo notificaciones:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/notifications/:id/read
 * Marca una notificación como leída
 */
router.post('/:id/read', async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.user?.id || req.body.userId || 1; // TODO: obtener de sesión real
    
    if (!notificationId || isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de notificación inválido'
      });
    }
    
    await notificationService.markAsRead(notificationId, userId);
    
    res.json({
      success: true,
      message: 'Notificación marcada como leída'
    });
    
  } catch (error) {
    console.error('❌ Error marcando notificación como leída:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Marca todas las notificaciones como leídas
 */
router.post('/mark-all-read', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId || 1; // TODO: obtener de sesión real
    
    // Obtener todas las notificaciones no leídas
    const unreadNotifications = await notificationService.getUserNotifications(userId, { 
      unreadOnly: true, 
      limit: 1000 
    });
    
    // Marcar cada una como leída
    const promises = unreadNotifications.map(notification => 
      notificationService.markAsRead(notification.Id, userId)
    );
    
    await Promise.all(promises);
    
    res.json({
      success: true,
      message: `${unreadNotifications.length} notificaciones marcadas como leídas`
    });
    
  } catch (error) {
    console.error('❌ Error marcando todas las notificaciones como leídas:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/notifications/test
 * Envía una notificación de prueba (solo en development)
 */
router.post('/test', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Endpoint de prueba no disponible en producción'
      });
    }
    
    const userId = req.body.userId || 1;
    const type = req.body.type || 'budget_warning';
    
    const result = await notificationService.sendTestNotification(userId);
    
    res.json({
      success: true,
      message: 'Notificación de prueba enviada',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error enviando notificación de prueba:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error enviando notificación de prueba'
    });
  }
});

/**
 * GET /api/notifications/stats
 * Obtiene estadísticas de notificaciones del usuario
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId || 1; // TODO: obtener de sesión real
    
    const notifications = await notificationService.getUserNotifications(userId, { limit: 1000 });
    
    // Calcular estadísticas
    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.ReadAt).length,
      byPriority: {
        high: notifications.filter(n => n.Priority === 'high').length,
        medium: notifications.filter(n => n.Priority === 'medium').length,
        low: notifications.filter(n => n.Priority === 'low').length
      },
      byType: {},
      recent: notifications.filter(n => {
        const createdAt = new Date(n.CreatedAt);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return createdAt > dayAgo;
      }).length
    };
    
    // Agrupar por tipo
    notifications.forEach(notification => {
      const type = notification.Type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de notificaciones:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/notifications/types
 * Obtiene los tipos de notificación disponibles
 */
router.get('/types', (req, res) => {
  try {
    const types = {
      budget: {
        budget_warning: 'Advertencia de presupuesto (80%)',
        budget_critical: 'Presupuesto crítico (95%)',
        daily_budget_exceeded: 'Presupuesto diario agotado'
      },
      control: {
        campaign_paused: 'Campaña pausada automáticamente'
      },
      performance: {
        cpc_exceeded: 'CPC límite excedido'
      },
      optimization: {
        bids_reduced: 'Pujas reducidas automáticamente'
      },
      schedule: {
        campaign_ending: 'Campaña próxima a finalizar'
      }
    };
    
    res.json({
      success: true,
      data: types
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo tipos de notificación:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/notifications/send
 * Envía una notificación personalizada (admin only)
 */
router.post('/send', async (req, res) => {
  try {
    // TODO: Verificar permisos de admin
    const isAdmin = req.user?.role === 'admin' || process.env.NODE_ENV === 'development';
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes'
      });
    }
    
    const { type, data, context } = req.body;
    
    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'Tipo y datos son requeridos'
      });
    }
    
    const result = await notificationService.sendNotification(type, data, context);
    
    res.json({
      success: true,
      message: 'Notificación enviada',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Error enviando notificación personalizada:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error enviando notificación'
    });
  }
});

module.exports = router;
