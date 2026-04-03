-- Migración: Agregar categoryId a clasificados_circuito
-- Esto permite calcular clasificados por categoría (Femenino/Masculino)

-- 1. Agregar columna categoryId
ALTER TABLE clasificados_circuito ADD COLUMN category_id TEXT;

-- 2. Asignar categoría por defecto (1ra Femenina) a registros existentes
-- Nota: Debes ajustar esto según tus datos reales
UPDATE clasificados_circuito 
SET category_id = (
    SELECT id FROM categories WHERE nombre = '1ra Femenina' LIMIT 1
);

-- 3. Hacer la columna NOT NULL
ALTER TABLE clasificados_circuito ALTER COLUMN category_id SET NOT NULL;

-- 4. Crear índice para la nueva constraint
CREATE UNIQUE INDEX clasificados_circuito_circuito_id_jugador_id_category_id_key 
ON clasificados_circuito(circuito_id, jugador_id, category_id);

-- 5. Agregar foreign key
ALTER TABLE clasificados_circuito 
ADD CONSTRAINT clasificados_circuito_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

-- 6. Eliminar constraint única antigua (si existe)
ALTER TABLE clasificados_circuito 
DROP CONSTRAINT IF EXISTS clasificados_circuito_circuito_id_jugador_id_key;

-- 7. Verificar cambios
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clasificados_circuito';
