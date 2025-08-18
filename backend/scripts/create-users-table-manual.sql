-- Script para crear tabla Users manualmente
-- Ejecutar en SQL Server Management Studio con permisos de administrador

USE JobPlatformDB;
GO

-- Crear tabla Users si no existe
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        FirstName NVARCHAR(255) NOT NULL,
        LastName NVARCHAR(255) NOT NULL,
        Company NVARCHAR(255) NOT NULL,
        Website NVARCHAR(500) NULL,
        Phone NVARCHAR(50) NOT NULL,
        PasswordHash NVARCHAR(255) NULL,
        GoogleId NVARCHAR(100) NULL,
        Image NVARCHAR(500) NULL,
        Role NVARCHAR(50) NOT NULL DEFAULT 'user',
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    -- Crear índices
    CREATE UNIQUE INDEX IX_Users_Email ON Users(Email);
    CREATE INDEX IX_Users_GoogleId ON Users(GoogleId);
    CREATE INDEX IX_Users_Active ON Users(IsActive);

    PRINT '✅ Tabla Users creada exitosamente';
END
ELSE
BEGIN
    PRINT '📋 Tabla Users ya existe';
    
    -- Agregar columnas faltantes si no existen
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FirstName')
        ALTER TABLE Users ADD FirstName NVARCHAR(255) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'LastName')
        ALTER TABLE Users ADD LastName NVARCHAR(255) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Company')
        ALTER TABLE Users ADD Company NVARCHAR(255) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Website')
        ALTER TABLE Users ADD Website NVARCHAR(500) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Phone')
        ALTER TABLE Users ADD Phone NVARCHAR(50) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PasswordHash')
        ALTER TABLE Users ADD PasswordHash NVARCHAR(255) NULL;
    
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'GoogleId')
        ALTER TABLE Users ADD GoogleId NVARCHAR(100) NULL;
    
    PRINT '✅ Columnas faltantes agregadas a tabla Users';
END

-- Mostrar estructura final
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Users'
ORDER BY ORDINAL_POSITION;

PRINT '🎉 Script completado. Tabla Users lista para usar.';