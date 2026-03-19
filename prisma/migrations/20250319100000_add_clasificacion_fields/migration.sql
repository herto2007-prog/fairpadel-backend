-- Add clasificacion fields to inscripciones table
ALTER TABLE "inscripciones" 
ADD COLUMN "estado_clasificacion" VARCHAR(20) DEFAULT 'PENDIENTE',
ADD COLUMN "posicion_clasificacion" INT,
ADD COLUMN "ronda_clasificacion" VARCHAR(20);

-- Create index for faster queries on estado_clasificacion
CREATE INDEX idx_inscripcion_estado_clasificacion 
ON "inscripciones"("estado_clasificacion") 
WHERE "estado_clasificacion" IS NOT NULL;
