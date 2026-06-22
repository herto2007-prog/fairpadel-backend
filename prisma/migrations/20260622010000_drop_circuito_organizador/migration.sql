-- Revertir el modelo equivocado "liga del organizador" (circuito con dueño).
-- La columna estaba vacía (0 ligas creadas) -> drop seguro.
DROP INDEX IF EXISTS "circuitos_organizador_id_idx";
ALTER TABLE "circuitos" DROP CONSTRAINT IF EXISTS "circuitos_organizador_id_fkey";
ALTER TABLE "circuitos" DROP COLUMN IF EXISTS "organizador_id";
