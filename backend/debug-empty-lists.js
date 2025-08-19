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

async function debugEmptyLists() {
  try {
    console.log('🔍 Debugging listas vacías en crear segmento...');
    await sql.connect(config);
    
    // 1. Verificar qué usuarios tienen datos
    console.log('\n👥 USUARIOS Y SUS DATOS:');
    
    const usersWithDataQuery = `
      SELECT 
        u.Id as UserId,
        u.Email,
        u.Role,
        COALESCE(conn.Connections, 0) as Conexiones,
        COALESCE(offers.Ofertas, 0) as Ofertas,
        COALESCE(locs.Ubicaciones, 0) as UbicacionesUnicas,
        COALESCE(secs.Sectores, 0) as SectoresUnicos,
        COALESCE(comps.Empresas, 0) as EmpresasUnicas
      FROM Users u
      LEFT JOIN (
        SELECT UserId, COUNT(*) as Connections 
        FROM Connections 
        GROUP BY UserId
      ) conn ON u.Id = conn.UserId
      LEFT JOIN (
        SELECT c.UserId, COUNT(*) as Ofertas 
        FROM JobOffers jo
        INNER JOIN Connections c ON jo.ConnectionId = c.Id
        WHERE jo.StatusId = 1
        GROUP BY c.UserId
      ) offers ON u.Id = offers.UserId
      LEFT JOIN (
        SELECT c.UserId, COUNT(DISTINCT 
          CASE 
            WHEN jo.City IS NOT NULL AND jo.Region IS NOT NULL AND jo.Region != '' 
            THEN CONCAT(jo.City, ', ', jo.Region)
            WHEN jo.City IS NOT NULL 
            THEN jo.City
            ELSE jo.Region
          END
        ) as Ubicaciones
        FROM JobOffers jo
        INNER JOIN Connections c ON jo.ConnectionId = c.Id
        WHERE jo.StatusId = 1 AND (jo.City IS NOT NULL OR jo.Region IS NOT NULL)
        GROUP BY c.UserId
      ) locs ON u.Id = locs.UserId
      LEFT JOIN (
        SELECT c.UserId, COUNT(DISTINCT jo.Sector) as Sectores
        FROM JobOffers jo
        INNER JOIN Connections c ON jo.ConnectionId = c.Id
        WHERE jo.StatusId = 1 AND jo.Sector IS NOT NULL AND jo.Sector != ''
        GROUP BY c.UserId
      ) secs ON u.Id = secs.UserId
      LEFT JOIN (
        SELECT c.UserId, COUNT(DISTINCT jo.CompanyName) as Empresas
        FROM JobOffers jo
        INNER JOIN Connections c ON jo.ConnectionId = c.Id
        WHERE jo.StatusId = 1 AND jo.CompanyName IS NOT NULL AND jo.CompanyName != ''
        GROUP BY c.UserId
      ) comps ON u.Id = comps.UserId
      ORDER BY u.Id
    `;
    
    const usersResult = await sql.query(usersWithDataQuery);
    console.table(usersResult.recordset);
    
    // 2. Probar las queries específicas que usan los endpoints con diferentes usuarios
    const testUsers = [1, 11]; // Usuario 1 (tiene datos) y Usuario 11 (no tiene datos)
    
    for (const userId of testUsers) {
      console.log(`\n🔍 TESTING QUERIES PARA USUARIO ${userId}:`);
      
      // Test locations
      try {
        const locationsQuery = `
          SELECT DISTINCT TOP 200
            CASE 
              WHEN jo.City IS NOT NULL AND jo.Region IS NOT NULL AND jo.Region != '' 
              THEN CONCAT(jo.City, ', ', jo.Region)
              WHEN jo.City IS NOT NULL 
              THEN jo.City
              ELSE jo.Region
            END as location
          FROM JobOffers jo WITH (NOLOCK)
          INNER JOIN Connections c ON jo.ConnectionId = c.Id
          WHERE c.UserId = ${userId}
            AND jo.StatusId = 1 
            AND (jo.City IS NOT NULL OR jo.Region IS NOT NULL)
          ORDER BY location
        `;
        
        const locResult = await sql.query(locationsQuery);
        console.log(`   📍 Locations: ${locResult.recordset.length} resultados`);
        
      } catch (error) {
        console.log(`   📍 Locations: ERROR - ${error.message}`);
      }
      
      // Test sectors
      try {
        const sectorsQuery = `
          SELECT DISTINCT TOP 50 jo.Sector
          FROM JobOffers jo WITH (NOLOCK)
          INNER JOIN Connections c ON jo.ConnectionId = c.Id
          WHERE c.UserId = ${userId}
            AND jo.StatusId = 1 
            AND jo.Sector IS NOT NULL AND jo.Sector != ''
          ORDER BY jo.Sector
        `;
        
        const secResult = await sql.query(sectorsQuery);
        console.log(`   🏭 Sectors: ${secResult.recordset.length} resultados`);
        
      } catch (error) {
        console.log(`   🏭 Sectors: ERROR - ${error.message}`);
      }
      
      // Test companies
      try {
        const companiesQuery = `
          SELECT DISTINCT TOP 100 jo.CompanyName
          FROM JobOffers jo WITH (NOLOCK)
          INNER JOIN Connections c ON jo.ConnectionId = c.Id
          WHERE c.UserId = ${userId}
            AND jo.StatusId = 1 
            AND jo.CompanyName IS NOT NULL AND jo.CompanyName != ''
          ORDER BY jo.CompanyName
        `;
        
        const compResult = await sql.query(companiesQuery);
        console.log(`   🏢 Companies: ${compResult.recordset.length} resultados`);
        
      } catch (error) {
        console.log(`   🏢 Companies: ERROR - ${error.message}`);
      }
    }
    
    // 3. Verificar si los endpoints están filtrando correctamente por UserId
    console.log('\n🔍 PROBLEMA IDENTIFICADO:');
    
    const userWithoutData = usersResult.recordset.find(u => u.Ofertas === 0);
    const userWithData = usersResult.recordset.find(u => u.Ofertas > 0);
    
    if (userWithoutData && userWithData) {
      console.log(`❌ Usuario ${userWithoutData.Email} (ID: ${userWithoutData.UserId}) NO tiene ofertas`);
      console.log(`✅ Usuario ${userWithData.Email} (ID: ${userWithData.UserId}) SÍ tiene ${userWithData.Ofertas} ofertas`);
      console.log('\n💡 SOLUCIÓN:');
      console.log('1. Si estás logueado como un usuario sin datos, las listas estarán vacías (correcto)');
      console.log('2. Para testing, debes loguearte con un usuario que tenga conexiones y ofertas');
      console.log(`3. O temporalmente desactivar el filtro por UserId en los endpoints`);
    } else {
      console.log('🤔 Todos los usuarios tienen o no tienen datos. Problema puede ser otro...');
    }
    
    // 4. Verificar queries sin filtro de usuario (para super admin)
    console.log('\n🔑 TESTING SIN FILTRO DE USUARIO (SUPER ADMIN):');
    
    try {
      const globalLocationsQuery = `
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
      
      const globalLocResult = await sql.query(globalLocationsQuery);
      console.log(`📍 Global Locations: ${globalLocResult.recordset.length} resultados`);
      
      const globalSectorsQuery = `
        SELECT DISTINCT TOP 50 Sector
        FROM JobOffers WITH (NOLOCK)
        WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
        ORDER BY Sector
      `;
      
      const globalSecResult = await sql.query(globalSectorsQuery);
      console.log(`🏭 Global Sectors: ${globalSecResult.recordset.length} resultados`);
      
      const globalCompaniesQuery = `
        SELECT DISTINCT TOP 100 CompanyName
        FROM JobOffers WITH (NOLOCK)
        WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
        ORDER BY CompanyName
      `;
      
      const globalCompResult = await sql.query(globalCompaniesQuery);
      console.log(`🏢 Global Companies: ${globalCompResult.recordset.length} resultados`);
      
    } catch (error) {
      console.log(`❌ Error en queries globales: ${error.message}`);
    }
    
    console.log('\n🎯 RECOMENDACIONES:');
    console.log('1. 🔐 Verifica con qué usuario estás logueado');
    console.log('2. 📊 Usa un usuario que tenga conexiones y ofertas para testing');
    console.log('3. 🔑 O testea como superadmin para ver datos globales');
    console.log('4. 🧪 Si necesitas datos de prueba, podemos crearlos para tu usuario');
    
    await sql.close();
    console.log('\n✅ Debug de listas vacías completado');
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  }
}

debugEmptyLists();