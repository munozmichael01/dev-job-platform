const { poolConnect, pool, sql } = require('./src/db/db');
const CredentialsManager = require('./src/services/credentialsManager');

async function decryptJoobleCredentials() {
  try {
    await poolConnect;
    console.log('✅ Conexión a BD establecida');
    
    // Obtener credenciales encriptadas
    const result = await pool.request().query(`
      SELECT 
        Id, UserId, ChannelId, ChannelName,
        EncryptedCredentials,
        IsActive, IsValidated,
        UpdatedAt
      FROM UserChannelCredentials 
      WHERE ChannelId = 'jooble'
      ORDER BY UpdatedAt DESC
    `);
    
    console.log('\n🔐 DESENCRIPTANDO CREDENCIALES JOOBLE:');
    
    const credentialsManager = new CredentialsManager();
    
    for (const record of result.recordset) {
      console.log(`\n👤 Usuario ${record.UserId}:`);
      console.log(`   Último update: ${record.UpdatedAt}`);
      
      try {
        // Usar el método correcto que retorna el objeto directamente
        const credentials = credentialsManager.decryptCredentials(record.EncryptedCredentials);
        
        console.log(`   Estructura:`, Object.keys(credentials));
        
        // Verificar si es formato multi-país
        if (credentials.joobleApiKeys && Array.isArray(credentials.joobleApiKeys)) {
          console.log(`   🌍 FORMATO MULTI-PAÍS (${credentials.joobleApiKeys.length} países):`);
          credentials.joobleApiKeys.forEach((keyData, index) => {
            console.log(`     ${index + 1}. País: ${keyData.countryCode}`);
            console.log(`        API Key: ${keyData.apiKey ? keyData.apiKey.substring(0, 10) + '...' : 'NO_KEY'}`);
          });
        } 
        // Formato antiguo single-country
        else if (credentials.apiKey) {
          console.log(`   🏳️ FORMATO SINGLE-COUNTRY:`);
          console.log(`      API Key: ${credentials.apiKey.substring(0, 10)}...`);
          console.log(`      Country: ${credentials.countryCode || 'NO_COUNTRY'}`);
        }
        else {
          console.log(`   ❌ FORMATO DESCONOCIDO:`, credentials);
        }
        
      } catch (decryptError) {
        console.log(`   ❌ Error desencriptando: ${decryptError.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    process.exit(0);
  }
}

decryptJoobleCredentials();