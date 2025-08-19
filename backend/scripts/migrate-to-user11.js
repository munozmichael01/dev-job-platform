const { pool, poolConnect, sql } = require('../src/db/db');

async function migrateToUser11() {
  try {
    await poolConnect;
    
    console.log('🔄 Migrando datos de UserId=1 a UserId=11...');
    
    // Migrar Campaigns
    const campaignsResult = await pool.request().query(`
      UPDATE Campaigns 
      SET UserId = 11
      WHERE UserId = 1;
      SELECT @@ROWCOUNT as UpdatedCampaigns;
    `);
    console.log(`✅ Campaigns: ${campaignsResult.recordset[0]?.UpdatedCampaigns || 0}`);
    
    // Migrar JobOffers
    const offersResult = await pool.request().query(`
      UPDATE JobOffers
      SET UserId = 11
      WHERE UserId = 1;
      SELECT @@ROWCOUNT as UpdatedOffers;
    `);
    console.log(`✅ JobOffers: ${offersResult.recordset[0]?.UpdatedOffers || 0}`);
    
    // Migrar Segments (si existen)
    try {
      const segmentsResult = await pool.request().query(`
        UPDATE Segments
        SET UserId = 11
        WHERE UserId = 1;
        SELECT @@ROWCOUNT as UpdatedSegments;
      `);
      console.log(`✅ Segments: ${segmentsResult.recordset[0]?.UpdatedSegments || 0}`);
    } catch (e) {
      console.log('⚠️ Segments table doesn\'t have UserId column');
    }
    
    console.log('🎉 Migración completada!');
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    if (pool && pool.close) {
      await pool.close();
    }
    process.exit();
  }
}

migrateToUser11();