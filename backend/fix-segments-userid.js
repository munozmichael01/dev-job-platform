const { pool, sql } = require('./src/db/db');

(async () => {
  try {
    console.log('🔧 Agregando columna UserId a tabla Segments...');
    
    await pool;
    
    // 1. Verificar si la columna ya existe
    const columnCheck = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Segments' AND COLUMN_NAME = 'UserId'
    `);
    
    if (columnCheck.recordset.length > 0) {
      console.log('✅ Columna UserId ya existe en tabla Segments');
      process.exit(0);
    }
    
    // 2. Agregar columna UserId
    await pool.request().query(`
      ALTER TABLE Segments 
      ADD UserId BIGINT NULL
    `);
    console.log('✅ Columna UserId agregada a tabla Segments');
    
    // 3. Actualizar todos los segmentos existentes para asignarlos al usuario ID 1 (admin)
    const updateResult = await pool.request()
      .input('userId', sql.BigInt, 1)
      .query(`
        UPDATE Segments 
        SET UserId = @userId 
        WHERE UserId IS NULL
      `);
    
    console.log(`✅ ${updateResult.rowsAffected[0]} segmentos asignados al usuario ID 1`);
    
    // 4. Agregar constraint para hacer la columna NOT NULL en el futuro
    // (Por ahora la dejamos NULL para facilitar la migración)
    
    // 5. Agregar índice para performance
    await pool.request().query(`
      CREATE INDEX IX_Segments_UserId ON Segments(UserId)
    `);
    console.log('✅ Índice creado en Segments.UserId');
    
    console.log('🎉 Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
  }
  
  process.exit();
})();