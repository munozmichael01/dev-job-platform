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

async function optimizeDistinctQueries() {
  try {
    console.log('🚀 Optimizando consultas DISTINCT para carga inicial...');
    await sql.connect(config);
    
    // Índices específicos para consultas DISTINCT que se ejecutan en carga inicial
    const distinctIndexes = [
      {
        name: 'IX_JobOffers_City_Region',
        table: 'JobOffers',
        columns: ['City', 'Region'],
        description: 'Optimizar DISTINCT locations (City + Region)'
      },
      {
        name: 'IX_JobOffers_Sector_Active',
        table: 'JobOffers', 
        columns: ['Sector'],
        includes: ['StatusId'],
        description: 'Optimizar DISTINCT sectors filtrado por StatusId'
      },
      {
        name: 'IX_JobOffers_CompanyName_Active',
        table: 'JobOffers',
        columns: ['CompanyName'],
        includes: ['StatusId'],
        description: 'Optimizar DISTINCT companies filtrado por StatusId'
      }
    ];
    
    console.log(`\n🔧 Creando ${distinctIndexes.length} índices para DISTINCT queries...`);
    
    let createdCount = 0;
    
    for (const index of distinctIndexes) {
      try {
        console.log(`📊 Verificando índice ${index.name}...`);
        
        // Verificar si ya existe
        const existsResult = await sql.query(`
          SELECT name FROM sys.indexes 
          WHERE name = '${index.name}' AND object_id = OBJECT_ID('${index.table}')
        `);
        
        if (existsResult.recordset.length > 0) {
          console.log(`ℹ️ Índice ${index.name} ya existe`);
          continue;
        }
        
        // Crear índice con INCLUDE si corresponde
        let createQuery;
        if (index.includes) {
          createQuery = `
            CREATE INDEX ${index.name} 
            ON ${index.table} (${index.columns.join(', ')})
            INCLUDE (${index.includes.join(', ')})
            WITH (FILLFACTOR = 90, ONLINE = OFF)
          `;
        } else {
          createQuery = `
            CREATE INDEX ${index.name} 
            ON ${index.table} (${index.columns.join(', ')})
            WITH (FILLFACTOR = 90, ONLINE = OFF)
          `;
        }
        
        console.log(`🚀 Creando ${index.name}...`);
        await sql.query(createQuery);
        
        console.log(`✅ ${index.name} creado: ${index.description}`);
        createdCount++;
        
      } catch (indexError) {
        console.log(`⚠️ Error creando ${index.name}: ${indexError.message}`);
      }
    }
    
    // Probar performance de las consultas DISTINCT después de crear índices
    console.log('\n🧪 Probando performance de consultas DISTINCT...');
    
    const testQueries = [
      {
        name: 'DISTINCT Locations',
        query: `
          SELECT DISTINCT TOP 30
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
        name: 'DISTINCT Sectors',
        query: `
          SELECT DISTINCT TOP 25 Sector
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
          ORDER BY Sector
        `
      },
      {
        name: 'DISTINCT Companies',
        query: `
          SELECT DISTINCT TOP 25 CompanyName
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
          ORDER BY CompanyName
        `
      }
    ];
    
    for (const test of testQueries) {
      const startTime = Date.now();
      try {
        const result = await sql.query(test.query);
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        console.log(`✅ ${test.name}: ${queryTime}ms (${result.recordset.length} resultados)`);
        
        if (queryTime < 100) {
          console.log(`   🎉 Excelente performance!`);
        } else if (queryTime < 500) {
          console.log(`   ✅ Buena performance`);
        } else {
          console.log(`   ⚠️ Performance mejorable (>500ms)`);
        }
        
      } catch (testError) {
        console.log(`❌ Error en ${test.name}: ${testError.message}`);
      }
    }
    
    // Mostrar resumen de optimización
    console.log('\n🎯 RESUMEN DE OPTIMIZACIÓN:');
    console.log(`✅ Índices creados: ${createdCount}`);
    console.log('🎯 Consultas DISTINCT optimizadas para carga inicial');
    console.log('💡 Las páginas de "Nuevo Segmento" deberían cargar más rápido');
    
    console.log('\n📊 Próximos pasos recomendados:');
    console.log('1. Probar crear nuevo segmento en http://localhost:3006/segmentos/nuevo');
    console.log('2. Verificar que las listas (Ubicaciones, Sectores, Empresas) cargan rápido');
    console.log('3. Si aún hay lentitud, considerar cache en frontend o backend');
    
    await sql.close();
    console.log('\n✅ Optimización de consultas DISTINCT completada');
    
  } catch (error) {
    console.error('❌ Error en optimización:', error);
  }
}

optimizeDistinctQueries();