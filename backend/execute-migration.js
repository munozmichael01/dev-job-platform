// Ejecutar migración usando el pool activo
const express = require('express');
const { pool, sql } = require('./src/db/db');

const executeMigration = async () => {
  try {
    console.log('🔧 Iniciando migración definitiva...');

    // 1. Agregar columna UserId si no existe
    try {
      await pool.request().query(`ALTER TABLE Segments ADD UserId BIGINT NULL`);
      console.log('✅ Columna UserId agregada a Segments');
    } catch (e) {
      if (e.message.includes('already exists') || e.message.includes('Column names in each table must be unique')) {
        console.log('✅ Columna UserId ya existe');
      } else {
        throw e;
      }
    }

    // 2. Asignar segmentos sin UserId al usuario ID 1
    const updateResult = await pool.request().query(`
      UPDATE Segments SET UserId = 1 WHERE UserId IS NULL
    `);
    console.log(`✅ ${updateResult.rowsAffected[0]} segmentos asignados al usuario ID 1`);

    // 3. Crear índice
    try {
      await pool.request().query(`CREATE INDEX IX_Segments_UserId ON Segments(UserId)`);
      console.log('✅ Índice creado');
    } catch (e) {
      console.log('✅ Índice ya existe o error creándolo');
    }

    // 4. Verificar resultado
    const result = await pool.request().query(`
      SELECT UserId, COUNT(*) as count FROM Segments GROUP BY UserId ORDER BY UserId
    `);
    
    console.log('📊 Segmentos por usuario:');
    result.recordset.forEach(row => {
      console.log(`  Usuario ${row.UserId}: ${row.count} segmentos`);
    });

    console.log('🎉 MIGRACIÓN COMPLETADA');
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
};

// Auto-ejecutar si se ejecuta directamente
if (require.main === module) {
  executeMigration().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { executeMigration };