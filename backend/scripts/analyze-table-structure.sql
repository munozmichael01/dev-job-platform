-- Script para analizar la estructura de ClientFieldMappings
-- Obtener información sobre la tabla y sus constrains

-- 1. Información sobre la tabla
SELECT 
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_NAME = 'ClientFieldMappings'
ORDER BY c.ORDINAL_POSITION;

-- 2. Información sobre constraints (PRIMARY KEY, FOREIGN KEY, etc.)
SELECT 
    tc.CONSTRAINT_NAME,
    tc.CONSTRAINT_TYPE,
    kcu.COLUMN_NAME,
    kcu.ORDINAL_POSITION
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
    AND tc.TABLE_NAME = kcu.TABLE_NAME
WHERE tc.TABLE_NAME = 'ClientFieldMappings'
ORDER BY tc.CONSTRAINT_TYPE, kcu.ORDINAL_POSITION;

-- 3. Información específica sobre PRIMARY KEY
SELECT 
    i.name AS IndexName,
    c.name AS ColumnName,
    ic.key_ordinal AS ColumnPosition,
    i.is_primary_key,
    i.is_unique
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('ClientFieldMappings')
    AND i.is_primary_key = 1
ORDER BY ic.key_ordinal;