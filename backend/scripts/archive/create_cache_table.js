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

async function createCacheTable() {
  try {
    await sql.connect(config);

    const query = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ApiResponseCache' AND xtype='U')
      BEGIN
          CREATE TABLE ApiResponseCache (
              Id INT IDENTITY(1,1) PRIMARY KEY,
              ConnectionId INT NOT NULL,
              CacheData NVARCHAR(MAX) NOT NULL,
              CreatedAt DATETIME2 DEFAULT GETDATE(),

              FOREIGN KEY (ConnectionId) REFERENCES Connections(id)
          );

          CREATE INDEX IX_ApiResponseCache_ConnectionId ON ApiResponseCache(ConnectionId);

          PRINT '✅ ApiResponseCache table created successfully';
      END
      ELSE
      BEGIN
          PRINT '⚠️ ApiResponseCache table already exists';
      END
    `;

    const result = await sql.query(query);
    console.log('✅ Cache table setup completed');

  } catch (error) {
    console.error('❌ Error creating cache table:', error.message);
  } finally {
    await sql.close();
  }
}

createCacheTable();