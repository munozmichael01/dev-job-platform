const sql = require('mssql');
const { pool, poolConnect } = require('../../db/db');

/**
 * WhatJobsService - Servicio para integración con WhatJobs
 * 
 * Funcionalidades:
 * 1. 📤 XML Feed Generation - Genera feeds XML para WhatJobs
 * 2. 📥 S2S Tracking - Procesa clicks y conversiones
 * 3. 🎯 Optimization - Optimización basada en datos reales
 * 4. 🌍 Multi-country - Soporte para múltiples países
 */
class WhatJobsService {
  constructor(config = {}) {
    this.config = {
      authKey: config.authKey || '',
      country: config.country || 'ES',
      defaultCPC: config.defaultCPC || 2.5,
      trackingEndpoint: 'https://api.whatjobs.com/api/v1/client/s2s/tracking',
      feedUrl: config.feedUrl || '',
      ...config
    };
    
    console.log(`🌍 WhatJobsService initialized for country: ${this.config.country}`);
  }

  /**
   * 📤 Genera XML Feed para WhatJobs
   * Convierte ofertas JobOffers a formato XML WhatJobs
   */
  async generateWhatJobsFeed(userId, offers, campaignConfig = {}) {
    try {
      console.log(`📤 Generando feed XML WhatJobs para ${offers.length} ofertas (User: ${userId})`);
      
      if (!this.config.authKey) {
        throw new Error('WhatJobs authKey es requerido para generar feed');
      }

      // Calcular CPC por oferta basado en campaña
      const baseCPC = campaignConfig.maxCPA || this.config.defaultCPC;
      const cpcPerOffer = this.calculateCPCPerOffer(baseCPC, offers.length);

      // Generar XML header
      let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
      xml += `<jobs>\n`;

      // Procesar cada oferta
      for (const offer of offers) {
        xml += this.generateJobXML(offer, cpcPerOffer, campaignConfig);
      }

      xml += `</jobs>\n`;

      console.log(`✅ Feed XML WhatJobs generado: ${offers.length} ofertas, CPC promedio: €${cpcPerOffer.toFixed(2)}`);
      return xml;

    } catch (error) {
      console.error(`❌ Error generando feed WhatJobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🏢 Genera XML para una oferta individual
   */
  generateJobXML(offer, cpc, campaignConfig = {}) {
    // Formatear fechas para WhatJobs (DD.MM.YYYY)
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    };

    // Mapear tipo de trabajo
    const jobTypeMapping = {
      'full-time': 'full-time',
      'part-time': 'part-time', 
      'contract': 'contract',
      'freelance': 'freelance',
      'indefinido': 'full-time',
      'temporal': 'contract',
      'practicas': 'internship'
    };

    // Determinar ubicación y país
    const location = offer.City || offer.Region || 'Madrid';
    const country = this.config.country;
    const language = country === 'ES' ? 'es' : 'en';

    // Generar URL con tracking
    const trackingUrl = this.generateTrackingUrl(offer.ExternalId || offer.Id);

    // Formatear salario
    const salary = this.formatSalary(offer.Salary || offer.SalaryMin, offer.SalaryMax, country);

    // Calcular fecha de expiración (30 días por defecto)
    const expireDate = offer.EndDate ? 
      formatDate(offer.EndDate) : 
      formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

    let xml = `  <job id="${offer.ExternalId || offer.Id}">\n`;
    xml += `    <id>${offer.ExternalId || offer.Id}</id>\n`;
    xml += `    <link>${trackingUrl}</link>\n`;
    xml += `    <title><![CDATA[${this.escapeXML(offer.Title || offer.JobTitle)}]]></title>\n`;
    xml += `    <location><![CDATA[${this.escapeXML(location)}]]></location>\n`;
    xml += `    <country>${country}</country>\n`;
    xml += `    <language>${language}</language>\n`;
    xml += `    <description><![CDATA[${this.formatDescription(offer.Description)}]]></description>\n`;
    xml += `    <CPC>${cpc.toFixed(2)}</CPC>\n`;
    xml += `    <pubdate>${formatDate(offer.CreatedAt)}</pubdate>\n`;
    xml += `    <updated>${formatDate(offer.UpdatedAt || offer.CreatedAt)}</updated>\n`;
    xml += `    <salary>${salary}</salary>\n`;
    xml += `    <company><![CDATA[${this.escapeXML(offer.CompanyName || 'Empresa Confidencial')}]]></company>\n`;
    xml += `    <expire>${expireDate}</expire>\n`;
    xml += `    <jobtype>${jobTypeMapping[offer.ContractType?.toLowerCase()] || 'full-time'}</jobtype>\n`;
    
    // Campos opcionales pero valiosos
    if (offer.Sector) {
      xml += `    <category><![CDATA[${this.escapeXML(offer.Sector)}]]></category>\n`;
    }
    
    if (offer.WorkMode) {
      const locationTypeMapping = {
        'remoto': 'remote',
        'hibrido': 'hybrid', 
        'presencial': 'onsite'
      };
      xml += `    <joblocationtype>${locationTypeMapping[offer.WorkMode?.toLowerCase()] || 'onsite'}</joblocationtype>\n`;
    }

    if (offer.PostalCode || offer.ZipCode) {
      xml += `    <zipcode>${offer.PostalCode || offer.ZipCode}</zipcode>\n`;
    }

    if (offer.Address) {
      xml += `    <street><![CDATA[${this.escapeXML(offer.Address)}]]></street>\n`;
    }

    xml += `  </job>\n`;
    return xml;
  }

  /**
   * 🔗 Genera URL con tracking de WhatJobs
   */
  generateTrackingUrl(offerId) {
    // URL base de la oferta en nuestro sistema
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3006';
    const offerUrl = `${baseUrl}/ofertas/${offerId}`;
    
    // Agregar parámetros de tracking WhatJobs
    const trackingParams = new URLSearchParams({
      utm_source: 'whatjobs',
      utm_medium: 'cpc',
      utm_campaign: 'job_feed',
      wj_offer_id: offerId
    });

    return `${offerUrl}?${trackingParams.toString()}`;
  }

  /**
   * 💰 Calcula CPC por oferta basado en presupuesto
   */
  calculateCPCPerOffer(maxCPA, totalOffers) {
    if (!maxCPA || totalOffers === 0) return this.config.defaultCPC;
    
    // Usar 60-80% del CPA como CPC para dejar margen
    const cpcMultiplier = 0.7;
    const calculatedCPC = (maxCPA * cpcMultiplier) / Math.sqrt(totalOffers);
    
    // Límites mínimos y máximos
    const minCPC = 0.5;
    const maxCPC = Math.min(maxCPA * 0.9, 20.0);
    
    return Math.max(minCPC, Math.min(calculatedCPC, maxCPC));
  }

  /**
   * 💶 Formatea salario según país
   */
  formatSalary(salaryMin, salaryMax, country) {
    const currency = country === 'ES' ? '€' : '$';
    
    if (salaryMin && salaryMax && salaryMin !== salaryMax) {
      return `${currency}${salaryMin} - ${currency}${salaryMax}`;
    } else if (salaryMin) {
      return `${currency}${salaryMin}`;
    } else if (salaryMax) {
      return `${currency}${salaryMax}`;
    }
    
    return 'Salario a convenir';
  }

  /**
   * 📝 Formatea descripción para XML (HTML permitido)
   */
  formatDescription(description) {
    if (!description) return 'Descripción no disponible.';
    
    // WhatJobs acepta HTML básico en descripción
    let formatted = description
      .replace(/\n/g, '<br/>')
      .replace(/\t/g, '    ');
    
    // Asegurar que no sea demasiado larga (límite razonable)
    if (formatted.length > 5000) {
      formatted = formatted.substring(0, 4900) + '...';
    }
    
    return formatted;
  }

  /**
   * 🔒 Escapa caracteres especiales para XML
   */
  escapeXML(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 📥 Procesa click de WhatJobs (S2S Tracking)
   */
  async processWhatJobsClick(wjClickID, authKey, offerId = null) {
    try {
      console.log(`📥 Procesando click WhatJobs: ${wjClickID}`);
      
      if (!wjClickID || !authKey) {
        throw new Error('wjClickID y authKey son requeridos');
      }

      if (authKey !== this.config.authKey) {
        throw new Error('authKey inválido para WhatJobs');
      }

      await poolConnect;

      // Registrar click en tabla Applications
      const clickData = {
        ChannelId: 'whatjobs',
        ExternalApplicationId: wjClickID,
        OfferId: offerId,
        ApplicationData: JSON.stringify({
          clickId: wjClickID,
          timestamp: new Date().toISOString(),
          source: 'whatjobs_click'
        }),
        ReceivedAt: new Date()
      };

      await pool.request()
        .input('ChannelId', sql.NVarChar(50), clickData.ChannelId)
        .input('ExternalApplicationId', sql.NVarChar(255), clickData.ExternalApplicationId)
        .input('OfferId', sql.BigInt, clickData.OfferId)
        .input('ApplicationData', sql.NVarChar(sql.MAX), clickData.ApplicationData)
        .input('ReceivedAt', sql.DateTime, clickData.ReceivedAt)
        .query(`
          INSERT INTO Applications 
          (ChannelId, ExternalApplicationId, OfferId, ApplicationData, ReceivedAt)
          VALUES 
          (@ChannelId, @ExternalApplicationId, @OfferId, @ApplicationData, @ReceivedAt)
        `);

      console.log(`✅ Click WhatJobs registrado: ${wjClickID}`);
      return { success: true, clickId: wjClickID };

    } catch (error) {
      console.error(`❌ Error procesando click WhatJobs: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🎯 Reporta conversión a WhatJobs (S2S)
   */
  async reportConversion(wjClickID) {
    try {
      console.log(`🎯 Reportando conversión a WhatJobs: ${wjClickID}`);
      
      if (!wjClickID) {
        throw new Error('wjClickID es requerido para reportar conversión');
      }

      // Construir URL de tracking S2S
      const trackingUrl = new URL(this.config.trackingEndpoint);
      trackingUrl.searchParams.set('authKey', this.config.authKey);
      trackingUrl.searchParams.set('wjClickID', wjClickID);

      // Enviar GET request a WhatJobs
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(trackingUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'JobPlatform-WhatJobs-Integration/1.0'
        },
        timeout: 10000
      });

      const responseText = await response.text();
      
      if (response.ok) {
        console.log(`✅ Conversión reportada a WhatJobs: ${wjClickID} - Response: ${response.status}`);
        
        // Actualizar base de datos con confirmación
        await this.updateConversionStatus(wjClickID, true, responseText);
        
        return { 
          success: true, 
          clickId: wjClickID, 
          status: response.status,
          response: responseText 
        };
      } else {
        console.warn(`⚠️ WhatJobs respondió con error: ${response.status} - ${responseText}`);
        await this.updateConversionStatus(wjClickID, false, responseText);
        
        return { 
          success: false, 
          clickId: wjClickID, 
          status: response.status, 
          error: responseText 
        };
      }

    } catch (error) {
      console.error(`❌ Error reportando conversión WhatJobs: ${error.message}`);
      await this.updateConversionStatus(wjClickID, false, error.message);
      throw error;
    }
  }

  /**
   * 🔄 Actualiza estado de conversión en BD
   */
  async updateConversionStatus(wjClickID, success, response) {
    try {
      await poolConnect;
      
      await pool.request()
        .input('ClickId', sql.NVarChar(255), wjClickID)
        .input('Converted', sql.Bit, success)
        .input('ConversionResponse', sql.NVarChar(sql.MAX), response)
        .input('ConvertedAt', sql.DateTime, new Date())
        .query(`
          UPDATE Applications 
          SET 
            Converted = @Converted,
            ConversionResponse = @ConversionResponse,
            ConvertedAt = @ConvertedAt
          WHERE ExternalApplicationId = @ClickId 
            AND ChannelId = 'whatjobs'
        `);
      
      console.log(`🔄 Estado de conversión actualizado: ${wjClickID} = ${success}`);
      
    } catch (error) {
      console.error(`❌ Error actualizando conversión: ${error.message}`);
    }
  }

  /**
   * 📊 Obtiene métricas de performance WhatJobs
   */
  async getPerformanceMetrics(userId, dateRange = 30) {
    try {
      await poolConnect;
      
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (dateRange * 24 * 60 * 60 * 1000));
      
      const result = await pool.request()
        .input('StartDate', sql.DateTime, startDate)
        .input('EndDate', sql.DateTime, endDate)
        .query(`
          SELECT 
            COUNT(*) as TotalClicks,
            SUM(CASE WHEN Converted = 1 THEN 1 ELSE 0 END) as TotalConversions,
            CAST(AVG(CASE WHEN Converted = 1 THEN 1.0 ELSE 0.0 END) * 100 AS DECIMAL(5,2)) as ConversionRate,
            COUNT(DISTINCT OfferId) as UniqueOffers
          FROM Applications 
          WHERE ChannelId = 'whatjobs'
            AND ReceivedAt BETWEEN @StartDate AND @EndDate
        `);

      const metrics = result.recordset[0] || {
        TotalClicks: 0,
        TotalConversions: 0, 
        ConversionRate: 0,
        UniqueOffers: 0
      };

      console.log(`📊 Métricas WhatJobs (${dateRange}d): ${metrics.TotalClicks} clicks, ${metrics.TotalConversions} conversiones`);
      
      return {
        channel: 'whatjobs',
        period: `${dateRange} días`,
        clicks: metrics.TotalClicks,
        conversions: metrics.TotalConversions,
        conversionRate: metrics.ConversionRate,
        uniqueOffers: metrics.UniqueOffers,
        ctr: metrics.TotalClicks > 0 ? ((metrics.TotalConversions / metrics.TotalClicks) * 100).toFixed(2) : 0
      };

    } catch (error) {
      console.error(`❌ Error obteniendo métricas WhatJobs: ${error.message}`);
      return {
        channel: 'whatjobs',
        error: error.message,
        clicks: 0,
        conversions: 0,
        conversionRate: 0
      };
    }
  }

