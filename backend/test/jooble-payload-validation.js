const JoobleService = require('../src/services/channels/joobleService');
const { ChannelLimitsMiddleware } = require('../src/middleware/channelLimitsMiddleware');

/**
 * Script de validación completa para la alineación de payload de Jooble
 * 
 * Pruebas según especificaciones del usuario:
 * 1. Crear campaña con datos completos
 * 2. Verificar payload-to-jooble cumple el ejemplo esperado
 * 3. Confirmar que NO se envían segmentationRules/targeting internos incorrectos
 * 4. Confirmar que UTMs se concatenan correctamente a URLs de ofertas
 * 5. Verificar respuesta exitosa de Jooble (simulada)
 * 6. Validar control de límites internos
 * 7. Generar ejemplos de payload final y URLs con UTMs
 */

class JooblePayloadValidator {
  
  constructor() {
    this.joobleService = new JoobleService({
      apiKey: 'test-api-key',
      countryCode: 'es'
    });
    
    this.limitsMiddleware = new ChannelLimitsMiddleware();
    
    console.log('🧪 Inicializando validador de payload Jooble');
  }

  /**
   * Ejecuta todas las pruebas de validación
   */
  async runAllTests() {
    console.log('\n🚀 INICIANDO PRUEBAS DE VALIDACIÓN JOOBLE PAYLOAD ALIGNMENT');
    console.log('=' .repeat(80));
    
    try {
      // Test 1: Datos de entrada completos
      const testData = this.generateTestData();
      console.log('\n✅ Test 1: Datos de entrada generados');
      
      // Test 2: Construcción de payload-to-jooble
      const payloadResult = await this.testPayloadConstruction(testData);
      console.log('\n✅ Test 2: Payload-to-jooble construido');
      
      // Test 3: Validación de campos mínimos requeridos
      const fieldsValidation = this.testRequiredFields(payloadResult.payloadToJooble);
      console.log('\n✅ Test 3: Campos requeridos validados');
      
      // Test 4: Validación de segmentationRules
      const segmentationValidation = this.testSegmentationRules(payloadResult.payloadToJooble);
      console.log('\n✅ Test 4: SegmentationRules validadas');
      
      // Test 5: Validación de UTMs
      const utmValidation = this.testUTMGeneration(payloadResult);
      console.log('\n✅ Test 5: UTMs validados');
      
      // Test 6: Validación de URLs con tracking
      const urlValidation = this.testTrackingUrls(payloadResult.offersWithTracking);
      console.log('\n✅ Test 6: URLs con tracking validadas');
      
      // Test 7: Validación de datos internos
      const internalValidation = this.testInternalDataRetention(payloadResult.internalData);
      console.log('\n✅ Test 7: Datos internos validados');
      
      // Test 8: Simulación de creación de campaña
      const campaignResult = await this.testCampaignCreation(testData);
      console.log('\n✅ Test 8: Creación de campaña simulada');
      
      // Test 9: Validación de límites internos
      const limitsResult = await this.testInternalLimits(testData);
      console.log('\n✅ Test 9: Límites internos validados');
      
      // Generar resumen final
      const summary = this.generateFinalSummary({
        testData,
        payloadResult,
        campaignResult,
        limitsResult,
        fieldsValidation,
        segmentationValidation,
        utmValidation,
        urlValidation,
        internalValidation
      });
      
      console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE');
      console.log('=' .repeat(80));
      
      return summary;
      
    } catch (error) {
      console.error('\n❌ ERROR EN PRUEBAS:', error.message);
      throw error;
    }
  }

