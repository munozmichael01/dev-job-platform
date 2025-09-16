const sql = require('mssql');

const config = {
  user: 'jobplatform',
  password: 'JobPlatform2025!',
  server: 'localhost',
  database: 'JobPlatform',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkConnection() {
  try {
    const pool = await sql.connect(config);

    // Verificar la conexión 2097
    const connectionResult = await pool.request().query(`
      SELECT id, name, UserId, clientId FROM Connections WHERE id = 2097
    `);

    console.log('📋 CONNECTION 2097 INFO:');
    console.log(connectionResult.recordset[0]);

    // Verificar cuántas ofertas se han guardado y para qué usuario
    const offersResult = await pool.request().query(`
      SELECT COUNT(*) as TotalOffers, UserId FROM JobOffers WHERE ConnectionId = 2097 GROUP BY UserId
    `);

    console.log('\n📊 OFFERS COUNT BY USER:');
    console.log(offersResult.recordset);

    // Verificar últimas ofertas insertadas
    const recentResult = await pool.request().query(`
      SELECT TOP 5 ExternalId, Title, UserId, CreatedAt FROM JobOffers
      WHERE ConnectionId = 2097
      ORDER BY CreatedAt DESC
    `);

    console.log('\n📝 RECENT OFFERS:');
    console.log(recentResult.recordset);

    await pool.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkConnection();