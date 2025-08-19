const { pool, poolConnect, sql } = require('../src/db/db');

async function populateUserIds() {
  try {
    await poolConnect;
    
    console.log('🚀 Poblando UserId en registros existentes...');
    
    // 1. Poblar Campaigns con UserId = 1 para las que no tienen UserId
    const campaignsResult = await pool.request().query(`
      UPDATE Campaigns 
      SET UserId = 1 
      WHERE UserId IS NULL;
      SELECT @@ROWCOUNT as UpdatedCampaigns;
    `);
    
    console.log(`✅ Campaigns actualizadas: ${campaignsResult.recordset[0]?.UpdatedCampaigns || 0}`);
    
    // 2. Poblar JobOffers con UserId = 1 para las que no tienen UserId
    const offersResult = await pool.request().query(`
      UPDATE JobOffers 
      SET UserId = 1 
      WHERE UserId IS NULL;
      SELECT @@ROWCOUNT as UpdatedOffers;
    `);
    
    console.log(`✅ JobOffers actualizadas: ${offersResult.recordset[0]?.UpdatedOffers || 0}`);
    
    // 3. Verificar el estado final
    const statsResult = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM Campaigns WHERE UserId IS NOT NULL) as CampaignsWithUser,
        (SELECT COUNT(*) FROM Campaigns WHERE UserId IS NULL) as CampaignsWithoutUser,
        (SELECT COUNT(*) FROM JobOffers WHERE UserId IS NOT NULL) as OffersWithUser,
        (SELECT COUNT(*) FROM JobOffers WHERE UserId IS NULL) as OffersWithoutUser
    `);
    
    const stats = statsResult.recordset[0];
    console.log('📊 Estado final:');
    console.log(`   Campaigns con UserId: ${stats.CampaignsWithUser}`);
    console.log(`   Campaigns sin UserId: ${stats.CampaignsWithoutUser}`);
    console.log(`   JobOffers con UserId: ${stats.OffersWithUser}`);
    console.log(`   JobOffers sin UserId: ${stats.OffersWithoutUser}`);
    
    console.log('✅ Proceso completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error poblando UserIds:', error);
  } finally {
    process.exit();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  populateUserIds();
}

module.exports = populateUserIds;