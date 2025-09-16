const { poolConnect, pool, sql } = require('./src/db/db');

async function checkJoobleCredentials() {
  try {
    await poolConnect;
    console.log('✅ Conexión a BD establecida');
    
    // Verificar credenciales Jooble
    const result = await pool.request().query(`
      SELECT 
        Id, UserId, ChannelId, ChannelName,
        CASE 
          WHEN EncryptedCredentials IS NOT NULL THEN 'ENCRYPTED_DATA_EXISTS'
          ELSE 'NO_DATA'
        END as HasCredentials,
        IsActive, IsValidated,
        CreatedAt, UpdatedAt
      FROM UserChannelCredentials 
      WHERE ChannelId = 'jooble'
      ORDER BY UpdatedAt DESC
    `);
    
    console.log('\n📊 CREDENCIALES JOOBLE EN BD:');
    console.log('Total registros:', result.recordset.length);
    
    if (result.recordset.length > 0) {
      result.recordset.forEach((record, index) => {
        console.log(`\n${index + 1}. Usuario ID: ${record.UserId}`);
        console.log(`   Canal: ${record.ChannelName}`);
        console.log(`   Datos: ${record.HasCredentials}`);
        console.log(`   Activo: ${record.IsActive ? 'SÍ' : 'NO'}`);
        console.log(`   Validado: ${record.IsValidated ? 'SÍ' : 'NO'}`);
        console.log(`   Actualizado: ${record.UpdatedAt}`);
      });
    } else {
      console.log('❌ NO hay credenciales Jooble en la BD');
    }
    
    // Verificar usuarios activos
    const users = await pool.request().query(`
      SELECT Id, Email, Name FROM Users WHERE IsActive = 1 ORDER BY Id
    `);
    
    console.log('\n👥 USUARIOS ACTIVOS:');
    users.recordset.forEach(user => {
      console.log(`${user.Id}: ${user.Email} (${user.Name || 'Sin nombre'})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkJoobleCredentials();