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

async function fixConnection2097() {
  try {
    await sql.connect(config);

    console.log('🔧 FIXING CONNECTION 2097 - Adding missing Body payload');

    const correctBody = '{"userId":null,"page":{"index":1,"size":8,"featuredSize":4,"difussionSize":2},"filter":{}}';

    await sql.query`
      UPDATE Connections
      SET Body = ${correctBody}
      WHERE id = 2097
    `;

    console.log('✅ Connection 2097 fixed with correct Body payload');
    console.log('🚀 Now the import should work!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
  }
}

fixConnection2097();