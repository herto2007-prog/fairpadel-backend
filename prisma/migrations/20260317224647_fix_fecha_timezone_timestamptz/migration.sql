-- Cambiar fecha de DATE a TIMESTAMPTZ para preservar timezone UTC-3 (Paraguay)
-- Esto corrige el bug de "off by one day" al guardar fechas

-- Convertir columna fecha de DATE a TIMESTAMPTZ
-- Los datos existentes se convierten a timestamp a las 00:00 UTC
-- Luego el backend usará T03:00:00.000Z para representar medianoche PY
ALTER TABLE "torneo_disponibilidad_dias" 
ALTER COLUMN "fecha" TYPE TIMESTAMPTZ 
USING "fecha"::timestamp AT TIME ZONE 'UTC';

-- Nota: Las fechas existentes quedarán como 2026-03-19 00:00:00+00
-- El backend ahora debe usar T03:00:00.000Z para nuevas fechas
-- para que se muestren correctamente como medianoche en Paraguay (UTC-3)
