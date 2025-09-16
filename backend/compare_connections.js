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

async function compareConnections() {
  try {
    await sql.connect(config);

    console.log('🔍 COMPARING CONNECTIONS 2094 (WORKING) vs 2097 (FAILING)');

    const result = await sql.query`
      SELECT id, name, url, Method, Headers, Body, SourceType, Endpoint
      FROM Connections
      WHERE id IN (2094, 2097)
      ORDER BY id
    `;

    result.recordset.forEach(conn => {
      console.log(`\n📋 CONNECTION ${conn.id} - ${conn.name}:`);
      console.log(`URL: ${conn.url}`);
      console.log(`Method: ${conn.Method}`);
      console.log(`Headers: ${conn.Headers}`);
      console.log(`Body: ${conn.Body}`);
      console.log(`SourceType: ${conn.SourceType}`);
      console.log(`Endpoint: ${conn.Endpoint}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
  }
}

compareConnections();