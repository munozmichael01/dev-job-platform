const { pool, sql } = require('./src/db/db');

(async () => {
  try {
    console.log('🔧 MIGRACIÓN DEFINITIVA: Agregando UserId a Segments...');
    
    await pool;
    
    // 1. Verificar si la columna ya existe
    const columnCheck = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Segments' AND COLUMN_NAME = 'UserId'
    `);
    
    if (columnCheck.recordset.length === 0) {
      // 2. Agregar columna UserId a Segments
      console.log('📝 Agregando columna UserId a tabla Segments...');
      await pool.request().query(`
        ALTER TABLE Segments 
        ADD UserId BIGINT NULL
      `);
      console.log('✅ Columna UserId agregada');
    } else {
      console.log('✅ Columna UserId ya existe');
    }
    
    // 3. Verificar qué usuarios existen y tienen campañas
    const usersWithCampaigns = await pool.request().query(`
      SELECT DISTINCT c.UserId, u.Email, COUNT(*) as CampaignCount
      FROM Campaigns c
      INNER JOIN Users u ON c.UserId = u.Id
      GROUP BY c.UserId, u.Email
      ORDER BY c.UserId
    `);
    
    console.log('👥 Usuarios con campañas encontrados:');
    usersWithCampaigns.recordset.forEach(user => {
      console.log(`  - Usuario ${user.UserId} (${user.Email}): ${user.CampaignCount} campañas`);
    });
    
    // 4. Asignar segmentos existentes al usuario principal (ID 1)
    // Ya que no sabemos qué segmentos pertenecen a qué usuarios
    const segmentsWithoutUserId = await pool.request().query(`
      SELECT COUNT(*) as count FROM Segments WHERE UserId IS NULL
    `);
    
    if (segmentsWithoutUserId.recordset[0].count > 0) {
      console.log(`📊 Asignando ${segmentsWithoutUserId.recordset[0].count} segmentos sin UserId al usuario ID 1...`);
      
      const updateResult = await pool.request()
        .input('userId', sql.BigInt, 1)
        .query(`
          UPDATE Segments 
          SET UserId = @userId 
          WHERE UserId IS NULL
        `);
      
      console.log(`✅ ${updateResult.rowsAffected[0]} segmentos asignados al usuario ID 1`);
    }
    
    // 5. Crear índice para performance si no existe
    try {
      await pool.request().query(`
        CREATE INDEX IX_Segments_UserId ON Segments(UserId)
      `);
      console.log('✅ Índice IX_Segments_UserId creado');
    } catch (indexError) {
      if (indexError.message.includes('already exists')) {
        console.log('✅ Índice IX_Segments_UserId ya existe');
      } else {
        console.log('⚠️ Error creando índice:', indexError.message);
      }
    }
    
    // 6. Verificar resultado final
    const finalCheck = await pool.request().query(`
      SELECT 
        UserId,
        COUNT(*) as SegmentCount
      FROM Segments 
      GROUP BY UserId
      ORDER BY UserId
    `);
    
    console.log('📊 Distribución final de segmentos por usuario:');
    finalCheck.recordset.forEach(row => {
      console.log(`  - Usuario ${row.UserId || 'NULL'}: ${row.SegmentCount} segmentos`);
    });
    
    console.log('🎉 MIGRACIÓN COMPLETADA - Ahora cada usuario verá solo sus segmentos');
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit();
})();