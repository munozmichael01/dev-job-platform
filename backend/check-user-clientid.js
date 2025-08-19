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

async function checkUserClientId() {
  try {
    console.log('🔍 Verificando relación Usuario -> Cliente...');
    await sql.connect(config);
    
    // 1. Verificar estructura de Users
    console.log('\n📊 ESTRUCTURA TABLA USERS:');
    const usersSchema = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Users' 
      ORDER BY ORDINAL_POSITION
    `);
    console.table(usersSchema.recordset);
    
    // 2. Verificar usuario específico (ID 11)
    console.log('\n👤 DATOS USUARIO ID 11:');
    const user11 = await sql.query(`
      SELECT * FROM Users WHERE Id = 11
    `);
    if (user11.recordset.length > 0) {
      console.table(user11.recordset);
    } else {
      console.log('❌ Usuario 11 no encontrado');
    }
    
    // 3. Verificar tabla Clients si existe
    console.log('\n🏢 VERIFICANDO TABLA CLIENTS:');
    try {
      const clientsSchema = await sql.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Clients' 
        ORDER BY ORDINAL_POSITION
      `);
      console.table(clientsSchema.recordset);
      
      // Mostrar algunos clientes
      const clients = await sql.query('SELECT TOP 5 * FROM Clients');
      console.log('\n🏢 ALGUNOS CLIENTES:');
      console.table(clients.recordset);
    } catch (error) {
      console.log('ℹ️ Tabla Clients no existe o no es accesible');
    }
    
    // 4. Verificar conexiones existentes y sus clientId
    console.log('\n🔗 CONEXIONES EXISTENTES:');
    const connections = await sql.query(`
      SELECT TOP 10 
        id, name, type, clientId, UserId, CreatedAt
      FROM Connections 
      ORDER BY CreatedAt DESC
    `);
    console.table(connections.recordset);
    
    // 5. Ver qué clientId usan las conexiones del usuario 1 (ejemplo)
    console.log('\n🔍 CONEXIONES DE USUARIOS EXISTENTES:');
    const userConnections = await sql.query(`
      SELECT DISTINCT c.UserId, c.clientId, u.Email
      FROM Connections c
      LEFT JOIN Users u ON c.UserId = u.Id
      WHERE c.UserId IS NOT NULL
      ORDER BY c.UserId
    `);
    console.table(userConnections.recordset);
    
    // 6. Propuesta de clientId para usuario 11
    console.log('\n💡 ANÁLISIS PARA USUARIO 11:');
    
    // Opción 1: Usar clientId = UserId (simple)
    console.log('📝 OPCIÓN 1: clientId = UserId (11)');
    
    // Opción 2: Usar clientId por defecto (como el usuario 1)
    const defaultClient = await sql.query(`
      SELECT clientId FROM Connections WHERE UserId = 1 LIMIT 1
    `);
    if (defaultClient.recordset.length > 0) {
      console.log(`📝 OPCIÓN 2: clientId por defecto = ${defaultClient.recordset[0].clientId}`);
    }
    
    await sql.close();
    console.log('\n✅ Verificación completada');
    
  } catch (error) {
    console.error('❌ Error verificando relación usuario-cliente:', error);
  }
}

checkUserClientId();