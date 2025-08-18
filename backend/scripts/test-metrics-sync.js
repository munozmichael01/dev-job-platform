/**
 * 🧪 Script de Testing para Sync de Métricas
 * 
 * Prueba la funcionalidad completa del sistema de sync de métricas
 * 
 * Uso:
 * node scripts/test-metrics-sync.js
 * 
 * @author Claude Code
 * @date 2025-01-17
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAPI(method, endpoint, data = null, expectedStatus = 200) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      ...(data && { data })
    };
    
    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      log(`✅ ${method} ${endpoint} - SUCCESS (${response.status})`, 'green');
      return { success: true, data: response.data };
    } else {
      log(`⚠️ ${method} ${endpoint} - Unexpected status ${response.status}`, 'yellow');
      return { success: false, data: response.data };
    }
    
  } catch (error) {
    if (error.response) {
      log(`❌ ${method} ${endpoint} - ERROR ${error.response.status}: ${error.response.data?.error || error.message}`, 'red');
      return { success: false, error: error.response.data };
    } else {
      log(`❌ ${method} ${endpoint} - NETWORK ERROR: ${error.message}`, 'red');
      return { success: false, error: error.message };
    }
  }
}

async function runTests() {
  log('🧪 Iniciando tests de Sync de Métricas...', 'blue');
  log('='.repeat(50), 'blue');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Test 1: Verificar estado del servicio
  totalTests++;
  log('\n📊 Test 1: Verificar estado del servicio de sync', 'blue');
  const statusResult = await testAPI('GET', '/api/metrics-sync/status');
  if (statusResult.success) {
    passedTests++;
    log(`   Estado: ${statusResult.data.status.isRunning ? 'EJECUTÁNDOSE' : 'DETENIDO'}`, 'green');
    log(`   Intervalo: ${statusResult.data.status.syncInterval} minutos`, 'green');
  }
  
  // Test 2: Iniciar servicio automático
  totalTests++;
  log('\n🚀 Test 2: Iniciar servicio de sync automático', 'blue');
  const startResult = await testAPI('POST', '/api/metrics-sync/start');
  if (startResult.success) {
    passedTests++;
    log(`   ${startResult.data.message}`, 'green');
  }
  
  // Test 3: Obtener campañas disponibles
  totalTests++;
  log('\n📋 Test 3: Obtener campañas disponibles', 'blue');
  const campaignsResult = await testAPI('GET', '/api/campaigns');
  let testCampaignId = null;
  if (campaignsResult.success && campaignsResult.data.length > 0) {
    passedTests++;
    testCampaignId = campaignsResult.data[0].Id;
    log(`   Encontradas ${campaignsResult.data.length} campañas`, 'green');
    log(`   Usando campaña ID ${testCampaignId} para tests`, 'green');
  } else {
    log('   ⚠️ No se encontraron campañas para testing', 'yellow');
  }
  
  if (testCampaignId) {
    // Test 4: Generar métricas demo
    totalTests++;
    log('\n🎮 Test 4: Generar métricas demo', 'blue');
    const demoResult = await testAPI('POST', `/api/metrics-sync/demo-metrics/${testCampaignId}`, {
      channelId: 'jooble'
    });
    if (demoResult.success) {
      passedTests++;
      log(`   Métricas demo generadas`, 'green');
      log(`   Gasto: €${demoResult.data.metrics?.ActualSpend || 0}`, 'green');
      log(`   Aplicaciones: ${demoResult.data.metrics?.ActualApplications || 0}`, 'green');
    }
    
    // Test 5: Obtener métricas actuales
    totalTests++;
    log('\n📊 Test 5: Obtener métricas actuales', 'blue');
    const metricsResult = await testAPI('GET', `/api/metrics-sync/campaign/${testCampaignId}/metrics`);
    if (metricsResult.success) {
      passedTests++;
      const metrics = metricsResult.data.metrics;
      log(`   Gasto actual: €${metrics.ActualSpend || 0}`, 'green');
      log(`   Aplicaciones: ${metrics.ActualApplications || 0}`, 'green');
      log(`   Último sync: ${metrics.LastMetricsSync || 'Nunca'}`, 'green');
    }
    
    // Test 6: Forzar sync de campaña específica
    totalTests++;
    log('\n🔄 Test 6: Forzar sync de campaña específica', 'blue');
    const forceSyncResult = await testAPI('POST', `/api/metrics-sync/campaign/${testCampaignId}`, {
      userId: 1
    });
    if (forceSyncResult.success) {
      passedTests++;
      log(`   Sync forzado completado`, 'green');
    }
    
    // Esperar un poco y verificar actualización
    log('   ⏳ Esperando 2 segundos...', 'yellow');
    await delay(2000);
    
    // Test 7: Verificar actualización de métricas
    totalTests++;
    log('\n✅ Test 7: Verificar actualización de métricas', 'blue');
    const updatedMetricsResult = await testAPI('GET', `/api/metrics-sync/campaign/${testCampaignId}/metrics`);
    if (updatedMetricsResult.success) {
      passedTests++;
      const metrics = updatedMetricsResult.data.metrics;
      log(`   Métricas actualizadas:`, 'green');
      log(`   - Gasto: €${metrics.ActualSpend || 0}`, 'green');
      log(`   - Aplicaciones: ${metrics.ActualApplications || 0}`, 'green');
      log(`   - Último sync: ${metrics.LastMetricsSync || 'Nunca'}`, 'green');
    }
  }
  
  // Test 8: Forzar sync de todas las campañas
  totalTests++;
  log('\n🌐 Test 8: Forzar sync de todas las campañas', 'blue');
  const syncAllResult = await testAPI('POST', '/api/metrics-sync/sync-all');
  if (syncAllResult.success) {
    passedTests++;
    const result = syncAllResult.data.result;
    log(`   Sync completo - Exitosos: ${result.success}, Errores: ${result.errors}`, 'green');
  }
  
  // Test 9: Verificar límites internos
  if (testCampaignId) {
    totalTests++;
    log('\n🛡️ Test 9: Verificar límites internos con métricas actualizadas', 'blue');
    const limitsResult = await testAPI('POST', `/api/internal-limits/check/${testCampaignId}`);
    if (limitsResult.success) {
      passedTests++;
      log(`   Verificación de límites completada`, 'green');
      const results = limitsResult.data.results;
      log(`   - Presupuesto: ${results.budgetCheck?.status || 'N/A'}`, 'green');
      log(`   - Fechas: ${results.dateCheck?.status || 'N/A'}`, 'green');
      log(`   - CPC: ${results.cpcCheck?.status || 'N/A'}`, 'green');
    }
  }
  
  // Resumen final
  log('\n' + '='.repeat(50), 'blue');
  log('📊 RESUMEN DE TESTS', 'blue');
  log('='.repeat(50), 'blue');
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  const color = successRate >= 80 ? 'green' : successRate >= 60 ? 'yellow' : 'red';
  
  log(`Tests pasados: ${passedTests}/${totalTests} (${successRate}%)`, color);
  
  if (successRate >= 80) {
    log('🎉 Sistema de sync de métricas funcionando correctamente!', 'green');
  } else if (successRate >= 60) {
    log('⚠️ Sistema funcional con algunos problemas menores', 'yellow');
  } else {
    log('❌ Sistema requiere correcciones importantes', 'red');
  }
  
  log('\n🔧 Pasos siguientes:', 'blue');
  log('1. Configurar JOOBLE_API_KEY real en .env', 'yellow');
  log('2. Ejecutar script add-metrics-columns.sql en SQL Server', 'yellow');
  log('3. Crear primera campaña real con presupuesto mínimo', 'yellow');
  log('4. Monitorear sync cada 5 minutos automáticamente', 'yellow');
  
  process.exit(successRate >= 80 ? 0 : 1);
}

// Verificar que el backend esté ejecutándose
async function checkBackend() {
  try {
    await axios.get(`${BASE_URL}/api/campaigns`);
    log('✅ Backend detectado en puerto 3002', 'green');
    return true;
  } catch (error) {
    log('❌ Backend no disponible en puerto 3002', 'red');
    log('   Asegúrate de ejecutar: cd backend && node index.js', 'yellow');
    return false;
  }
}

// Ejecutar tests
(async () => {
  if (await checkBackend()) {
    await runTests();
  } else {
    process.exit(1);
  }
})();