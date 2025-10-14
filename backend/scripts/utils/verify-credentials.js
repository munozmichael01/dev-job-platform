const sql = require('mssql');
const CredentialsManager = require('../../src/services/credentialsManager');
const credentialsManager = new CredentialsManager();

const dbConfig = {
  user: process.env.DB_USER || 'jobplatform',
  password: process.env.DB_PASSWORD || 'JobPlatform2025!',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'JobPlatform',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function checkCredentials() {
  let pool;
  try {
    pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      SELECT
        UserId,
        ChannelId,
        CASE WHEN EncryptedCredentials IS NOT NULL THEN 1 ELSE 0 END as HasCreds,
        IsActive,
        UpdatedAt
      FROM UserChannelCredentials
      WHERE UserId = 11
      ORDER BY ChannelId
    `);

    console.log('📋 Credenciales guardadas para Usuario 11:');
    console.log('='.repeat(80));

    for (const row of result.recordset) {
      console.log(`Canal: ${row.ChannelId.padEnd(15)} | Encrypted: ${row.HasCreds ? 'SÍ' : 'NO'} | Active: ${row.IsActive ? 'SÍ' : 'NO'} | Updated: ${row.UpdatedAt || 'Nunca'}`);
    }

    console.log('\n🔍 Desencriptando todas las credenciales:');
    console.log('='.repeat(80));

    for (const row of result.recordset) {
      const credResult = await pool.request()
        .input('UserId', row.UserId)
        .input('ChannelId', row.ChannelId)
        .query('SELECT EncryptedCredentials FROM UserChannelCredentials WHERE UserId = @UserId AND ChannelId = @ChannelId');

      if (credResult.recordset[0] && credResult.recordset[0].EncryptedCredentials) {
        const decrypted = credentialsManager.decryptCredentials(credResult.recordset[0].EncryptedCredentials);
        console.log(`\n${row.ChannelId.toUpperCase()}:`);
        console.log(JSON.stringify(decrypted, null, 2));
      }
    }

    if (pool) await pool.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (pool) await pool.close();
  }
  process.exit(0);
}

checkCredentials();
