-- Verificar estructura de la tabla torneo_circuitos
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'torneo_circuitos' 
ORDER BY 
    ordinal_position;

-- Verificar constraints
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM 
    pg_constraint 
WHERE 
    conrelid = 'torneo_circuitos'::regclass;

-- Verificar índices únicos
SELECT 
    indexname, 
    indexdef 
FROM 
    pg_indexes 
WHERE 
    tablename = 'torneo_circuitos';
