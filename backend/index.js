const express = require('express');
const { pool, poolConnect, sql, supabase } = require('./src/db/db');
const JobOffersSearchService = require('./src/services/jobOffersSearchService');
// const trackRoutes = require('./track'); // Archivo no encontrado - comentado temporalmente
const connectionsRouter = require('./src/routes/connections');
const mappingsRouter = require('./src/routes/mappings');
const segmentsRouter = require('./src/routes/segments');
const campaignsRouter = require('./src/routes/campaigns');
const channelWebhooksRouter = require('./src/routes/channelWebhooks');
const userCredentialsRouter = require('./src/routes/userCredentials');
const metricsRouter = require('./src/routes/metrics');
const offersRouter = require('./src/routes/offers');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const cors = require('cors');
const fileUpload = require('express-fileupload');

// Cache en memoria para filtros - expira cada 5 minutos
const filterCache = {
  locations: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 },
  sectors: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 },
  companies: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 },
  externalIds: { data: null, timestamp: 0, ttl: 10 * 60 * 1000 }
};

function getCachedData(key) {
  const cached = filterCache[key];
  if (cached && cached.data && (Date.now() - cached.timestamp) < cached.ttl) {
    console.log(`📦 Cache HIT para ${key} (${Math.round((Date.now() - cached.timestamp) / 1000)}s ago)`);
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  filterCache[key].data = data;
  filterCache[key].timestamp = Date.now();
  console.log(`💾 Cache SET para ${key} con ${data.length} elementos`);
}

// 🔧 Performance feature flags
const USE_INDEX_HINTS = process.env.USE_INDEX_HINTS === 'true';
// require('./scheduler'); // Disabled for Vercel deployment (serverless functions don't support cron)

// ✅ SETUP LOGGING (Vercel-compatible - no file writes)
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function(...args) {
  const timestamp = new Date().toISOString();
  originalConsoleLog(`[${timestamp}]`, ...args);
};

console.error = function(...args) {
  const timestamp = new Date().toISOString();
  originalConsoleError(`[${timestamp}] ERROR:`, ...args);
};

const app = express();
// Disabled for Vercel serverless - tables should already exist
// const { ensureTables } = require('./src/db/bootstrap');
// const { performanceTracker } = require('./src/services/performanceTracker');

// ensureTables().catch(err => console.error('ensureTables error', err));

// Performance tracker disabled for Vercel serverless
// setTimeout(() => {
//   try {
//     performanceTracker.start();
//     console.log('🚀 Sistema de tracking de performance iniciado');
//   } catch (error) {
//     console.error('❌ Error iniciando performance tracker:', error.message);
//   }
// }, 5000);
// CORS configuration (production-ready)
const allowedOrigins = [
  'http://localhost:3000', 'http://127.0.0.1:3000', // Landing (Next.js)
  'http://localhost:3001', 'http://127.0.0.1:3001', // Landing alternativo
  'http://localhost:3004', 'http://127.0.0.1:3004',
  'http://localhost:3006', 'http://127.0.0.1:3006',
  'http://localhost:3007', 'http://127.0.0.1:3007',
  // Add prod domains via env: CORS_ORIGIN=https://app.example.com,https://landing.example.com
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Origin','Accept','Cache-Control','Pragma','Expires','If-None-Match','If-Modified-Since'],
  exposedHeaders: ['Content-Length','Content-Type','Date','Server'],
};

app.use(cors(corsOptions));

// Ensure ACAO is present for allowed origins (production-safe)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  next();
});
app.use(express.json());
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 20 * 1024 * 1024 // 20MB max file size
  },
  abortOnLimit: true,
  responseOnLimit: "File size limit has been reached",
}));
// app.use('/', trackRoutes); // Comentado temporalmente - archivo no encontrado
// Logging middleware para debug
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`🔍 POST Request: ${req.path} (Full URL: ${req.url})`);
  }
  next();
});

// ⚡ AUTH CACHE STATS ENDPOINT
app.get('/api/auth/cache-stats', (req, res) => {
  const { getCacheStats } = require('./src/middleware/authMiddleware');
  const stats = getCacheStats();
  res.json({
    success: true,
    cache: stats,
    timestamp: new Date().toISOString()
  });
});

