const { pool } = require('./src/db/db');

async function testData() {
  try {
    console.log('🔍 Verificando datos después del mapeo corregido...');
    
    // Test de conexión específica
    const result = await pool.request()
      .query(`SELECT TOP 5 
        Id, ExternalId, Title, CompanyName, City, Region, StatusId 
        FROM JobOffers 
        WHERE ConnectionId = 2089
        ORDER BY CreatedAt DESC`);
    
    console.log('📊 Muestra de ofertas después del fix:');
    result.recordset.forEach(offer => {
      console.log(`ID: ${offer.Id} | ExternalId: ${offer.ExternalId} | Company: '${offer.CompanyName}' | City: '${offer.City}' | Region: '${offer.Region}' | Status: ${offer.StatusId}`);
    });

    // Contar ofertas con ubicación y empresa
    const stats = await pool.request()
      .query(`SELECT 
        COUNT(*) as Total,
        COUNT(CASE WHEN CompanyName IS NOT NULL AND CompanyName != '' THEN 1 END) as WithCompany,
        COUNT(CASE WHEN City IS NOT NULL AND City != '' THEN 1 END) as WithCity,
        COUNT(CASE WHEN Region IS NOT NULL AND Region != '' THEN 1 END) as WithRegion
        FROM JobOffers 
        WHERE ConnectionId = 2089`);
    
    const s = stats.recordset[0];
    console.log(`\n📊 Estadísticas ofertas ConnectionId 2089:`);
    console.log(`Total: ${s.Total}`);
    console.log(`Con CompanyName: ${s.WithCompany} (${Math.round(s.WithCompany/s.Total*100)}%)`);
    console.log(`Con City: ${s.WithCity} (${Math.round(s.WithCity/s.Total*100)}%)`);
    console.log(`Con Region: ${s.WithRegion} (${Math.round(s.WithRegion/s.Total*100)}%)`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testData();