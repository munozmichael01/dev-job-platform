/**
 * 🔐 API Routes para Autenticación
 * 
 * Maneja el registro y autenticación de usuarios desde la landing page
 * 
 * @author Claude Code
 * @date 2025-08-17
 */

const express = require('express');
const router = express.Router();
const { poolConnect, pool, sql } = require('../db/db');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../middleware/authMiddleware');

/**
 * POST /api/auth/google
 * Registra o autentica un usuario con Google OAuth
 */
router.post('/google', async (req, res) => {
  try {
    const { email, name, image, googleId } = req.body;

    if (!email || !name || !googleId) {
      return res.status(400).json({
        success: false,
        error: 'Email, name y googleId son requeridos'
      });
    }

    console.log(`🔐 Autenticando usuario Google: ${email}`);

    await poolConnect;

    // Verificar si el usuario ya existe
    const existingUser = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .input('GoogleId', sql.NVarChar(100), googleId)
      .query(`
        SELECT Id, Email, Name, GoogleId, CreatedAt, UpdatedAt
        FROM Users 
        WHERE Email = @Email OR GoogleId = @GoogleId
      `);

    let user;
    let isNewUser = false;

    if (existingUser.recordset.length > 0) {
      // Usuario existente - actualizar información si es necesario
      user = existingUser.recordset[0];
      
      await pool.request()
        .input('Id', sql.BigInt, user.Id)
        .input('Name', sql.NVarChar(255), name)
        .input('Image', sql.NVarChar(500), image || null)
        .input('GoogleId', sql.NVarChar(100), googleId)
        .query(`
          UPDATE Users 
          SET 
            Name = @Name,
            Image = @Image,
            GoogleId = @GoogleId,
            UpdatedAt = GETDATE()
          WHERE Id = @Id
        `);

      console.log(`✅ Usuario existente actualizado: ${email} (ID: ${user.Id})`);
    } else {
      // Nuevo usuario - crear registro
      const newUserResult = await pool.request()
        .input('Email', sql.NVarChar(255), email)
        .input('Name', sql.NVarChar(255), name)
        .input('Image', sql.NVarChar(500), image || null)
        .input('GoogleId', sql.NVarChar(100), googleId)
        .input('Role', sql.NVarChar(50), 'user')
        .input('IsActive', sql.Bit, 1)
        .query(`
          INSERT INTO Users (Email, Name, Image, GoogleId, Role, IsActive, CreatedAt, UpdatedAt)
          OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.Name, INSERTED.GoogleId, INSERTED.CreatedAt
          VALUES (@Email, @Name, @Image, @GoogleId, @Role, @IsActive, GETDATE(), GETDATE())
        `);

      user = newUserResult.recordset[0];
      isNewUser = true;

      console.log(`🎉 Nuevo usuario creado: ${email} (ID: ${user.Id})`);
    }

    res.json({
      success: true,
      user: {
        id: user.Id,
        email: user.Email || email,
        name: user.Name || name,
        image: image,
        googleId: user.GoogleId || googleId,
        createdAt: user.CreatedAt
      },
      isNewUser: isNewUser,
      message: isNewUser ? 'Usuario registrado exitosamente' : 'Usuario autenticado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en autenticación Google:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * GET /api/auth/user/:id
 * Obtiene información de un usuario específico
 */
router.get('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`👤 Obteniendo información del usuario ID: ${id}`);

    await poolConnect;

    const userResult = await pool.request()
      .input('Id', sql.BigInt, id)
      .query(`
        SELECT 
          Id, 
          Email, 
          Name, 
          Image, 
          Role, 
          IsActive,
          CreatedAt,
          UpdatedAt
        FROM Users 
        WHERE Id = @Id AND IsActive = 1
      `);

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = userResult.recordset[0];

    // Obtener estadísticas del usuario
    const statsResult = await pool.request()
      .input('UserId', sql.BigInt, id)
      .query(`
        SELECT 
          (SELECT COUNT(*) FROM Campaigns WHERE UserId = @UserId) as CampaignsCount,
          (SELECT COUNT(*) FROM UserChannelCredentials WHERE UserId = @UserId AND IsActive = 1) as ChannelsConfigured,
          (SELECT ISNULL(SUM(ActualSpend), 0) FROM Campaigns WHERE UserId = @UserId) as TotalSpent,
          (SELECT ISNULL(SUM(ActualApplications), 0) FROM Campaigns WHERE UserId = @UserId) as TotalApplications
      `);

    const stats = statsResult.recordset[0];

    res.json({
      success: true,
      user: {
        id: user.Id,
        email: user.Email,
        name: user.Name,
        image: user.Image,
        role: user.Role,
        isActive: user.IsActive,
        createdAt: user.CreatedAt,
        updatedAt: user.UpdatedAt,
        stats: {
          campaignsCount: stats.CampaignsCount || 0,
          channelsConfigured: stats.ChannelsConfigured || 0,
          totalSpent: parseFloat(stats.TotalSpent) || 0,
          totalApplications: stats.TotalApplications || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * PUT /api/auth/user/:id
 * Actualiza información de un usuario
 */
router.put('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image } = req.body;

    console.log(`✏️ Actualizando usuario ID: ${id}`);

    await poolConnect;

    const updateResult = await pool.request()
      .input('Id', sql.BigInt, id)
      .input('Name', sql.NVarChar(255), name)
      .input('Image', sql.NVarChar(500), image)
      .query(`
        UPDATE Users 
        SET 
          Name = @Name,
          Image = @Image,
          UpdatedAt = GETDATE()
        OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Image, INSERTED.UpdatedAt
        WHERE Id = @Id AND IsActive = 1
      `);

    if (updateResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const updatedUser = updateResult.recordset[0];

    res.json({
      success: true,
      user: {
        id: updatedUser.Id,
        name: updatedUser.Name,
        image: updatedUser.Image,
        updatedAt: updatedUser.UpdatedAt
      },
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando usuario:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/register
 * Registra un nuevo usuario con email y contraseña
 */
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, company, website, phone, email, password } = req.body;

    if (!firstName || !lastName || !company || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, apellido, empresa, teléfono, email y contraseña son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    console.log(`🔐 Registrando nuevo usuario: ${email} (${firstName} ${lastName})`);

    await poolConnect;

    // Verificar si el usuario ya existe
    const existingUser = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .query(`
        SELECT Id, Email FROM Users WHERE Email = @Email
      `);

    if (existingUser.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un usuario con este email'
      });
    }

    // Hash de la contraseña
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Crear nuevo usuario con todos los campos de contacto
    const newUserResult = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .input('FirstName', sql.NVarChar(255), firstName)
      .input('LastName', sql.NVarChar(255), lastName)
      .input('Company', sql.NVarChar(255), company)
      .input('Website', sql.NVarChar(500), website || null)
      .input('Phone', sql.NVarChar(50), phone)
      .input('PasswordHash', sql.NVarChar(255), hashedPassword)
      .input('Role', sql.NVarChar(50), 'user')
      .input('IsActive', sql.Bit, 1)
      .query(`
        INSERT INTO Users (Email, FirstName, LastName, Company, Website, Phone, PasswordHash, Role, IsActive, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.FirstName, INSERTED.LastName, INSERTED.Company, INSERTED.Website, INSERTED.Phone, INSERTED.CreatedAt
        VALUES (@Email, @FirstName, @LastName, @Company, @Website, @Phone, @PasswordHash, @Role, @IsActive, GETDATE(), GETDATE())
      `);

    const user = newUserResult.recordset[0];

    console.log(`🎉 Usuario registrado exitosamente: ${email} (ID: ${user.Id})`);

    // Auto-crear Client por defecto para el nuevo usuario
    try {
      const clientName = `${user.FirstName} ${user.LastName} - ${user.Company}`;
      
      // Obtener el próximo ID disponible
      const maxIdResult = await pool.request()
        .query('SELECT ISNULL(MAX(Id), 0) + 1 as NextId FROM Clients');
      const nextId = maxIdResult.recordset[0].NextId;
      
      const newClientResult = await pool.request()
        .input('Id', sql.BigInt, nextId)
        .input('UserId', sql.BigInt, user.Id)
        .input('Name', sql.NVarChar(255), clientName)
        .input('IsActive', sql.Bit, 1)
        .query(`
          INSERT INTO Clients (Id, UserId, Name, IsActive, CreatedAt)
          OUTPUT INSERTED.Id, INSERTED.Name
          VALUES (@Id, @UserId, @Name, @IsActive, GETDATE())
        `);

      const client = newClientResult.recordset[0];
      console.log(`🏢 Client creado automáticamente: ${client.Name} (ID: ${client.Id}) para usuario ${user.Id}`);
    } catch (clientError) {
      console.error(`⚠️ Error creando Client automático para usuario ${user.Id}:`, clientError.message);
      // No fallar el registro si el Client no se puede crear
    }

    res.status(201).json({
      success: true,
      user: {
        id: user.Id,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName,
        company: user.Company,
        website: user.Website,
        phone: user.Phone,
        createdAt: user.CreatedAt
      },
      message: 'Usuario registrado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en registro:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/signup (alias de /register)
 * Ruta de compatibilidad para frontends que usen "/signup"
 */
router.post('/signup', async (req, res) => {
  try {
    // Reutiliza exactamente la misma lógica que /register
    const { firstName, lastName, company, website, phone, email, password } = req.body;

    if (!firstName || !lastName || !company || !phone || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Nombre, apellido, empresa, teléfono, email y contraseña son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    console.log(`🔐 Registrando nuevo usuario (alias /signup): ${email} (${firstName} ${lastName})`);

    await poolConnect;

    const existingUser = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .query(`
        SELECT Id, Email FROM Users WHERE Email = @Email
      `);

    if (existingUser.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un usuario con este email'
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUserResult = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .input('FirstName', sql.NVarChar(255), firstName)
      .input('LastName', sql.NVarChar(255), lastName)
      .input('Company', sql.NVarChar(255), company)
      .input('Website', sql.NVarChar(500), website || null)
      .input('Phone', sql.NVarChar(50), phone)
      .input('PasswordHash', sql.NVarChar(255), hashedPassword)
      .input('Role', sql.NVarChar(50), 'user')
      .input('IsActive', sql.Bit, 1)
      .query(`
        INSERT INTO Users (Email, FirstName, LastName, Company, Website, Phone, PasswordHash, Role, IsActive, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.FirstName, INSERTED.LastName, INSERTED.Company, INSERTED.Website, INSERTED.Phone, INSERTED.CreatedAt
        VALUES (@Email, @FirstName, @LastName, @Company, @Website, @Phone, @PasswordHash, @Role, @IsActive, GETDATE(), GETDATE())
      `);

    const user = newUserResult.recordset[0];

    console.log(`🎉 Usuario registrado exitosamente (alias /signup): ${email} (ID: ${user.Id})`);

    // Auto-crear Client por defecto para el nuevo usuario (igual que en /register)
    try {
      const clientName = `${user.FirstName} ${user.LastName} - ${user.Company}`;
      
      // Obtener el próximo ID disponible
      const maxIdResult = await pool.request()
        .query('SELECT ISNULL(MAX(Id), 0) + 1 as NextId FROM Clients');
      const nextId = maxIdResult.recordset[0].NextId;
      
      const newClientResult = await pool.request()
        .input('Id', sql.BigInt, nextId)
        .input('UserId', sql.BigInt, user.Id)
        .input('Name', sql.NVarChar(255), clientName)
        .input('IsActive', sql.Bit, 1)
        .query(`
          INSERT INTO Clients (Id, UserId, Name, IsActive, CreatedAt)
          OUTPUT INSERTED.Id, INSERTED.Name
          VALUES (@Id, @UserId, @Name, @IsActive, GETDATE())
        `);

      const client = newClientResult.recordset[0];
      console.log(`🏢 Client creado automáticamente (alias /signup): ${client.Name} (ID: ${client.Id}) para usuario ${user.Id}`);
    } catch (clientError) {
      console.error(`⚠️ Error creando Client automático (alias /signup) para usuario ${user.Id}:`, clientError.message);
      // No fallar el registro si el Client no se puede crear
    }

    res.status(201).json({
      success: true,
      user: {
        id: user.Id,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName,
        company: user.Company,
        website: user.Website,
        phone: user.Phone,
        createdAt: user.CreatedAt
      },
      message: 'Usuario registrado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en registro (alias /signup):', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/login
 * Autentica un usuario con email y contraseña
 */
router.post('/login', async (req, res) => {
  try {
    console.log('📨 Backend: Recibida petición de login');
    console.log('📝 Backend: Request body:', req.body);
    
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Backend: Faltan email o contraseña');
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    console.log(`🔐 Backend: Intentando autenticar usuario: ${email}`);

    await poolConnect;

    // Buscar usuario por email
    const userResult = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .query(`
        SELECT 
          Id, 
          Email, 
          FirstName,
          LastName,
          Company,
          Website,
          Phone,
          PasswordHash, 
          Image, 
          Role, 
          IsActive,
          CreatedAt
        FROM Users 
        WHERE Email = @Email AND IsActive = 1
      `);

    if (userResult.recordset.length === 0) {
      console.log(`❌ Backend: Usuario no encontrado: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Email o contraseña incorrectos'
      });
    }

    const user = userResult.recordset[0];
    console.log(`👤 Backend: Usuario encontrado - ID: ${user.Id}, Email: ${user.Email}`);

    // Verificar contraseña
    console.log('🔑 Backend: Verificando contraseña...');
    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);

    if (!isPasswordValid) {
      console.log(`❌ Contraseña incorrecta para usuario: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Email o contraseña incorrectos'
      });
    }

    console.log(`✅ Backend: Usuario autenticado exitosamente: ${email} (ID: ${user.Id})`);

    // Generar token JWT
    console.log('🔑 Backend: Generando token JWT...');
    const token = generateToken(user);
    console.log('✅ Backend: Token JWT generado exitosamente');

    console.log('📤 Backend: Enviando respuesta de login exitoso');
    res.json({
      success: true,
      user: {
        id: user.Id,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName,
        company: user.Company,
        website: user.Website,
        phone: user.Phone,
        image: user.Image,
        role: user.Role,
        createdAt: user.CreatedAt
      },
      token: token,
      message: 'Usuario autenticado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en login:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/signin (alias de /login)
 */
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña son requeridos' });
    }

    console.log(`🔐 Intentando autenticar usuario (alias /signin): ${email}`);

    await poolConnect;

    const userResult = await pool.request()
      .input('Email', sql.NVarChar(255), email)
      .query(`
        SELECT 
          Id, Email, FirstName, LastName, Company, Website, Phone, PasswordHash, Image, Role, IsActive, CreatedAt
        FROM Users 
        WHERE Email = @Email AND IsActive = 1
      `);

    if (userResult.recordset.length === 0) {
      return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
    }

    const user = userResult.recordset[0];
    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);

    if (!isPasswordValid) {
      console.log(`❌ Contraseña incorrecta para usuario (alias /signin): ${email}`);
      return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
    }

    console.log(`✅ Usuario autenticado exitosamente (alias /signin): ${email} (ID: ${user.Id})`);

    // Generar token JWT
    const token = generateToken(user);

    res.json({
      success: true,
      user: {
        id: user.Id,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName,
        company: user.Company,
        website: user.Website,
        phone: user.Phone,
        image: user.Image,
        role: user.Role,
        createdAt: user.CreatedAt
      },
      token: token,
      message: 'Usuario autenticado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en login (alias /signin):', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

/**
 * PATCH /api/auth/user/:id/email
 * Cambiar email de un usuario específico
 */
router.patch('/user/:id/email', async (req, res) => {
  try {
    const { id } = req.params;
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({
        success: false,
        error: 'newEmail es requerido'
      });
    }

    console.log(`📧 Cambiando email del usuario ID: ${id} a ${newEmail}`);

    await poolConnect;

    // Verificar que el usuario existe
    const userCheck = await pool.request()
      .input('Id', sql.BigInt, id)
      .query(`SELECT Id, Email, FirstName, LastName FROM Users WHERE Id = @Id`);

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = userCheck.recordset[0];
    console.log(`🔍 Usuario encontrado: ${user.Email} (${user.FirstName} ${user.LastName})`);

    // Verificar que el nuevo email no esté en uso
    const emailCheck = await pool.request()
      .input('Email', sql.NVarChar(255), newEmail)
      .query(`SELECT Id FROM Users WHERE Email = @Email`);

    if (emailCheck.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        error: `El email ${newEmail} ya está en uso por otro usuario`
      });
    }

    // Actualizar el email
    const updateResult = await pool.request()
      .input('Id', sql.BigInt, id)
      .input('NewEmail', sql.NVarChar(255), newEmail)
      .query(`
        UPDATE Users 
        SET Email = @NewEmail, UpdatedAt = GETDATE()
        WHERE Id = @Id
      `);

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se pudo actualizar el usuario'
      });
    }

    console.log(`✅ Email actualizado exitosamente: ${user.Email} → ${newEmail}`);

    res.json({
      success: true,
      message: `Email actualizado de ${user.Email} a ${newEmail}`,
      user: {
        id: user.Id,
        oldEmail: user.Email,
        newEmail: newEmail,
        firstName: user.FirstName,
        lastName: user.LastName
      }
    });

  } catch (error) {
    console.error('❌ Error cambiando email:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * DELETE /api/auth/user/:id
 * Elimina un usuario y sus datos relacionados
 */
router.delete('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Eliminando usuario ID: ${id}`);

    await poolConnect;

    // Verificar que el usuario existe antes de eliminarlo
    const userCheck = await pool.request()
      .input('Id', sql.BigInt, id)
      .query(`SELECT Id, Email, FirstName, LastName FROM Users WHERE Id = @Id`);

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = userCheck.recordset[0];
    console.log(`🔍 Usuario encontrado: ${user.Email} (${user.FirstName} ${user.LastName})`);

    // Eliminar en cascada:
    // 1. Primero eliminar Connections del usuario
    const connectionsResult = await pool.request()
      .input('UserId', sql.BigInt, id)
      .query(`DELETE FROM Connections WHERE UserId = @UserId`);
    
    console.log(`🔗 Eliminadas ${connectionsResult.rowsAffected[0]} conexiones del usuario ${id}`);

    // 2. Eliminar Clients del usuario
    const clientsResult = await pool.request()
      .input('UserId', sql.BigInt, id)
      .query(`DELETE FROM Clients WHERE UserId = @UserId`);
    
    console.log(`🏢 Eliminados ${clientsResult.rowsAffected[0]} clientes del usuario ${id}`);

    // 3. Eliminar credenciales del usuario (si la tabla existe)
    try {
      const credentialsResult = await pool.request()
        .input('UserId', sql.BigInt, id)
        .query(`DELETE FROM UserChannelCredentials WHERE UserId = @UserId`);
      
      console.log(`🔑 Eliminadas ${credentialsResult.rowsAffected[0]} credenciales del usuario ${id}`);
    } catch (credError) {
      console.log(`⚠️ Tabla UserChannelCredentials no existe o ya está vacía para usuario ${id}`);
    }

    // 4. Finalmente eliminar el usuario
    const userResult = await pool.request()
      .input('Id', sql.BigInt, id)
      .query(`DELETE FROM Users WHERE Id = @Id`);

    if (userResult.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se pudo eliminar el usuario'
      });
    }

    console.log(`✅ Usuario eliminado exitosamente: ${user.Email} (ID: ${id})`);

    res.json({
      success: true,
      message: `Usuario ${user.Email} eliminado exitosamente`,
      deletedUser: {
        id: user.Id,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName
      }
    });

  } catch (error) {
    console.error('❌ Error eliminando usuario:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/migrate-segments
 * TEMPORAL: Migrar tabla Segments para agregar UserId
 */
router.post('/migrate-segments', async (req, res) => {
  try {
    console.log('🔧 Ejecutando migración de Segments...');

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
      console.log('✅ Índice ya existe');
    }

    // 4. Verificar resultado
    const result = await pool.request().query(`
      SELECT UserId, COUNT(*) as count FROM Segments GROUP BY UserId ORDER BY UserId
    `);
    
    const distribution = result.recordset.map(row => ({
      userId: row.UserId,
      count: row.count
    }));

    res.json({
      success: true,
      message: 'Migración completada exitosamente',
      segmentDistribution: distribution
    });

  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error ejecutando migración',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout del usuario (limpia el estado del cliente)
 */
router.post('/logout', async (req, res) => {
  try {
    // En JWT no necesitamos invalidar el token en el servidor (stateless)
    // El frontend simplemente eliminará el token de su almacenamiento
    console.log('🚪 Usuario haciendo logout');
    
    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    console.error('❌ Error en logout:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * POST /api/auth/create-client-for-user
 * Crear cliente para un usuario específico (temporal para fix)
 */
router.post('/create-client-for-user', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId es requerido'
      });
    }

    console.log(`🏢 Creando Cliente para usuario ID: ${userId}`);

    await poolConnect;

    // Obtener info del usuario
    const userResult = await pool.request()
      .input('UserId', sql.BigInt, userId)
      .query('SELECT FirstName, LastName, Company FROM Users WHERE Id = @UserId');
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    const user = userResult.recordset[0];
    const clientName = `${user.FirstName} ${user.LastName} - ${user.Company}`;

    // Obtener el próximo ID disponible
    const maxIdResult = await pool.request()
      .query('SELECT ISNULL(MAX(Id), 0) + 1 as NextId FROM Clients');
    const nextId = maxIdResult.recordset[0].NextId;

    // Crear el cliente
    const newClientResult = await pool.request()
      .input('Id', sql.BigInt, nextId)
      .input('UserId', sql.BigInt, userId)
      .input('Name', sql.NVarChar(255), clientName)
      .input('IsActive', sql.Bit, 1)
      .query(`
        INSERT INTO Clients (Id, UserId, Name, IsActive, CreatedAt)
        OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.UserId
        VALUES (@Id, @UserId, @Name, @IsActive, GETDATE())
      `);

    const client = newClientResult.recordset[0];
    console.log(`✅ Cliente creado: ${client.Name} (ID: ${client.Id}) para usuario ${userId}`);

    res.status(201).json({
      success: true,
      client: {
        id: client.Id,
        name: client.Name,
        userId: client.UserId
      },
      message: `Cliente creado exitosamente: ${client.Name}`
    });

  } catch (error) {
    console.error('❌ Error creando cliente:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * POST /api/auth/create-superadmin
 * Crear super admin inicial (solo para setup inicial)
 */
router.post('/create-superadmin', async (req, res) => {
  try {
    const { setupKey } = req.body;
    
    // Validar setup key (solo para evitar uso accidental)
    if (setupKey !== 'job-platform-super-admin-setup-2025') {
      return res.status(403).json({
        success: false,
        error: 'Setup key inválido'
      });
    }

    console.log('🔑 Creando super admin inicial...');

    await poolConnect;

    // Verificar si ya existe un super admin
    const existingSuperAdmin = await pool.request()
      .query(`SELECT Id FROM Users WHERE Role = 'superadmin' AND IsActive = 1`);

    if (existingSuperAdmin.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un super admin en el sistema'
      });
    }

    // Hash para contraseña 'admin123'
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);

    // Crear super admin
    const superAdminResult = await pool.request()
      .input('Email', sql.NVarChar(255), 'superadmin@jobplatform.com')
      .input('FirstName', sql.NVarChar(255), 'Super')
      .input('LastName', sql.NVarChar(255), 'Admin')
      .input('Company', sql.NVarChar(255), 'Job Platform')
      .input('Phone', sql.NVarChar(50), '+34 600 000 000')
      .input('PasswordHash', sql.NVarChar(255), hashedPassword)
      .input('Role', sql.NVarChar(50), 'superadmin')
      .input('IsActive', sql.Bit, 1)
      .query(`
        INSERT INTO Users (Email, FirstName, LastName, Company, Phone, PasswordHash, Role, IsActive, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.FirstName, INSERTED.LastName, INSERTED.Role, INSERTED.CreatedAt
        VALUES (@Email, @FirstName, @LastName, @Company, @Phone, @PasswordHash, @Role, @IsActive, GETDATE(), GETDATE())
      `);

    const superAdmin = superAdminResult.recordset[0];

    // Auto-crear Client para el super admin (aunque no lo necesite realmente)
    try {
      await pool.request()
        .input('UserId', sql.BigInt, superAdmin.Id)
        .input('Name', sql.NVarChar(255), 'Super Admin Client')
        .input('IsActive', sql.Bit, 1)
        .query(`
          INSERT INTO Clients (UserId, Name, IsActive, CreatedAt)
          VALUES (@UserId, @Name, @IsActive, GETDATE())
        `);
    } catch (clientError) {
      console.error('⚠️ Error creando Client para super admin:', clientError.message);
      // No fallar la creación por esto
    }

    // También actualizar usuario ID=1 como super admin si existe
    try {
      await pool.request()
        .query(`UPDATE Users SET Role = 'superadmin' WHERE Id = 1`);
      console.log('✅ Usuario ID=1 actualizado como superadmin');
    } catch (updateError) {
      console.error('⚠️ Error actualizando usuario ID=1:', updateError.message);
    }

    console.log(`✅ Super admin creado: ${superAdmin.Email} (ID: ${superAdmin.Id})`);

    res.status(201).json({
      success: true,
      user: {
        id: superAdmin.Id,
        email: superAdmin.Email,
        firstName: superAdmin.FirstName,
        lastName: superAdmin.LastName,
        role: superAdmin.Role,
        createdAt: superAdmin.CreatedAt
      },
      message: 'Super admin creado exitosamente',
      credentials: {
        email: 'superadmin@jobplatform.com',
        password: 'admin123'
      }
    });

  } catch (error) {
    console.error('❌ Error creando super admin:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

module.exports = router;