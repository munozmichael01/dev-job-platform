const { pool, poolConnect, sql } = require('./src/db/db');
const CredentialsManager = require('./src/services/credentialsManager');

const credentialsManager = new CredentialsManager();

async function debugJoobleCredentials() {
  try {
    await poolConnect;
    
    console.log('🔍 Verificando credenciales de Jooble del usuario 11...');
    
    const result = await pool.request()
      .input('UserId', sql.BigInt, 11)
      .input('ChannelId', sql.NVarChar(50), 'jooble')
      .query(`
        SELECT 
          Id, UserId, ChannelId, ChannelName, EncryptedCredentials, 
          ConfigurationData, IsActive, IsValidated, LastValidated,
          ValidationError, DailyBudgetLimit, MonthlyBudgetLimit, MaxCPA,
          CreatedAt, UpdatedAt
        FROM UserChannelCredentials 
        WHERE UserId = @UserId AND ChannelId = @ChannelId
        ORDER BY CreatedAt DESC
      `);
    
    if (result.recordset.length > 0) {
      console.log(`✅ Encontrados ${result.recordset.length} registro(s):`);
      
      result.recordset.forEach((record, index) => {
        console.log(`\n📋 REGISTRO ${index + 1}:`);
        console.log(`  ID: ${record.Id}`);
        console.log(`  Creado: ${record.CreatedAt}`);
        console.log(`  Activo: ${record.IsActive}`);
        console.log(`  Validado: ${record.IsValidated}`);
        console.log(`  Última validación: ${record.LastValidated || 'NUNCA'}`);
        
        // Desencriptar credenciales
        const decryptedCreds = credentialsManager.decryptCredentials(record.EncryptedCredentials);
        
        if (decryptedCreds) {
          console.log('\n🔐 CREDENCIALES DESENCRIPTADAS:');
          console.log(JSON.stringify(decryptedCreds, null, 2));
        } else {
          console.log('❌ No se pudo desencriptar');
        }
        
        console.log(`\n💰 LÍMITES:`);
        console.log(`  Diario: €${record.DailyBudgetLimit || 'No definido'}`);
        console.log(`  Mensual: €${record.MonthlyBudgetLimit || 'No definido'}`);
        console.log(`  CPA máximo: €${record.MaxCPA || 'No definido'}`);
      });
    } else {
      console.log('❌ No se encontraron credenciales');
    }
    
  } catch(e) { 
    console.error('❌ Error:', e.message); 
  }
  process.exit(0);
}

debugJoobleCredentials();