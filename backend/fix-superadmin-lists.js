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

async function fixSuperadminLists() {
  try {
    console.log('🔍 Investigando estructura de datos para superadmin...');
    await sql.connect(config);
    
    // 1. Verificar estructura de las tablas
    console.log('\n📊 ESTRUCTURA DE DATOS:');
    
    // Verificar si JobOffers tiene UserId directamente
    const jobOffersStructure = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'JobOffers' 
      AND COLUMN_NAME IN ('UserId', 'ConnectionId')
      ORDER BY COLUMN_NAME
    `);
    
    console.log('JobOffers columns:');
    console.table(jobOffersStructure.recordset);
    
    // Verificar relación con Connections
    const connectionsStructure = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Connections' 
      AND COLUMN_NAME IN ('Id', 'UserId')
      ORDER BY COLUMN_NAME
    `);
    
    console.log('Connections columns:');
    console.table(connectionsStructure.recordset);
    
    // 2. Probar queries correctas para superadmin
    console.log('\n🔧 TESTING QUERIES CORRECTAS PARA SUPERADMIN:');
    
    // Verificar si JobOffers tiene UserId directamente
    const hasUserIdInJobOffers = jobOffersStructure.recordset.some(col => col.COLUMN_NAME === 'UserId');
    
    if (hasUserIdInJobOffers) {
      console.log('✅ JobOffers tiene UserId directamente');
      
      // Test query directa en JobOffers
      const directLocationsQuery = `
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
      
      const directLocResult = await sql.query(directLocationsQuery);
      console.log(`📍 Direct JobOffers Locations: ${directLocResult.recordset.length} resultados`);
      
      const directSectorsQuery = `
        SELECT DISTINCT TOP 50 Sector
        FROM JobOffers WITH (NOLOCK)
        WHERE StatusId = 1 AND Sector IS NOT NULL AND Sector != ''
        ORDER BY Sector
      `;
      
      const directSecResult = await sql.query(directSectorsQuery);
      console.log(`🏭 Direct JobOffers Sectors: ${directSecResult.recordset.length} resultados`);
      
      const directCompaniesQuery = `
        SELECT DISTINCT TOP 100 CompanyName
        FROM JobOffers WITH (NOLOCK)
        WHERE StatusId = 1 AND CompanyName IS NOT NULL AND CompanyName != ''
        ORDER BY CompanyName
      `;
      
      const directCompResult = await sql.query(directCompaniesQuery);
      console.log(`🏢 Direct JobOffers Companies: ${directCompResult.recordset.length} resultados`);
      
    } else {
      console.log('❌ JobOffers NO tiene UserId directamente, necesita JOIN con Connections');
      
      // Test query con JOIN para superadmin
      const joinLocationsQuery = `
        SELECT DISTINCT TOP 200
          CASE 
            WHEN jo.City IS NOT NULL AND jo.Region IS NOT NULL AND jo.Region != '' 
            THEN CONCAT(jo.City, ', ', jo.Region)
            WHEN jo.City IS NOT NULL 
            THEN jo.City
            ELSE jo.Region
          END as location
        FROM JobOffers jo WITH (NOLOCK)
        INNER JOIN Connections c WITH (NOLOCK) ON jo.ConnectionId = c.Id
        WHERE jo.StatusId = 1 AND (jo.City IS NOT NULL OR jo.Region IS NOT NULL)
        ORDER BY location
      `;
      
      const joinLocResult = await sql.query(joinLocationsQuery);
      console.log(`📍 JOIN JobOffers+Connections Locations: ${joinLocResult.recordset.length} resultados`);
    }
    
    // 3. Identificar el problema en los endpoints actuales
    console.log('\n🔍 ANÁLISIS DEL PROBLEMA:');
    
    if (hasUserIdInJobOffers) {
      console.log('✅ Los endpoints deberían funcionar correctamente para superadmin');
      console.log('🔍 Problema puede ser en la lógica de isSuperAdmin() o en el request.userId');
      
      // Test la función isSuperAdmin
      console.log('\n🧪 TESTING isSuperAdmin LOGIC:');
      
      // Simular diferentes usuarios
      const testUsers = [
        { id: 1, email: 'juan@miempresa.com', role: 'superadmin' },
        { id: 8, email: 'superadmin@jobplatform.com', role: 'superadmin' },
        { id: 11, email: 'michael.munoz@turijobs.com', role: 'user' }
      ];
      
      for (const user of testUsers) {
        const mockReq = {
          userId: user.id,
          user: user
        };
        
        // Importar y probar la función isSuperAdmin
        const { isSuperAdmin } = require('./src/middleware/authMiddleware');
        const isSuper = isSuperAdmin(mockReq);
        
        console.log(`User ${user.email} (ID: ${user.id}, Role: ${user.role}) -> isSuperAdmin: ${isSuper}`);
      }
      
    } else {
      console.log('❌ Los endpoints necesitan ser modificados para manejar correctamente la relación JobOffers -> Connections -> UserId');
    }
    
    console.log('\n🎯 SOLUCIÓN IDENTIFICADA:');
    console.log('1. Verificar que isSuperAdmin() funciona correctamente');
    console.log('2. Verificar que req.userId está correctamente configurado');
    console.log('3. Los endpoints YA tienen la lógica correcta para superadmin');
    console.log('4. El problema puede estar en el frontend (qué usuario está logueado)');
    
    await sql.close();
    console.log('\n✅ Análisis completado');
    
  } catch (error) {
    console.error('❌ Error en análisis:', error);
  }
}

fixSuperadminLists();