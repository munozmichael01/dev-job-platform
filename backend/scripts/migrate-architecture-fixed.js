/**
 * 🔄 Script de Migración Corregido: Arquitectura Multi-Tenant
 * 
 * Corrige la arquitectura moviendo datos técnicos de Clients a Connections
 * 
 * @author Claude Code
 * @date 2025-08-18
 */

const { pool, poolConnect, sql } = require('../src/db/db');

async function migrateArchitecture() {
  try {
    await poolConnect;
    
    console.log('🚀 Iniciando migración de arquitectura multi-tenant...');
    
    // 1. Agregar campos técnicos faltantes a Connections
    console.log('🔧 Agregando campos técnicos faltantes a tabla Connections...');
    
    const fieldsToAdd = [
      'SourceType',
      'Endpoint', 
      'PayloadTemplate',
      'FeedUrl',
      'Notes',
      'UserId'
    ];
    
    for (const fieldName of fieldsToAdd) {
      try {
        const checkColumn = await pool.request()
          .input('TableName', sql.NVarChar, 'Connections')
          .input('ColumnName', sql.NVarChar, fieldName)
          .query(`
            SELECT COUNT(*) as columnExists
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = @TableName AND COLUMN_NAME = @ColumnName
          `);
        
        if (checkColumn.recordset[0].columnExists === 0) {
          let columnType = 'NVARCHAR(500) NULL';
          if (fieldName === 'PayloadTemplate' || fieldName === 'Notes') {
            columnType = 'NVARCHAR(MAX) NULL';
          } else if (fieldName === 'UserId') {
            columnType = 'BIGINT NULL';
          }
          
          await pool.request().query(`
            ALTER TABLE Connections 
            ADD ${fieldName} ${columnType}
          `);
          console.log(`   ✅ Campo ${fieldName} agregado a Connections`);
        } else {
          console.log(`   ⚠️ Campo ${fieldName} ya existe en Connections`);
        }
      } catch (error) {
        console.error(`   ❌ Error agregando campo ${fieldName}:`, error.message);
      }
    }
    
    // 2. Agregar UserId a tabla Clients si no existe
    console.log('🔧 Agregando UserId a tabla Clients...');
    
    try {
      const checkUserIdClients = await pool.request()
        .input('TableName', sql.NVarChar, 'Clients')
        .input('ColumnName', sql.NVarChar, 'UserId')
        .query(`
          SELECT COUNT(*) as columnExists
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = @TableName AND COLUMN_NAME = @ColumnName
        `);
      
      if (checkUserIdClients.recordset[0].columnExists === 0) {
        await pool.request().query(`
          ALTER TABLE Clients 
          ADD UserId BIGINT NULL
        `);
        console.log('   ✅ Campo UserId agregado a Clients');
      } else {
        console.log('   ⚠️ Campo UserId ya existe en Clients');
      }
    } catch (error) {
      console.error('   ❌ Error agregando UserId a Clients:', error.message);
    }
    
    // 3. Migrar datos técnicos de Clients a Connections
    console.log('🔄 Migrando datos técnicos Clients → Connections...');
    
    try {
      const migrationResult = await pool.request().query(`
        UPDATE Connections SET 
          SourceType = c.SourceType,
          Endpoint = c.Endpoint,
          PayloadTemplate = c.PayloadTemplate,
          FeedUrl = c.FeedUrl,
          Notes = c.Notes,
          Headers = COALESCE(Connections.Headers, c.Headers),
          Method = COALESCE(Connections.Method, c.Method)
        FROM Connections
        INNER JOIN Clients c ON Connections.clientId = c.Id;
        
        SELECT @@ROWCOUNT as UpdatedConnections;
      `);
      
      console.log(`✅ ${migrationResult.recordset[0]?.UpdatedConnections || 0} Connections actualizadas con datos técnicos`);
    } catch (error) {
      console.error('❌ Error migrando datos técnicos:', error.message);
    }
    
    // 4. Asignar UserId por defecto a registros existentes
    console.log('👤 Asignando UserId por defecto a registros existentes...');
    
    // Clients
    try {
      const updateClientsUserId = await pool.request().query(`
        UPDATE Clients 
        SET UserId = 1 
        WHERE UserId IS NULL;
        SELECT @@ROWCOUNT as UpdatedClients;
      `);
      
      console.log(`   ✅ ${updateClientsUserId.recordset[0]?.UpdatedClients || 0} Clients actualizados con UserId`);
    } catch (error) {
      console.error('   ❌ Error actualizando Clients:', error.message);
    }
    
    // Connections
    try {
      const updateConnectionsUserId = await pool.request().query(`
        UPDATE Connections 
        SET UserId = 1 
        WHERE UserId IS NULL;
        SELECT @@ROWCOUNT as UpdatedConnections;
      `);
      
      console.log(`   ✅ ${updateConnectionsUserId.recordset[0]?.UpdatedConnections || 0} Connections actualizadas con UserId`);
    } catch (error) {
      console.error('   ❌ Error actualizando Connections:', error.message);
    }
    
    // 5. Crear foreign keys si no existen
    console.log('🔗 Creando foreign keys...');
    
    try {
      // FK Clients → Users
      const checkFKClientsUsers = await pool.request().query(`
        SELECT COUNT(*) as fkExists
        FROM sys.foreign_keys 
        WHERE name = 'FK_Clients_Users'
      `);
      
      if (checkFKClientsUsers.recordset[0].fkExists === 0) {
        await pool.request().query(`
          ALTER TABLE Clients
          ADD CONSTRAINT FK_Clients_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
        `);
        console.log('   ✅ Foreign key FK_Clients_Users creado');
      } else {
        console.log('   ⚠️ Foreign key FK_Clients_Users ya existe');
      }
      
      // FK Connections → Users
      const checkFKConnectionsUsers = await pool.request().query(`
        SELECT COUNT(*) as fkExists
        FROM sys.foreign_keys 
        WHERE name = 'FK_Connections_Users'
      `);
      
      if (checkFKConnectionsUsers.recordset[0].fkExists === 0) {
        await pool.request().query(`
          ALTER TABLE Connections
          ADD CONSTRAINT FK_Connections_Users FOREIGN KEY (UserId) REFERENCES Users(Id)
        `);
        console.log('   ✅ Foreign key FK_Connections_Users creado');
      } else {
        console.log('   ⚠️ Foreign key FK_Connections_Users ya existe');
      }
      
    } catch (error) {
      console.error('   ❌ Error creando foreign keys:', error.message);
    }
    
    // 6. Verificar resultado final
    console.log('📊 Verificando resultado final...');
    
    const finalCheck = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM Clients WHERE UserId IS NOT NULL) as ClientsWithUserId,
        (SELECT COUNT(*) FROM Clients WHERE UserId IS NULL) as ClientsWithoutUserId,
        (SELECT COUNT(*) FROM Connections WHERE UserId IS NOT NULL) as ConnectionsWithUserId,
        (SELECT COUNT(*) FROM Connections WHERE UserId IS NULL) as ConnectionsWithoutUserId,
        (SELECT COUNT(*) FROM Connections WHERE SourceType IS NOT NULL) as ConnectionsWithTechnicalData,
        (SELECT COUNT(*) FROM Users) as TotalUsers
    `);
    
    const stats = finalCheck.recordset[0];
    console.log('📊 Estado final:');
    console.log(`   Usuarios totales: ${stats.TotalUsers}`);
    console.log(`   Clients con UserId: ${stats.ClientsWithUserId}`);
    console.log(`   Clients sin UserId: ${stats.ClientsWithoutUserId}`);
    console.log(`   Connections con UserId: ${stats.ConnectionsWithUserId}`);
    console.log(`   Connections sin UserId: ${stats.ConnectionsWithoutUserId}`);
    console.log(`   Connections con datos técnicos: ${stats.ConnectionsWithTechnicalData}`);
    
    // 7. Mostrar muestra de datos migrados
    console.log('📋 Muestra de datos migrados:');
    
    const sampleData = await pool.request().query(`
      SELECT TOP 2 
        c.id, c.name, c.type, c.SourceType, c.Endpoint, c.UserId,
        cl.Name as ClientName, cl.UserId as ClientUserId
      FROM Connections c
      LEFT JOIN Clients cl ON c.clientId = cl.Id
    `);
    
    sampleData.recordset.forEach(row => {
      console.log(`   Connection: ${row.name} (${row.type}) - UserId: ${row.UserId} - SourceType: ${row.SourceType || 'NULL'}`);
    });
    
    console.log('✅ Migración de arquitectura completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    process.exit();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrateArchitecture();
}

module.exports = migrateArchitecture;