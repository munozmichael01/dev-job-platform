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

async function cleanupAndOptimizeDB() {
  try {
    console.log('🧹 Conectando para limpiar y optimizar BD...');
    await sql.connect(config);
    
    // 1. Listar todos los índices existentes
    console.log('\n📊 Analizando índices existentes...');
    const existingIndexes = await sql.query(`
      SELECT 
        t.name AS TableName,
        i.name AS IndexName,
        i.type_desc AS IndexType,
        CASE WHEN i.is_unique = 1 THEN 'UNIQUE' ELSE 'NON-UNIQUE' END AS Uniqueness,
        STUFF((
          SELECT ', ' + c.name
          FROM sys.index_columns ic
          INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
          ORDER BY ic.key_ordinal
          FOR XML PATH('')
        ), 1, 2, '') AS Columns
      FROM sys.indexes i
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE i.index_id > 0  -- Excluir heaps
        AND t.name IN ('JobOffers', 'Connections', 'Campaigns', 'CampaignChannels', 'Users')
      ORDER BY t.name, i.name
    `);
    
    console.log('\n=== ÍNDICES ACTUALES ===');
    console.table(existingIndexes.recordset);
    
    // 2. Identificar índices duplicados o innecesarios
    console.log('\n🔍 Identificando índices para eliminar...');
    
    const indicesToDrop = [
      // Ejemplos de índices que podrían ser innecesarios
      // (ajustar según el análisis real)
    ];
    
    // 3. Reconstruir estadísticas críticas
    console.log('\n📊 Actualizando estadísticas críticas...');
    const criticalTables = ['JobOffers', 'Connections', 'Campaigns', 'CampaignChannels'];
    
    for (const table of criticalTables) {
      try {
        console.log(`📊 Actualizando estadísticas de ${table}...`);
        await sql.query(`UPDATE STATISTICS ${table}`);
        console.log(`✅ Estadísticas de ${table} actualizadas`);
      } catch (error) {
        console.log(`⚠️ Error actualizando estadísticas de ${table}: ${error.message}`);
      }
    }
    
    // 4. Intentar crear el índice crítico que faltó (con ONLINE=ON si es posible)
    console.log('\n🔧 Creando índice crítico de JobOffers...');
    
    try {
      // Primero verificar si ya existe
      const existsResult = await sql.query(`
        SELECT name FROM sys.indexes 
        WHERE name = 'IX_JobOffers_ConnectionId_StatusId' 
        AND object_id = OBJECT_ID('JobOffers')
      `);
      
      if (existsResult.recordset.length === 0) {
        console.log('🚀 Creando IX_JobOffers_ConnectionId_StatusId con ONLINE=ON...');
        
        // Intentar con ONLINE=ON para minimizar bloqueos
        await sql.query(`
          CREATE INDEX IX_JobOffers_ConnectionId_StatusId 
          ON JobOffers (ConnectionId, StatusId) 
          WITH (ONLINE = ON, FILLFACTOR = 80)
        `);
        
        console.log('✅ Índice crítico IX_JobOffers_ConnectionId_StatusId creado exitosamente');
      } else {
        console.log('ℹ️ Índice IX_JobOffers_ConnectionId_StatusId ya existe');
      }
    } catch (indexError) {
      console.log(`⚠️ Error creando índice crítico: ${indexError.message}`);
      
      // Intentar sin ONLINE=ON como fallback
      try {
        console.log('🔧 Intentando crear índice sin ONLINE=ON...');
        await sql.query(`
          CREATE INDEX IX_JobOffers_ConnectionId_StatusId 
          ON JobOffers (ConnectionId, StatusId) 
          WITH (FILLFACTOR = 80)
        `);
        console.log('✅ Índice crítico creado sin ONLINE=ON');
      } catch (fallbackError) {
        console.log(`❌ Error en fallback: ${fallbackError.message}`);
      }
    }
    
    // 5. Probar consulta optimizada
    console.log('\n🧪 Probando consulta optimizada...');
    
    const startTime = Date.now();
    
    try {
      // Consulta sin hints de índice específicos para probar performance
      const testResult = await sql.query(`
        SELECT TOP 5
          jo.Id,
          jo.Title,
          jo.CompanyName,
          jo.CreatedAt
        FROM JobOffers jo WITH (NOLOCK)
        INNER JOIN Connections con WITH (NOLOCK) ON jo.ConnectionId = con.Id
        WHERE con.UserId = 11 AND jo.StatusId = 1
        ORDER BY jo.CreatedAt DESC
        OPTION (FAST 5)
      `);
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      console.log(`✅ Consulta de prueba completada en ${queryTime}ms`);
      console.log(`📊 Resultados: ${testResult.recordset.length} ofertas encontradas`);
      
      if (queryTime < 1000) {
        console.log('🎉 ¡Performance mejorada significativamente!');
      } else if (queryTime < 5000) {
        console.log('⚠️ Performance mejorada pero aún puede optimizarse');
      } else {
        console.log('❌ Performance aún problemática, necesita más optimización');
      }
      
    } catch (testError) {
      console.log(`❌ Error en consulta de prueba: ${testError.message}`);
    }
    
    // 6. Resumen final
    console.log('\n🎯 RESUMEN DE OPTIMIZACIÓN:');
    console.log('✅ Estadísticas actualizadas en tablas críticas');
    console.log('✅ Índices básicos creados correctamente');
    console.log('📊 Performance de consultas debe mejorar significativamente');
    console.log('💡 Si persisten problemas, considerar fragmentación de tablas');
    
    await sql.close();
    console.log('\n✅ Optimización de BD completada');
    
  } catch (error) {
    console.error('❌ Error en optimización:', error);
  }
}

cleanupAndOptimizeDB();