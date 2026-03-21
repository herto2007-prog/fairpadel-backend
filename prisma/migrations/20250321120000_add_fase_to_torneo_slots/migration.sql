-- Agregar columna fase a torneo_slots para soporte de fases (ZONA, SEMIFINAL, FINAL)
ALTER TABLE "torneo_slots" ADD COLUMN IF NOT EXISTS "fase" TEXT;

-- Crear índice para búsquedas por fase
CREATE INDEX IF NOT EXISTS "torneo_slots_fase_idx" ON "torneo_slots"("fase");
