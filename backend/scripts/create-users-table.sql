-- 👥 Script para Crear Tabla de Usuarios
-- Ejecutar como administrador de SQL Server
-- Fecha: 2025-08-17

USE JobPlatformDB;
GO

-- Verificar contexto
SELECT 'Conectado a base de datos: ' + DB_NAME() as Status;
GO

-- Crear tabla Users si no existe
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        Name NVARCHAR(255) NOT NULL,
        Image NVARCHAR(500) NULL,
        GoogleId NVARCHAR(100) NULL UNIQUE,
        Role NVARCHAR(50) DEFAULT 'user',
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
    );
    
    PRINT '✅ Tabla Users creada exitosamente';
    
    -- Crear índices para performance
    CREATE INDEX IX_Users_Email ON Users (Email);
    CREATE INDEX IX_Users_GoogleId ON Users (GoogleId) WHERE GoogleId IS NOT NULL;
    CREATE INDEX IX_Users_IsActive ON Users (IsActive);
    
    PRINT '✅ Índices de Users creados';
END
ELSE
BEGIN
    PRINT '⚠️ Tabla Users ya existe';
END

-- Agregar UserId a tabla Campaigns si no existe
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Campaigns') AND name = 'UserId')
BEGIN
    ALTER TABLE Campaigns ADD UserId BIGINT NULL;
    PRINT '✅ Columna UserId agregada a Campaigns';
    
    -- Crear foreign key constraint
    ALTER TABLE Campaigns 
    ADD CONSTRAINT FK_Campaigns_Users 
    FOREIGN KEY (UserId) REFERENCES Users(Id);
    
    PRINT '✅ Foreign key constraint creada';
    
    -- Crear índice para performance
    CREATE INDEX IX_Campaigns_UserId ON Campaigns (UserId);
    PRINT '✅ Índice IX_Campaigns_UserId creado';
END
ELSE
BEGIN
    PRINT '⚠️ Columna UserId ya existe en Campaigns';
END

-- Agregar UserId a tabla UserChannelCredentials si no existe (debería existir pero verificamos)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UserChannelCredentials') AND name = 'UserId')
BEGIN
    ALTER TABLE UserChannelCredentials ADD UserId BIGINT NOT NULL DEFAULT 1;
    PRINT '✅ Columna UserId agregada a UserChannelCredentials';
ELSE
    PRINT '✅ Columna UserId ya existe en UserChannelCredentials';
END

-- Crear usuario de prueba si no existe
IF NOT EXISTS (SELECT * FROM Users WHERE Email = 'test@jobplatform.com')
BEGIN
    INSERT INTO Users (Email, Name, Role, IsActive, CreatedAt, UpdatedAt)
    VALUES ('test@jobplatform.com', 'Usuario de Prueba', 'admin', 1, GETDATE(), GETDATE());
    
    PRINT '✅ Usuario de prueba creado: test@jobplatform.com (ID: 1)';
END
ELSE
BEGIN
    PRINT '⚠️ Usuario de prueba ya existe';
END

-- Actualizar campañas existentes para asignarlas al usuario de prueba
UPDATE Campaigns 
SET UserId = 1 
WHERE UserId IS NULL;

PRINT '✅ Campañas existentes asignadas al usuario de prueba';

-- Mostrar resumen
SELECT 
    'Users' as Tabla,
    COUNT(*) as TotalRegistros
FROM Users

UNION ALL

SELECT 
    'Campaigns' as Tabla,
    COUNT(*) as TotalRegistros
FROM Campaigns

UNION ALL

SELECT 
    'UserChannelCredentials' as Tabla,
    COUNT(*) as TotalRegistros
FROM UserChannelCredentials;

PRINT '🎉 Script de usuarios completado exitosamente!';

GO