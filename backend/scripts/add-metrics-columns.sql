-- 📊 Script para Agregar Columnas de Métricas
-- Ejecutar como administrador de SQL Server o usuario con permisos DDL
-- Fecha: 2025-01-17

USE JobPlatformDB;
GO

-- Verificar contexto
SELECT 'Conectado a base de datos: ' + DB_NAME() as Status;
GO

-- 1. Agregar columnas de métricas a tabla Campaigns
PRINT '🎯 Agregando columnas de métricas a tabla Campaigns...';

-- ActualSpend: Gasto real acumulado desde todos los canales
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Campaigns') AND name = 'ActualSpend')
BEGIN
    ALTER TABLE Campaigns ADD ActualSpend DECIMAL(10,2) DEFAULT 0;
    PRINT '✅ Columna ActualSpend agregada a Campaigns';
END
ELSE
    PRINT '⚠️ Columna ActualSpend ya existe en Campaigns';

-- ActualApplications: Aplicaciones reales recibidas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Campaigns') AND name = 'ActualApplications')
BEGIN
    ALTER TABLE Campaigns ADD ActualApplications INT DEFAULT 0;
    PRINT '✅ Columna ActualApplications agregada a Campaigns';
END
ELSE
    PRINT '⚠️ Columna ActualApplications ya existe en Campaigns';

-- LastMetricsSync: Última vez que se sincronizaron métricas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Campaigns') AND name = 'LastMetricsSync')
BEGIN
    ALTER TABLE Campaigns ADD LastMetricsSync DATETIME2;
    PRINT '✅ Columna LastMetricsSync agregada a Campaigns';
END
ELSE
    PRINT '⚠️ Columna LastMetricsSync ya existe en Campaigns';

-- 2. Agregar columnas de métricas a tabla CampaignChannels
PRINT '📊 Agregando columnas de métricas a tabla CampaignChannels...';

-- ActualSpend: Gasto real por canal
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CampaignChannels') AND name = 'ActualSpend')
BEGIN
    ALTER TABLE CampaignChannels ADD ActualSpend DECIMAL(10,2) DEFAULT 0;
    PRINT '✅ Columna ActualSpend agregada a CampaignChannels';
END
ELSE
    PRINT '⚠️ Columna ActualSpend ya existe en CampaignChannels';

-- ActualClicks: Clicks reales recibidos
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CampaignChannels') AND name = 'ActualClicks')
BEGIN
    ALTER TABLE CampaignChannels ADD ActualClicks INT DEFAULT 0;
    PRINT '✅ Columna ActualClicks agregada a CampaignChannels';
END
ELSE
    PRINT '⚠️ Columna ActualClicks ya existe en CampaignChannels';

-- ActualImpressions: Impresiones reales mostradas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CampaignChannels') AND name = 'ActualImpressions')
BEGIN
    ALTER TABLE CampaignChannels ADD ActualImpressions INT DEFAULT 0;
    PRINT '✅ Columna ActualImpressions agregada a CampaignChannels';
END
ELSE
    PRINT '⚠️ Columna ActualImpressions ya existe en CampaignChannels';

-- ActualApplications: Aplicaciones reales por canal
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CampaignChannels') AND name = 'ActualApplications')
BEGIN
    ALTER TABLE CampaignChannels ADD ActualApplications INT DEFAULT 0;
    PRINT '✅ Columna ActualApplications agregada a CampaignChannels';
END
ELSE
    PRINT '⚠️ Columna ActualApplications ya existe en CampaignChannels';

-- LastSyncAt: Última sincronización de métricas para este canal
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CampaignChannels') AND name = 'LastSyncAt')
BEGIN
    ALTER TABLE CampaignChannels ADD LastSyncAt DATETIME2;
    PRINT '✅ Columna LastSyncAt agregada a CampaignChannels';
END
ELSE
    PRINT '⚠️ Columna LastSyncAt ya existe en CampaignChannels';

-- 3. Verificar resultado final
PRINT '🔍 Verificando columnas agregadas...';

SELECT 
    'Campaigns' as Tabla,
    COUNT(*) as TotalColumnas,
    SUM(CASE WHEN COLUMN_NAME LIKE 'Actual%' OR COLUMN_NAME = 'LastMetricsSync' THEN 1 ELSE 0 END) as ColumnasMetricas
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'Campaigns'

UNION ALL

SELECT 
    'CampaignChannels' as Tabla,
    COUNT(*) as TotalColumnas,
    SUM(CASE WHEN COLUMN_NAME LIKE 'Actual%' OR COLUMN_NAME = 'LastSyncAt' THEN 1 ELSE 0 END) as ColumnasMetricas
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'CampaignChannels';

-- 4. Crear índices para performance
PRINT '🚀 Creando índices para performance de métricas...';

-- Índice para búsquedas por LastMetricsSync
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Campaigns_LastMetricsSync')
BEGIN
    CREATE INDEX IX_Campaigns_LastMetricsSync ON Campaigns (LastMetricsSync) WHERE LastMetricsSync IS NOT NULL;
    PRINT '✅ Índice IX_Campaigns_LastMetricsSync creado';
END
ELSE
    PRINT '⚠️ Índice IX_Campaigns_LastMetricsSync ya existe';

-- Índice para búsquedas por LastSyncAt en CampaignChannels
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CampaignChannels_LastSyncAt')
BEGIN
    CREATE INDEX IX_CampaignChannels_LastSyncAt ON CampaignChannels (CampaignId, ChannelId, LastSyncAt);
    PRINT '✅ Índice IX_CampaignChannels_LastSyncAt creado';
END
ELSE
    PRINT '⚠️ Índice IX_CampaignChannels_LastSyncAt ya existe';

PRINT '🎉 Script de métricas completado exitosamente!';

-- 5. Query de ejemplo para verificar
PRINT '📋 Ejemplo de query para verificar métricas:';
PRINT 'SELECT c.Name, c.ActualSpend, c.ActualApplications, c.LastMetricsSync FROM Campaigns c WHERE c.ActualSpend > 0;';

GO