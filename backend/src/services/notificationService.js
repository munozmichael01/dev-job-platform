const { pool, poolConnect, sql } = require('../db/db');

/**
 * NotificationService - Sistema de alertas y notificaciones
 * 
 * Maneja notificaciones para:
 * - Límites de presupuesto alcanzados
 * - Campañas pausadas automáticamente  
 * - CPC excedido
 * - Fechas de campaña
 * - Acciones automáticas tomadas
 * 
 * Soporta múltiples canales:
 * - Dashboard (en tiempo real)
 * - Email
 * - Webhook
 * - SMS (futuro)
 * - Slack/Teams (futuro)
 */
class NotificationService {
  
  constructor() {
    this.config = {
      // Configuración de canales de notificación
      channels: {
        dashboard: { enabled: true },
        email: { 
          enabled: process.env.EMAIL_NOTIFICATIONS === 'true',
          smtp: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          from: process.env.SMTP_FROM || 'alerts@jobplatform.com'
        },
        webhook: {
          enabled: process.env.WEBHOOK_NOTIFICATIONS === 'true',
          url: process.env.WEBHOOK_URL,
          timeout: 5000
        }
      },
      
      // Templates de mensajes
      templates: {
        budget_warning: {
          title: '⚠️ Presupuesto de campaña en advertencia',
          message: 'La campaña "{campaignName}" ha usado {percentage}% de su presupuesto (€{spent}/€{budget})',
          priority: 'medium',
          category: 'budget'
        },
        budget_critical: {
          title: '🚨 Presupuesto de campaña crítico', 
          message: 'La campaña "{campaignName}" ha usado {percentage}% de su presupuesto (€{spent}/€{budget})',
          priority: 'high',
          category: 'budget'
        },
        campaign_paused: {
          title: '⏸️ Campaña pausada automáticamente',
          message: 'La campaña "{campaignName}" ha sido pausada por: {reason}',
          priority: 'high',
          category: 'control'
        },
        cpc_exceeded: {
          title: '💳 CPC límite excedido',
          message: 'La campaña "{campaignName}" excede el CPC máximo: €{currentCPA} > €{maxCPC}',
          priority: 'medium',
          category: 'performance'
        },
        daily_budget_exceeded: {
          title: '💰 Presupuesto diario agotado',
          message: 'La campaña "{campaignName}" ha agotado su presupuesto diario: €{todaySpend}/€{dailyBudget}',
          priority: 'high',
          category: 'budget'
        },
        campaign_ending: {
          title: '📅 Campaña próxima a finalizar',
          message: 'La campaña "{campaignName}" finaliza el {endDate} - quedan {daysLeft} días',
          priority: 'medium',
          category: 'schedule'
        },
        bids_reduced: {
          title: '📉 Pujas reducidas automáticamente',
          message: 'Las pujas de "{campaignName}" se redujeron de €{oldBid} a €{newBid} por exceder límite CPC',
          priority: 'medium',
          category: 'optimization'
        }
      }
    };
    
    console.log('🔔 NotificationService inicializado');
  }

