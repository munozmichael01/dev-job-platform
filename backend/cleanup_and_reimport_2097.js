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

async function cleanupAndReimport() {
  try {
    const pool = await sql.connect(config);

    console.log('🧹 CLEANING UP INCORRECT OFFERS...');

    // Eliminar ofertas que se guardaron incorrectamente para el usuario 3
    const deleteResult = await pool.request().query(`
      DELETE FROM JobOffers WHERE ConnectionId = 2097 AND UserId = 3
    `);

    console.log(`✅ Deleted ${deleteResult.rowsAffected[0]} offers from incorrect user (3)`);

    // Verificar que se limpiaron correctamente
    const checkResult = await pool.request().query(`
      SELECT COUNT(*) as Count FROM JobOffers WHERE ConnectionId = 2097
    `);

    console.log(`📊 Remaining offers for connection 2097: ${checkResult.recordset[0].Count}`);

    await pool.close();

    console.log('🚀 Starting corrected import for user 11...');

    // Importar el script optimizado corregido
    const { OptimizedTurijobsImporter } = require('./optimized_import_2097');
    const importer = new OptimizedTurijobsImporter();
    await importer.processInStreaming();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupAndReimport();