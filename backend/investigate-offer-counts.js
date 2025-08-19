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

async function investigateOfferCounts() {
  try {
    console.log('🔍 Investigando discrepancia en conteo de ofertas...');
    await sql.connect(config);
    
    // 1. Conteos totales en la base de datos
    console.log('\n📊 CONTEOS TOTALES EN LA BASE DE DATOS:');
    
    const totalCountsQuery = `
      SELECT 
        COUNT(*) as TotalTodasLasOfertas,
        COUNT(CASE WHEN StatusId = 1 THEN 1 END) as TotalOfertasActivas,
        COUNT(CASE WHEN StatusId = 2 THEN 1 END) as TotalOfertasPausadas,
        COUNT(CASE WHEN StatusId = 3 THEN 1 END) as TotalOfertasArchivadas,
        COUNT(CASE WHEN StatusId = 4 THEN 1 END) as TotalOfertasPendientes,
        COUNT(CASE WHEN ConnectionId IS NOT NULL THEN 1 END) as TotalConConnectionId,
        COUNT(CASE WHEN ConnectionId IS NULL THEN 1 END) as TotalSinConnectionId
      FROM JobOffers WITH (NOLOCK)
    `;
    
    const totalCounts = await sql.query(totalCountsQuery);
    console.table(totalCounts.recordset);
    
    // 2. Conteos por usuario (a través de Connections)
    console.log('\n👥 CONTEOS POR USUARIO (a través de Connections):');
    
    const userCountsQuery = `
      SELECT 
        u.Id as UserId,
        u.Email,
        u.Role,
        COUNT(c.Id) as TotalConexiones,
        COUNT(jo.Id) as TotalOfertasDelUsuario,
        COUNT(CASE WHEN jo.StatusId = 1 THEN 1 END) as OfertasActivasDelUsuario
      FROM Users u
      LEFT JOIN Connections c ON u.Id = c.UserId
      LEFT JOIN JobOffers jo ON c.Id = jo.ConnectionId
      GROUP BY u.Id, u.Email, u.Role
      HAVING COUNT(jo.Id) > 0  -- Solo usuarios con ofertas
      ORDER BY COUNT(jo.Id) DESC
    `;
    
    const userCounts = await sql.query(userCountsQuery);
    console.table(userCounts.recordset);
    
    // 3. Verificar si hay ofertas huérfanas (sin ConnectionId o con ConnectionId inválido)
    console.log('\n🔍 VERIFICANDO OFERTAS HUÉRFANAS:');
    
    const orphanOffersQuery = `
      SELECT 
        COUNT(*) as OfertasHuerfanas,
        COUNT(CASE WHEN StatusId = 1 THEN 1 END) as OfertasHuerfanasActivas
      FROM JobOffers jo
      WHERE jo.ConnectionId IS NULL 
         OR jo.ConnectionId NOT IN (SELECT Id FROM Connections)
    `;
    
    const orphanOffers = await sql.query(orphanOffersQuery);
    console.table(orphanOffers.recordset);
    
    // 4. Investigar conteo de estimación de segmentos
    console.log('\n🎯 SIMULANDO CONTEO DE ESTIMACIÓN DE SEGMENTOS:');
    
    // Esta es probablemente la query que usa el frontend para estimar
    const segmentEstimationQuery = `
      SELECT COUNT(*) as EstimacionSegmento
      FROM JobOffers jo WITH (NOLOCK)
      INNER JOIN Connections con WITH (NOLOCK) ON jo.ConnectionId = con.Id
      WHERE jo.StatusId = 1
        AND con.UserId = 1  -- Usuario superadmin principal
    `;
    
    const segmentEstimation = await sql.query(segmentEstimationQuery);
    console.log(`🎯 Estimación para segmento (Usuario 1): ${segmentEstimation.recordset[0].EstimacionSegmento}`);
    
    // 5. Conteo como superadmin (sin filtro de usuario)
    console.log('\n🔑 CONTEO COMO SUPERADMIN (sin filtro):');
    
    const superadminCountQuery = `
      SELECT COUNT(*) as SuperadminTotal
      FROM JobOffers WITH (NOLOCK)
      WHERE StatusId = 1
    `;
    
    const superadminCount = await sql.query(superadminCountQuery);
    console.log(`🔑 Total como superadmin: ${superadminCount.recordset[0].SuperadminTotal}`);
    
    // 6. Verificar ofertas por ConnectionId específicos
    console.log('\n🔗 TOP 10 CONNECTIONS CON MÁS OFERTAS:');
    
    const topConnectionsQuery = `
      SELECT TOP 10
        c.Id as ConnectionId,
        c.UserId,
        u.Email,
        COUNT(jo.Id) as TotalOfertas,
        COUNT(CASE WHEN jo.StatusId = 1 THEN 1 END) as OfertasActivas
      FROM Connections c
      LEFT JOIN JobOffers jo ON c.Id = jo.ConnectionId
      LEFT JOIN Users u ON c.UserId = u.Id
      GROUP BY c.Id, c.UserId, u.Email
      ORDER BY COUNT(jo.Id) DESC
    `;
    
    const topConnections = await sql.query(topConnectionsQuery);
    console.table(topConnections.recordset);
    
    // 7. Análisis de la discrepancia
    console.log('\n🔍 ANÁLISIS DE DISCREPANCIA:');
    
    const total60k = totalCounts.recordset[0].TotalTodasLasOfertas;
    const active19k = segmentEstimation.recordset[0].EstimacionSegmento;
    const superAdmin = superadminCount.recordset[0].SuperadminTotal;
    
    console.log(`📊 Total en BD: ${total60k}`);
    console.log(`🎯 Estimación segmento: ${active19k}`);
    console.log(`🔑 Superadmin total: ${superAdmin}`);
    console.log(`❓ Diferencia: ${total60k - active19k} ofertas`);
    
    // 8. Investigar posibles causas
    console.log('\n🔍 POSIBLES CAUSAS DE LA DISCREPANCIA:');
    
    const causeAnalysisQuery = `
      SELECT 
        'Sin ConnectionId' as Categoria,
        COUNT(*) as Cantidad
      FROM JobOffers 
      WHERE ConnectionId IS NULL
      
      UNION ALL
      
      SELECT 
        'ConnectionId inválido' as Categoria,
        COUNT(*) as Cantidad
      FROM JobOffers jo
      WHERE jo.ConnectionId IS NOT NULL 
        AND jo.ConnectionId NOT IN (SELECT Id FROM Connections)
      
      UNION ALL
      
      SELECT 
        'StatusId != 1' as Categoria,
        COUNT(*) as Cantidad
      FROM JobOffers 
      WHERE StatusId != 1
      
      UNION ALL
      
      SELECT 
        'Connection sin UserId' as Categoria,
        COUNT(*) as Cantidad
      FROM JobOffers jo
      INNER JOIN Connections c ON jo.ConnectionId = c.Id
      WHERE c.UserId IS NULL
      
      UNION ALL
      
      SELECT 
        'Ofertas de usuarios inactivos' as Categoria,
        COUNT(*) as Cantidad
      FROM JobOffers jo
      INNER JOIN Connections c ON jo.ConnectionId = c.Id
      INNER JOIN Users u ON c.UserId = u.Id
      WHERE u.Id != 1  -- No del usuario principal
    `;
    
    const causeAnalysis = await sql.query(causeAnalysisQuery);
    console.table(causeAnalysis.recordset);
    
    console.log('\n💡 CONCLUSIÓN:');
    console.log('La discrepancia probablemente se debe a:');
    console.log('1. 🔍 Filtrado por StatusId (solo activas vs todas)');
    console.log('2. 🔗 Filtrado por ConnectionId válidos');
    console.log('3. 👤 Filtrado por UserId específico vs global');
    console.log('4. 🗑️ Ofertas huérfanas sin conexión válida');
    
    await sql.close();
    console.log('\n✅ Investigación completada');
    
  } catch (error) {
    console.error('❌ Error en investigación:', error);
  }
}

investigateOfferCounts();