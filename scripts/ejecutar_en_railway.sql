-- EJECUTAR ESTO EN RAILWAY (en orden)

-- 1. Ver categorías existentes
SELECT id, nombre, tipo FROM categories ORDER BY tipo, nombre;

-- 2. Agregar columna categoryId (permite null temporalmente)
ALTER TABLE clasificados_circuito ADD COLUMN IF NOT EXISTS category_id TEXT;

-- 3. Asignar categoría por defecto (ajusta según tus categorías)
-- Opción A: Si tienen datos mixtos, asignar 1ra Femenina a todos
UPDATE clasificados_circuito 
SET category_id = (SELECT id FROM categories WHERE nombre = '1ra Femenina' LIMIT 1)
WHERE category_id IS NULL;

-- 4. Verificar que no quedan nulos
SELECT COUNT(*) as nulos FROM clasificados_circuito WHERE category_id IS NULL;

-- 5. Si el paso 4 devuelve 0, ejecutar:
ALTER TABLE clasificados_circuito ALTER COLUMN category_id SET NOT NULL;

-- 6. Agregar relación con tabla categories
ALTER TABLE clasificados_circuito 
ADD CONSTRAINT clasificados_circuito_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;

-- 7. Crear índice único nuevo
CREATE UNIQUE INDEX IF NOT EXISTS clasificados_circuito_circuito_cat_jug_key 
ON clasificados_circuito(circuito_id, category_id, jugador_id);

-- 8. Eliminar índice único antiguo (si existe)
DROP INDEX IF EXISTS clasificados_circuito_circuito_id_jugador_id_key;

-- 9. Verificar resultado
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clasificados_circuito';