  /**
   * ✅ Valida configuración de WhatJobs
   */
  async validateConfiguration() {
    try {
      console.log('🔍 Validando configuración WhatJobs...');
      
      const errors = [];
      
      if (!this.config.authKey || this.config.authKey.length < 10) {
        errors.push('authKey inválido o faltante');
      }
      
      if (!['ES', 'MX', 'GB', 'US', 'DE', 'FR', 'IT'].includes(this.config.country)) {
        errors.push('country debe ser un código ISO válido (ES, MX, GB, US, etc.)');
      }
      
      if (!this.config.defaultCPC || this.config.defaultCPC < 0.1 || this.config.defaultCPC > 50) {
        errors.push('defaultCPC debe estar entre 0.1 y 50');
      }

      if (errors.length > 0) {
        throw new Error(`Configuración inválida: ${errors.join(', ')}`);
      }

      // Test opcional de conectividad (sin hacer request real)
      const isValid = true; // Por ahora siempre válido si pasa validaciones básicas
      
      console.log('✅ Configuración WhatJobs válida');
      return { isValid: true, message: 'Configuración válida' };
      
    } catch (error) {
      console.error(`❌ Error validando WhatJobs: ${error.message}`);
      return { isValid: false, error: error.message };
    }
  }
}

module.exports = WhatJobsService;