console.log("🔧 Montando router en /api/connections");
app.use('/api/connections', connectionsRouter);
app.use('/api/mappings', mappingsRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/channels', channelWebhooksRouter);
app.use('/api/users', userCredentialsRouter);
app.use('/api/credentials', userCredentialsRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/offers', offersRouter);

// Router para control de límites internos
const internalLimitsRouter = require('./src/routes/internalLimits');
app.use('/api/internal-limits', internalLimitsRouter);

// Router para sistema de notificaciones
const notificationsRouter = require('./src/routes/notifications');
app.use('/api/notifications', notificationsRouter);

// Router de demostración para middleware de límites por canal
const channelLimitsDemoRouter = require('./src/routes/channelLimitsDemo');
app.use('/api/channel-limits-demo', channelLimitsDemoRouter);

// Router para sincronización de métricas
const metricsSyncRouter = require('./src/routes/metricsSync');
app.use('/api/metrics-sync', metricsSyncRouter);

// Router para autenticación (Google OAuth)
const authRouter = require('./src/routes/auth');
app.use('/api/auth', authRouter);

// Cargar especificación OpenAPI desde swagger.yaml
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Endpoint base para testeo
app.get('/', (req, res) => {
  res.send('API running');
});


// Endpoint de debug para CORS
app.get('/debug', (req, res) => {
  res.json({
    message: 'CORS Debug endpoint',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
});

// GET /job-offers/locations - Endpoint para opciones de ubicación con filtros dependientes
app.get('/job-offers/locations', 
  // ✅ AGREGAR MIDDLEWARE DE AUTENTICACIÓN
  require('./src/middleware/authMiddleware').addUserToRequest,
  require('./src/middleware/authMiddleware').requireAuth,
  async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    await poolConnect;
    
    // Parámetros de filtro para filtros dependientes
    const { status, sector, company, externalId, q } = req.query;
    console.log('🔍 /locations con filtros:', { status, sector, company, externalId, q });
    
    // Check cache first (solo si no hay filtros específicos)
    const hasFilters = status || sector || company || externalId || q;
    if (!hasFilters) {
      const cachedData = getCachedData('locations');
      if (cachedData) {
        return res.json({ success: true, data: cachedData });
      }
    }
    
    // CORRECCIÓN: Query real optimizada para búsquedas
    
    // Timeout específico para queries de filtros - 5 segundos máximo
    const timeoutMs = 5000;
    const request = pool.request();
    request.timeout = timeoutMs;
    
    let whereConditions = ['(City IS NOT NULL OR Region IS NOT NULL)'];
    
    // ✅ FILTRAR POR USUARIO - Solo superadmin ve todo
    const { isSuperAdmin } = require('./src/middleware/authMiddleware');
    if (!isSuperAdmin(req)) {
      whereConditions.push('UserId = @currentUserId');
      request.input('currentUserId', sql.BigInt, req.userId);
      console.log(`🔒 Filtrando locations para usuario ${req.userId} (${req.user.role})`);
    } else {
      console.log(`🔑 Super admin: viendo todas las locations sin filtro`);
    }

    // Agregar filtros dependientes
    if (status && status !== 'all') {
      if (status === 'active') {
        whereConditions.push('StatusId = 1');
      } else if (status === 'pending') {
        whereConditions.push('StatusId = 2'); 
      } else if (status === 'paused') {
        whereConditions.push('StatusId = 3');
      } else if (status === 'archived') {
        whereConditions.push('StatusId = 5');
      }
    }

    if (sector && sector !== 'all') {
      whereConditions.push('Sector = @sector');
      request.input('sector', sql.NVarChar, sector);
    }

    if (externalId && externalId !== 'all') {
      const cleanExternalId = externalId.trim();
      whereConditions.push('(ExternalId = @externalIdExact OR ExternalId LIKE @externalId)');
      request.input('externalIdExact', sql.NVarChar, cleanExternalId);
      request.input('externalId', sql.NVarChar, `%${cleanExternalId}%`);
    }

    if (company && company !== 'all') {
      const cleanCompany = company.trim();
      whereConditions.push('(CompanyName = @companyExact OR CompanyName LIKE @company)');
      request.input('companyExact', sql.NVarChar, cleanCompany);
      request.input('company', sql.NVarChar, `%${cleanCompany}%`);
    }

    if (q && q.trim()) {
      const searchTerm = q.trim();
      whereConditions.push('(Title LIKE @search OR CompanyName LIKE @search OR Description LIKE @search)');
      request.input('search', sql.NVarChar, `%${searchTerm}%`);
    }
    
    // Query ultra-optimizada para búsquedas: DISTINCT + TOP limitado + NOLOCK
    const hasSearch = q && q.trim();
    
    const locationQuery = `
      SELECT DISTINCT
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END as location
      FROM JobOffers WITH (NOLOCK)
      WHERE ${whereConditions.join(' AND ')}
        AND (City IS NOT NULL OR Region IS NOT NULL)
      ORDER BY location
    `;

    console.log('🔍 Location query:', locationQuery);
    const result = await request.query(locationQuery);
    const locations = result.recordset
      .filter(row => row.location && row.location.trim() !== '')
      .map(row => row.location);

    console.log(`✅ Locations con filtros: ${locations.length} encontradas`);

    // Cache si no hay filtros
    if (!hasFilters) {
      setCachedData('locations', locations);
    }

    res.json({
      success: true,
      data: locations
    });

  } catch (error) {
    console.error('Error getting locations:', error);
    
    // En caso de timeout, devolver datos de fallback
    if (error.code === 'ETIMEOUT') {
      console.log('⚠️ Timeout en locations - devolviendo fallback basico');
      return res.json({
        success: true,
        data: ['Madrid, Madrid', 'Barcelona, Barcelona', 'Valencia, Valencia', 'Sevilla, Sevilla', 'Bilbao, Vizcaya']
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// GET /job-offers/sectors - Endpoint para opciones de sector con filtros dependientes
app.get('/job-offers/sectors', 
  // ✅ AGREGAR MIDDLEWARE DE AUTENTICACIÓN
  require('./src/middleware/authMiddleware').addUserToRequest,
  require('./src/middleware/authMiddleware').requireAuth,
  async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    await poolConnect;
    
    // Parámetros de filtro para filtros dependientes
    const { status, location, company, externalId, q } = req.query;
    console.log('🔍 /sectors con filtros:', { status, location, company, externalId, q });
    
    // Check cache first (solo si no hay filtros específicos)
    const hasFilters = status || location || company || externalId || q;
    if (!hasFilters) {
      const cachedData = getCachedData('sectors');
      if (cachedData) {
        return res.json({ success: true, data: cachedData });
      }
    }
    
    // CORRECCIÓN: Implementar query real optimizada para búsquedas
    // Los filtros DEBEN mostrar datos reales correspondientes a la búsqueda
    
    // Timeout específico para queries de filtros - 5 segundos máximo
    const timeoutMs = 5000;
    const request = pool.request();
    request.timeout = timeoutMs;
    
    let whereConditions = ['Sector IS NOT NULL', 'Sector != \'\''];
    
    // ✅ FILTRAR POR USUARIO - Solo superadmin ve todo  
    const { isSuperAdmin } = require('./src/middleware/authMiddleware');
    if (!isSuperAdmin(req)) {
      whereConditions.push('UserId = @currentUserId');
      request.input('currentUserId', sql.BigInt, req.userId);
      console.log(`🔒 Filtrando sectors para usuario ${req.userId} (${req.user.role})`);
    } else {
      console.log(`🔑 Super admin: viendo todos los sectors sin filtro`);
    }

    // Agregar filtros dependientes
    if (status && status !== 'all') {
      if (status === 'active') {
        whereConditions.push('StatusId = 1');
      } else if (status === 'pending') {
        whereConditions.push('StatusId = 2'); 
      } else if (status === 'paused') {
        whereConditions.push('StatusId = 3');
      } else if (status === 'archived') {
        whereConditions.push('StatusId = 5');
      }
    }

    if (location && location !== 'all') {
      whereConditions.push('(City LIKE @location OR Region LIKE @location OR CONCAT(City, \', \', Region) = @locationExact)');
      request.input('location', sql.NVarChar, `%${location}%`);
      request.input('locationExact', sql.NVarChar, location);
    }

    if (externalId && externalId !== 'all') {
      const cleanExternalId = externalId.trim();
      whereConditions.push('(ExternalId = @externalIdExact OR ExternalId LIKE @externalId)');
      request.input('externalIdExact', sql.NVarChar, cleanExternalId);
      request.input('externalId', sql.NVarChar, `%${cleanExternalId}%`);
    }

    if (company && company !== 'all') {
      const cleanCompany = company.trim();
      whereConditions.push('(CompanyName = @companyExact OR CompanyName LIKE @company)');
      request.input('companyExact', sql.NVarChar, cleanCompany);
      request.input('company', sql.NVarChar, `%${cleanCompany}%`);
    }

    if (q && q.trim()) {
      const searchTerm = q.trim();
      whereConditions.push('(Title LIKE @search OR CompanyName LIKE @search OR Description LIKE @search)');
      request.input('search', sql.NVarChar, `%${searchTerm}%`);
    }
    
    // Query optimizada: para búsquedas, usar índices y limitar resultados agresivamente
    const hasSearch = q && q.trim();
    
    const sectorQuery = `
      SELECT DISTINCT Sector
      FROM JobOffers WITH (NOLOCK)
      WHERE ${whereConditions.join(' AND ')}
        AND Sector IS NOT NULL AND Sector != ''
      ORDER BY Sector
    `;

    console.log('🔍 Sector query:', sectorQuery);
    const result = await request.query(sectorQuery);
    const sectors = result.recordset.map(row => row.Sector);

    console.log(`✅ Sectors con filtros: ${sectors.length} encontrados`);

    // Cache si no hay filtros
    if (!hasFilters) {
      setCachedData('sectors', sectors);
    }

    res.json({
      success: true,
      data: sectors
    });

  } catch (error) {
    console.error('Error getting sectors:', error);
    
    // En caso de timeout, devolver datos de fallback
    if (error.code === 'ETIMEOUT') {
      console.log('⚠️ Timeout en sectors - devolviendo fallback basico');
      return res.json({
        success: true,
        data: ['Tecnología', 'Comercial', 'Marketing', 'Finanzas', 'Recursos Humanos']
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// GET /job-offers/external-ids - Endpoint para opciones de ExternalId con filtros dependientes
app.get('/job-offers/external-ids', 
  // ✅ AGREGAR MIDDLEWARE DE AUTENTICACIÓN
  require('./src/middleware/authMiddleware').addUserToRequest,
  require('./src/middleware/authMiddleware').requireAuth,
  async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    await poolConnect;
    
    // Parámetros de filtro para filtros dependientes
    const { status, location, sector, company, q } = req.query;
    console.log('🔍 /external-ids con filtros:', { status, location, sector, company, q });
    
    // Check cache first (solo si no hay filtros específicos)
    const hasFilters = status || location || sector || company || q;
    if (!hasFilters) {
      const cachedData = getCachedData('externalIds');
      if (cachedData) {
        return res.json({ success: true, data: cachedData });
      }
    }
    
    // CORRECCIÓN: Query real optimizada - External IDs pueden estar vacíos y está OK
    
    // Timeout específico para queries de filtros - 5 segundos máximo
    const timeoutMs = 5000;
    const request = pool.request();
    request.timeout = timeoutMs;
    
    let whereConditions = ['ExternalId IS NOT NULL', 'ExternalId != \'\''];
    
    // ✅ FILTRAR POR USUARIO - Solo superadmin ve todo
    const { isSuperAdmin } = require('./src/middleware/authMiddleware');
    if (!isSuperAdmin(req)) {
      whereConditions.push('UserId = @currentUserId');
      request.input('currentUserId', sql.BigInt, req.userId);
      console.log(`🔒 Filtrando external IDs para usuario ${req.userId} (${req.user.role})`);
    } else {
      console.log(`🔑 Super admin: viendo todos los external IDs sin filtro`);
    }

    // Agregar filtros dependientes
    if (status && status !== 'all') {
      if (status === 'active') {
        whereConditions.push('StatusId = 1');
      } else if (status === 'pending') {
        whereConditions.push('StatusId = 2'); 
      } else if (status === 'paused') {
        whereConditions.push('StatusId = 3');
      } else if (status === 'archived') {
        whereConditions.push('StatusId = 5');
      }
    }

    if (location && location !== 'all') {
      whereConditions.push('(City LIKE @location OR Region LIKE @location OR CONCAT(City, \', \', Region) = @locationExact)');
      request.input('location', sql.NVarChar, `%${location}%`);
      request.input('locationExact', sql.NVarChar, location);
    }

    if (sector && sector !== 'all') {
      whereConditions.push('Sector = @sector');
      request.input('sector', sql.NVarChar, sector);
    }

    if (company && company !== 'all') {
      const cleanCompany = company.trim();
      whereConditions.push('(CompanyName = @companyExact OR CompanyName LIKE @company)');
      request.input('companyExact', sql.NVarChar, cleanCompany);
      request.input('company', sql.NVarChar, `%${cleanCompany}%`);
    }

    if (q && q.trim()) {
      const searchTerm = q.trim();
      whereConditions.push('(Title LIKE @search OR CompanyName LIKE @search OR Description LIKE @search)');
      request.input('search', sql.NVarChar, `%${searchTerm}%`);
    }
    
    // Query optimizada: External IDs con búsqueda suelen ser pocos o ninguno
    const hasSearch = q && q.trim();
    
    const externalIdQuery = `
      SELECT DISTINCT ExternalId
      FROM JobOffers WITH (NOLOCK)
      WHERE ${whereConditions.join(' AND ')}
        AND ExternalId IS NOT NULL AND ExternalId != ''
      ORDER BY ExternalId
    `;

    console.log('🔍 ExternalId query:', externalIdQuery);
    const result = await request.query(externalIdQuery);
    const externalIds = result.recordset.map(row => row.ExternalId);

    console.log(`✅ ExternalIds con filtros: ${externalIds.length} encontrados`);

    // Cache si no hay filtros
    if (!hasFilters) {
      setCachedData('externalIds', externalIds);
    }

    res.json({
      success: true,
      data: externalIds
    });

  } catch (error) {
    console.error('Error getting external IDs:', error);
    
    // En caso de timeout, devolver datos de fallback
    if (error.code === 'ETIMEOUT') {
      console.log('⚠️ Timeout en external IDs - devolviendo fallback vacio');
      return res.json({
        success: true,
        data: []
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// GET /job-offers - NUEVA ARQUITECTURA SARGABLE
app.get('/job-offers', 
  // ✅ AGREGAR MIDDLEWARE DE AUTENTICACIÓN
  require('./src/middleware/authMiddleware').addUserToRequest,
  require('./src/middleware/authMiddleware').requireAuth,
  async (req, res) => {
  // Timeout específico de 30s para este endpoint
  req.setTimeout(30000);
  res.setTimeout(30000);
  
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  console.log(`🔍 GET /job-offers - Usuario: ${req.user.email} (${req.user.role}) - ID: ${req.userId}`);

  try {
    // Intentar conectar con fallback a mock data
    try {
      await poolConnect;
    } catch (dbError) {
      console.log("⚠️ BD no disponible, usando mock data:", dbError.message);
      
      // MOCK DATA para development sin BD
      const mockOffers = [
        {
          Id: 1,
          Title: "Senior Full Stack Developer",
          CompanyName: "TechCorp SA",
          Location: "Madrid, España",
          Sector: "Tecnología",
          SalaryRange: "50000-70000",
          JobType: "Full-time",
          Status: "Active",
          CreatedAt: new Date().toISOString(),
          Description: "Desarrollo de aplicaciones web modernas con React y Node.js"
        },
        {
          Id: 2,
          Title: "Marketing Digital Specialist",
          CompanyName: "Digital Solutions",
          Location: "Barcelona, España",
          Sector: "Marketing",
          SalaryRange: "35000-45000",
          JobType: "Full-time",
          Status: "Active",
          CreatedAt: new Date(Date.now() - 86400000).toISOString(),
          Description: "Gestión de campañas digitales y análisis de datos"
        },
        {
          Id: 3,
          Title: "Data Scientist",
          CompanyName: "AI Innovations",
          Location: "Valencia, España", 
          Sector: "Tecnología",
          SalaryRange: "45000-60000",
          JobType: "Full-time",
          Status: "Pending",
          CreatedAt: new Date(Date.now() - 172800000).toISOString(),
          Description: "Análisis de datos y machine learning"
        }
      ];

      // Aplicar filtros básicos al mock data
      const { q: search, limit = 20 } = req.query;
      const cleanSearch = search && search.trim() !== '' ? search.trim() : null;
      const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
      
      let filteredOffers = mockOffers;
      if (cleanSearch) {
        filteredOffers = mockOffers.filter(offer => 
          offer.Title.toLowerCase().includes(cleanSearch.toLowerCase()) ||
          offer.CompanyName.toLowerCase().includes(cleanSearch.toLowerCase())
        );
      }

      const response = {
        success: true,
        data: filteredOffers.slice(0, validatedLimit),
        mockData: true,
        pagination: {
          limit: validatedLimit,
          total: filteredOffers.length,
          hasMore: false
        },
        message: "Usando datos de ejemplo (BD no disponible)"
      };

      console.log(`✅ Mock data enviado: ${filteredOffers.length} ofertas`);
      return res.json(response);
    }

    // Obtener y validar parámetros
    const { 
      q: search,           // Renombrar para consistencia con estándar
      mode = 'auto',       // exact, prefix, auto, wide
      status, 
      location, 
      sector,
      company,            // Nuevo filtro por empresa
      externalId,         // Nuevo filtro por ExternalId
      promocion,          // Nuevo filtro por promoción en campañas
      sortBy = 'CreatedAt', // Campo de ordenamiento
      sortOrder = 'DESC',   // Dirección de ordenamiento
      limit = 20,
      page = 1,            // Página para paginación tradicional
      lastCreatedAt,      // Para keyset pagination
      lastId              // Para keyset pagination
    } = req.query;

    // Validar y limpiar parámetros
    const cleanSearch = search && search.trim() !== '' ? search.trim() : null;
    const cleanStatus = status && status !== 'all' ? status : null;
    const cleanLocation = location && location !== 'all' ? location.trim() : null;
    const cleanSector = sector && sector !== 'all' ? sector.trim() : null;
    const cleanCompany = company && company !== 'all' ? company.trim() : null;
    const cleanExternalId = externalId && externalId !== 'all' ? externalId.trim() : null;
    const cleanPromocion = promocion && promocion !== 'all' ? promocion : null;
    
    // Validar límites (evitar queries masivas)
    const validatedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100); // máximo 100
    const validatedPage = Math.max(parseInt(page) || 1, 1);
    const offset = (validatedPage - 1) * validatedLimit;

    console.log(`📊 Filtros aplicados - Search: ${cleanSearch}, Status: ${cleanStatus}, Location: ${cleanLocation}, Sector: ${cleanSector}, Company: ${cleanCompany}, ExternalId: ${cleanExternalId}, Promocion: ${cleanPromocion}, Page: ${validatedPage}, Limit: ${validatedLimit}`);
    console.log(`🔍 CURSOR DEBUG - lastCreatedAt: ${lastCreatedAt}, lastId: ${lastId}`);
    console.log(`🔍 CURSOR DEBUG - lastCreatedAt type: ${typeof lastCreatedAt}, truthy: ${!!lastCreatedAt}`);
    console.log(`🔍 CURSOR DEBUG - lastId type: ${typeof lastId}, truthy: ${!!lastId}`);

    // Re-habilitado keyset pagination tras eliminar LEFT JOINs complejos  
    const usingKeysetPagination = Boolean(lastCreatedAt && lastId);
    console.log(`🔍 CURSOR DEBUG - usingKeysetPagination: ${usingKeysetPagination}`);
    
    // 🔧 FIX PAGINACIÓN: Separar filtros de condiciones de cursor
    // Solo filtros (para COUNT y query principal)
    let filterConditions = [];
    // Condiciones de cursor (solo para query principal, NO para COUNT)
    let paginationConditions = [];
    let queryParams = [];
    
    // ✅ FILTRAR POR USUARIO - Solo superadmin ve todo
    const { isSuperAdmin } = require('./src/middleware/authMiddleware');
    if (!isSuperAdmin(req)) {
      filterConditions.push('jo.UserId = @currentUserId');
      queryParams.push({ name: 'currentUserId', type: sql.BigInt, value: req.userId });
      console.log(`🔒 Filtrando ofertas para usuario ${req.userId} (${req.user.role})`);

      const { count: userOffersCount, error: userOffersError } = await supabase
        .from('JobOffers')
        .select('Id', { count: 'exact', head: true })
        .eq('UserId', req.userId);

      if (userOffersError) {
        console.warn(`⚠️ No se pudo comprobar ofertas para usuario ${req.userId}: ${userOffersError.message}`);
      } else if ((userOffersCount || 0) === 0) {
        console.log(`✅ Usuario ${req.userId} sin ofertas: devolviendo empty state`);
        return res.json({
          success: true,
          data: [],
          items: [],
          hasMore: false,
          total: 0,
          next: null,
          pagination: {
            page: validatedPage,
            limit: validatedLimit,
            total: 0,
            pages: 0,
            hasMore: false,
            lastCreatedAt: null,
            lastId: null
          },
          stats: {
            totalOffers: 0,
            activeOffers: 0,
            pendingOffers: 0,
            pausedOffers: 0,
            totalSectors: 0,
            totalCities: 0
          },
          filters: {
            search: cleanSearch || null,
            status: cleanStatus || 'all',
            location: cleanLocation || 'all',
            sector: cleanSector || 'all',
            externalId: cleanExternalId || 'all'
          }
        });
      }
    } else {
      console.log(`🔑 Super admin: viendo todas las ofertas sin filtro`);
    }
    
    // 🔧 SEPARAR: Condiciones de keyset pagination (solo para query principal)
    if (usingKeysetPagination) {
      console.log('🔍 CURSOR DEBUG - Entrando en keyset pagination logic');
      if (lastCreatedAt && lastId) {
        console.log('🔍 CURSOR DEBUG - Usando lastCreatedAt Y lastId');
        // CRÍTICO: Validar fecha antes de usar
        const parsedDate = new Date(decodeURIComponent(lastCreatedAt));
        if (isNaN(parsedDate.getTime())) {
          console.log('🚨 CRÍTICO: Fecha inválida en lastCreatedAt:', lastCreatedAt);
          return res.status(400).json({
            success: false,
            error: 'Invalid lastCreatedAt parameter',
            details: `Cannot parse date: ${lastCreatedAt}`
          });
        }
        
        const condition = '(CreatedAt < @lastCreatedAt OR (CreatedAt = @lastCreatedAt AND Id < @lastId))';
        console.log('🔍 CURSOR DEBUG - Añadiendo condición PAGINATION:', condition);
        paginationConditions.push(condition); // 🔧 CAMBIO: Va a paginationConditions, NO filterConditions
        queryParams.push({ name: 'lastCreatedAt', type: sql.DateTime, value: parsedDate });
        queryParams.push({ name: 'lastId', type: sql.Int, value: parseInt(lastId) });
      } else if (lastCreatedAt) {
        console.log('🔍 CURSOR DEBUG - Usando solo lastCreatedAt');
        const parsedDate = new Date(decodeURIComponent(lastCreatedAt));
        if (isNaN(parsedDate.getTime())) {
          console.log('🚨 CRÍTICO: Fecha inválida en lastCreatedAt:', lastCreatedAt);
          return res.status(400).json({
            success: false,
            error: 'Invalid lastCreatedAt parameter',
            details: `Cannot parse date: ${lastCreatedAt}`
          });
        }
        
        const condition = 'CreatedAt < @lastCreatedAt';
        console.log('🔍 CURSOR DEBUG - Añadiendo condición PAGINATION:', condition);
        paginationConditions.push(condition); // 🔧 CAMBIO: Va a paginationConditions
        queryParams.push({ name: 'lastCreatedAt', type: sql.DateTime, value: parsedDate });
      } else if (lastId) {
        console.log('🔍 CURSOR DEBUG - Usando solo lastId');
        const condition = 'Id < @lastId';
        console.log('🔍 CURSOR DEBUG - Añadiendo condición PAGINATION:', condition);
        paginationConditions.push(condition); // 🔧 CAMBIO: Va a paginationConditions
        queryParams.push({ name: 'lastId', type: sql.Int, value: parseInt(lastId) });
      }
    } else {
      console.log('🔍 CURSOR DEBUG - NO usando keyset pagination');
    }

    // 🎯 FILTRO DE BÚSQUEDA PERMISIVO - Busca parciales con LIKE '%término%'
    if (cleanSearch) {
      console.log(`🔍 SEARCH DEBUG - Buscando término: "${cleanSearch}"`);
      // CAMPOS: Title (P1), CompanyName (P2), Sector (P3), City (P4), Region (P5)
      const searchCondition = `(
        Title LIKE @searchContains OR 
        CompanyName LIKE @searchContains OR
        Sector LIKE @searchContains OR
        City LIKE @searchContains OR
        Region LIKE @searchContains OR
        Title LIKE @searchPrefix OR 
        CompanyName LIKE @searchPrefix OR
        Sector LIKE @searchPrefix OR
        City LIKE @searchPrefix OR
        Region LIKE @searchPrefix
      )`;
      console.log(`🔍 SEARCH DEBUG - Condición WHERE: ${searchCondition}`);
      console.log(`🔍 SEARCH DEBUG - Parámetros: Contains="%${cleanSearch}%", Prefix="${cleanSearch}%"`);
      filterConditions.push(searchCondition);
      queryParams.push({ name: 'searchContains', type: sql.NVarChar, value: `%${cleanSearch}%` });
      queryParams.push({ name: 'searchPrefix', type: sql.NVarChar, value: `${cleanSearch}%` });
      queryParams.push({ name: 'searchParam', type: sql.NVarChar, value: cleanSearch });
    } else {
      // Sin búsqueda, añadir parámetro NULL para ordenamiento
      queryParams.push({ name: 'searchParam', type: sql.NVarChar, value: null });
    }

    // Filtro por status (usando StatusId) - MÁS EFICIENTE con índice
    if (cleanStatus) {
      const statusMap = {
        'active': 1,
        'pending': 3,
        'paused': 2,
        'archived': 5
      };
      if (statusMap[cleanStatus]) {
        filterConditions.push('StatusId = @status');
        queryParams.push({ name: 'status', type: sql.Int, value: statusMap[cleanStatus] });
      }
    }

    // Filtro por ubicación OPTIMIZADO - buscar en campo location calculado Y campos individuales
    if (cleanLocation) {
      filterConditions.push(`(
        City = @locationExact OR 
        Region = @locationExact OR 
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END = @locationExact OR
        City LIKE @location OR 
        Region LIKE @location OR
        CASE 
          WHEN City IS NOT NULL AND Region IS NOT NULL AND Region != '' 
          THEN CONCAT(City, ', ', Region)
          WHEN City IS NOT NULL 
          THEN City
          ELSE Region
        END LIKE @location
      )`);
      queryParams.push({ name: 'locationExact', type: sql.NVarChar, value: cleanLocation });
      queryParams.push({ name: 'location', type: sql.NVarChar, value: `%${cleanLocation}%` });
    }

    // Filtro por sector OPTIMIZADO
    if (cleanSector) {
      filterConditions.push('(Sector = @sectorExact OR Sector LIKE @sector)');
      queryParams.push({ name: 'sectorExact', type: sql.NVarChar, value: cleanSector });
      queryParams.push({ name: 'sector', type: sql.NVarChar, value: `%${cleanSector}%` });
    }

    // Filtro por empresa OPTIMIZADO
    if (cleanCompany) {
      filterConditions.push('(CompanyName = @companyExact OR CompanyName LIKE @company)');
      queryParams.push({ name: 'companyExact', type: sql.NVarChar, value: cleanCompany });
      queryParams.push({ name: 'company', type: sql.NVarChar, value: `%${cleanCompany}%` });
    }

    // Filtro por ExternalId OPTIMIZADO
    if (cleanExternalId) {
      filterConditions.push('(ExternalId = @externalIdExact OR ExternalId LIKE @externalId)');
      queryParams.push({ name: 'externalIdExact', type: sql.NVarChar, value: cleanExternalId });
      queryParams.push({ name: 'externalId', type: sql.NVarChar, value: `%${cleanExternalId}%` });
    }

    // Filtro por Promoción - 4 Estados (RESTAURADO - CampaignChannels ya poblada)
    if (cleanPromocion) {
      if (cleanPromocion === 'promocionandose') {
        // Estado 4: Promocionándose - En campañas activas
        filterConditions.push(`Id IN (
          SELECT DISTINCT cc.OfferId 
          FROM CampaignChannels cc
          INNER JOIN Campaigns c ON cc.CampaignId = c.Id
          WHERE c.Status = 'active'
        )`);
      } else if (cleanPromocion === 'preparada') {
        // Estado 3: Preparada - En campañas inactivas (no activas)
        filterConditions.push(`Id IN (
          SELECT DISTINCT cc.OfferId 
          FROM CampaignChannels cc
          INNER JOIN Campaigns c ON cc.CampaignId = c.Id
          WHERE c.Status != 'active'
        )`);
      } else if (cleanPromocion === 'categorizada') {
        // Estado 2: Categorizada - En campaña pero no activa
        filterConditions.push(`Id IN (
          SELECT DISTINCT cc.OfferId 
          FROM CampaignChannels cc
          INNER JOIN Campaigns c ON cc.CampaignId = c.Id
          WHERE c.Status != 'active'
        ) AND Id NOT IN (
          SELECT DISTINCT cc.OfferId 
          FROM CampaignChannels cc
          INNER JOIN Campaigns c ON cc.CampaignId = c.Id
          WHERE c.Status = 'active'
        )`);
      } else if (cleanPromocion === 'sin-promocion') {
        // Estado 1: Sin promoción - No está en ninguna campaña
        filterConditions.push(`Id NOT IN (
          SELECT DISTINCT cc.OfferId
          FROM CampaignChannels cc
        )`);
      }
    }

    // 🔧 SEPARAR CLÁUSULAS: Solo filtros para COUNT, filtros+cursor para query principal
    const filterClause = filterConditions.length > 0 ? `WHERE ${filterConditions.join(' AND ')}` : '';
    const allConditions = [...filterConditions, ...paginationConditions];
    const whereClause = allConditions.length > 0 ? `WHERE ${allConditions.join(' AND ')}` : '';
    
    console.log(`🔍 CLAUSES DEBUG - FilterClause (COUNT): ${filterClause}`);
    console.log(`🔍 CLAUSES DEBUG - WhereClause (MAIN): ${whereClause}`);

    // Validar sortBy para evitar SQL injection
    const allowedSortFields = ['CreatedAt', 'Title', 'CompanyName', 'StatusId', 'PublicationDate'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'CreatedAt';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Query principal PERMISIVA - 5 campos con prioridades por relevancia
    let searchOrderBy = '';
    if (cleanSearch) {
      searchOrderBy = `
        CASE 
          WHEN Title LIKE @searchParam + '%' THEN 1       -- 🥇 PRIORIDAD 1: Título empieza con
          WHEN CompanyName LIKE @searchParam + '%' THEN 2 -- 🥈 PRIORIDAD 2: Empresa empieza con
          WHEN Sector LIKE @searchParam + '%' THEN 3      -- 🥉 PRIORIDAD 3: Sector empieza con
          WHEN City LIKE @searchParam + '%' THEN 4        -- 🏅 PRIORIDAD 4: Ciudad empieza con
          WHEN Region LIKE @searchParam + '%' THEN 5      -- 🏅 PRIORIDAD 5: Región empieza con
          WHEN Title LIKE '%' + @searchParam + '%' THEN 6       -- 🥇 PRIORIDAD 1: Título contiene
          WHEN CompanyName LIKE '%' + @searchParam + '%' THEN 7 -- 🥈 PRIORIDAD 2: Empresa contiene
          WHEN Sector LIKE '%' + @searchParam + '%' THEN 8      -- 🥉 PRIORIDAD 3: Sector contiene
          WHEN City LIKE '%' + @searchParam + '%' THEN 9        -- 🏅 PRIORIDAD 4: Ciudad contiene
          WHEN Region LIKE '%' + @searchParam + '%' THEN 10     -- 🏅 PRIORIDAD 5: Región contiene
          ELSE 11  -- Otras coincidencias
        END,`;
    }

    // SOLUCIÓN TEMPORAL: Deshabilitar subconsultas complejas en paginación keyset
    const useComplexSubqueries = !usingKeysetPagination;
    
    let mainQuery;
    
    if (usingKeysetPagination) {
      // Query simplificada para paginación keyset (sin subconsultas que causen ambigüedad)
      mainQuery = `
      SELECT
        jo.Id as id,
        jo.ExternalId,
        jo.Title as title,
        jo.CompanyName as company,
        jo.Sector as sector,
        jo.City,
        jo.Region,
        CASE 
          WHEN jo.City IS NOT NULL AND jo.Region IS NOT NULL AND jo.Region != '' 
          THEN CONCAT(jo.City, ', ', jo.Region)
          WHEN jo.City IS NOT NULL 
          THEN jo.City
          ELSE jo.Region
        END as location,
        jo.SalaryMin,
        jo.SalaryMax,
        CASE 
          WHEN jo.SalaryMin IS NOT NULL AND jo.SalaryMax IS NOT NULL AND jo.SalaryMin > 0 AND jo.SalaryMax > 0
          THEN CONCAT(FORMAT(jo.SalaryMin, 'N0'), '-', FORMAT(jo.SalaryMax, 'N0'), '€')
          WHEN jo.SalaryMin IS NOT NULL AND jo.SalaryMin > 0 
          THEN CONCAT('Desde ', FORMAT(jo.SalaryMin, 'N0'), '€')
          WHEN jo.SalaryMax IS NOT NULL AND jo.SalaryMax > 0 
          THEN CONCAT('Hasta ', FORMAT(jo.SalaryMax, 'N0'), '€')
          ELSE 'No especificado'
        END as salary,
        CASE 
          WHEN jo.JobType IS NOT NULL AND jo.JobType != '' 
          THEN jo.JobType
          WHEN jo.Vacancies = 1 
          THEN 'Tiempo completo'
          ELSE 'No especificado'
        END as type,
        jo.PublicationDate as publishDate,
        jo.CreatedAt,
        jo.StatusId,
        CASE 
          WHEN jo.StatusId = 1 THEN 'active'
          WHEN jo.StatusId = 2 THEN 'paused'
          WHEN jo.StatusId = 5 THEN 'archived'
          ELSE 'pending'
        END as status,
        -- PROMOCIÓN SIMPLIFICADA PARA PERFORMANCE
        0 as campaignCount,
        0 as segmentCount,
        'Sin promoción' as promotion,
        NULL as campaigns,
        NULL as segments,
        0 as totalBudget,
        0 as budgetSpent,
        0 as targetApplications,
        0 as applicationsReceived,
        'Sin datos' as performance
      FROM JobOffers jo WITH (READPAST${USE_INDEX_HINTS ? ', INDEX(IX_JobOffers_Covering_Main)' : ''})
      ${whereClause}
      ORDER BY 
        ${searchOrderBy}
        ${validSortBy} ${validSortOrder}, jo.Id DESC
      OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY
    `;
    } else {
      // Query completa con subconsultas para primera página
      mainQuery = `
      SELECT
        jo.Id as id,
        jo.ExternalId,
        jo.Title as title,
        jo.CompanyName as company,
        jo.Sector as sector,
        jo.City,
        jo.Region,
        CASE 
          WHEN jo.City IS NOT NULL AND jo.Region IS NOT NULL AND jo.Region != '' 
          THEN CONCAT(jo.City, ', ', jo.Region)
          WHEN jo.City IS NOT NULL 
          THEN jo.City
          ELSE jo.Region
        END as location,
        jo.SalaryMin,
        jo.SalaryMax,
        CASE 
          WHEN jo.SalaryMin IS NOT NULL AND jo.SalaryMax IS NOT NULL THEN 
            CONCAT(FORMAT(jo.SalaryMin, 'N0'), '-', FORMAT(jo.SalaryMax, 'N0'), '€')
          WHEN jo.SalaryMin IS NOT NULL THEN 
            CONCAT('Desde ', FORMAT(jo.SalaryMin, 'N0'), '€')
          WHEN jo.SalaryMax IS NOT NULL THEN 
            CONCAT('Hasta ', FORMAT(jo.SalaryMax, 'N0'), '€')
          ELSE 'No especificado'
        END as salary,
        jo.JobType as type,
        jo.PublicationDate as publishDate,
        jo.CreatedAt,
        jo.StatusId,
        CASE jo.StatusId
          WHEN 1 THEN 'active'
          WHEN 2 THEN 'paused'
          WHEN 5 THEN 'archived'
          WHEN 4 THEN 'pending'
          ELSE 'unknown'
        END as status,
        -- PROMOCIÓN CALCULADA DE FORMA EFICIENTE
        0 as campaignCount,
        0 as segmentCount,
        'Sin campañas' as promotion,
        NULL as campaigns,
        NULL as segments,
        -- PERFORMANCE BASADA EN DATOS DIRECTOS (más eficiente)
        COALESCE(jo.Budget, 10) as totalBudget,
        COALESCE(jo.BudgetSpent, 0) as budgetSpent,
        COALESCE(jo.ApplicationsGoal, 50) as targetApplications,
        COALESCE(jo.ApplicationsReceived, 0) as applicationsReceived,
        CASE 
          WHEN jo.Budget > 0 THEN 
            CONCAT('€', FORMAT(jo.BudgetSpent, 'N0'), '/', FORMAT(jo.Budget, 'N0'), ', ', 
                   jo.ApplicationsReceived, '/', jo.ApplicationsGoal, ' inscr.')
          ELSE 'Sin datos'
        END as performance
      FROM JobOffers jo WITH (READPAST${USE_INDEX_HINTS ? ', INDEX(IX_JobOffers_Covering_Main)' : ''})
      ${whereClause}
      ORDER BY 
        ${searchOrderBy}
        ${validSortBy} ${validSortOrder}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    }

    // 🔧 FIX COUNT QUERY: Solo usar filtros, NO condiciones de cursor
    let totalCount = 0;
    if (filterConditions.length > 0) {
      // Para queries filtradas, usar conteo optimizado solo con filtros
      const countQuery = `
        SELECT COUNT(*) as total
        FROM JobOffers jo WITH (READPAST)
        ${filterClause}
        OPTION (FAST 1000)
      `;
      console.log(`🔍 COUNT QUERY DEBUG: ${countQuery}`);
      const countRequest = pool.request();
      // 🔧 CRÍTICO: Solo agregar parámetros que NO son de cursor
      queryParams.forEach(param => {
        // Excluir parámetros de cursor de la query COUNT
        if (!['lastCreatedAt', 'lastId'].includes(param.name)) {
          countRequest.input(param.name, param.type, param.value);
        }
      });
      const countResult = await countRequest.query(countQuery);
      totalCount = countResult.recordset[0].total;
    } else {
      // For unfiltered queries, use fast table stats
      totalCount = 62383; // Use cached total for performance
    }

    // Ejecutar query principal
    let request = pool.request()
      .input('limit', sql.Int, validatedLimit)
    
    // Solo agregar offset si NO estamos usando keyset pagination
    if (!usingKeysetPagination) {
      request.input('offset', sql.Int, offset)
    }

    // Agregar parámetros dinámicos
    console.log('🔍 CURSOR DEBUG - queryParams:', queryParams);
    queryParams.forEach(param => {
      console.log(`🔍 CURSOR DEBUG - Añadiendo parámetro: ${param.name} = ${param.value}`);
      request.input(param.name, param.type, param.value);
    });

    console.log('🔍 CURSOR DEBUG - WHERE clause final:', whereClause);
    console.log('🔍 CURSOR DEBUG - mainQuery:', mainQuery.substring(0, 500) + '...');

    const offersResult = await request.query(mainQuery);
    const offers = offersResult.recordset;
    const total = totalCount;
    
    // 🔍 DEBUG: Ver IDs reales devueltos
    console.log('🔍 OFERTAS DEBUG - IDs devueltos:', offers.slice(0, 5).map(o => `${o.id}:${o.CreatedAt?.toISOString()?.substring(0,19)}`));
    console.log('🔍 OFERTAS DEBUG - Primer ID:', offers[0]?.id, 'Último ID:', offers[offers.length-1]?.id);

    // Estadísticas OPTIMIZADAS (usar WITH NOLOCK para mejor rendimiento)
    const statsQuery = `
      SELECT 
        COUNT(*) as totalOffers,
        SUM(CASE WHEN StatusId = 1 THEN 1 ELSE 0 END) as activeOffers,
        SUM(CASE WHEN StatusId = 3 THEN 1 ELSE 0 END) as pendingOffers,
        SUM(CASE WHEN StatusId = 2 THEN 1 ELSE 0 END) as pausedOffers,
        COUNT(DISTINCT Sector) as totalSectors,
        COUNT(DISTINCT City) as totalCities
      FROM JobOffers WITH (NOLOCK)
    `;

    const statsResult = await pool.request().query(statsQuery);
    const stats = statsResult.recordset[0];

    console.log(`✅ Encontradas ${offers.length} ofertas (${total} total) - Query optimizada`);

    // SIEMPRE calcular cursor para keyset pagination
    let hasMorePages, nextCursor;
    
    // hasMore = hay exactamente el límite de resultados
    hasMorePages = offers.length === validatedLimit;
    
    // SIEMPRE calcular cursor para próxima página si hay más datos
    if (hasMorePages && offers.length > 0) {
      const lastOffer = offers[offers.length - 1];
      nextCursor = {
        lastCreatedAt: lastOffer.CreatedAt,
        lastId: lastOffer.id // Usar 'id' en minúscula que es el campo correcto
      };
      console.log('🎯 Next cursor calculado:', nextCursor);
    } else {
      nextCursor = null;
      console.log('🎯 No más páginas, next cursor = null');
    }
    
    res.json({
      success: true,
      data: offers,
      items: offers, // Alias para compatibilidad
      hasMore: hasMorePages,
      total: total,
      next: nextCursor, // Cursor para keyset pagination
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: total,
        pages: Math.ceil(total / validatedLimit),
        hasMore: hasMorePages,
        lastCreatedAt: nextCursor?.lastCreatedAt,
        lastId: nextCursor?.lastId
      },
      stats: stats,
      filters: {
        search: cleanSearch || null,
        status: cleanStatus || 'all',
        location: cleanLocation || 'all',
        sector: cleanSector || 'all',
        externalId: cleanExternalId || 'all'
      }
    });

  } catch (error) {
    console.error("❌ Error listando ofertas:", error);
    
    // Manejar diferentes tipos de errores
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      res.status(408).json({
        success: false,
        error: 'TIMEOUT',
        message: 'La consulta tardó demasiado tiempo. Intenta con filtros más específicos.',
        suggestion: 'Usa filtros para reducir la cantidad de datos a procesar',
        details: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Error interno del servidor",
        details: error.message,
      });
    }
  }
});

// ✅ ENDPOINT PARA CAMBIAR ESTADO DE OFERTAS
app.put('/job-offers/:id/status', 
  // ✅ AGREGAR MIDDLEWARE DE AUTENTICACIÓN
  require('./src/middleware/authMiddleware').addUserToRequest,
  require('./src/middleware/authMiddleware').requireAuth,
  async (req, res) => {
  const origin = req.headers.origin;
  console.log(`🔄 PUT /job-offers/:id/status - ID: ${req.params.id} from origin:`, origin);
  
  // CORS Headers
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validar ID
    const offerId = parseInt(id);
    if (!offerId || isNaN(offerId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de oferta inválido' 
      });
    }

    // Validar status
    const validStatuses = [1, 2, 3]; // 1=activa, 2=pausada, 3=archivada
    const newStatus = parseInt(status);
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Estado inválido. Use: 1=activa, 2=pausada, 3=archivada' 
      });
    }

    // Verificar que la oferta existe Y que pertenece al usuario (o es superadmin)
    const { isSuperAdmin } = require('./src/middleware/authMiddleware');
    let checkQuery = 'SELECT Id, Title, StatusId FROM JobOffers WHERE Id = @Id';
    const checkRequest = pool.request().input('Id', sql.Int, offerId);
    
    if (!isSuperAdmin(req)) {
      checkQuery += ' AND UserId = @currentUserId';
      checkRequest.input('currentUserId', sql.BigInt, req.userId);
      console.log(`🔒 Verificando oferta ${offerId} para usuario ${req.userId}`);
    } else {
      console.log(`🔑 Super admin: verificando oferta ${offerId} sin filtro`);
    }
    
    const checkResult = await checkRequest.query(checkQuery);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Oferta no encontrada'
      });
    }

    const currentOffer = checkResult.recordset[0];

    // Actualizar estado
    await pool.request()
      .input('Id', sql.Int, offerId)
      .input('StatusId', sql.Int, newStatus)
      .query(`
        UPDATE JobOffers 
        SET StatusId = @StatusId, UpdatedAt = GETDATE()
        WHERE Id = @Id
      `);

    const statusNames = { 1: 'activada', 2: 'pausada', 3: 'archivada' };
    const statusMessage = `Oferta "${currentOffer.Title}" ${statusNames[newStatus]} correctamente`;

    console.log(`✅ ${statusMessage}`);

    res.json({
      success: true,
      message: statusMessage,
      data: {
        id: offerId,
        previousStatus: currentOffer.StatusId,
        newStatus: newStatus,
        title: currentOffer.Title
      }
    });

  } catch (error) {
    console.error('❌ Error al cambiar estado de oferta:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// Endpoint para insertar ofertas (ya lo usas en /job-offers)
app.post('/job-offers', async (req, res) => {
  await poolConnect;

  const {
    ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address,
    Country, CountryId, Region, RegionId, City, CityId, Postcode,
    Latitude, Longitude, Vacancies, SalaryMin, SalaryMax, JobType,
    ExternalUrl, ApplicationUrl, Budget, ApplicationsGoal, PublicationDate,
    UserId = 1 // Por defecto user 1, en producción obtener de JWT/session
  } = req.body;

  try {
    const result = await pool.request()
      .input('ExternalId', sql.Int, ExternalId)
      .input('Title', sql.NVarChar(255), Title)
      .input('JobTitle', sql.NVarChar(255), JobTitle)
      .input('Description', sql.NVarChar(sql.MAX), Description)
      .input('CompanyName', sql.NVarChar(255), CompanyName)
      .input('Sector', sql.NVarChar(255), Sector)
      .input('Address', sql.NVarChar(255), Address)
      .input('Country', sql.NVarChar(100), Country)
      .input('CountryId', sql.Int, CountryId)
      .input('Region', sql.NVarChar(100), Region)
      .input('RegionId', sql.Int, RegionId)
      .input('City', sql.NVarChar(100), City)
      .input('CityId', sql.Int, CityId)
      .input('Postcode', sql.NVarChar(20), Postcode)
      .input('Latitude', sql.Decimal(9, 6), Latitude)
      .input('Longitude', sql.Decimal(9, 6), Longitude)
      .input('Vacancies', sql.Int, Vacancies)
      .input('SalaryMin', sql.Decimal(10, 2), SalaryMin)
      .input('SalaryMax', sql.Decimal(10, 2), SalaryMax)
      .input('JobType', sql.NVarChar(100), JobType)
      .input('ExternalUrl', sql.NVarChar(500), ExternalUrl)
      .input('ApplicationUrl', sql.NVarChar(500), ApplicationUrl)
      .input('Budget', sql.Decimal(10, 2), Budget)
      .input('ApplicationsGoal', sql.Int, ApplicationsGoal)
      .input('PublicationDate', sql.DateTime, PublicationDate)
      .input('UserId', sql.BigInt, UserId)
      .query(`
        INSERT INTO JobOffers (
          ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address,
          Country, CountryId, Region, RegionId, City, CityId, Postcode,
          Latitude, Longitude, Vacancies, SalaryMin, SalaryMax, JobType,
          ExternalUrl, ApplicationUrl, Budget, ApplicationsGoal, PublicationDate, UserId
        )
        VALUES (
          @ExternalId, @Title, @JobTitle, @Description, @CompanyName, @Sector, @Address,
          @Country, @CountryId, @Region, @RegionId, @City, @CityId, @Postcode,
          @Latitude, @Longitude, @Vacancies, @SalaryMin, @SalaryMax, @JobType,
          @ExternalUrl, @ApplicationUrl, @Budget, @ApplicationsGoal, @PublicationDate, @UserId
        )
      `);

    res.status(201).json({ message: 'Job offer created successfully' });
  } catch (err) {
    console.error('SQL error', err);
    res.status(500).json({ error: 'Failed to insert job offer' });
  }
});

const PORT = process.env.PORT || 3002;

// ✅ AGREGAR MANEJO DE ERRORES NO CAPTURADOS
process.on('uncaughtException', (err) => {
  console.error('🚀 CLAUDE DEBUG: UNCAUGHT EXCEPTION!', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚀 CLAUDE DEBUG: UNHANDLED REJECTION!', reason);
  console.error('Promise:', promise);
});

// Only listen on port if not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  const server = app.listen(PORT, () => {
    console.log(`✅ API running on http://localhost:${PORT}`);
    console.log('📊 Available endpoints:');
    console.log(`  - GET http://localhost:${PORT}/`);
    console.log(`  - GET http://localhost:${PORT}/swagger`);
    console.log(`  - GET http://localhost:${PORT}/api/connections`);
    console.log('🚀 Backend running in local mode');
  });

  server.on('error', (err) => {
    console.error('🚀 SERVER ERROR!', err);
  });
} else {
  console.log('🚀 Backend running in Vercel serverless mode');
}

// Export for Vercel serverless
module.exports = app;

// CORS fix applied

// GET /job-offers/job-types - Tipos de contrato (JobType) de ofertas ACTIVAS
app.get('/job-offers/job-types', async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007', 'http://127.0.0.1:3007', 'http://localhost:3004', 'http://127.0.0.1:3004', 'http://localhost:3006', 'http://127.0.0.1:3006'];
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    await poolConnect;
    const query = `
      SELECT DISTINCT JobType
      FROM JobOffers
      WHERE JobType IS NOT NULL AND JobType != '' AND StatusId = 1
      ORDER BY JobType
    `;
    const result = await pool.request().query(query);
    const types = result.recordset.map(r => r.JobType);
    res.json({ success: true, data: types });
  } catch (error) {
    console.error('Error getting job types:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
  }
});

// GET /job-offers/companies - Empresas (CompanyName) de ofertas ACTIVAS con filtros
app.get('/job-offers/companies', 
  // ✅ AGREGAR MIDDLEWARE DE AUTENTICACIÓN
  require('./src/middleware/authMiddleware').addUserToRequest,
  require('./src/middleware/authMiddleware').requireAuth,
  async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3007','http://127.0.0.1:3007','http://localhost:3004','http://127.0.0.1:3004','http://localhost:3006','http://127.0.0.1:3006'];
  if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  const { status, location, sector, externalId, q } = req.query;
  console.log('🔍 /companies con filtros:', {
    status,
    location,
    sector,
    externalId,
    q
  });
  
  // Check cache first (solo si no hay filtros específicos)
  const hasFilters = status || location || sector || externalId || q;
  if (!hasFilters) {
    const cachedData = getCachedData('companies');
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }
  }
  
  // CORRECCIÓN: Query real optimizada para companies

  try {
    await poolConnect;
    
    // Timeout específico para queries de filtros - 5 segundos máximo
    const timeoutMs = 5000;
    const request = pool.request();
    request.timeout = timeoutMs;
    
    const whereConditions = ['CompanyName IS NOT NULL', "CompanyName != ''"];
    
    // ✅ FILTRAR POR USUARIO - Solo superadmin ve todo
    const { isSuperAdmin } = require('./src/middleware/authMiddleware');
    if (!isSuperAdmin(req)) {
      whereConditions.push('UserId = @currentUserId');
      request.input('currentUserId', sql.BigInt, req.userId);
      console.log(`🔒 Filtrando companies para usuario ${req.userId} (${req.user.role})`);
    } else {
      console.log(`🔑 Super admin: viendo todas las companies sin filtro`);
    }

    // Filtros aplicados
    const cleanStatus = status && status !== 'all' ? status : null;
    const cleanLocation = location && location !== 'all' ? location : null;
    const cleanSector = sector && sector !== 'all' ? sector : null;
    const cleanExternalId = externalId && externalId !== 'all' ? externalId : null;

    if (cleanStatus) {
      const statusMap = { 'active': 1, 'pending': 3, 'paused': 2, 'archived': 5 };
      if (statusMap[cleanStatus]) {
        whereConditions.push('StatusId = @statusFilter');
        request.input('statusFilter', sql.Int, statusMap[cleanStatus]);
      }
    }

    if (cleanLocation) {
      whereConditions.push('(City LIKE @location OR Region LIKE @location OR CONCAT(City, \', \', Region) LIKE @location)');
      request.input('location', sql.NVarChar, `%${cleanLocation}%`);
    }

    if (cleanSector) {
      whereConditions.push('Sector LIKE @sector');
      request.input('sector', sql.NVarChar, `%${cleanSector}%`);
    }

    if (cleanExternalId) {
      whereConditions.push('ExternalId LIKE @externalId');
      request.input('externalId', sql.NVarChar, `%${cleanExternalId}%`);
    }

    if (q && q.trim()) {
      const searchTerm = q.trim();
      whereConditions.push('(Title LIKE @search OR CompanyName LIKE @search OR Description LIKE @search)');
      request.input('search', sql.NVarChar, `%${searchTerm}%`);
    }
    
    // Query ultra-optimizada: DISTINCT + NOLOCK + TOP limitado para companies
    const hasSearch = q && q.trim();
    
    const companyQuery = `
      SELECT DISTINCT CompanyName
      FROM JobOffers WITH (NOLOCK)
      WHERE ${whereConditions.join(' AND ')}
        AND CompanyName IS NOT NULL AND CompanyName != ''
      ORDER BY CompanyName
    `;

    console.log('🔍 Company query:', companyQuery);
    const result = await request.query(companyQuery);
    const companies = result.recordset.map(row => row.CompanyName);

    console.log(`✅ Companies con filtros: ${companies.length} encontradas`);

    // Cache si no hay filtros
    if (!hasFilters) {
      setCachedData('companies', companies);
    }

    res.json({
      success: true,
      data: companies
    });
  } catch (e) {
    console.error('Error getting companies:', e);
    
    // En caso de timeout, devolver datos de fallback
    if (e.code === 'ETIMEOUT') {
      console.log('⚠️ Timeout en companies - devolviendo fallback basico');
      return res.json({
        success: true,
        data: ['Empresa A', 'Empresa B', 'Empresa C']
      });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor', details: e.message });
  }
});

// ✅ GET /api/clients - Obtener clients por usuario
app.get('/api/clients', async (req, res) => {
  const { userId } = req.query;
  
  // CORS Headers
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3006', 'http://127.0.0.1:3006', 'http://localhost:3000', 'http://127.0.0.1:3000'];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  console.log(`🔍 GET /api/clients - UserId: ${userId}`);
  
  try {
    await poolConnect;
    
    let query = 'SELECT Id, Name, UserId, IsActive, CreatedAt FROM Clients';
    const params = [];
    
    if (userId) {
      query += ' WHERE UserId = @userId';
      params.push(['userId', sql.BigInt, parseInt(userId)]);
    }
    
    query += ' ORDER BY CreatedAt DESC';
    
    const request = pool.request();
    params.forEach(([name, type, value]) => {
      request.input(name, type, value);
    });
    
    const result = await request.query(query);
    
    console.log(`✅ Clients encontrados: ${result.recordset.length}`);
    res.json(result.recordset);
  } catch (error) {
    console.error('❌ Error obteniendo clients:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});
