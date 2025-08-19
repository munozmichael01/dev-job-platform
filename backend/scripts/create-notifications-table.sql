-- Script para crear la tabla Notifications
-- Sistema de notificaciones interno para límites y alertas

USE [JobPlatformDB]
GO

-- Verificar si la tabla ya existe
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications')
BEGIN
    CREATE TABLE [dbo].[Notifications] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [UserId] INT NULL,
        [CampaignId] INT NULL,
        [Type] NVARCHAR(50) NOT NULL,
        [Priority] NVARCHAR(20) NOT NULL DEFAULT 'medium',
        [Title] NVARCHAR(255) NOT NULL,
        [Message] NVARCHAR(1000) NOT NULL,
        [Data] NVARCHAR(MAX) NULL,
        [Context] NVARCHAR(MAX) NULL,
        [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [ReadAt] DATETIME NULL,
        [Acknowledged] BIT NOT NULL DEFAULT 0
    )
    
    -- Crear índices para performance
    CREATE INDEX [IX_Notifications_UserId] ON [dbo].[Notifications]([UserId])
    CREATE INDEX [IX_Notifications_CampaignId] ON [dbo].[Notifications]([CampaignId])
    CREATE INDEX [IX_Notifications_Type] ON [dbo].[Notifications]([Type])
    CREATE INDEX [IX_Notifications_CreatedAt] ON [dbo].[Notifications]([CreatedAt])
    CREATE INDEX [IX_Notifications_ReadAt] ON [dbo].[Notifications]([ReadAt])
    
    PRINT '✅ Tabla Notifications creada exitosamente'
END
ELSE
BEGIN
    PRINT '⚠️ La tabla Notifications ya existe'
END

-- Verificar si la columna InternalConfig existe en Campaigns
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('[dbo].[Campaigns]') 
    AND name = 'InternalConfig'
)
BEGIN
    ALTER TABLE [dbo].[Campaigns] 
    ADD [InternalConfig] NVARCHAR(MAX) NULL
    
    PRINT '✅ Columna InternalConfig agregada a tabla Campaigns'
END
ELSE
BEGIN
    PRINT '⚠️ La columna InternalConfig ya existe en Campaigns'
END

-- Mostrar estructura final de ambas tablas
PRINT '📋 Estructura de tabla Notifications:'
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Notifications'
ORDER BY ORDINAL_POSITION

PRINT '📋 Estructura de tabla Campaigns (columnas relevantes):'
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Campaigns' 
    AND COLUMN_NAME IN ('Id', 'Name', 'MaxCPA', 'Status', 'InternalConfig')
ORDER BY ORDINAL_POSITION

