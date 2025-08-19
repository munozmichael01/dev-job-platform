/**
 * 🔄 Script de Migración: Clients → Connections
 * 
 * Migra los datos técnicos de la tabla Clients a Connections
 * y corrige la arquitectura multi-tenant
 * 
 * @author Claude Code
 * @date 2025-08-18
 */

const { pool, poolConnect, sql } = require('../src/db/db');

async function migrateClientsToConnections() {
  try {
    await poolConnect;
    
    console.log('🚀 Iniciando migración Clients → Connections...');
    
    // 1. Verificar estructura actual
    console.log('📊 Verificando estructura actual...');
    
    const clientsStructure = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Clients'
      ORDER BY ORDINAL_POSITION
    `);
    
    const connectionsStructure = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Connections'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 Estructura Clients:');
    clientsStructure.recordset.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE})`);
    });
    
    console.log('📋 Estructura Connections:');
    connectionsStructure.recordset.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE})`);
    });
    
    // 2. Agregar campos técnicos a Connections si no existen
    console.log('🔧 Agregando campos técnicos a tabla Connections...');
    
    const fieldsToAdd = [
      { name: 'SourceType', type: 'NVARCHAR(50)', nullable: 'NULL' },
      { name: 'Endpoint', type: 'NVARCHAR(500)', nullable: 'NULL' },
      { name: 'Headers', type: 'NVARCHAR(MAX)', nullable: 'NULL' },
      { name: 'PayloadTemplate', type: 'NVARCHAR(MAX)', nullable: 'NULL' },
      { name: 'Method', type: 'NVARCHAR(10)', nullable: 'NULL' },
      { name: 'FeedUrl', type: 'NVARCHAR(500)', nullable: 'NULL' },
      { name: 'Notes', type: 'NVARCHAR(MAX)', nullable: 'NULL' },
      { name: 'UserId', type: 'BIGINT', nullable: 'NULL' }
    ];
    
    for (const field of fieldsToAdd) {
      try {
        const checkColumn = await pool.request().query(`
          SELECT COUNT(*) as exists
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'Connections' AND COLUMN_NAME = '${field.name}'
        `);
        
        if (checkColumn.recordset[0].exists === 0) {
          await pool.request().query(`
            ALTER TABLE Connections 
            ADD ${field.name} ${field.type} ${field.nullable}
          `);
          console.log(`   ✅ Campo ${field.name} agregado a Connections`);
        } else {
          console.log(`   ⚠️ Campo ${field.name} ya existe en Connections`);
        }
      } catch (error) {
        console.error(`   ❌ Error agregando campo ${field.name}:`, error.message);
      }
    }
    
    // 3. Agregar UserId a tabla Clients si no existe
    console.log('🔧 Agregando UserId a tabla Clients...');
    
    try {
      const checkUserIdClients = await pool.request().query(`
        SELECT COUNT(*) as exists
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Clients' AND COLUMN_NAME = 'UserId'
      `);
      
      if (checkUserIdClients.recordset[0].exists === 0) {
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
    
    // 4. Verificar datos existentes antes de migrar
    console.log('📊 Verificando datos existentes...');
    
    const clientsData = await pool.request().query(`
      SELECT TOP 5 Id, Name, SourceType, Endpoint, Headers, PayloadTemplate, Method, FeedUrl, Notes
      FROM Clients
    `);
    
    const connectionsData = await pool.request().query(`
      SELECT TOP 5 id, name, type, url, clientId, Method, Headers, Body
      FROM Connections
    `);
    
    console.log(`📊 Clients: ${clientsData.recordset.length} registros encontrados`);
    console.log(`📊 Connections: ${connectionsData.recordset.length} registros encontrados`);
    
    // 5. Migrar datos técnicos de Clients a Connections
    console.log('🔄 Migrando datos técnicos Clients → Connections...');
    
    if (clientsData.recordset.length > 0 && connectionsData.recordset.length > 0) {
      const migrationResult = await pool.request().query(`
        UPDATE Connections SET 
          SourceType = c.SourceType,
          Endpoint = c.Endpoint,
          Headers = COALESCE(c.Headers, Connections.Headers),
          PayloadTemplate = c.PayloadTemplate,
          Method = COALESCE(c.Method, Connections.Method),
          FeedUrl = c.FeedUrl,
          Notes = c.Notes
        FROM Connections
        INNER JOIN Clients c ON Connections.clientId = c.Id
        WHERE c.SourceType IS NOT NULL OR c.Headers IS NOT NULL OR c.PayloadTemplate IS NOT NULL;
        
        SELECT @@ROWCOUNT as UpdatedConnections;
      `);
      
      console.log(`✅ ${migrationResult.recordset[0]?.UpdatedConnections || 0} Connections actualizadas con datos técnicos`);
    } else {
      console.log('⚠️ No hay datos para migrar');
    }
    
    // 6. Asignar UserId por defecto (Usuario 1) a Clients existentes
    console.log('👤 Asignando UserId por defecto a Clients existentes...');
    
    const updateClientsUserId = await pool.request().query(`
      UPDATE Clients 
      SET UserId = 1 
      WHERE UserId IS NULL;
      SELECT @@ROWCOUNT as UpdatedClients;
    `);
    
    console.log(`✅ ${updateClientsUserId.recordset[0]?.UpdatedClients || 0} Clients actualizados con UserId`);
    
    // 7. Asignar UserId por defecto a Connections existentes
    console.log('👤 Asignando UserId por defecto a Connections existentes...');
    
    const updateConnectionsUserId = await pool.request().query(`
      UPDATE Connections 
      SET UserId = 1 
      WHERE UserId IS NULL;
      SELECT @@ROWCOUNT as UpdatedConnections;
    `);
    
    console.log(`✅ ${updateConnectionsUserId.recordset[0]?.UpdatedConnections || 0} Connections actualizadas con UserId`);
    
    // 8. Crear foreign keys si no existen
    console.log('🔗 Creando foreign keys...');
    
    try {
      // FK Clients → Users
      const checkFKClientsUsers = await pool.request().query(`
        SELECT COUNT(*) as exists
        FROM sys.foreign_keys 
        WHERE name = 'FK_Clients_Users'
      `);
      
      if (checkFKClientsUsers.recordset[0].exists === 0) {
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
        SELECT COUNT(*) as exists
        FROM sys.foreign_keys 
        WHERE name = 'FK_Connections_Users'
      `);
      
      if (checkFKConnectionsUsers.recordset[0].exists === 0) {
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
    
    // 9. Verificar resultado final
    console.log('📊 Verificando resultado final...');
    
    const finalCheck = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM Clients WHERE UserId IS NOT NULL) as ClientsWithUserId,
        (SELECT COUNT(*) FROM Clients WHERE UserId IS NULL) as ClientsWithoutUserId,
        (SELECT COUNT(*) FROM Connections WHERE UserId IS NOT NULL) as ConnectionsWithUserId,
        (SELECT COUNT(*) FROM Connections WHERE UserId IS NULL) as ConnectionsWithoutUserId,
        (SELECT COUNT(*) FROM Connections WHERE SourceType IS NOT NULL) as ConnectionsWithTechnicalData
    `);
    
    const stats = finalCheck.recordset[0];
    console.log('📊 Estado final:');
    console.log(`   Clients con UserId: ${stats.ClientsWithUserId}`);
    console.log(`   Clients sin UserId: ${stats.ClientsWithoutUserId}`);
    console.log(`   Connections con UserId: ${stats.ConnectionsWithUserId}`);
    console.log(`   Connections sin UserId: ${stats.ConnectionsWithoutUserId}`);
    console.log(`   Connections con datos técnicos: ${stats.ConnectionsWithTechnicalData}`);
    
    console.log('✅ Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  } finally {
    process.exit();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  migrateClientsToConnections();
}

module.exports = migrateClientsToConnections;