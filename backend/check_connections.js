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
  return sql.query`SELECT TOP 5 * FROM Connections WHERE UserId = 11 ORDER BY CreatedAt DESC`;
}).then(result => {
  console.log('=== ÚLTIMAS 5 CONEXIONES DEL USUARIO 11 ===');
  result.recordset.forEach(conn => {
    console.log(`ID: ${conn.Id}`);
    console.log(`Nombre: ${conn.Name}`);
    console.log(`Tipo: ${conn.Type}`);
    console.log(`URL API: ${conn.ApiEndpoint || 'N/A'}`);
    console.log(`URL XML: ${conn.XmlUrl || 'N/A'}`);
    console.log(`Fecha: ${conn.CreatedAt}`);
    console.log('---');
  });
  sql.close();
}).catch(err => {
  console.error('Error:', err);
  sql.close();
});