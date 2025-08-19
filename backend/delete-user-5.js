const { pool, sql } = require('./src/db/db');

(async () => {
  try {
    console.log('🗑️ Iniciando eliminación del usuario ID 5...');
    
    await pool;
    
    // 1. Verificar que el usuario existe
    const userCheck = await pool.request()
      .input('UserId', sql.BigInt, 5)
      .query(`SELECT Id, Email, FirstName, LastName FROM Users WHERE Id = @UserId`);
    
    if (userCheck.recordset.length === 0) {
      console.log('❌ Usuario ID 5 no encontrado');
      process.exit(1);
    }
    
    const user = userCheck.recordset[0];
    console.log(`🔍 Usuario encontrado: ${user.Email} (${user.FirstName} ${user.LastName})`);
    
    // 2. Eliminar Connections del usuario
    const connectionsResult = await pool.request()
      .input('UserId', sql.BigInt, 5)
      .query(`DELETE FROM Connections WHERE UserId = @UserId`);
    
    console.log(`🔗 Eliminadas ${connectionsResult.rowsAffected[0]} conexiones`);
    
    // 3. Eliminar Clients del usuario
    const clientsResult = await pool.request()
      .input('UserId', sql.BigInt, 5)
      .query(`DELETE FROM Clients WHERE UserId = @UserId`);
    
    console.log(`🏢 Eliminados ${clientsResult.rowsAffected[0]} clientes`);
    
    // 4. Eliminar credenciales del usuario (si existen)
    try {
      const credentialsResult = await pool.request()
        .input('UserId', sql.BigInt, 5)
        .query(`DELETE FROM UserChannelCredentials WHERE UserId = @UserId`);
      
      console.log(`🔑 Eliminadas ${credentialsResult.rowsAffected[0]} credenciales`);
    } catch (credError) {
      console.log(`⚠️ Tabla UserChannelCredentials no existe o ya vacía`);
    }
    
    // 5. Eliminar campañas del usuario (si existen)
    try {
      const campaignsResult = await pool.request()
        .input('UserId', sql.BigInt, 5)
        .query(`DELETE FROM Campaigns WHERE UserId = @UserId`);
      
      console.log(`📊 Eliminadas ${campaignsResult.rowsAffected[0]} campañas`);
    } catch (campaignError) {
      console.log(`⚠️ No hay campañas para eliminar`);
    }
    
    // 6. Finalmente eliminar el usuario
    const userResult = await pool.request()
      .input('UserId', sql.BigInt, 5)
      .query(`DELETE FROM Users WHERE Id = @UserId`);
    
    console.log(`✅ Usuario eliminado: ${userResult.rowsAffected[0]} filas afectadas`);
    
    if (userResult.rowsAffected[0] > 0) {
      console.log(`🎉 SUCCESS: Usuario ${user.Email} (ID: 5) eliminado completamente`);
    } else {
      console.log(`❌ ERROR: No se pudo eliminar el usuario`);
    }
    
  } catch (error) {
    console.error('❌ Error eliminando usuario:', error.message);
  }
  
  process.exit();
})();