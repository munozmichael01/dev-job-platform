const { pool, poolConnect, sql } = require('./src/db/db');
const bcrypt = require('bcryptjs');

// Usuarios con contraseñas conocidas
const USERS_WITH_PASSWORDS = [
  {
    email: 'juan@miempresa.com',
    password: 'password123',
    description: 'Usuario principal con todas las campañas (UserId: 1)'
  },
  {
    email: 'michael.munoz@turijobs.com',
    password: 'Turijobs-2021',
    description: 'Usuario de prueba regular (UserId: 11)'
  },
  {
    email: 'superadmin@jobplatform.com',
    password: 'admin123',
    description: 'Super administrador global'
  }
];

async function resetUserPasswords() {
  try {
    await poolConnect;
    
    console.log('🔑 Iniciando reset de contraseñas de usuarios...');
    console.log('🎯 Objetivo: Asegurar que todos los usuarios tienen contraseñas conocidas\n');
    
    // 1. Listar todos los usuarios existentes
    const allUsersResult = await pool.request().query(`
      SELECT Id, Email, FirstName, LastName, Role, IsActive 
      FROM Users 
      ORDER BY Id
    `);
    
    console.log('👥 Usuarios encontrados en la base de datos:');
    allUsersResult.recordset.forEach(user => {
      console.log(`   ${user.Id}: ${user.Email} (${user.Role}) - Active: ${user.IsActive}`);
    });
    console.log('');
    
    // 2. Resetear contraseñas para usuarios conocidos
    const saltRounds = 12;
    let usersUpdated = 0;
    
    for (const userInfo of USERS_WITH_PASSWORDS) {
      try {
        // Verificar si el usuario existe
        const userExists = await pool.request()
          .input('Email', sql.NVarChar(255), userInfo.email)
          .query('SELECT Id, Email FROM Users WHERE Email = @Email');
        
        if (userExists.recordset.length === 0) {
          console.log(`⚠️  Usuario ${userInfo.email} no existe en la base de datos`);
          continue;
        }
        
        // Hash de la nueva contraseña
        const hashedPassword = await bcrypt.hash(userInfo.password, saltRounds);
        
        // Actualizar contraseña
        await pool.request()
          .input('Email', sql.NVarChar(255), userInfo.email)
          .input('PasswordHash', sql.NVarChar(255), hashedPassword)
          .query(`
            UPDATE Users 
            SET PasswordHash = @PasswordHash, UpdatedAt = GETDATE()
            WHERE Email = @Email
          `);
        
        console.log(`✅ ${userInfo.email} -> Password: "${userInfo.password}"`);
        console.log(`   ${userInfo.description}`);
        usersUpdated++;
        
      } catch (error) {
        console.error(`❌ Error actualizando ${userInfo.email}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Proceso completado: ${usersUpdated} usuarios actualizados`);
    console.log('\n📋 RESUMEN DE USUARIOS PARA LOGIN:');
    console.log('=====================================');
    
    USERS_WITH_PASSWORDS.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${user.password}`);
      console.log(`Descripción: ${user.description}`);
      console.log('---');
    });
    
    console.log('\n🚀 Puedes usar cualquiera de estos usuarios para hacer login en:');
    console.log('   Landing Page: http://localhost:3000/login');
    console.log('   API Direct: POST http://localhost:3002/api/auth/login');
    
  } catch (error) {
    console.error('❌ Error general en reset de contraseñas:', error);
  } finally {
    process.exit();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  resetUserPasswords();
}

module.exports = resetUserPasswords;