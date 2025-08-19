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

async function fixConnectionsSchema() {
  try {
    console.log('🔧 Corrigiendo esquema de tabla Connections...');
    await sql.connect(config);
    
    // 1. Verificar estructura actual
    console.log('\n📊 ESTRUCTURA ACTUAL:');
    const currentSchema = await sql.query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Connections' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.table(currentSchema.recordset);
    
    // 2. Verificar si clientId existe y es NOT NULL
    const clientIdColumn = currentSchema.recordset.find(col => col.COLUMN_NAME === 'clientId' || col.COLUMN_NAME === 'ClientId');
    
    if (clientIdColumn) {
      console.log(`\n🔍 Columna clientId encontrada: ${clientIdColumn.COLUMN_NAME} (${clientIdColumn.IS_NULLABLE})`);
      
      if (clientIdColumn.IS_NULLABLE === 'NO') {
        console.log('❌ clientId es NOT NULL - necesita ser corregido');
        
        // Opción 1: Hacer la columna nullable
        console.log('\n🔧 OPCIÓN 1: Hacer clientId nullable (recomendado)');
        
        try {
          await sql.query(`ALTER TABLE Connections ALTER COLUMN clientId BIGINT NULL`);
          console.log('✅ clientId ahora permite NULL');
        } catch (error) {
          console.log('❌ Error alterando clientId:', error.message);
          
          // Opción 2: Eliminar la columna si no hay datos importantes
          console.log('\n🔧 OPCIÓN 2: Verificar si podemos eliminar clientId');
          
          const connectionsCount = await sql.query('SELECT COUNT(*) as Total FROM Connections');
          console.log(`📊 Total de conexiones existentes: ${connectionsCount.recordset[0].Total}`);
          
          if (connectionsCount.recordset[0].Total === 0) {
            console.log('💡 No hay conexiones existentes, podemos eliminar la columna');
            
            try {
              await sql.query('ALTER TABLE Connections DROP COLUMN clientId');
              console.log('✅ Columna clientId eliminada exitosamente');
            } catch (dropError) {
              console.log('❌ Error eliminando clientId:', dropError.message);
            }
          } else {
            console.log('⚠️ Hay conexiones existentes, no se puede eliminar clientId');
          }
        }
      } else {
        console.log('✅ clientId ya permite NULL');
      }
    } else {
      console.log('ℹ️ No se encontró columna clientId - ya está eliminada');
    }
    
    // 3. Verificar estructura final
    console.log('\n📊 ESTRUCTURA FINAL:');
    const finalSchema = await sql.query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Connections' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.table(finalSchema.recordset);
    
    // 4. Test de inserción
    console.log('\n🧪 TEST: Inserción sin clientId');
    
    try {
      const testInsert = await sql.query(`
        INSERT INTO Connections (name, type, url, frequency, UserId, status, CreatedAt) 
        VALUES ('Test Connection', 'XML', 'https://test.com', 'daily', 11, 'active', GETDATE())
      `);
      
      console.log('✅ Inserción de prueba exitosa');
      
      // Limpiar el registro de prueba
      await sql.query(`DELETE FROM Connections WHERE name = 'Test Connection' AND UserId = 11`);
      console.log('🧹 Registro de prueba eliminado');
      
    } catch (testError) {
      console.log('❌ Error en inserción de prueba:', testError.message);
    }
    
    await sql.close();
    console.log('\n✅ Corrección de esquema completada');
    
  } catch (error) {
    console.error('❌ Error corrigiendo esquema:', error);
  }
}

fixConnectionsSchema();