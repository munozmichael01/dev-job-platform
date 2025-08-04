const express = require('express');
const { pool, poolConnect, sql } = require('./src/db/db');
const trackRoutes = require('./track');
const connectionsRouter = require('./src/routes/connections');
const mappingsRouter = require('./src/routes/mappings');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
require('dotenv').config();
const cors = require('cors');
const fileUpload = require('express-fileupload');
// require('./scheduler'); // Temporarily disabled for debugging

const app = express();
// Manual CORS middleware to ensure headers are set correctly
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('🔍 CORS Request from origin:', origin);
  
  // Allow specific origins
  const allowedOrigins = [
    'http://localhost:3007',
    'http://127.0.0.1:3007',
    'http://localhost:3004',
    'http://127.0.0.1:3004',
    'http://localhost:3006',
    'http://127.0.0.1:3006'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    console.log('✅ CORS: Allowed origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Origin,Accept');
  
  if (req.method === 'OPTIONS') {
    console.log('🔧 CORS: Handling preflight request');
    res.status(204).end();
    return;
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
app.use('/', trackRoutes);
// Logging middleware para debug
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`🔍 POST Request: ${req.path} (Full URL: ${req.url})`);
  }
  next();
});

console.log("🔧 Montando router en /api/connections");
app.use('/api/connections', connectionsRouter);
app.use('/api/mappings', mappingsRouter);

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

// Endpoint para insertar ofertas (ya lo usas en /job-offers)
app.post('/job-offers', async (req, res) => {
  await poolConnect;

  const {
    ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address,
    Country, CountryId, Region, RegionId, City, CityId, Postcode,
    Latitude, Longitude, Vacancies, SalaryMin, SalaryMax, JobType,
    ExternalUrl, ApplicationUrl, Budget, ApplicationsGoal, PublicationDate
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
      .query(`
        INSERT INTO JobOffers (
          ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address,
          Country, CountryId, Region, RegionId, City, CityId, Postcode,
          Latitude, Longitude, Vacancies, SalaryMin, SalaryMax, JobType,
          ExternalUrl, ApplicationUrl, Budget, ApplicationsGoal, PublicationDate
        )
        VALUES (
          @ExternalId, @Title, @JobTitle, @Description, @CompanyName, @Sector, @Address,
          @Country, @CountryId, @Region, @RegionId, @City, @CityId, @Postcode,
          @Latitude, @Longitude, @Vacancies, @SalaryMin, @SalaryMax, @JobType,
          @ExternalUrl, @ApplicationUrl, @Budget, @ApplicationsGoal, @PublicationDate
        )
      `);

    res.status(201).json({ message: 'Job offer created successfully' });
  } catch (err) {
    console.error('SQL error', err);
    res.status(500).json({ error: 'Failed to insert job offer' });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
  console.log('📊 Available endpoints:');
  console.log(`  - GET http://localhost:${PORT}/`);
  console.log(`  - GET http://localhost:${PORT}/swagger`);
  console.log(`  - GET http://localhost:${PORT}/api/connections`);
});// Force restart

// CORS fix applied
