const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function dropProblematicIndex() {
  try {
    console.log('🗑️ Eliminando índice problemático IX_JobOffers_City_Region...');
    await sql.connect(config);
    
    // Verificar si el índice existe
    const checkIndexQuery = `
      SELECT name 
      FROM sys.indexes 
      WHERE object_id = OBJECT_ID('JobOffers') 
        AND name = 'IX_JobOffers_City_Region'
    `;
    
    const indexExists = await sql.query(checkIndexQuery);
    
    if (indexExists.recordset.length > 0) {
      console.log('📍 Índice IX_JobOffers_City_Region encontrado. Eliminando...');
      
      const dropIndexQuery = `DROP INDEX IX_JobOffers_City_Region ON JobOffers`;
      await sql.query(dropIndexQuery);
      
      console.log('✅ Índice IX_JobOffers_City_Region eliminado exitosamente');
    } else {
      console.log('⚠️ Índice IX_JobOffers_City_Region no encontrado');
    }
    
    // Verificar performance después del drop
    console.log('\n🧪 Verificando performance después del drop:');
    
    const testLocationQuery = `
      SELECT DISTINCT TOP 200
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END as location
      FROM JobOffers WITH (NOLOCK)
      WHERE StatusId = 1 AND (City IS NOT NULL OR Region IS NOT NULL)
      ORDER BY location
    `;
    
    const startTime = Date.now();
    const testResult = await sql.query(testLocationQuery);
    const endTime = Date.now();
    const queryTime = endTime - startTime;
    
    console.log(`⏱️ Performance después del drop: ${queryTime}ms`);
    console.log(`📋 Resultados: ${testResult.recordset.length} locations`);
    
    if (queryTime < 1000) {
      console.log('🎉 Excelente! Performance mejorada');
    } else {
      console.log('⚠️ Aún hay problemas de performance');
    }
    
    await sql.close();
    console.log('\n✅ Proceso completado');
    
  } catch (error) {
    console.error('❌ Error eliminando índice problemático:', error);
  }
}

dropProblematicIndex();