const sql = require('mssql');
const XMLProcessor = require('./src/processors/xmlProcessor');

const config = {
  user: 'jobplatform',
  password: 'JobPlatform2025!',
  server: 'localhost',
  database: 'job_platform_db',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function reprocessXML() {
  let pool;
  try {
    console.log('🔄 Conectando a la base de datos...');
    pool = await sql.connect(config);
    console.log('✅ Conexión establecida');
    
    console.log('🔄 Re-procesando XML feed con mapeo corregido...');
    
    // Obtener conexión 2089
    const connectionResult = await pool.request()
      .input('ConnectionId', sql.Int, 2089)
      .query('SELECT * FROM ClientConnections WHERE Id = @ConnectionId');
    
    if (connectionResult.recordset.length === 0) {
      throw new Error('Connection 2089 not found');
    }
    
    const connection = connectionResult.recordset[0];
    console.log(`📡 Conexión encontrada: ${connection.Name}`);
    console.log(`📡 URL: ${connection.Url}`);
    
    // Crear processor y ejecutar
    const processor = new XMLProcessor(connection);
    const result = await processor.process();
    
    console.log('✅ Re-procesamiento completado:', result);
    console.log(`📊 Ofertas procesadas: ${result.imported}`);
    console.log(`❌ Errores: ${result.errors}`);
    
    // Verificar datos después del re-procesamiento
    const testResult = await pool.request()
      .query(`SELECT TOP 5 
        Id, ExternalId, Title, CompanyName, City, Region 
        FROM JobOffers 
        WHERE ConnectionId = 2089 AND StatusId = 1
        ORDER BY CreatedAt DESC`);
    
    console.log('\n📊 Muestra de ofertas re-procesadas:');
    testResult.recordset.forEach(offer => {
      console.log(`ID: ${offer.Id} | Company: '${offer.CompanyName}' | City: '${offer.City}' | Region: '${offer.Region}'`);
    });
    
    // Estadísticas finales
    const stats = await pool.request()
      .query(`SELECT 
        COUNT(*) as Total,
        COUNT(CASE WHEN CompanyName IS NOT NULL AND CompanyName != '' THEN 1 END) as WithCompany,
        COUNT(CASE WHEN City IS NOT NULL AND City != '' THEN 1 END) as WithCity,
        COUNT(CASE WHEN Region IS NOT NULL AND Region != '' THEN 1 END) as WithRegion
        FROM JobOffers 
        WHERE ConnectionId = 2089 AND StatusId = 1`);
    
    const s = stats.recordset[0];
    console.log(`\n📊 Estadísticas después del fix:`);
    console.log(`Total ofertas activas: ${s.Total}`);
    console.log(`Con CompanyName: ${s.WithCompany} (${s.Total > 0 ? Math.round(s.WithCompany/s.Total*100) : 0}%)`);
    console.log(`Con City: ${s.WithCity} (${s.Total > 0 ? Math.round(s.WithCity/s.Total*100) : 0}%)`);
    console.log(`Con Region: ${s.WithRegion} (${s.Total > 0 ? Math.round(s.WithRegion/s.Total*100) : 0}%)`);
    
  } catch (error) {
    console.error('❌ Error en re-procesamiento:', error.message);
    console.error(error.stack);
  } finally {
    if (pool) {
      await pool.close();
    }
    process.exit(0);
  }
}

reprocessXML();