-- Add clasificacion fields to inscripciones table
ALTER TABLE "inscripciones" 
ADD COLUMN IF NOT EXISTS "estado_clasificacion" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "posicion_clasificacion" INT,
ADD COLUMN IF NOT EXISTS "ronda_clasificacion" VARCHAR(20);

-- Create index for faster queries on estado_clasificacion
CREATE INDEX IF NOT EXISTS idx_inscripcion_estado_clasificacion 
ON "inscripciones"("estado_clasificacion") 
WHERE "estado_clasificacion" IS NOT NULL;