  /**
   * Genera datos de prueba realistas
   */
  generateTestData() {
    const campaignData = {
      id: 'test-campaign-123',
      name: 'Campaña Hoteles Agosto 2025',
      description: 'Campaña de prueba para validación de payload',
      status: 'active',
      startDate: '2025-01-08',
      endDate: '2025-02-08',
      timezone: 'Europe/Madrid',
      bidStrategy: 'automatic'
    };

    const offers = [
      {
        id: 'offer-1',
        title: 'Cocinero Especializado',
        company: 'Hotel Ritz Madrid',
        location: 'Madrid',
        url: 'https://www.turijobs.com/oferta/cocinero-especializado-1234',
        description: 'Buscamos cocinero con experiencia en alta cocina'
      },
      {
        id: 'offer-2', 
        title: 'Camarero de Sala',
        company: 'Hotel Ritz Madrid',
        location: 'Madrid',
        url: 'https://www.turijobs.com/oferta/camarero-sala-5678',
        description: 'Camarero para restaurante de lujo'
      },
      {
        id: 'offer-3',
        title: 'Recepcionista Nocturno',
        company: 'Paradores España',
        location: 'Barcelona',
        url: 'https://www.turijobs.com/oferta/recepcionista-nocturno-9012?source=internal',
        description: 'Recepcionista para turno de noche'
      },
      {
        id: 'offer-4',
        title: 'Chef de Partida',
        company: 'Grand Hotel Barcelona',
        location: 'Barcelona',
        url: 'https://www.turijobs.com/oferta/chef-partida-3456',
        description: 'Chef de partida para cocina mediterránea'
      },
      {
        id: 'offer-5',
        title: 'Camarero VIP',
        company: 'Hotel Villa Valencia',
        location: 'Valencia',
        url: 'https://www.turijobs.com/oferta/camarero-vip-7890',
        description: 'Atención personalizada a clientes VIP'
      }
    ];

    const budgetInfo = {
      maxCPC: 0.25,
      dailyBudget: 100,
      totalBudget: 3000,
      monthlyBudget: false
    };

    return { campaignData, offers, budgetInfo };
  }

  /**
   * Test 2: Construcción de payload-to-jooble
   */
  async testPayloadConstruction(testData) {
    const { campaignData, offers, budgetInfo } = testData;
    
    console.log('\n📤 Construyendo payload-to-jooble...');
    
    // Construir payload para Jooble
    const payloadToJooble = this.joobleService.buildJooblePayload(campaignData, offers, budgetInfo);
    
    // Construir datos internos
    const internalData = this.joobleService.buildInternalData(campaignData, offers, budgetInfo);
    
    // Aplicar tracking a ofertas
    const offersWithTracking = this.joobleService.applyTrackingToOffers(offers, campaignData);
    
    console.log('📋 Payload construido con campos:', Object.keys(payloadToJooble));
    console.log('🗄️ Datos internos conservados:', Object.keys(internalData));
    console.log('🔗 Ofertas con tracking:', offersWithTracking.length);
    
    return {
      payloadToJooble,
      internalData,
      offersWithTracking
    };
  }

  /**
   * Test 3: Validación de campos mínimos requeridos
   */
  testRequiredFields(payloadToJooble) {
    console.log('\n🔍 Validando campos requeridos en payload-to-jooble...');
    
    const requiredFields = [
      'CampaignName',
      'Status', 
      'ClickPrice',
      'Budget',
      'MonthlyBudget',
      'Utm',
      'SiteUrl',
      'segmentationRules'
    ];
    
    const validation = {
      valid: true,
      missingFields: [],
      presentFields: [],
      fieldTypes: {}
    };
    
    for (const field of requiredFields) {
      if (payloadToJooble.hasOwnProperty(field)) {
        validation.presentFields.push(field);
        validation.fieldTypes[field] = typeof payloadToJooble[field];
        console.log(`  ✅ ${field}: ${typeof payloadToJooble[field]} = ${JSON.stringify(payloadToJooble[field])}`);
      } else {
        validation.missingFields.push(field);
        validation.valid = false;
        console.log(`  ❌ ${field}: FALTANTE`);
      }
    }
    
    // Validar tipos específicos
    if (typeof payloadToJooble.Status !== 'number') {
      console.log(`  ⚠️ Status debería ser número, recibido: ${typeof payloadToJooble.Status}`);
    }
    
    if (typeof payloadToJooble.MonthlyBudget !== 'boolean') {
      console.log(`  ⚠️ MonthlyBudget debería ser boolean, recibido: ${typeof payloadToJooble.MonthlyBudget}`);
    }
    
    if (!payloadToJooble.Utm.startsWith('?')) {
      console.log(`  ⚠️ Utm debería empezar con '?', recibido: ${payloadToJooble.Utm}`);
    }
    
    return validation;
  }

  /**
   * Test 4: Validación de segmentationRules
   */
  testSegmentationRules(payloadToJooble) {
    console.log('\n🎯 Validando segmentationRules...');
    
    const rules = payloadToJooble.segmentationRules || [];
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      stats: {
        totalRules: rules.length,
        titles: 0,
        companies: 0,
        locations: 0
      }
    };
    
    // Contar por tipo
    for (const rule of rules) {
      switch (rule.type) {
        case 1: validation.stats.titles++; break;
        case 2: validation.stats.companies++; break;
        case 4: validation.stats.locations++; break;
      }
    }
    
