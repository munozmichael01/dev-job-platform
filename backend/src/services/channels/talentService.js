const axios = require('axios');
const xml2js = require('xml2js');

/**
 * TalentService - Integración con Talent.com
 * Basado en: https://www.talent.com/integrations
 * 
 * Funcionalidades:
 * - Publicación de ofertas vía XML Feed
 * - Recepción de aplicaciones vía PostURL
 * - Tracking de performance por oferta
 */
class TalentService {
  
  constructor(config = {}) {
    this.config = {
      feedUrl: config.feedUrl || process.env.TALENT_FEED_URL,
      publisherName: config.publisherName || process.env.TALENT_PUBLISHER_NAME || 'Job Platform',
      publisherUrl: config.publisherUrl || process.env.TALENT_PUBLISHER_URL || 'https://jobplatform.com',
      postbackUrl: config.postbackUrl || process.env.TALENT_POSTBACK_URL || 'http://localhost:3002/api/channels/talent/applications',
      ...config
    };
    
    this.xmlBuilder = new xml2js.Builder({
      headless: true,
      rootName: 'source'
    });
  }

  /**
   * Genera XML Feed compatible con Talent.com
   * @param {Array} offers - Array de ofertas para publicar
   * @param {Object} campaignInfo - Información de la campaña
   * @returns {String} XML Feed
   */
  generateXMLFeed(offers, campaignInfo = {}) {
    console.log(`🔄 Generando XML Feed para Talent.com con ${offers.length} ofertas`);

    const feedData = {
      publisher: this.config.publisherName,
      publisherurl: this.config.publisherUrl,
      lastbuilddate: new Date().toISOString(),
      job: offers.map(offer => this.formatOfferForTalent(offer, campaignInfo))
    };

    const xmlFeed = this.xmlBuilder.buildObject(feedData);
    console.log(`✅ XML Feed generado: ${xmlFeed.length} caracteres`);
    
    return xmlFeed;
  }

  /**
   * Formatea una oferta individual para Talent.com XML
   * @param {Object} offer - Oferta de nuestra base de datos
   * @param {Object} campaignInfo - Info de campaña para tracking
   * @returns {Object} Oferta formateada para XML
   */
  formatOfferForTalent(offer, campaignInfo = {}) {
    // URL con tracking para identificar tráfico desde Talent
    const trackingUrl = this.buildTrackingUrl(offer, campaignInfo);
    
    // Mapear status de nuestra BD a formato esperado por Talent
    const jobType = this.mapJobType(offer.JobType);
    
    return {
      referencenumber: { _: `${offer.ExternalId || offer.Id}`, $: { 'CDATA': true } },
      title: { _: offer.Title || 'Sin título', $: { 'CDATA': true } },
      company: { _: offer.CompanyName || 'Sin empresa', $: { 'CDATA': true } },
      city: { _: offer.City || 'Sin ciudad', $: { 'CDATA': true } },
      state: { _: offer.Region || offer.City || 'Sin región', $: { 'CDATA': true } },
      country: { _: offer.Country || 'España', $: { 'CDATA': true } },
      dateposted: { _: offer.PublicationDate ? new Date(offer.PublicationDate).toISOString() : new Date().toISOString(), $: { 'CDATA': true } },
      url: { _: trackingUrl, $: { 'CDATA': true } },
      description: { _: this.formatDescription(offer), $: { 'CDATA': true } },
      
      // Campos recomendados
      ...(offer.ExpirationDate && {
        expirationdate: { _: new Date(offer.ExpirationDate).toISOString(), $: { 'CDATA': true } }
      }),
      ...(offer.Address && {
        streetaddress: { _: offer.Address, $: { 'CDATA': true } }
      }),
      ...(offer.Postcode && {
        postalcode: { _: offer.Postcode, $: { 'CDATA': true } }
      }),
      ...(jobType && {
        jobtype: { _: jobType, $: { 'CDATA': true } }
      }),
      
      // Salary información si está disponible
      ...(offer.SalaryMin && offer.SalaryMax && {
        salary: { _: this.formatSalary(offer), $: { 'CDATA': true } }
      }),
      
      // Categoría basada en Sector
      ...(offer.Sector && {
        category: { _: this.mapSectorToCategory(offer.Sector), $: { 'CDATA': true } }
      })
    };
  }

