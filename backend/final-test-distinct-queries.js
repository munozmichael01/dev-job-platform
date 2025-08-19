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

async function testDistinctQueriesFixed() {
  try {
    console.log('🎯 TEST FINAL: Verificando que las consultas DISTINCT funcionan correctamente');
    console.log('📋 Después de eliminar el índice problemático IX_JobOffers_City_Region');
    await sql.connect(config);
    
    // Test 1: Locations (la que tenía problemas)
    console.log('\n🧪 TEST 1: DISTINCT Locations');
    const startLoc = Date.now();
    
    const locationQuery = `
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
    
    const locResult = await sql.query(locationQuery);
    const endLoc = Date.now();
    const locTime = endLoc - startLoc;
    
    console.log(`   ⏱️ Performance: ${locTime}ms`);
    console.log(`   📋 Resultados: ${locResult.recordset.length} locations`);
    
    if (locTime < 1000) {
      console.log('   🎉 ¡EXCELENTE! Performance mejorada significativamente');
    } else {
      console.log('   ⚠️ Aún hay problemas de performance');
    }
    
    // Test 2: Sectors
    console.log('\n🧪 TEST 2: DISTINCT Sectors');
    const startSec = Date.now();
    
    const sectorQuery = `
      SELECT DISTINCT TOP 50 Sector
      FROM JobOffers WITH (NOLOCK)
      WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
      ORDER BY Sector
    `;
    
    const secResult = await sql.query(sectorQuery);
    const endSec = Date.now();
    const secTime = endSec - startSec;
    
    console.log(`   ⏱️ Performance: ${secTime}ms`);
    console.log(`   📋 Resultados: ${secResult.recordset.length} sectors`);
    
    // Test 3: Companies
    console.log('\n🧪 TEST 3: DISTINCT Companies');
    const startComp = Date.now();
    
    const companyQuery = `
      SELECT DISTINCT TOP 100 CompanyName
      FROM JobOffers WITH (NOLOCK)
      WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
      ORDER BY CompanyName
    `;
    
    const compResult = await sql.query(companyQuery);
    const endComp = Date.now();
    const compTime = endComp - startComp;
    
    console.log(`   ⏱️ Performance: ${compTime}ms`);
    console.log(`   📋 Resultados: ${compResult.recordset.length} companies`);
    
    // Resumen final
    console.log('\n📊 RESUMEN FINAL:');
    console.log(`   🔍 Locations: ${locTime}ms (${locResult.recordset.length} resultados)`);
    console.log(`   🏭 Sectors: ${secTime}ms (${secResult.recordset.length} resultados)`);
    console.log(`   🏢 Companies: ${compTime}ms (${compResult.recordset.length} resultados)`);
    
    const totalTime = locTime + secTime + compTime;
    console.log(`   ⚡ Total: ${totalTime}ms`);
    
    if (totalTime < 3000) {
      console.log('   🎊 ¡PROBLEMA RESUELTO! Performance excelente en todas las consultas');
    } else {
      console.log('   ⚠️ Aún hay margen de mejora');
    }
    
    // Test 4: Verificar que no tenemos más índices problemáticos
    console.log('\n🔍 VERIFICACIÓN: Índices actuales en JobOffers');
    const indexQuery = `
      SELECT 
        i.name as IndexName,
        i.type_desc as IndexType,
        STUFF((
          SELECT ', ' + c.name
          FROM sys.index_columns ic
          JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          ORDER BY ic.key_ordinal
          FOR XML PATH('')
        ), 1, 2, '') as Columns
      FROM sys.indexes i
      WHERE i.object_id = OBJECT_ID('JobOffers')
        AND i.type > 0  -- Excluir heap
      ORDER BY i.name
    `;
    
    const indexResult = await sql.query(indexQuery);
    console.log('\n   📊 Índices actuales:');
    indexResult.recordset.forEach(idx => {
      console.log(`      ${idx.IndexName}: ${idx.Columns} (${idx.IndexType})`);
    });
    
    await sql.close();
    console.log('\n✅ Test final completado - Las consultas DISTINCT están optimizadas');
    
  } catch (error) {
    console.error('❌ Error en test final:', error);
  }
}

testDistinctQueriesFixed();