  /**
   * Envía una notificación a través de todos los canales habilitados
   * @param {string} type - Tipo de notificación (budget_warning, campaign_paused, etc.)
   * @param {Object} data - Datos para la notificación
   * @param {Object} context - Contexto adicional (userId, campaignId, etc.)
   */
  async sendNotification(type, data, context = {}) {
    try {
      console.log(`🔔 Enviando notificación: ${type}`);
      
      const template = this.config.templates[type];
      if (!template) {
        console.warn(`⚠️ Template no encontrado para tipo: ${type}`);
        return { success: false, error: 'Template not found' };
      }
      
      // Construir mensaje desde template
      const notification = this.buildNotification(template, data, context);
      
      // Guardar en base de datos
      const notificationId = await this.saveNotification(notification, context);
      
      // Enviar por todos los canales habilitados
      const results = await Promise.allSettled([
        this.sendDashboardNotification(notification, context),
        this.sendEmailNotification(notification, context),
        this.sendWebhookNotification(notification, context)
      ]);
      
      // Procesar resultados
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const total = results.length;
      
      console.log(`✅ Notificación enviada: ${successful}/${total} canales exitosos`);
      
      return {
        success: true,
        notificationId,
        channels: {
          successful,
          total,
          results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason })
        }
      };
      
    } catch (error) {
      console.error(`❌ Error enviando notificación ${type}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Construye el objeto de notificación desde template y datos
   * @param {Object} template - Template de la notificación
   * @param {Object} data - Datos para interpolar
   * @param {Object} context - Contexto adicional
   * @returns {Object} Notificación construida
   */
  buildNotification(template, data, context) {
    // Interpolar variables en el mensaje
    let message = template.message;
    let title = template.title;
    
    // Reemplazar variables en formato {variable}
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      message = message.replace(regex, value);
      title = title.replace(regex, value);
    });
    
    return {
      id: null, // Se asignará al guardar
      type: template.category,
      priority: template.priority,
      title,
      message,
      data,
      context,
      createdAt: new Date().toISOString(),
      readAt: null,
      acknowledged: false
    };
  }

  /**
   * Guarda la notificación en base de datos
   * @param {Object} notification - Notificación a guardar
   * @param {Object} context - Contexto (userId, campaignId)
   * @returns {Promise<number>} ID de la notificación guardada
   */
  async saveNotification(notification, context) {
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('UserId', sql.Int, context.userId || null)
        .input('CampaignId', sql.Int, context.campaignId || null)
        .input('Type', sql.NVarChar(50), notification.type)
        .input('Priority', sql.NVarChar(20), notification.priority)
        .input('Title', sql.NVarChar(255), notification.title)
        .input('Message', sql.NVarChar(1000), notification.message)
        .input('Data', sql.NVarChar(sql.MAX), JSON.stringify(notification.data))
        .input('Context', sql.NVarChar(sql.MAX), JSON.stringify(notification.context))
        .query(`
          INSERT INTO Notifications 
          (UserId, CampaignId, Type, Priority, Title, Message, Data, Context, CreatedAt)
          OUTPUT INSERTED.Id
          VALUES 
          (@UserId, @CampaignId, @Type, @Priority, @Title, @Message, @Data, @Context, GETDATE())
        `);
      
      const notificationId = result.recordset[0].Id;
      console.log(`💾 Notificación guardada con ID: ${notificationId}`);
      
      return notificationId;
      
    } catch (error) {
      console.error(`❌ Error guardando notificación: ${error.message}`);
      // No lanzar error para que no falle el envío
      return null;
    }
  }

  /**
   * Envía notificación al dashboard (WebSocket/SSE en el futuro)
   * @param {Object} notification - Notificación
   * @param {Object} context - Contexto
   */
  async sendDashboardNotification(notification, context) {
    if (!this.config.channels.dashboard.enabled) {
      return { success: false, reason: 'dashboard_disabled' };
    }
    
    try {
      // Por ahora solo loggeamos - en el futuro se puede integrar con WebSocket
      console.log(`📱 Dashboard notification: ${notification.title}`);
      console.log(`   Message: ${notification.message}`);
      console.log(`   Priority: ${notification.priority}`);
      
      // TODO: Implementar WebSocket/SSE para notificaciones en tiempo real
      // websocketService.sendToUser(context.userId, notification);
      
      return { 
        success: true, 
        channel: 'dashboard',
        method: 'logged' // Cambiar a 'websocket' cuando se implemente
      };
      
    } catch (error) {
      return { success: false, channel: 'dashboard', error: error.message };
    }
  }

  /**
   * Envía notificación por email
   * @param {Object} notification - Notificación
   * @param {Object} context - Contexto
   */
  async sendEmailNotification(notification, context) {
    if (!this.config.channels.email.enabled) {
      return { success: false, reason: 'email_disabled' };
    }
    
    try {
      // Obtener email del usuario
      const userEmail = await this.getUserEmail(context.userId);
      if (!userEmail) {
        return { success: false, reason: 'user_email_not_found' };
      }
      
      const nodemailer = require('nodemailer');
      
      // Crear transporter
      const transporter = nodemailer.createTransporter(this.config.channels.email.smtp);
      
      // Construir email
      const mailOptions = {
        from: this.config.channels.email.from,
        to: userEmail,
        subject: notification.title,
        html: this.buildEmailTemplate(notification, context),
        text: notification.message // Fallback text
      };
      
      // Enviar email
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`📧 Email enviado a ${userEmail}: ${info.messageId}`);
      
      return { 
        success: true, 
        channel: 'email',
        recipient: userEmail,
        messageId: info.messageId
      };
      
    } catch (error) {
      console.error(`❌ Error enviando email: ${error.message}`);
      return { success: false, channel: 'email', error: error.message };
    }
  }

  /**
   * Envía notificación por webhook
   * @param {Object} notification - Notificación
   * @param {Object} context - Contexto
   */
  async sendWebhookNotification(notification, context) {
    if (!this.config.channels.webhook.enabled || !this.config.channels.webhook.url) {
      return { success: false, reason: 'webhook_disabled_or_no_url' };
    }
    
    try {
      const axios = require('axios');
      
      const payload = {
        timestamp: new Date().toISOString(),
        type: 'campaign_alert',
        notification: {
          ...notification,
          context
        },
        source: 'job-platform-alerts'
      };
      
      const response = await axios.post(
        this.config.channels.webhook.url,
        payload,
        {
          timeout: this.config.channels.webhook.timeout,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'JobPlatform-Alerts/1.0'
          }
        }
      );
      
      console.log(`🔗 Webhook enviado: ${response.status} ${response.statusText}`);
      
      return { 
        success: true, 
        channel: 'webhook',
        status: response.status,
        url: this.config.channels.webhook.url
      };
      
    } catch (error) {
      console.error(`❌ Error enviando webhook: ${error.message}`);
      return { success: false, channel: 'webhook', error: error.message };
    }
  }

  /**
   * Construye template HTML para email
   * @param {Object} notification - Notificación
   * @param {Object} context - Contexto
   * @returns {string} HTML del email
   */
  buildEmailTemplate(notification, context) {
    const priorityColors = {
      low: '#10B981',    // verde
      medium: '#F59E0B', // amarillo
      high: '#EF4444'    // rojo
    };
    
    const color = priorityColors[notification.priority] || '#6B7280';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${notification.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: ${color}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
          .priority-badge { 
            display: inline-block; 
            padding: 4px 8px; 
            background: ${color}; 
            color: white; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: bold;
          }
          .data-table { border-collapse: collapse; width: 100%; margin: 15px 0; }
          .data-table th, .data-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .data-table th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${notification.title}</h1>
          <span class="priority-badge">${notification.priority.toUpperCase()}</span>
        </div>
        
        <div class="content">
          <p><strong>Mensaje:</strong></p>
          <p>${notification.message}</p>
          
          ${context.campaignId ? `<p><strong>Campaña ID:</strong> ${context.campaignId}</p>` : ''}
          
          ${Object.keys(notification.data).length > 0 ? `
            <p><strong>Detalles:</strong></p>
            <table class="data-table">
              ${Object.entries(notification.data).map(([key, value]) => 
                `<tr><th>${key}</th><td>${value}</td></tr>`
              ).join('')}
            </table>
          ` : ''}
          
          <p><strong>Fecha:</strong> ${new Date(notification.createdAt).toLocaleString('es-ES')}</p>
        </div>
        
        <div class="footer">
          <p>Job Platform - Sistema de Alertas Automáticas</p>
          <p>Este es un mensaje automático, por favor no responder a este email.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Obtiene el email de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<string|null>} Email del usuario
   */
  async getUserEmail(userId) {
    if (!userId) return null;
    
    try {
      await poolConnect;
      
      const result = await pool.request()
        .input('UserId', sql.Int, userId)
        .query(`
          SELECT Email FROM Users WHERE Id = @UserId
        `);
      
      return result.recordset[0]?.Email || null;
      
    } catch (error) {
      console.error(`❌ Error obteniendo email de usuario ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Marca una notificación como leída
   * @param {number} notificationId - ID de la notificación
   * @param {number} userId - ID del usuario
   */
  async markAsRead(notificationId, userId) {
    try {
      await poolConnect;
      
      await pool.request()
        .input('NotificationId', sql.Int, notificationId)
        .input('UserId', sql.Int, userId)
        .query(`
          UPDATE Notifications 
          SET ReadAt = GETDATE()
          WHERE Id = @NotificationId 
            AND (UserId = @UserId OR UserId IS NULL)
            AND ReadAt IS NULL
        `);
      
      console.log(`✅ Notificación ${notificationId} marcada como leída`);
      
    } catch (error) {
      console.error(`❌ Error marcando notificación como leída: ${error.message}`);
    }
  }

  /**
   * Obtiene notificaciones de un usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de notificaciones
   */
  async getUserNotifications(userId, options = {}) {
    try {
      await poolConnect;
      
      const {
        limit = 50,
        offset = 0,
        unreadOnly = false,
        priority = null,
        type = null
      } = options;
      
      let whereClause = 'WHERE (UserId = @UserId OR UserId IS NULL)';
      const inputs = [['UserId', sql.Int, userId]];
      
      if (unreadOnly) {
        whereClause += ' AND ReadAt IS NULL';
      }
      
      if (priority) {
        whereClause += ' AND Priority = @Priority';
        inputs.push(['Priority', sql.NVarChar(20), priority]);
      }
      
      if (type) {
        whereClause += ' AND Type = @Type';
        inputs.push(['Type', sql.NVarChar(50), type]);
      }
      
      const request = pool.request();
      inputs.forEach(([name, sqlType, value]) => request.input(name, sqlType, value));
      
      const result = await request
        .input('Limit', sql.Int, limit)
        .input('Offset', sql.Int, offset)
        .query(`
          SELECT 
            Id, CampaignId, Type, Priority, Title, Message, 
            Data, Context, CreatedAt, ReadAt, Acknowledged
          FROM Notifications
          ${whereClause}
          ORDER BY CreatedAt DESC
          OFFSET @Offset ROWS
          FETCH NEXT @Limit ROWS ONLY
        `);
      
      return result.recordset.map(notification => ({
        ...notification,
        data: notification.Data ? JSON.parse(notification.Data) : {},
        context: notification.Context ? JSON.parse(notification.Context) : {}
      }));
      
    } catch (error) {
      console.error(`❌ Error obteniendo notificaciones: ${error.message}`);
      return [];
    }
  }

  /**
   * Envía notificación de prueba
   * @param {number} userId - ID del usuario para testing
   */
  async sendTestNotification(userId) {
    return await this.sendNotification('budget_warning', {
      campaignName: 'Campaña de Prueba',
      percentage: '85',
      spent: '850',
      budget: '1000'
    }, {
      userId,
      campaignId: 999
    });
  }
}

module.exports = { NotificationService };
