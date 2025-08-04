require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function testConnection() {
  try {
    let pool = await sql.connect(config);
    let result = await pool.request().query('SELECT 1 as test');
    console.log('Conexión exitosa:', result.recordset);
    await pool.close();
  } catch (err) {
    console.error('Error de conexión:', err.message);
  }
}

testConnection();