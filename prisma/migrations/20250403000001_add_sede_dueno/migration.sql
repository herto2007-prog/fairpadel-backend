-- Agregar campos dueno_id y encargado_id a sedes
ALTER TABLE "sedes" 
ADD COLUMN IF NOT EXISTS "dueno_id" VARCHAR(255) REFERENCES "users"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "encargado_id" VARCHAR(255) REFERENCES "users"("id") ON DELETE SET NULL;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS "idx_sedes_dueno" ON "sedes"("dueno_id");
CREATE INDEX IF NOT EXISTS "idx_sedes_encargado" ON "sedes"("encargado_id");
