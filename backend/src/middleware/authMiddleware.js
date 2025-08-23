/**
 * 🔐 Middleware de Autenticación JWT con Roles y Super Admin
 * 
 * Sistema completo de autenticación multi-tenant con:
 * - JWT tokens con expiración
 * - Roles: user, admin, superadmin
 * - Super admin: acceso total a todos los datos
 * - Separación estricta de datos por usuario
 * 
 * @author Claude Code
 * @date 2025-08-18
 */

const jwt = require('jsonwebtoken');
const { pool, sql } = require('../db/db');

// Configuración JWT
const JWT_SECRET = process.env.JWT_SECRET || 'tu-jwt-secret-super-seguro-cambiar-en-produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generar token JWT para usuario
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
 * Verificar y decodificar token JWT
 */
const verifyToken = (token) => {
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
 * Obtener UserId y datos del usuario desde JWT
 */
const getUserFromRequest = async (req) => {
  console.log('🔍 Headers recibidos:', JSON.stringify(req.headers, null, 2));
  
  // 1. Intentar obtener token desde Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = verifyToken(token);
      console.log(`🔐 JWT User: ${decoded.email} (${decoded.role}) - ID: ${decoded.userId}`);
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        company: decoded.company
      };
    } catch (error) {
      console.error('❌ Error verificando JWT:', error.message);
    }
  }

  // 2. Buscar token en cookies (Next.js)
  const cookies = req.headers.cookie;
  if (cookies) {
    const tokenMatch = cookies.match(/auth_token=([^;]+)/);
    if (tokenMatch) {
      const token = decodeURIComponent(tokenMatch[1]);
      try {
        const decoded = verifyToken(token);
        console.log(`🔐 JWT Cookie User: ${decoded.email} (${decoded.role}) - ID: ${decoded.userId}`);
        return {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          firstName: decoded.firstName,
          lastName: decoded.lastName,
          company: decoded.company
        };
      } catch (error) {
        console.error('❌ Error verificando JWT cookie:', error.message);
      }
    }
  }

  // 3. Fallback: x-user-id header para testing
  const headerUserId = req.headers['x-user-id'];
  if (headerUserId) {
    console.log(`🔄 Fallback x-user-id: ${headerUserId}`);
    try {
      await pool;
      const result = await pool.request()
        .input('userId', sql.BigInt, parseInt(headerUserId))
        .query('SELECT Id, Email, Role, FirstName, LastName, Company FROM Users WHERE Id = @userId AND IsActive = 1');
      
      if (result.recordset.length > 0) {
        const user = result.recordset[0];
        return {
          userId: user.Id,
          email: user.Email,
          role: user.Role || 'user',
          firstName: user.FirstName,
          lastName: user.LastName,
          company: user.Company
        };
      }
    } catch (error) {
      console.error('❌ Error obteniendo usuario desde BD:', error.message);
    }
  }

  // 4. No hay token válido - error real
  console.log('❌ No se encontró token JWT válido en headers:', Object.keys(req.headers));
  throw new Error('Token JWT requerido');
};

/**
 * Middleware: Agregar información del usuario a la request
 */
const addUserToRequest = async (req, res, next) => {
  try {
    const user = await getUserFromRequest(req);
    req.user = user;
    req.userId = user.userId; // Mantener compatibilidad
    
    console.log(`🔐 Request User: ${user.email} (${user.role}) - ${req.method} ${req.path}`);
    console.log(`🔐 Request UserId: ${req.userId}`);
    console.log(`🔐 Request User completo:`, JSON.stringify(req.user, null, 2));
    next();
  } catch (error) {
    console.error('❌ Error obteniendo usuario:', error);
    return res.status(401).json({
      success: false,
      error: 'Error de autenticación',
      message: 'No se pudo autenticar la solicitud'
    });
  }
};

/**
 * Middleware: Requiere autenticación válida
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.userId) {
    return res.status(401).json({
      success: false,
      error: 'Usuario no autenticado',
      message: 'Se requiere autenticación para acceder a este recurso'
    });
  }
  next();
};

/**
 * Middleware: Requiere rol específico
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(userRole)) {
      console.log(`❌ Acceso denegado: usuario ${req.user.email} (${userRole}) intentó acceder a recurso que requiere ${roles.join(' o ')}`);
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado',
        message: `Se requiere rol: ${roles.join(' o ')}`
      });
    }

    console.log(`✅ Acceso autorizado: ${req.user.email} (${userRole})`);
    next();
  };
};

/**
 * Middleware: Solo super admin
 */
const requireSuperAdmin = requireRole('superadmin');

/**
 * Middleware: Admin o super admin
 */
const requireAdmin = requireRole(['admin', 'superadmin']);

/**
 * Verificar si el usuario es super admin
 */
const isSuperAdmin = (req) => {
  const result = req.user && req.user.role === 'superadmin';
  console.log(`🔑 isSuperAdmin check: req.user = ${!!req.user}, req.user.role = ${req.user?.role}, result = ${result}`);
  return result;
};

/**
 * Obtener UserId para queries (considera super admin)
 * Super admin puede ver datos de todos los usuarios
 */
const getUserIdForQuery = (req, targetUserId = null) => {
  if (isSuperAdmin(req)) {
    // Super admin: puede especificar userId específico o ver todos
    if (targetUserId) {
      console.log(`🔑 Super admin accediendo a datos de usuario ${targetUserId}`);
      return targetUserId;
    }
    console.log(`🔑 Super admin accediendo a todos los datos`);
    return null; // null significa "todos los usuarios"
  }
  
  // Usuario normal: solo sus propios datos
  return req.userId;
};

/**
 * Middleware: Verificar acceso a datos propios (excepto super admin)
 */
const onlyOwnData = (userIdField = 'UserId') => {
  return (req, res, next) => {
    console.log(`🛡️ onlyOwnData middleware: userIdField = ${userIdField}`);
    console.log(`🛡️ onlyOwnData: req.user = ${!!req.user}, req.userId = ${req.userId}, req.user.role = ${req.user?.role}`);
    console.log(`🛡️ onlyOwnData: isSuperAdmin(req) = ${isSuperAdmin(req)}`);
    
    if (isSuperAdmin(req)) {
      // Super admin puede acceder a cualquier dato
      console.log(`🔑 Super admin bypassing data access restrictions`);
      req.userIdField = userIdField;
      req.allowAllUsers = true;
      return next();
    }

    // Usuario normal: solo sus datos
    console.log(`🔒 Usuario normal: restringiendo acceso a datos propios (UserId = ${req.userId})`);
    req.userIdField = userIdField;
    req.allowAllUsers = false;
    req.restrictedUserId = req.userId;
    next();
  };
};

module.exports = {
  // Funciones principales
  generateToken,
  verifyToken,
  getUserFromRequest,
  
  // Middleware
  addUserToRequest,
  requireAuth,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  onlyOwnData,
  
  // Utilidades
  isSuperAdmin,
  getUserIdForQuery,
  
  // Compatibilidad hacia atrás
  addUserIdToRequest: addUserToRequest, // Alias para compatibilidad
  getUserIdFromRequest: getUserFromRequest // Mantener función legacy
};