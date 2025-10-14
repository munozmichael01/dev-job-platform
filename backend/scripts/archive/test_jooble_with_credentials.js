const CredentialsManager = require('./src/services/credentialsManager');
const JoobleService = require('./src/services/channels/joobleService');

async function testJoobleWithCredentials() {
  try {
    console.log('🧪 Probando JoobleService con credenciales reales del Usuario 11...');
    
    // 1. Obtener credenciales del usuario 11
    const credentialsManager = new CredentialsManager();
    const userCredentials = await credentialsManager.getUserChannelCredentials(11, 'jooble');
    
    if (!userCredentials) {
      console.log('❌ No se encontraron credenciales para Usuario 11');
      return;
    }
    
    console.log('✅ Credenciales obtenidas para Usuario 11');
    console.log('Estructura:', Object.keys(userCredentials));
    
    // 2. Crear JoobleService con estas credenciales
    const joobleService = new JoobleService(userCredentials);
    
    console.log('✅ JoobleService inicializado con credenciales del usuario');
    console.log('Config apiKey:', joobleService.config.apiKey ? joobleService.config.apiKey.substring(0, 10) + '...' : 'NO_EXISTE');
    console.log('Config joobleApiKeys:', joobleService.config.joobleApiKeys ? 'SÍ (' + joobleService.config.joobleApiKeys.length + ' países)' : 'NO');
    
    // 3. Test de validación
    const validation = await joobleService.validateConfiguration();
    console.log('Validación:', validation.isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA');
    if (!validation.isValid) {
      console.log('Error:', validation.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testJoobleWithCredentials();