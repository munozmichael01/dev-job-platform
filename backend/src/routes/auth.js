const express = require('express');
const router = express.Router();
const { supabase } = require('../db/db');
const bcrypt = require('bcryptjs');
const { generateToken, addUserToRequest, requireAuth } = require('../middleware/authMiddleware');

const now = () => new Date().toISOString();

// ─── Google OAuth ────────────────────────────────────────────────────────────

router.post('/google', async (req, res) => {
  try {
    const { email, name, image, googleId } = req.body;

    if (!email || !name || !googleId) {
      return res.status(400).json({ success: false, error: 'Email, name y googleId son requeridos' });
    }

    console.log(`🔐 Autenticando usuario Google: ${email}`);

    const { data: existing } = await supabase
      .from('Users')
      .select('Id, Email, Name, GoogleId, CreatedAt')
      .or(`Email.eq.${email},GoogleId.eq.${googleId}`)
      .limit(1);

    let user;
    let isNewUser = false;

    if (existing && existing.length > 0) {
      user = existing[0];

      await supabase
        .from('Users')
        .update({ Name: name, Image: image || null, GoogleId: googleId, UpdatedAt: now() })
        .eq('Id', user.Id);

      console.log(`✅ Usuario existente actualizado: ${email} (ID: ${user.Id})`);
    } else {
      const { data: created, error } = await supabase
        .from('Users')
        .insert({
          Email: email, Name: name, Image: image || null, GoogleId: googleId,
          Role: 'user', IsActive: 1, CreatedAt: now(), UpdatedAt: now()
        })
        .select('Id, Email, Name, GoogleId, CreatedAt')
        .single();

      if (error) throw error;
      user = created;
      isNewUser = true;
      console.log(`🎉 Nuevo usuario creado: ${email} (ID: ${user.Id})`);
    }

    res.json({
      success: true,
      user: { id: user.Id, email: user.Email || email, name: user.Name || name, image, googleId: user.GoogleId || googleId, createdAt: user.CreatedAt },
      isNewUser,
      message: isNewUser ? 'Usuario registrado exitosamente' : 'Usuario autenticado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en autenticación Google:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ─── GET user by ID ──────────────────────────────────────────────────────────

router.get('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👤 Obteniendo información del usuario ID: ${id}`);

    const { data: users, error } = await supabase
      .from('Users')
      .select('Id, Email, Name, Image, Role, IsActive, CreatedAt, UpdatedAt')
      .eq('Id', id)
      .eq('IsActive', 1)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const user = users[0];

    const [campaignsRes, credentialsRes] = await Promise.all([
      supabase.from('Campaigns').select('Id, BudgetTotal').eq('UserId', id),
      supabase.from('ChannelCredentials').select('Id').eq('UserId', id).eq('IsActive', true)
    ]);

    const campaigns = campaignsRes.data || [];
    const stats = {
      campaignsCount: campaigns.length,
      channelsConfigured: (credentialsRes.data || []).length,
      totalSpent: 0,
      totalApplications: 0
    };

    res.json({
      success: true,
      user: {
        id: user.Id, email: user.Email, name: user.Name, image: user.Image,
        role: user.Role, isActive: user.IsActive, createdAt: user.CreatedAt,
        updatedAt: user.UpdatedAt, stats
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ─── PUT update user ─────────────────────────────────────────────────────────

router.put('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image } = req.body;
    console.log(`✏️ Actualizando usuario ID: ${id}`);

    const { data, error } = await supabase
      .from('Users')
      .update({ Name: name, Image: image, UpdatedAt: now() })
      .eq('Id', id)
      .eq('IsActive', 1)
      .select('Id, Name, Image, UpdatedAt')
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      user: { id: data.Id, name: data.Name, image: data.Image, updatedAt: data.UpdatedAt },
      message: 'Usuario actualizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando usuario:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ─── Register ────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, company, website, phone, email, password } = req.body;

    if (!firstName || !lastName || !company || !phone || !email || !password) {
      return res.status(400).json({ success: false, error: 'Nombre, apellido, empresa, teléfono, email y contraseña son requeridos' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    console.log(`🔐 Registrando nuevo usuario: ${email} (${firstName} ${lastName})`);

    const { data: existing } = await supabase
      .from('Users')
      .select('Id')
      .eq('Email', email)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Ya existe un usuario con este email' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabase
      .from('Users')
      .insert({
        Email: email, FirstName: firstName, LastName: lastName, Company: company,
        Website: website || null, Phone: phone, PasswordHash: hashedPassword,
        Role: 'user', IsActive: 1, CreatedAt: now(), UpdatedAt: now()
      })
      .select('Id, Email, FirstName, LastName, Company, Website, Phone, CreatedAt')
      .single();

    if (error) throw error;
    console.log(`🎉 Usuario registrado exitosamente: ${email} (ID: ${user.Id})`);

    await _createClientForUser(user);

    res.status(201).json({
      success: true,
      user: { id: user.Id, email: user.Email, firstName: user.FirstName, lastName: user.LastName, company: user.Company, website: user.Website, phone: user.Phone, createdAt: user.CreatedAt },
      message: 'Usuario registrado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en registro:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Alias de /register
router.post('/signup', async (req, res) => {
  req.url = '/register';
  router.handle(req, res, () => {});
});

// ─── Login ───────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    console.log('📨 Recibida petición de login');
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña son requeridos' });
    }

    console.log(`🔐 Autenticando usuario: ${email}`);

    const { data: users, error } = await supabase
      .from('Users')
      .select('Id, Email, FirstName, LastName, Company, Website, Phone, PasswordHash, Image, Role, IsActive, CreatedAt')
      .eq('Email', email)
      .eq('IsActive', 1)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) {
      console.log(`❌ Usuario no encontrado: ${email}`);
      return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);

    if (!isPasswordValid) {
      console.log(`❌ Contraseña incorrecta para usuario: ${email}`);
      return res.status(401).json({ success: false, error: 'Email o contraseña incorrectos' });
    }

    console.log(`✅ Usuario autenticado: ${email} (ID: ${user.Id})`);
    const token = generateToken(user);

    res.json({
      success: true,
      user: { id: user.Id, email: user.Email, firstName: user.FirstName, lastName: user.LastName, company: user.Company, website: user.Website, phone: user.Phone, image: user.Image, role: user.Role, createdAt: user.CreatedAt },
      token,
      message: 'Usuario autenticado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en login:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Alias de /login
router.post('/signin', (req, res, next) => {
  req.url = '/login';
  router.handle(req, res, next);
});

// ─── Verify token ────────────────────────────────────────────────────────────

router.get('/verify', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.Id;

    const { data: users, error } = await supabase
      .from('Users')
      .select('Id, Email, FirstName, LastName, Company, Role, IsActive')
      .eq('Id', userId)
      .eq('IsActive', 1)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado o inactivo' });
    }

    const user = users[0];
    res.json({
      success: true, valid: true,
      user: { id: user.Id, email: user.Email, firstName: user.FirstName, lastName: user.LastName, company: user.Company, role: user.Role },
      message: 'Token válido'
    });

  } catch (error) {
    console.error('❌ Error verificando token:', error.message);
    res.status(500).json({ success: false, error: 'Error verificando token' });
  }
});

// ─── Refresh token ───────────────────────────────────────────────────────────

router.post('/refresh', addUserToRequest, requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.Id;

    const { data: users, error } = await supabase
      .from('Users')
      .select('Id, Email, FirstName, LastName, Company, Website, Phone, Image, Role, IsActive')
      .eq('Id', userId)
      .eq('IsActive', 1)
      .limit(1);

    if (error) throw error;
    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado o inactivo' });
    }

    const user = users[0];
    const newToken = generateToken(user);

    res.json({
      success: true, token: newToken,
      user: { id: user.Id, email: user.Email, firstName: user.FirstName, lastName: user.LastName, company: user.Company, website: user.Website, phone: user.Phone, image: user.Image, role: user.Role },
      message: 'Token refrescado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error refrescando token:', error.message);
    res.status(500).json({ success: false, error: 'Error refrescando token' });
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  // JWT es stateless — el frontend elimina el token localmente
  console.log('🚪 Usuario haciendo logout');
  res.json({ success: true, message: 'Logout exitoso' });
});

// ─── PATCH change email ───────────────────────────────────────────────────────

router.patch('/user/:id/email', async (req, res) => {
  try {
    const { id } = req.params;
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({ success: false, error: 'newEmail es requerido' });
    }

    console.log(`📧 Cambiando email del usuario ID: ${id} a ${newEmail}`);

    const { data: userCheck } = await supabase
      .from('Users')
      .select('Id, Email, FirstName, LastName')
      .eq('Id', id)
      .limit(1);

    if (!userCheck || userCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const user = userCheck[0];

    const { data: emailCheck } = await supabase
      .from('Users')
      .select('Id')
      .eq('Email', newEmail)
      .limit(1);

    if (emailCheck && emailCheck.length > 0) {
      return res.status(409).json({ success: false, error: `El email ${newEmail} ya está en uso` });
    }

    const { error } = await supabase
      .from('Users')
      .update({ Email: newEmail, UpdatedAt: now() })
      .eq('Id', id);

    if (error) throw error;

    console.log(`✅ Email actualizado: ${user.Email} → ${newEmail}`);
    res.json({
      success: true,
      message: `Email actualizado de ${user.Email} a ${newEmail}`,
      user: { id: user.Id, oldEmail: user.Email, newEmail, firstName: user.FirstName, lastName: user.LastName }
    });

  } catch (error) {
    console.error('❌ Error cambiando email:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── DELETE user ─────────────────────────────────────────────────────────────

router.delete('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Eliminando usuario ID: ${id}`);

    const { data: userCheck } = await supabase
      .from('Users')
      .select('Id, Email, FirstName, LastName')
      .eq('Id', id)
      .limit(1);

    if (!userCheck || userCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const user = userCheck[0];

    // Cascade delete — orden importa por FK
    const { count: connCount } = await supabase.from('Connections').delete({ count: 'exact' }).eq('UserId', id);
    console.log(`🔗 Eliminadas ${connCount ?? 0} conexiones del usuario ${id}`);

    const { count: clientCount } = await supabase.from('Clients').delete({ count: 'exact' }).eq('UserId', id);
    console.log(`🏢 Eliminados ${clientCount ?? 0} clientes del usuario ${id}`);

    try {
      const { count: credCount } = await supabase.from('ChannelCredentials').delete({ count: 'exact' }).eq('UserId', id);
      console.log(`🔑 Eliminadas ${credCount ?? 0} credenciales del usuario ${id}`);
    } catch {
      console.log(`⚠️ ChannelCredentials no encontrado para usuario ${id}`);
    }

    const { error } = await supabase.from('Users').delete().eq('Id', id);
    if (error) throw error;

    console.log(`✅ Usuario eliminado: ${user.Email} (ID: ${id})`);
    res.json({
      success: true,
      message: `Usuario ${user.Email} eliminado exitosamente`,
      deletedUser: { id: user.Id, email: user.Email, firstName: user.FirstName, lastName: user.LastName }
    });

  } catch (error) {
    console.error('❌ Error eliminando usuario:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── Create superadmin ───────────────────────────────────────────────────────

router.post('/create-superadmin', async (req, res) => {
  try {
    const { setupKey } = req.body;

    if (setupKey !== 'job-platform-super-admin-setup-2025') {
      return res.status(403).json({ success: false, error: 'Setup key inválido' });
    }

    console.log('🔑 Creando super admin inicial...');

    const { data: existing } = await supabase
      .from('Users')
      .select('Id')
      .eq('Role', 'superadmin')
      .eq('IsActive', 1)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Ya existe un super admin en el sistema' });
    }

    const hashedPassword = await bcrypt.hash('admin123', 12);

    const { data: superAdmin, error } = await supabase
      .from('Users')
      .insert({
        Email: 'superadmin@jobplatform.com', FirstName: 'Super', LastName: 'Admin',
        Company: 'Job Platform', Phone: '+34 600 000 000', PasswordHash: hashedPassword,
        Role: 'superadmin', IsActive: 1, CreatedAt: now(), UpdatedAt: now()
      })
      .select('Id, Email, FirstName, LastName, Role, CreatedAt')
      .single();

    if (error) throw error;

    await supabase.from('Clients').insert({ UserId: superAdmin.Id, Name: 'Super Admin Client', IsActive: 1, CreatedAt: now() });

    // Asegurar que usuario ID=1 también sea superadmin si existe
    await supabase.from('Users').update({ Role: 'superadmin' }).eq('Id', 1);

    console.log(`✅ Super admin creado: ${superAdmin.Email} (ID: ${superAdmin.Id})`);
    res.status(201).json({
      success: true,
      user: { id: superAdmin.Id, email: superAdmin.Email, firstName: superAdmin.FirstName, lastName: superAdmin.LastName, role: superAdmin.Role, createdAt: superAdmin.CreatedAt },
      message: 'Super admin creado exitosamente',
      credentials: { email: 'superadmin@jobplatform.com', password: 'admin123' }
    });

  } catch (error) {
    console.error('❌ Error creando super admin:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── Create client for user ───────────────────────────────────────────────────

router.post('/create-client-for-user', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId es requerido' });
    }

    console.log(`🏢 Creando Cliente para usuario ID: ${userId}`);

    const { data: users } = await supabase
      .from('Users')
      .select('FirstName, LastName, Company')
      .eq('Id', userId)
      .limit(1);

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const user = users[0];
    const clientName = `${user.FirstName} ${user.LastName} - ${user.Company}`;

    const { data: client, error } = await supabase
      .from('Clients')
      .insert({ UserId: userId, Name: clientName, IsActive: 1, CreatedAt: now() })
      .select('Id, Name, UserId')
      .single();

    if (error) throw error;

    console.log(`✅ Cliente creado: ${client.Name} (ID: ${client.Id})`);
    res.status(201).json({
      success: true,
      client: { id: client.Id, name: client.Name, userId: client.UserId },
      message: `Cliente creado exitosamente: ${client.Name}`
    });

  } catch (error) {
    console.error('❌ Error creando cliente:', error.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// ─── TEMP: migrate-segments ───────────────────────────────────────────────────
// DDL (ALTER TABLE, CREATE INDEX) no puede ejecutarse desde Supabase JS client.
// Ejecutar manualmente en Supabase SQL Editor:
//   ALTER TABLE "Segments" ADD COLUMN IF NOT EXISTS "UserId" BIGINT;
//   CREATE INDEX IF NOT EXISTS "IX_Segments_UserId" ON "Segments"("UserId");
// Este endpoint solo maneja el UPDATE y SELECT DML.

router.post('/migrate-segments', async (req, res) => {
  try {
    console.log('🔧 Ejecutando migración DML de Segments...');

    const { count } = await supabase
      .from('Segments')
      .update({ UserId: 1 })
      .is('UserId', null);

    console.log(`✅ ${count ?? 0} segmentos asignados al usuario ID 1`);

    const { data: result } = await supabase
      .from('Segments')
      .select('UserId');

    const distribution = (result || []).reduce((acc, row) => {
      const key = row.UserId;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      message: 'Migración DML completada. DDL (ALTER TABLE, CREATE INDEX) debe ejecutarse manualmente en Supabase SQL Editor.',
      segmentDistribution: Object.entries(distribution).map(([userId, count]) => ({ userId: parseInt(userId), count }))
    });

  } catch (error) {
    console.error('❌ Error en migración:', error.message);
    res.status(500).json({ success: false, error: 'Error ejecutando migración', details: error.message });
  }
});

// ─── Helper privado ───────────────────────────────────────────────────────────

async function _createClientForUser(user) {
  try {
    const clientName = `${user.FirstName} ${user.LastName} - ${user.Company}`;
    const { data: client } = await supabase
      .from('Clients')
      .insert({ UserId: user.Id, Name: clientName, IsActive: 1, CreatedAt: now() })
      .select('Id, Name')
      .single();

    if (client) {
      console.log(`🏢 Client creado automáticamente: ${client.Name} (ID: ${client.Id}) para usuario ${user.Id}`);
    }
  } catch (err) {
    console.error(`⚠️ Error creando Client para usuario ${user.Id}:`, err.message);
    // No fallar el registro si el Client no se puede crear
  }
}

module.exports = router;
