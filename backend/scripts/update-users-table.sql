-- Script para actualizar la tabla Users con soporte para autenticación por contraseña
-- Ejecutar con: sqlcmd -S localhost,50057 -U sa -P password -i "C:\Dev\job-platform\backend\scripts\update-users-table.sql"

USE JobPlatformDB;
GO

-- Verificar si la tabla Users existe
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    PRINT '❌ La tabla Users no existe. Creándola...'
    
    CREATE TABLE Users (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        Name NVARCHAR(255) NOT NULL,
        PasswordHash NVARCHAR(255) NULL, -- Para autenticación tradicional
        Image NVARCHAR(500) NULL,
        GoogleId NVARCHAR(100) NULL, -- Para autenticación Google
        Role NVARCHAR(50) NOT NULL DEFAULT 'user',
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    PRINT '✅ Tabla Users creada exitosamente'
END
ELSE
BEGIN
    PRINT '📋 La tabla Users ya existe. Verificando columnas...'
    
    -- Agregar columna PasswordHash si no existe
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'PasswordHash')
    BEGIN
        ALTER TABLE Users ADD PasswordHash NVARCHAR(255) NULL;
        PRINT '✅ Columna PasswordHash agregada'
    END
    ELSE
    BEGIN
        PRINT '📋 Columna PasswordHash ya existe'
    END
    
    -- Agregar columna GoogleId si no existe
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'GoogleId')
    BEGIN
        ALTER TABLE Users ADD GoogleId NVARCHAR(100) NULL;
        PRINT '✅ Columna GoogleId agregada'
    END
    ELSE
    BEGIN
        PRINT '📋 Columna GoogleId ya existe'
    END
    
    -- Agregar columna Image si no existe
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Image')
    BEGIN
        ALTER TABLE Users ADD Image NVARCHAR(500) NULL;
        PRINT '✅ Columna Image agregada'
    END
    ELSE
    BEGIN
        PRINT '📋 Columna Image ya existe'
    END
    
    -- Agregar columna Role si no existe
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Role')
    BEGIN
        ALTER TABLE Users ADD Role NVARCHAR(50) NOT NULL DEFAULT 'user';
        PRINT '✅ Columna Role agregada'
    END
    ELSE
    BEGIN
        PRINT '📋 Columna Role ya existe'
    END
    
    -- Agregar columna IsActive si no existe
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'IsActive')
    BEGIN
        ALTER TABLE Users ADD IsActive BIT NOT NULL DEFAULT 1;
        PRINT '✅ Columna IsActive agregada'
    END
    ELSE
    BEGIN
        PRINT '📋 Columna IsActive ya existe'
    END
END

-- Crear índices si no existen
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Email')
BEGIN
    CREATE UNIQUE INDEX IX_Users_Email ON Users(Email);
    PRINT '✅ Índice IX_Users_Email creado'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_GoogleId')
BEGIN
    CREATE INDEX IX_Users_GoogleId ON Users(GoogleId);
    PRINT '✅ Índice IX_Users_GoogleId creado'
END

-- Verificar estructura final
PRINT '📊 Estructura final de la tabla Users:'
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Users'
ORDER BY ORDINAL_POSITION;

PRINT '🎉 Script completado exitosamente'