-- Crear tabla para cache de respuestas API
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ApiResponseCache' AND xtype='U')
BEGIN
    CREATE TABLE ApiResponseCache (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ConnectionId INT NOT NULL,
        CacheData NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETDATE(),

        FOREIGN KEY (ConnectionId) REFERENCES Connections(id)
    );

    -- Índice para búsquedas rápidas
    CREATE INDEX IX_ApiResponseCache_ConnectionId ON ApiResponseCache(ConnectionId);

    PRINT '✅ ApiResponseCache table created successfully';
END
ELSE
BEGIN
    PRINT '⚠️ ApiResponseCache table already exists';
END