-- Migración: Cambiar fecha_aprobacion de timestamp a text
-- Esto alinea la DB con el schema de Prisma (String para fechas)

-- 1. Verificar tipo actual
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'torneo_circuitos' AND column_name = 'fecha_aprobacion';

-- 2. Cambiar tipo de timestamp a text
ALTER TABLE torneo_circuitos 
ALTER COLUMN fecha_aprobacion TYPE text 
USING fecha_aprobacion::text;

-- 3. Verificar cambio
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'torneo_circuitos' AND column_name = 'fecha_aprobacion';
