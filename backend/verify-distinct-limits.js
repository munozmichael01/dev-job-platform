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

async function verifyDistinctLimits() {
  try {
    console.log('🔍 Verificando si las limitaciones DISTINCT ocultan datos importantes...');
    await sql.connect(config);
    
    // 1. Verificar cuántas ubicaciones únicas existen vs las que mostramos
    console.log('\n📍 ANÁLISIS DE UBICACIONES:');
    
    const totalLocationsQuery = `
      SELECT COUNT(DISTINCT 
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END
      ) as totalUniqueLocations
      FROM JobOffers WITH (NOLOCK)
      WHERE StatusId = 1 AND (City IS NOT NULL OR Region IS NOT NULL)
    `;
    
    const totalLocResult = await sql.query(totalLocationsQuery);
    const totalLocations = totalLocResult.recordset[0].totalUniqueLocations;
    
    console.log(`📊 Total ubicaciones únicas disponibles: ${totalLocations}`);
    console.log(`📊 Limitación actual (TOP 30): Mostrando máximo 30`);
    console.log(`${totalLocations > 30 ? '⚠️' : '✅'} ${totalLocations > 30 ? 'SÍ HAY LIMITACIÓN' : 'NO HAY LIMITACIÓN'} - ${totalLocations > 30 ? `Se ocultan ${totalLocations - 30} ubicaciones` : 'Se muestran todas'}`);
    
    // 2. Verificar sectores
    console.log('\n🏭 ANÁLISIS DE SECTORES:');
    
    const totalSectorsQuery = `
      SELECT COUNT(DISTINCT Sector) as totalUniqueSectors
      FROM JobOffers WITH (NOLOCK)
      WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
    `;
    
    const totalSecResult = await sql.query(totalSectorsQuery);
    const totalSectors = totalSecResult.recordset[0].totalUniqueSectors;
    
    console.log(`📊 Total sectores únicos disponibles: ${totalSectors}`);
    console.log(`📊 Limitación actual (TOP 25): Mostrando máximo 25`);
    console.log(`${totalSectors > 25 ? '⚠️' : '✅'} ${totalSectors > 25 ? 'SÍ HAY LIMITACIÓN' : 'NO HAY LIMITACIÓN'} - ${totalSectors > 25 ? `Se ocultan ${totalSectors - 25} sectores` : 'Se muestran todos'}`);
    
    // 3. Verificar empresas
    console.log('\n🏢 ANÁLISIS DE EMPRESAS:');
    
    const totalCompaniesQuery = `
      SELECT COUNT(DISTINCT CompanyName) as totalUniqueCompanies
      FROM JobOffers WITH (NOLOCK)
      WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
    `;
    
    const totalCompResult = await sql.query(totalCompaniesQuery);
    const totalCompanies = totalCompResult.recordset[0].totalUniqueCompanies;
    
    console.log(`📊 Total empresas únicas disponibles: ${totalCompanies}`);
    console.log(`📊 Limitación actual (TOP 25): Mostrando máximo 25`);
    console.log(`${totalCompanies > 25 ? '⚠️' : '✅'} ${totalCompanies > 25 ? 'SÍ HAY LIMITACIÓN' : 'NO HAY LIMITACIÓN'} - ${totalCompanies > 25 ? `Se ocultan ${totalCompanies - 25} empresas` : 'Se muestran todas'}`);
    
    // 4. Mostrar ejemplos de lo que se está ocultando (si aplica)
    if (totalLocations > 30) {
      console.log('\n📍 UBICACIONES QUE SE OCULTAN (alfabéticamente después de la posición 30):');
      const hiddenLocationsQuery = `
        WITH AllLocations AS (
          SELECT DISTINCT 
            CASE 
              WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
              THEN CONCAT(City, ', ', Region)
              WHEN City IS NOT NULL 
              THEN City
              ELSE Region
            END as location,
            ROW_NUMBER() OVER (ORDER BY 
              CASE 
                WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
                THEN CONCAT(City, ', ', Region)
                WHEN City IS NOT NULL 
                THEN City
                ELSE Region
              END
            ) as rowNum
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND (City IS NOT NULL OR Region IS NOT NULL)
        )
        SELECT TOP 10 location 
        FROM AllLocations 
        WHERE rowNum > 30
        ORDER BY location
      `;
      
      const hiddenLocResult = await sql.query(hiddenLocationsQuery);
      hiddenLocResult.recordset.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.location}`);
      });
      console.log(`   ... y ${totalLocations - 40} más`);
    }
    
    if (totalSectors > 25) {
      console.log('\n🏭 SECTORES QUE SE OCULTAN (alfabéticamente después de la posición 25):');
      const hiddenSectorsQuery = `
        WITH AllSectors AS (
          SELECT DISTINCT Sector,
            ROW_NUMBER() OVER (ORDER BY Sector) as rowNum
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
        )
        SELECT TOP 10 Sector 
        FROM AllSectors 
        WHERE rowNum > 25
        ORDER BY Sector
      `;
      
      const hiddenSecResult = await sql.query(hiddenSectorsQuery);
      hiddenSecResult.recordset.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.Sector}`);
      });
      console.log(`   ... y ${totalSectors - 35} más`);
    }
    
    if (totalCompanies > 25) {
      console.log('\n🏢 EMPRESAS QUE SE OCULTAN (alfabéticamente después de la posición 25):');
      const hiddenCompaniesQuery = `
        WITH AllCompanies AS (
          SELECT DISTINCT CompanyName,
            ROW_NUMBER() OVER (ORDER BY CompanyName) as rowNum
          FROM JobOffers WITH (NOLOCK)
          WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
        )
        SELECT TOP 10 CompanyName 
        FROM AllCompanies 
        WHERE rowNum > 25
        ORDER BY CompanyName
      `;
      
      const hiddenCompResult = await sql.query(hiddenCompaniesQuery);
      hiddenCompResult.recordset.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.CompanyName}`);
      });
      console.log(`   ... y ${totalCompanies - 35} más`);
    }
    
    // 5. Análisis de impacto y recomendaciones
    console.log('\n🎯 ANÁLISIS DE IMPACTO:');
    
    const hasLimitations = totalLocations > 30 || totalSectors > 25 || totalCompanies > 25;
    
    if (hasLimitations) {
      console.log('⚠️ SÍ HAY LIMITACIONES que pueden afectar la experiencia del usuario');
      console.log('\n💡 OPCIONES PARA RESOLVER:');
      console.log('1. 🔍 Implementar búsqueda/autocompletado en lugar de listas completas');
      console.log('2. 📈 Aumentar los límites (pero puede afectar performance)');
      console.log('3. 🏆 Mostrar los más populares en lugar de orden alfabético');
      console.log('4. 📄 Implementar paginación en las listas');
      console.log('5. ⚡ Cache inteligente con lazy loading');
    } else {
      console.log('✅ NO HAY LIMITACIONES problemáticas');
      console.log('✅ Los límites actuales cubren todos los datos disponibles');
    }
    
    console.log('\n📊 RECOMENDACIÓN ESPECÍFICA:');
    if (totalLocations > 30 || totalSectors > 25 || totalCompanies > 25) {
      console.log('⚠️ Considera implementar autocompletado/búsqueda para mejor UX');
      console.log('💡 O aumentar límites a TOP 50-100 si performance lo permite');
    } else {
      console.log('✅ Límites actuales son apropiados - no necesitas cambiar nada');
    }
    
    await sql.close();
    console.log('\n✅ Verificación de limitaciones DISTINCT completada');
    
  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
}

verifyDistinctLimits();