    // Validar límites de Jooble
    if (validation.stats.titles > 5) {
      validation.valid = false;
      validation.errors.push(`Demasiados job titles: ${validation.stats.titles}/5 máximo`);
    }
    
    if (validation.stats.companies > 3) {
      validation.valid = false;
      validation.errors.push(`Demasiadas companies: ${validation.stats.companies}/3 máximo`);
    }
    
    // Validar estructura de reglas
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      
      if (!rule.type || !rule.value || !rule.operator) {
        validation.valid = false;
        validation.errors.push(`Regla ${i}: estructura incompleta`);
      }
      
      // Validar operadores correctos
      if (rule.type === 1 && rule.operator !== 'contains') {
        validation.warnings.push(`Regla ${i}: job title debería usar 'contains'`);
      }
      
      if (rule.type === 2 && rule.operator !== 'equals') {
        validation.warnings.push(`Regla ${i}: company debería usar 'equals'`);
      }
      
      if (rule.type === 4 && rule.operator !== 'in') {
        validation.warnings.push(`Regla ${i}: location debería usar 'in'`);
      }
    }
    
    console.log(`  📊 Total reglas: ${validation.stats.totalRules}`);
    console.log(`  👔 Job titles (type=1): ${validation.stats.titles}/5`);
    console.log(`  🏢 Companies (type=2): ${validation.stats.companies}/3`);
    console.log(`  📍 Locations (type=4): ${validation.stats.locations}`);
    
    if (validation.errors.length > 0) {
      console.log(`  ❌ Errores: ${validation.errors.join(', ')}`);
    }
    
    if (validation.warnings.length > 0) {
      console.log(`  ⚠️ Warnings: ${validation.warnings.join(', ')}`);
    }
    
    return validation;
  }

  /**
   * Test 5: Validación de UTMs
   */
  testUTMGeneration(payloadResult) {
    console.log('\n🏷️ Validando generación de UTMs...');
    
    const utmString = payloadResult.payloadToJooble.Utm;
    const trackingParams = payloadResult.internalData.trackingParams;
    
    const validation = {
      valid: true,
      errors: [],
      utmString,
      trackingParams,
      parsedUTMs: {}
    };
    
    // Parsear UTMs del string
    if (utmString.startsWith('?')) {
      const params = new URLSearchParams(utmString.substring(1));
      validation.parsedUTMs = {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign')
      };
    } else {
      validation.valid = false;
      validation.errors.push('UTM string no empieza con ?');
    }
    
    // Validar valores esperados
    if (validation.parsedUTMs.utm_source !== 'jooble') {
      validation.errors.push(`utm_source incorrecto: ${validation.parsedUTMs.utm_source} (esperado: jooble)`);
    }
    
    if (validation.parsedUTMs.utm_medium !== 'cpc') {
      validation.errors.push(`utm_medium incorrecto: ${validation.parsedUTMs.utm_medium} (esperado: cpc)`);
    }
    
    if (!validation.parsedUTMs.utm_campaign) {
      validation.errors.push('utm_campaign faltante');
    }
    
    console.log(`  🔗 UTM string: ${utmString}`);
    console.log(`  📊 UTM source: ${validation.parsedUTMs.utm_source}`);
    console.log(`  📊 UTM medium: ${validation.parsedUTMs.utm_medium}`);
    console.log(`  📊 UTM campaign: ${validation.parsedUTMs.utm_campaign}`);
    
    // Validar trackingParams internos
    if (trackingParams.source !== validation.parsedUTMs.utm_source) {
      validation.errors.push('Inconsistencia entre trackingParams.source y utm_source');
    }
    
    if (validation.errors.length > 0) {
      validation.valid = false;
      console.log(`  ❌ Errores: ${validation.errors.join(', ')}`);
    }
    
    return validation;
  }

  /**
   * Test 6: Validación de URLs con tracking
   */
  testTrackingUrls(offersWithTracking) {
    console.log('\n🔗 Validando URLs con tracking...');
    
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      urlExamples: [],
      stats: {
        total: offersWithTracking.length,
        withUTMs: 0,
        withExistingParams: 0
      }
    };
    
    for (const offer of offersWithTracking) {
      if (!offer.trackingUrl) {
        validation.errors.push(`Oferta ${offer.id}: trackingUrl faltante`);
        continue;
      }
      
      const url = new URL(offer.trackingUrl);
      const params = url.searchParams;
      
      // Verificar UTMs presentes
      const hasUTMs = params.has('utm_source') && params.has('utm_medium') && params.has('utm_campaign');
      
      if (hasUTMs) {
        validation.stats.withUTMs++;
      } else {
        validation.errors.push(`Oferta ${offer.id}: UTMs faltantes en trackingUrl`);
      }
      
      // Verificar si había parámetros existentes
      if (offer.url.includes('?')) {
        validation.stats.withExistingParams++;
      }
      
      // Guardar ejemplos
      if (validation.urlExamples.length < 3) {
        validation.urlExamples.push({
          originalUrl: offer.url,
          trackingUrl: offer.trackingUrl,
          utmParams: {
            utm_source: params.get('utm_source'),
            utm_medium: params.get('utm_medium'),
            utm_campaign: params.get('utm_campaign')
          }
        });
      }
    }
    
    console.log(`  📊 Total ofertas: ${validation.stats.total}`);
    console.log(`  ✅ Con UTMs aplicados: ${validation.stats.withUTMs}`);
    console.log(`  🔗 Con parámetros existentes: ${validation.stats.withExistingParams}`);
    
    // Mostrar ejemplos
    validation.urlExamples.forEach((example, index) => {
      console.log(`  \n📝 Ejemplo ${index + 1}:`);
      console.log(`    Original: ${example.originalUrl}`);
      console.log(`    Tracking: ${example.trackingUrl}`);
      console.log(`    UTMs: ${JSON.stringify(example.utmParams)}`);
    });
    
    if (validation.errors.length > 0) {
      validation.valid = false;
      console.log(`  ❌ Errores: ${validation.errors.join(', ')}`);
    }
    
    return validation;
  }

  /**
   * Test 7: Validación de datos internos
   */
  testInternalDataRetention(internalData) {
    console.log('\n🗄️ Validando retención de datos internos...');
    
    const expectedInternalFields = [
      'maxCPC',
      'dailyBudget', 
      'totalBudget',
      'startDate',
      'endDate',
      'timezone',
      'bidStrategy',
      'targeting',
      'segmentationRules',
      'trackingParams'
    ];
    
    const validation = {
      valid: true,
      presentFields: [],
      missingFields: [],
      fieldDetails: {}
    };
    
    for (const field of expectedInternalFields) {
      if (internalData.hasOwnProperty(field)) {
        validation.presentFields.push(field);
        validation.fieldDetails[field] = {
          type: typeof internalData[field],
          value: field === 'trackingParams' ? internalData[field] : 
                 typeof internalData[field] === 'object' ? '[object]' : internalData[field]
        };
        console.log(`  ✅ ${field}: ${validation.fieldDetails[field].type} = ${validation.fieldDetails[field].value}`);
      } else {
        validation.missingFields.push(field);
        console.log(`  ⚠️ ${field}: No presente (opcional)`);
      }
    }
    
    // Validar que trackingParams sea objeto
    if (internalData.trackingParams && typeof internalData.trackingParams !== 'object') {
      validation.valid = false;
      console.log(`  ❌ trackingParams debería ser objeto, recibido: ${typeof internalData.trackingParams}`);
    }
    
    console.log(`  📊 Campos presentes: ${validation.presentFields.length}/${expectedInternalFields.length}`);
    
    return validation;
  }

  /**
   * Test 8: Simulación de creación de campaña
   */
  async testCampaignCreation(testData) {
    console.log('\n🚀 Simulando creación de campaña en Jooble...');
    
    const { campaignData, offers, budgetInfo } = testData;
    
    try {
      // Usar simulateCreateCampaign para modo de prueba
      const result = await this.joobleService.simulateCreateCampaign(campaignData, offers, budgetInfo);
      
      console.log(`  ✅ Campaña simulada exitosamente`);
      console.log(`  📝 Campaign ID: ${result.campaignId}`);
      console.log(`  🏷️ Channel: ${result.channel}`);
      console.log(`  📤 Payload enviado: ${Object.keys(result.payloadSent).length} campos`);
      console.log(`  🗄️ Datos internos: ${Object.keys(result.internalData).length} campos`);
      console.log(`  🔗 Tracking URL ejemplo: ${result.exampleTrackingUrl}`);
      
      return {
        valid: true,
        result,
        campaignCreated: true
      };
      
    } catch (error) {
      console.log(`  ❌ Error en simulación: ${error.message}`);
      return {
        valid: false,
        error: error.message,
        campaignCreated: false
      };
    }
  }

  /**
   * Test 9: Validación de límites internos
   */
  async testInternalLimits(testData) {
    console.log('\n🛡️ Validando middleware de límites internos...');
    
    const { campaignData, offers, budgetInfo } = testData;
    
    // Construir payloads para validación
    const payloadToJooble = this.joobleService.buildJooblePayload(campaignData, offers, budgetInfo);
    const internalData = this.joobleService.buildInternalData(campaignData, offers, budgetInfo);
    
    try {
      // Probar validación pre-envío
      const validation = await this.limitsMiddleware.validateBeforeSend(
        'jooble',
        campaignData,
        payloadToJooble,
        internalData
      );
      
      console.log(`  📋 Validación pre-envío: ${validation.valid ? 'EXITOSA' : 'FALLÓ'}`);
      console.log(`  ⚠️ Warnings: ${validation.warnings.length}`);
      console.log(`  ❌ Errores: ${validation.errors.length}`);
      console.log(`  🎯 Acciones automáticas: ${validation.actions.length}`);
      
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => console.log(`    ⚠️ ${warning}`));
      }
      
      if (validation.errors.length > 0) {
        validation.errors.forEach(error => console.log(`    ❌ ${error}`));
      }
      
      return {
        valid: validation.valid,
        preValidation: validation,
        middlewareWorking: true
      };
      
    } catch (error) {
      console.log(`  ❌ Error en middleware: ${error.message}`);
      return {
        valid: false,
        error: error.message,
        middlewareWorking: false
      };
    }
  }

  /**
   * Genera resumen final con ejemplos
   */
  generateFinalSummary(results) {
    console.log('\n📋 RESUMEN FINAL DE VALIDACIÓN');
    console.log('=' .repeat(80));
    
    const summary = {
      timestamp: new Date().toISOString(),
      validationResults: {
        allTestsPassed: true,
        totalTests: 9,
        passedTests: 0,
        failedTests: 0
      },
      examplePayloadToJooble: results.payloadResult.payloadToJooble,
      exampleInternalData: results.payloadResult.internalData,
      exampleTrackingUrls: results.urlValidation.urlExamples,
      compliance: {
        requiredFieldsPresent: results.fieldsValidation.valid,
        segmentationRulesValid: results.segmentationValidation.valid,
        utmsCorrect: results.utmValidation.valid,
        trackingUrlsWorking: results.urlValidation.valid,
        internalDataRetained: results.internalValidation.valid,
        campaignCreationWorking: results.campaignResult.valid,
        limitsMiddlewareWorking: results.limitsResult.valid
      }
    };
    
    // Contar tests exitosos
    Object.values(summary.compliance).forEach(passed => {
      if (passed) {
        summary.validationResults.passedTests++;
      } else {
        summary.validationResults.failedTests++;
        summary.validationResults.allTestsPassed = false;
      }
    });
    
    console.log(`\n📊 RESULTADOS:`);
    console.log(`  ✅ Tests exitosos: ${summary.validationResults.passedTests}/${summary.validationResults.totalTests}`);
    console.log(`  ❌ Tests fallidos: ${summary.validationResults.failedTests}/${summary.validationResults.totalTests}`);
    console.log(`  🎯 Estado general: ${summary.validationResults.allTestsPassed ? 'EXITOSO' : 'CON ERRORES'}`);
    
    console.log(`\n📤 EJEMPLO DE PAYLOAD-TO-JOOBLE:`);
    console.log(JSON.stringify(summary.examplePayloadToJooble, null, 2));
    
    console.log(`\n🗄️ EJEMPLO DE DATOS INTERNOS (NO ENVIADOS):`);
    console.log(JSON.stringify(summary.exampleInternalData, null, 2));
    
    console.log(`\n🔗 EJEMPLO DE URL CON TRACKING:`);
    if (summary.exampleTrackingUrls.length > 0) {
      const example = summary.exampleTrackingUrls[0];
      console.log(`  Original: ${example.originalUrl}`);
      console.log(`  Con UTMs: ${example.trackingUrl}`);
    }
    
    console.log(`\n✅ CUMPLIMIENTO DE ESPECIFICACIONES:`);
    Object.entries(summary.compliance).forEach(([requirement, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${requirement}`);
    });
    
    return summary;
  }
}

// Ejecutar validación si se ejecuta directamente
if (require.main === module) {
  const validator = new JooblePayloadValidator();
  validator.runAllTests()
    .then(summary => {
      console.log('\n🎉 VALIDACIÓN COMPLETADA');
      process.exit(summary.validationResults.allTestsPassed ? 0 : 1);
    })
    .catch(error => {
      console.error('\n💥 ERROR FATAL EN VALIDACIÓN:', error);
      process.exit(1);
    });
}

module.exports = { JooblePayloadValidator };
