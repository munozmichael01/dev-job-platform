const { pool, sql } = require('./src/db/db');

(async () => {
  try {
    await pool;
    
    // Verificar usuario específico
    const userResult = await pool.request()
      .input('Email', sql.NVarChar(255), 'michael.munoz@turijobs.com')
      .query(`
        SELECT Id, Email, FirstName, LastName, Company, Role, IsActive
        FROM Users 
        WHERE Email = @Email
      `);
    
    if (userResult.recordset.length > 0) {
      const user = userResult.recordset[0];
      console.log('✅ USUARIO ENCONTRADO:');
      console.log('ID:', user.Id);
      console.log('Email:', user.Email);
      console.log('Nombre:', user.FirstName, user.LastName);
      console.log('Empresa:', user.Company);
      console.log('Rol:', user.Role);
      console.log('Activo:', user.IsActive);
      
      // Verificar si tiene datos asociados
      const campaignsResult = await pool.request()
        .input('UserId', sql.BigInt, user.Id)
        .query('SELECT COUNT(*) as Count FROM Campaigns WHERE UserId = @UserId');
      
      const segmentsResult = await pool.request()
        .input('UserId', sql.BigInt, user.Id)
        .query('SELECT COUNT(*) as Count FROM Segments WHERE UserId = @UserId');
      
      const connectionsResult = await pool.request()
        .input('UserId', sql.BigInt, user.Id)
        .query('SELECT COUNT(*) as Count FROM Connections WHERE UserId = @UserId');
      
      console.log('\n📊 DATOS ASOCIADOS:');
      console.log('Campañas:', campaignsResult.recordset[0].Count);
      console.log('Segmentos:', segmentsResult.recordset[0].Count);
      console.log('Conexiones:', connectionsResult.recordset[0].Count);
      
      // Verificar si hay otros usuarios con rol superadmin
      const superAdminResult = await pool.request()
        .query("SELECT Id, Email, Role FROM Users WHERE Role = 'superadmin'");
      
      console.log('\n🔑 USUARIOS SUPER ADMIN:');
      superAdminResult.recordset.forEach(u => {
        console.log(`- ID ${u.Id}: ${u.Email} (${u.Role})`);
      });
      
    } else {
      console.log('❌ Usuario no encontrado');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit();
})();
