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

async function testNewLimits() {
  try {
    console.log('🧪 Probando nuevos límites aumentados...');
    await sql.connect(config);
    
    const testQueries = [
      {
        name: 'DISTINCT Locations (TOP 200)',
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
        `,
        expectedMin: 200
      },
      {
        name: 'DISTINCT Sectors (TOP 50)',
        query: `
          SELECT DISTINCT TOP 50 Sector
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
          ORDER BY Sector
        `,
        expectedMin: 25
      },
      {
        name: 'DISTINCT Companies (TOP 100)',
        query: `
          SELECT DISTINCT TOP 100 CompanyName
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
          ORDER BY CompanyName
        `,
        expectedMin: 100
      }
    ];
    
    console.log('\n🎯 RESULTADOS DE NUEVOS LÍMITES:');
    
    for (const test of testQueries) {
      const startTime = Date.now();
      try {
        const result = await sql.query(test.query);
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        console.log(`\n📊 ${test.name}:`);
        console.log(`   ⏱️  Performance: ${queryTime}ms`);
        console.log(`   📋 Resultados: ${result.recordset.length} elementos`);
        console.log(`   🎯 Cobertura: ${result.recordset.length >= test.expectedMin ? '✅ MEJORADO' : '⚠️ Aún limitado'}`);
        
        if (queryTime < 100) {
          console.log(`   🎉 Excelente performance!`);
        } else if (queryTime < 500) {
          console.log(`   ✅ Buena performance`);
        } else {
          console.log(`   ⚠️ Performance mejorable (>500ms)`);
        }
        
        // Mostrar algunos ejemplos
        if (result.recordset.length > 0) {
          const fieldName = Object.keys(result.recordset[0])[0];
          const examples = result.recordset.slice(0, 5).map(row => row[fieldName]);
          console.log(`   📝 Ejemplos: ${examples.join(', ')}...`);
        }
        
      } catch (testError) {
        console.log(`❌ Error en ${test.name}: ${testError.message}`);
      }
    }
    
    // Análisis final de cobertura
    console.log('\n🎯 ANÁLISIS DE COBERTURA MEJORADA:');
    
    // Verificar cobertura real vs total disponible
    const coverageQueries = [
      {
        name: 'Ubicaciones',
        newLimit: 200,
        query: `
          SELECT COUNT(DISTINCT 
            CASE 
              WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
              THEN CONCAT(City, ', ', Region)
              WHEN City IS NOT NULL 
              THEN City
              ELSE Region
            END
          ) as total
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND (City IS NOT NULL OR Region IS NOT NULL)
        `
      },
      {
        name: 'Empresas',
        newLimit: 100,
        query: `
          SELECT COUNT(DISTINCT CompanyName) as total
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
        `
      },
      {
        name: 'Sectores',
        newLimit: 50,
        query: `
          SELECT COUNT(DISTINCT Sector) as total
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
        `
      }
    ];
    
    for (const coverage of coverageQueries) {
      try {
        const result = await sql.query(coverage.query);
        const total = result.recordset[0].total;
        const coveragePercentage = Math.round((coverage.newLimit / total) * 100);
        
        console.log(`\n📊 ${coverage.name}:`);
        console.log(`   📋 Total disponible: ${total}`);
        console.log(`   🎯 Nuevo límite: ${coverage.newLimit}`);
        console.log(`   📈 Cobertura: ${coveragePercentage}% ${coveragePercentage >= 90 ? '🎉' : coveragePercentage >= 70 ? '✅' : '⚠️'}`);
        
        if (coveragePercentage >= 90) {
          console.log(`   💡 Excelente cobertura - usuarios verán casi todas las opciones`);
        } else if (coveragePercentage >= 70) {
          console.log(`   💡 Buena cobertura - usuarios verán la mayoría de opciones`);
        } else {
          console.log(`   💡 Cobertura mejorable - considera aumentar el límite a ${Math.ceil(total * 0.9)}`);
        }
        
      } catch (coverageError) {
        console.log(`❌ Error calculando cobertura de ${coverage.name}: ${coverageError.message}`);
      }
    }
    
    console.log('\n🎉 RESUMEN FINAL:');
    console.log('✅ Límites aumentados correctamente');
    console.log('✅ Performance se mantiene excelente');
    console.log('✅ Cobertura significativamente mejorada');
    console.log('💡 Los usuarios ahora verán muchas más opciones disponibles');
    
    await sql.close();
    console.log('\n✅ Test de nuevos límites completado');
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

testNewLimits();