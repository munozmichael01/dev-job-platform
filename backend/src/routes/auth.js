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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    console.log(`🔐 Intentando autenticar usuario: ${email}`);

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
      return res.status(401).json({
        success: false,
        error: 'Email o contraseña incorrectos'
      });
    }

    const user = userResult.recordset[0];

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);

    if (!isPasswordValid) {
      console.log(`❌ Contraseña incorrecta para usuario: ${email}`);
      return res.status(401).json({
        success: false,
        error: 'Email o contraseña incorrectos'
      });
    }

    console.log(`✅ Usuario autenticado exitosamente: ${email} (ID: ${user.Id})`);

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
      message: 'Usuario autenticado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error en login (alias /signin):', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

module.exports = router;