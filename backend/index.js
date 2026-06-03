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
const jobOffersRouter = require('./src/routes/jobOffers');
const importOffersRouter = require('./src/routes/importOffers');
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
  'https://dev-job-platform.vercel.app',
  'https://dev-job-platform-frontend.vercel.app',
  'https://dev-job-platform-landing.vercel.app',
  'https://job-platform-frontend.vercel.app',
  'https://job-platform-landing.vercel.app',
  // Add prod domains via env: CORS_ORIGIN=https://app.example.com,https://landing.example.com
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [])
].map(origin => origin.trim()).filter(Boolean);

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
app.use('/', jobOffersRouter);
app.use('/api/import', importOffersRouter);

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

// ✅ GET /api/clients - Obtener clients por usuario
app.get('/api/clients', async (req, res) => {
  const { userId } = req.query;
  
  // CORS Headers
  const origin = req.headers.origin;
  // Reuse global allowedOrigins
  
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
