-- Script para modificar PRIMARY KEY de ClientFieldMappings
-- Permitir que un SourceField mapee a múltiples TargetField
-- 
-- PROBLEMA: PK actual: (ClientId, SourceField, ConnectionId)
-- SOLUCIÓN: Nuevo PK: (ClientId, SourceField, TargetField, ConnectionId)

USE JobPlatform;
GO

BEGIN TRANSACTION;

PRINT '🔧 Iniciando modificación de PRIMARY KEY en ClientFieldMappings...';

-- Paso 1: Verificar que la tabla existe
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'ClientFieldMappings')
BEGIN
    PRINT '❌ ERROR: Tabla ClientFieldMappings no existe';
    ROLLBACK TRANSACTION;
    RETURN;
END

-- Paso 2: Hacer backup de datos existentes
PRINT '📋 Haciendo backup de datos existentes...';
SELECT * INTO ClientFieldMappings_BACKUP FROM ClientFieldMappings;
PRINT '✅ Backup creado como ClientFieldMappings_BACKUP';

-- Paso 3: Obtener count de registros antes de la modificación
DECLARE @CountBefore INT;
SELECT @CountBefore = COUNT(*) FROM ClientFieldMappings;
PRINT '📊 Registros antes de la modificación: ' + CAST(@CountBefore AS VARCHAR);

-- Paso 4: Eliminar el PRIMARY KEY constraint existente
PRINT '🗑️ Eliminando PRIMARY KEY constraint actual...';
ALTER TABLE ClientFieldMappings 
DROP CONSTRAINT PK_ClientFieldMappings;
PRINT '✅ PRIMARY KEY constraint eliminado';

-- Paso 5: Verificar que TargetField no tenga valores NULL (es necesario para PK)
PRINT '🔍 Verificando valores NULL en TargetField...';
DECLARE @NullCount INT;
SELECT @NullCount = COUNT(*) FROM ClientFieldMappings WHERE TargetField IS NULL;

IF @NullCount > 0
BEGIN
    PRINT '⚠️ ADVERTENCIA: ' + CAST(@NullCount AS VARCHAR) + ' registros con TargetField NULL';
    PRINT '🔧 Actualizando registros con TargetField NULL...';
    
    -- Actualizar valores NULL con un valor por defecto
    UPDATE ClientFieldMappings 
    SET TargetField = SourceField 
    WHERE TargetField IS NULL;
    
    PRINT '✅ Registros con TargetField NULL actualizados';
END

-- Paso 6: Hacer TargetField NOT NULL (requerido para PRIMARY KEY)
PRINT '🔧 Modificando TargetField para ser NOT NULL...';
ALTER TABLE ClientFieldMappings
ALTER COLUMN TargetField varchar(100) NOT NULL;
PRINT '✅ TargetField configurado como NOT NULL';

-- Paso 7: Crear el nuevo PRIMARY KEY constraint
PRINT '🔑 Creando nuevo PRIMARY KEY constraint...';
ALTER TABLE ClientFieldMappings 
ADD CONSTRAINT PK_ClientFieldMappings 
PRIMARY KEY (ClientId, SourceField, TargetField, ConnectionId);
PRINT '✅ Nuevo PRIMARY KEY creado: (ClientId, SourceField, TargetField, ConnectionId)';

-- Paso 8: Verificar que el cambio fue exitoso
PRINT '🔍 Verificando nueva estructura...';
SELECT 
    i.name AS IndexName,
    c.name AS ColumnName,
    ic.key_ordinal AS ColumnPosition
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('ClientFieldMappings')
    AND i.is_primary_key = 1
ORDER BY ic.key_ordinal;

-- Paso 9: Verificar count después de la modificación
DECLARE @CountAfter INT;
SELECT @CountAfter = COUNT(*) FROM ClientFieldMappings;
PRINT '📊 Registros después de la modificación: ' + CAST(@CountAfter AS VARCHAR);

IF @CountBefore = @CountAfter
BEGIN
    PRINT '✅ SUCCESS: Modificación completada sin pérdida de datos';
    PRINT '✅ Ahora un SourceField puede mapear a múltiples TargetField';
    COMMIT TRANSACTION;
END
ELSE
BEGIN
    PRINT '❌ ERROR: Count de registros no coincide, haciendo rollback';
    ROLLBACK TRANSACTION;
END

PRINT '🎉 Script completado';
GO