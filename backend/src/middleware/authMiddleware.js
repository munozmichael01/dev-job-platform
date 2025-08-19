/**
 * 🚀 MIDDLEWARE DE AUTENTICACIÓN OPTIMIZADO
 * 
 * Mejoras de performance:
 * - Cache de usuarios en memoria con TTL (5 min)
 * - JWT verificado solo una vez por request
 * - Logs reducidos (solo en debug mode)
 * - DB queries minimizadas
 * 
 * @author Claude Code  
 * @date 2025-08-19
 */

const jwt = require('jsonwebtoken');
const { pool, sql } = require('../db/db');

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'tu-jwt-secret-super-seguro-cambiar-en-produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const DEBUG_MODE = process.env.AUTH_DEBUG === 'true';

// 🔥 CACHE EN MEMORIA - TTL 5 minutos
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const REQUEST_CACHE = new WeakMap(); // Cache por request

/**
 * Limpiar cache expirado cada 10 minutos
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      userCache.delete(key);
    }
  }
  if (DEBUG_MODE && userCache.size > 0) {
    console.log(`🗑️ Cache limpieza: ${userCache.size} usuarios en cache`);
  }
}, 10 * 60 * 1000);

/**
 * Generar token JWT (sin cambios)
 */
const generateToken = (user) => {
  const payload = {
    userId: user.Id,
    email: user.Email,
    role: user.Role || 'user',
    firstName: user.FirstName,
    lastName: user.LastName,
    company: user.Company
  };
  
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'job-platform',
    audience: 'job-platform-users'
  });
};

/**
 * ⚡ VERIFICAR TOKEN OPTIMIZADO - Solo verificación JWT
 */
const verifyTokenOptimized = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'job-platform',
      audience: 'job-platform-users'
    });
  } catch (error) {
    throw new Error(`Token inválido: ${error.message}`);
  }
};

/**
 * ⚡ OBTENER USER OPTIMIZADO - Con cache y sin DB lookup innecesario
 */
const getUserFromRequestOptimized = async (req) => {
  // 1. Check request cache first
  if (REQUEST_CACHE.has(req)) {
    return REQUEST_CACHE.get(req);
  }

  let token = null;
  
  // 2. Extraer token (sin logs verbosos)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookies = req.headers.cookie;
    if (cookies) {
      const tokenMatch = cookies.match(/auth_token=([^;]+)/);
      if (tokenMatch) {
        token = decodeURIComponent(tokenMatch[1]);
      }
    }
  }

  if (!token) {
    if (DEBUG_MODE) console.log('⚠️ No token found');
    return null;
  }

  try {
    // 3. Verificar JWT (sin DB lookup)
    const decoded = verifyTokenOptimized(token);
    const userKey = `user_${decoded.userId}`;
    
    // 4. Check memory cache
    const cachedUser = userCache.get(userKey);
    if (cachedUser && (Date.now() - cachedUser.timestamp < CACHE_TTL)) {
      const user = cachedUser.data;
      REQUEST_CACHE.set(req, user);
      if (DEBUG_MODE) console.log(`💾 Cache hit: ${user.email}`);
      return user;
    }

    // 5. Solo si no hay cache, hacer DB lookup
    await pool;
    const dbResult = await pool.request()
      .input('userId', sql.BigInt, decoded.userId)
      .query('SELECT Id, Email, Role, FirstName, LastName, Company FROM Users WHERE Id = @userId');

    if (dbResult.recordset.length === 0) {
      throw new Error('Usuario no encontrado en BD');
    }

    const dbUser = dbResult.recordset[0];
    const user = {
      userId: dbUser.Id,
      email: dbUser.Email,
      role: dbUser.Role || 'user',
      firstName: dbUser.FirstName,
      lastName: dbUser.LastName,
      company: dbUser.Company
    };

    // 6. Guardar en cache
    userCache.set(userKey, {
      data: user,
      timestamp: Date.now()
    });
    
    REQUEST_CACHE.set(req, user);
    
    if (DEBUG_MODE) console.log(`🔐 DB lookup: ${user.email} (cached for ${CACHE_TTL/60000}min)`);
    return user;

  } catch (error) {
    if (DEBUG_MODE) console.error('❌ Auth error:', error.message);
    return null;
  }
};

/**
 * ⚡ MIDDLEWARE: Agregar user a request (optimizado)
 */
const addUserToRequest = async (req, res, next) => {
  try {
    const user = await getUserFromRequestOptimized(req);
    if (user) {
      req.user = user;
      req.userId = parseInt(user.userId);
    }
    next();
  } catch (error) {
    if (DEBUG_MODE) console.error('❌ addUserToRequest error:', error);
    next();
  }
};

/**
 * MIDDLEWARE: Require autenticación
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Error de autenticación',
      message: 'No se pudo autenticar la solicitud'
    });
  }
  next();
};

/**
 * MIDDLEWARE: Solo datos propios (igual que antes)
 */
const onlyOwnData = (userIdField = 'UserId') => {
  return (req, res, next) => {
    if (isSuperAdmin(req)) {
      return next(); // Super admin ve todo
    }
    
    req.userIdField = userIdField;
    req.shouldFilterByUser = true;
    next();
  };
};

/**
 * Utilidades (sin cambios)
 */
const isSuperAdmin = (req) => {
  return req.user && req.user.role === 'superadmin';
};

const addUserIdToRequest = addUserToRequest;

const getUserIdForQuery = (req) => {
  if (isSuperAdmin(req)) return null;
  return req.userId;
};

/**
 * ⚡ STATS DEL CACHE (para monitoring)
 */
const getCacheStats = () => {
  const now = Date.now();
  let active = 0, expired = 0;
  
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp < CACHE_TTL) {
      active++;
    } else {
      expired++;
    }
  }
  
  return { active, expired, total: userCache.size };
};

module.exports = {
  generateToken,
  addUserToRequest,
  addUserIdToRequest,
  requireAuth,
  onlyOwnData,
  isSuperAdmin,
  getUserIdForQuery,
  getUserFromRequest: getUserFromRequestOptimized,
  getCacheStats // Para debugging
};