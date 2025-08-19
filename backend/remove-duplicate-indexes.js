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

async function removeDuplicateIndexes() {
  try {
    console.log('🧹 Conectando para eliminar índices duplicados...');
    await sql.connect(config);
    
    // Índices duplicados identificados que deben eliminarse
    const duplicateIndexesToDrop = [
      // CampaignChannels - Duplicados obvios
      { table: 'CampaignChannels', index: 'IX_CampaignChannels_Campaign' }, // Duplicado de IX_CampaignChannels_CampaignId
      { table: 'CampaignChannels', index: 'IX_CampaignChannels_Offer' }, // Duplicado de IX_CampaignChannels_OfferId
      { table: 'CampaignChannels', index: 'IX_CampaignChannels_Channel' }, // Posiblemente innecesario
      
      // JobOffers - Índices muy específicos y redundantes
      { table: 'JobOffers', index: 'IX_JobOffers_CompanyName_Exact' }, // Cubierto por otros índices más generales
      { table: 'JobOffers', index: 'IX_JobOffers_Title_Exact' }, // Cubierto por otros índices más generales
      { table: 'JobOffers', index: 'IX_JobOffers_Filters_Combined' }, // Redundante con Covering_Main
      { table: 'JobOffers', index: 'IX_JobOffers_Keyset_Final' }, // Redundante con Keyset_Pagination
      { table: 'JobOffers', index: 'IX_JobOffers_Search_SARGable' }, // Redundante con Covering_Main
      { table: 'JobOffers', index: 'IX_JobOffers_CreatedAt_Desc' }, // Redundante con IX_JobOffers_CreatedAt
      { table: 'JobOffers', index: 'IX_JobOffers_Location' }, // Cubierto por índices más generales
      { table: 'JobOffers', index: 'IX_JobOffers_Sector' }, // Cubierto por índices más generales
      { table: 'JobOffers', index: 'IX_JobOffers_Status_Date' }, // Cubierto por índices más generales
      
      // Users - Duplicados
      { table: 'Users', index: 'UQ__Users__A9D10534370DA812' } // Duplicado de IX_Users_Email
    ];
    
    console.log(`\n🗑️ Eliminando ${duplicateIndexesToDrop.length} índices duplicados/innecesarios...`);
    
    let removedCount = 0;
    let errorCount = 0;
    
    for (const indexInfo of duplicateIndexesToDrop) {
      try {
        console.log(`🗑️ Eliminando ${indexInfo.table}.${indexInfo.index}...`);
        
        // Verificar si el índice existe antes de eliminarlo
        const existsResult = await sql.query(`
          SELECT name FROM sys.indexes 
          WHERE name = '${indexInfo.index}' AND object_id = OBJECT_ID('${indexInfo.table}')
        `);
        
        if (existsResult.recordset.length > 0) {
          // Eliminar el índice
          await sql.query(`DROP INDEX ${indexInfo.index} ON ${indexInfo.table}`);
          console.log(`✅ Eliminado: ${indexInfo.table}.${indexInfo.index}`);
          removedCount++;
        } else {
          console.log(`ℹ️ Ya eliminado: ${indexInfo.table}.${indexInfo.index}`);
        }
        
      } catch (dropError) {
        console.log(`⚠️ Error eliminando ${indexInfo.table}.${indexInfo.index}: ${dropError.message}`);
        errorCount++;
      }
    }
    
    // Mostrar índices restantes después de la limpieza
    console.log('\n📊 Analizando índices después de la limpieza...');
    const remainingIndexes = await sql.query(`
      SELECT 
        t.name AS TableName,
        i.name AS IndexName,
        i.type_desc AS IndexType,
        CASE WHEN i.is_unique = 1 THEN 'UNIQUE' ELSE 'NON-UNIQUE' END AS Uniqueness
      FROM sys.indexes i
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE i.index_id > 0  -- Excluir heaps
        AND t.name IN ('JobOffers', 'Connections', 'Campaigns', 'CampaignChannels', 'Users')
      ORDER BY t.name, i.name
    `);
    
    console.log('\n=== ÍNDICES DESPUÉS DE LIMPIEZA ===');
    console.table(remainingIndexes.recordset);
    
    // Probar performance después de la limpieza
    console.log('\n🧪 Probando performance después de limpieza...');
    
    const testQueries = [
      {
        name: 'Ofertas por usuario',
        query: `
          SELECT COUNT(*) as Total
          FROM JobOffers jo WITH (NOLOCK)
          INNER JOIN Connections con WITH (NOLOCK) ON jo.ConnectionId = con.Id
          WHERE con.UserId = 11 AND jo.StatusId = 1
        `
      },
      {
        name: 'Conexiones por usuario',
        query: `
          SELECT COUNT(*) as Total
          FROM Connections WITH (NOLOCK)
          WHERE UserId = 11
        `
      },
      {
        name: 'Campañas activas',
        query: `
          SELECT COUNT(*) as Total
          FROM Campaigns WITH (NOLOCK)
          WHERE Status = 'active'
        `
      }
    ];
    
    for (const test of testQueries) {
      const startTime = Date.now();
      try {
        const result = await sql.query(test.query);
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        console.log(`✅ ${test.name}: ${queryTime}ms (${result.recordset[0].Total} resultados)`);
      } catch (testError) {
        console.log(`❌ Error en ${test.name}: ${testError.message}`);
      }
    }
    
    console.log('\n🎯 RESUMEN DE LIMPIEZA:');
    console.log(`✅ Índices eliminados: ${removedCount}`);
    console.log(`⚠️ Errores: ${errorCount}`);
    console.log(`📊 Índices restantes: ${remainingIndexes.recordset.length}`);
    console.log('💡 BD optimizada para mejor performance');
    
    await sql.close();
    console.log('\n✅ Limpieza de índices completada');
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  }
}

removeDuplicateIndexes();