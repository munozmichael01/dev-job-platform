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

async function testForcedIndexes() {
  try {
    console.log('🧪 Probando queries con índices forzados...');
    await sql.connect(config);
    
    const testQueries = [
      {
        name: 'DISTINCT Locations (sin índice)',
        query: `
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
        `
      },
      {
        name: 'DISTINCT Locations (CON índice forzado)',
        query: `
          SELECT DISTINCT TOP 200
            CASE 
              WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
              THEN CONCAT(City, ', ', Region)
              WHEN City IS NOT NULL 
              THEN City
              ELSE Region
            END as location
          FROM JobOffers WITH (INDEX(IX_JobOffers_City_Region), NOLOCK)
          WHERE StatusId = 1 AND (City IS NOT NULL OR Region IS NOT NULL)
          ORDER BY location
        `
      },
      {
        name: 'DISTINCT Sectors (sin índice)',
        query: `
          SELECT DISTINCT TOP 50 Sector
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
          ORDER BY Sector
        `
      },
      {
        name: 'DISTINCT Sectors (CON índice forzado)',
        query: `
          SELECT DISTINCT TOP 50 Sector
          FROM JobOffers WITH (INDEX(IX_JobOffers_Sector_Active), NOLOCK)
          WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
          ORDER BY Sector
        `
      },
      {
        name: 'DISTINCT Companies (sin índice)',
        query: `
          SELECT DISTINCT TOP 100 CompanyName
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
          ORDER BY CompanyName
        `
      },
      {
        name: 'DISTINCT Companies (CON índice forzado)',
        query: `
          SELECT DISTINCT TOP 100 CompanyName
          FROM JobOffers WITH (INDEX(IX_JobOffers_CompanyName_Active), NOLOCK)
          WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
          ORDER BY CompanyName
        `
      }
    ];
    
    for (const test of testQueries) {
      console.log(`\n🧪 ${test.name}:`);
      
      const startTime = Date.now();
      try {
        const result = await sql.query(test.query);
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        console.log(`   ⏱️  Performance: ${queryTime}ms`);
        console.log(`   📋 Resultados: ${result.recordset.length} elementos`);
        
        if (queryTime < 1000) {
          console.log(`   🎉 Excelente performance!`);
        } else if (queryTime < 5000) {
          console.log(`   ✅ Performance aceptable`);
        } else if (queryTime < 15000) {
          console.log(`   ⚠️ Performance lenta pero funciona`);
        } else {
          console.log(`   ❌ Timeout probable (>15s)`);
        }
        
      } catch (testError) {
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        console.log(`   ❌ Error después de ${queryTime}ms: ${testError.message}`);
      }
    }
    
    // Probar query simple para verificar que la BD funciona
    console.log('\n🔍 VERIFICACIÓN BÁSICA:');
    try {
      const simpleTest = await sql.query('SELECT TOP 5 Id, Title FROM JobOffers WHERE StatusId = 1');
      console.log(`✅ Query simple funciona: ${simpleTest.recordset.length} resultados`);
    } catch (error) {
      console.log(`❌ Query simple falló: ${error.message}`);
    }
    
    await sql.close();
    console.log('\n✅ Test completado');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

testForcedIndexes();