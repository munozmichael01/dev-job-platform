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

async function cleanupIncorrectOffers() {
  try {
    const pool = await sql.connect(config);

    console.log('🧹 CLEANING UP INCORRECT OFFERS FOR CONNECTION 2097...');

    // Contar ofertas antes
    const beforeCount = await pool.request().query(`
      SELECT COUNT(*) as Count FROM JobOffers WHERE ConnectionId = 2097 AND UserId = 3
    `);

    console.log(`📊 Found ${beforeCount.recordset[0].Count} offers to delete`);

    // Eliminar ofertas que se guardaron incorrectamente para el usuario 3
    const deleteResult = await pool.request().query(`
      DELETE FROM JobOffers WHERE ConnectionId = 2097 AND UserId = 3
    `);

    console.log(`✅ Deleted ${deleteResult.rowsAffected[0]} offers from incorrect user (3)`);

    // Verificar que se limpiaron correctamente
    const afterCount = await pool.request().query(`
      SELECT COUNT(*) as Count, UserId FROM JobOffers WHERE ConnectionId = 2097 GROUP BY UserId
    `);

    console.log('📊 Final offers count by user for connection 2097:');
    console.log(afterCount.recordset);

    await pool.close();

    console.log('✅ Cleanup completed! Ready to re-import with correct UserId = 11');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupIncorrectOffers();