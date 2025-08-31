require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: 1433,
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'JobPlatform',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeout: 5000,
  requestTimeout: 10000,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false
  }
};

// Solo agregar port si está definido
if (process.env.DB_PORT && process.env.DB_PORT.trim() !== '') {
  config.port = parseInt(process.env.DB_PORT, 10);
}

const pool = new sql.ConnectionPool(config);
const poolPromise = pool.connect();

// Handle connection events
poolPromise.then(pool => {
  console.log('✅ Conexión a SQL Server establecida');
}).catch(err => {
  console.error('❌ Error conectando a SQL Server:', err);
});

// Handle connection errors
pool.on('error', err => {
  console.error('❌ SQL Server pool error:', err);
});

module.exports = {
  sql,
  pool,
  poolPromise,
  poolConnect: poolPromise
};