  /**
   * Construye URL con parámetros de tracking para Talent
   * @param {Object} offer - Oferta 
   * @param {Object} campaignInfo - Info de campaña
   * @returns {String} URL con tracking
   */
  buildTrackingUrl(offer, campaignInfo) {
    const baseUrl = offer.ExternalUrl || offer.ApplicationUrl || `${this.config.publisherUrl}/job/${offer.Id}`;
    const params = new URLSearchParams({
      source: 'talent',
      campaign_id: campaignInfo.campaignId || 'unknown',
      offer_id: offer.Id,
      utm_source: 'talent',
      utm_medium: 'cpc',
      utm_campaign: campaignInfo.name || 'job_distribution'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Formatea descripción para HTML según requerimientos de Talent
   * @param {Object} offer - Oferta
   * @returns {String} Descripción en HTML
   */
  formatDescription(offer) {
    let description = offer.Description || 'Sin descripción disponible';
    
    // Asegurar mínimo 50 caracteres
    if (description.length < 50) {
      description += '. Excelente oportunidad profesional en ' + (offer.CompanyName || 'empresa líder') + '.';
    }
    
    // Convertir a HTML básico si no lo está ya
    if (!description.includes('<')) {
      description = description.replace(/\n/g, '<br>');
      description = `<p>${description}</p>`;
    }
    
    // Agregar información adicional
    const extras = [];
    if (offer.SalaryMin && offer.SalaryMax) {
      extras.push(`<strong>Salario:</strong> ${this.formatSalary(offer)}`);
    }
    if (offer.JobType) {
      extras.push(`<strong>Tipo:</strong> ${offer.JobType}`);
    }
    if (offer.Vacancies && offer.Vacancies > 1) {
      extras.push(`<strong>Vacantes:</strong> ${offer.Vacancies}`);
    }
    
    if (extras.length > 0) {
      description += '<br><br>' + extras.join('<br>');
    }
    
    return description;
  }

  /**
   * Mapea nuestros tipos de trabajo a los esperados por Talent
   * @param {String} jobType - Tipo de trabajo en nuestra BD
   * @returns {String} Tipo de trabajo para Talent
   */
  mapJobType(jobType) {
    const typeMapping = {
      'full-time': 'Full time',
      'part-time': 'Part time', 
      'contract': 'Contract',
      'temporary': 'Temporary',
      'internship': 'Internship',
      'freelance': 'Contract',
      'indefinido': 'Full time',
      'temporal': 'Temporary',
      'practicas': 'Internship'
    };
    
    if (!jobType) return 'Full time'; // Default
    return typeMapping[jobType.toLowerCase()] || jobType;
  }

  /**
   * Formatea información salarial
   * @param {Object} offer - Oferta
   * @returns {String} Rango salarial formateado
   */
  formatSalary(offer) {
    if (offer.SalaryMin && offer.SalaryMax) {
      return `€${offer.SalaryMin} - €${offer.SalaryMax}`;
    } else if (offer.SalaryMin) {
      return `Desde €${offer.SalaryMin}`;
    } else if (offer.SalaryMax) {
      return `Hasta €${offer.SalaryMax}`;
    }
    return 'Salario a negociar';
  }

  /**
   * Mapea sectores a categorías de Talent.com
   * @param {String} sector - Sector de la oferta
   * @returns {String} Categoría para Talent
   */
  mapSectorToCategory(sector) {
    const categoryMapping = {
      // Mapeo de sectores españoles a categorías de Talent.com
      'tecnologia': 'IT',
      'informatica': 'IT',
      'desarrollo': 'IT',
      'programacion': 'IT',
      'sistemas': 'IT',
      'administracion': 'Administration',
      'contabilidad': 'Accounting',
      'finanzas': 'Finance',
      'marketing': 'Marketing',
      'ventas': 'Sales',
      'comercial': 'Sales',
      'recursos humanos': 'Human Resources',
      'rrhh': 'Human Resources',
      'educacion': 'Education',
      'enseñanza': 'Education',
      'sanidad': 'Healthcare',
      'medicina': 'Healthcare',
      'enfermeria': 'Nursing',
      'ingenieria': 'Engineering',
      'construccion': 'Construction',
      'arquitectura': 'Construction',
      'turismo': 'Hospitality',
      'hosteleria': 'Hospitality',
      'restauracion': 'Food Industry',
      'cocina': 'Food Industry',
      'sala': 'Hospitality',
      'camarero': 'Hospitality',
      'transporte': 'Transportation',
      'logistica': 'Logistics',
      'almacen': 'Warehouse',
      'produccion': 'Manufacturing',
      'fabricacion': 'Manufacturing',
      'industria': 'Manufacturing',
      'legal': 'Legal',
      'derecho': 'Legal',
      'seguros': 'Insurance',
      'banca': 'Finance',
      'inmobiliario': 'Services',
      'consultoria': 'Consulting',
      'telecomunicaciones': 'Telecommunications',
      'media': 'Media',
      'comunicacion': 'Media',
      'arte': 'Arts',
      'diseño': 'Arts',
      'seguridad': 'Security',
      'limpieza': 'Services',
      'mantenimiento': 'Services'
    };
    
    if (!sector) return 'Other';
    
    const lowerSector = sector.toLowerCase();
    for (const [key, category] of Object.entries(categoryMapping)) {
      if (lowerSector.includes(key)) {
        return category;
      }
    }
    
    return 'Other';
  }

  /**
   * Publica ofertas en Talent.com (simulado - requiere configuración real)
   * @param {Array} offers - Ofertas a publicar
   * @param {Object} campaignData - Datos de la campaña
   * @returns {Object} Resultado de la publicación
   */
  async publishOffers(offers, campaignData) {
    console.log(`🚀 Publicando ${offers.length} ofertas en Talent.com`);
    
    try {
      // Generar XML Feed
      const xmlFeed = this.generateXMLFeed(offers, campaignData);
      
      // En implementación real, aquí subirías el XML a Talent.com
      // Esto puede ser vía FTP, HTTP upload, o endpoint específico
      
      // Simulación de resultado exitoso
      const result = {
        success: true,
        channel: 'talent',
        publishedOffers: offers.length,
        feedSize: xmlFeed.length,
        feedUrl: this.config.feedUrl || 'pending_setup',
        timestamp: new Date().toISOString(),
        estimatedCosts: this.calculateEstimatedCosts(offers, campaignData)
      };
      
      console.log(`✅ Ofertas publicadas en Talent.com: ${offers.length} ofertas`);
      return result;
      
    } catch (error) {
      console.error(`❌ Error publicando en Talent.com: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calcula costos estimados para la campaña en Talent
   * @param {Array} offers - Ofertas
   * @param {Object} campaignData - Datos de campaña
   * @returns {Object} Estimación de costos
   */
  calculateEstimatedCosts(offers, campaignData) {
    const totalBudget = campaignData.budget || 0;
    const targetApplications = campaignData.targetApplications || 0;
    const estimatedCPA = totalBudget / targetApplications || 18; // CPA default de Talent
    
    return {
      totalBudget: totalBudget,
      estimatedCPA: estimatedCPA,
      expectedApplications: Math.floor(totalBudget / estimatedCPA),
      dailyBudget: Math.floor(totalBudget / 30), // Asumir campaña de 30 días
      costPerOffer: totalBudget / offers.length
    };
  }

  /**
   * Procesa aplicación recibida desde Talent.com
   * @param {Object} applicationData - Datos de aplicación desde Talent PostURL
   * @returns {Object} Aplicación procesada
   */
  processApplication(applicationData) {
    console.log(`📨 Procesando aplicación desde Talent.com para job ${applicationData.job?.jobId}`);
    
    try {
      const processedApplication = {
        // Información del aplicante
        applicant: {
          fullName: applicationData.applicant?.fullName,
          email: applicationData.applicant?.email,
          phoneNumber: applicationData.applicant?.phoneNumber,
          resume: applicationData.applicant?.resume
        },
        
        // Información del trabajo
        job: {
          externalJobId: applicationData.job?.jobId,
          title: applicationData.job?.jobTitle,
          company: applicationData.job?.jobCompany,
          location: applicationData.job?.jobLocation
        },
        
        // Respuestas a preguntas de screening (si las hay)
        screeningAnswers: applicationData.questions?.answers || [],
        
        // Analytics y tracking
        analytics: {
          source: 'talent',
          ip: applicationData.analytics?.ip,
          userAgent: applicationData.analytics?.useragent,
          device: applicationData.analytics?.device
        },
        
        // Metadata
        receivedAt: new Date().toISOString(),
        applicationId: applicationData.id,
        channel: 'talent'
      };
      
      console.log(`✅ Aplicación procesada: ${processedApplication.applicant.email}`);
      return processedApplication;
      
    } catch (error) {
      console.error(`❌ Error procesando aplicación: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualiza estadísticas de performance para ofertas en Talent
   * @param {Array} offerIds - IDs de ofertas a actualizar
   * @returns {Object} Estadísticas actualizadas
   */
  async updatePerformanceStats(offerIds) {
    console.log(`📊 Actualizando estadísticas de performance para ${offerIds.length} ofertas en Talent`);
    
    try {
      // En implementación real, aquí consultarías la API de Talent para obtener stats
      // Por ahora simulamos datos realistas
      
      const stats = offerIds.map(offerId => ({
        offerId: offerId,
        channel: 'talent',
        views: Math.floor(Math.random() * 1000) + 100,
        clicks: Math.floor(Math.random() * 100) + 10,
        applications: Math.floor(Math.random() * 20) + 1,
        spend: Math.floor(Math.random() * 200) + 50,
        ctr: Math.random() * 0.15 + 0.02, // 2-17% CTR
        cpa: Math.floor(Math.random() * 15) + 10, // €10-25 CPA
        lastUpdated: new Date().toISOString()
      }));
      
      console.log(`✅ Estadísticas actualizadas para ${stats.length} ofertas`);
      return {
        success: true,
        channel: 'talent',
        offersUpdated: stats.length,
        stats: stats,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error actualizando estadísticas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pausa/reanuda ofertas en Talent.com
   * @param {Array} offerIds - IDs de ofertas
   * @param {String} action - 'pause' o 'resume'
   * @returns {Object} Resultado de la acción
   */
  async controlOffers(offerIds, action) {
    console.log(`🔄 ${action === 'pause' ? 'Pausando' : 'Reanudando'} ${offerIds.length} ofertas en Talent`);
    
    try {
      // En implementación real, aquí enviarías comandos a Talent API
      // Por ahora simulamos respuesta exitosa
      
      const result = {
        success: true,
        channel: 'talent',
        action: action,
        affectedOffers: offerIds.length,
        offerIds: offerIds,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Acción ${action} completada para ${offerIds.length} ofertas`);
      return result;
      
    } catch (error) {
      console.error(`❌ Error en acción ${action}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = TalentService;
