const sql = require('mssql');

const config = {
  user: 'jobplatform',
  password: 'JobPlatform2025!',
  server: 'localhost',
  database: 'JobPlatform',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

sql.connect(config).then(() => {
  console.log('=== ESTRUCTURA DE LA TABLA CONNECTIONS ===');
  return sql.query`SELECT TOP 1 * FROM Connections WHERE UserId = 11`;
}).then(result => {
  if (result.recordset.length > 0) {
    console.log('Columnas disponibles:', Object.keys(result.recordset[0]));
    console.log('Primer registro:', result.recordset[0]);
  }

  return sql.query`SELECT TOP 5 * FROM Connections WHERE UserId = 11 ORDER BY CreatedAt DESC`;
}).then(result => {
  console.log('\n=== ÚLTIMAS 5 CONEXIONES DEL USUARIO 11 ===');
  result.recordset.forEach(conn => {
    console.log('Registro completo:', conn);
    console.log('---');
  });
  sql.close();
}).catch(err => {
  console.error('Error:', err);
  sql.close();
});