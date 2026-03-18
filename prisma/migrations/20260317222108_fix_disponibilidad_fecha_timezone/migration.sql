-- Cambiar el tipo de fecha de DATE a TIMESTAMPTZ para preservar timezone UTC-3 (Paraguay)
-- Esto corrige el bug de "off by one day" cuando se selecciona una fecha

ALTER TABLE "torneo_disponibilidad_dias" 
ALTER COLUMN "fecha" TYPE TIMESTAMPTZ 
USING "fecha"::timestamp AT TIME ZONE 'UTC';

-- Nota: Después de esta migración, el backend debe usar T03:00:00.000Z
-- para representar medianoche en Paraguay (UTC-3)
