-- ============================================================
-- MIGRACIÓN: Cambiar fechas de DATE a TEXT (YYYY-MM-DD)
-- Fecha: 2026-04-03
-- Objetivo: Evitar problemas de zona horaria UTC vs Paraguay
-- ============================================================

-- 1. Cambiar columnas en alquiler_pagos
-- Primero verificamos los tipos actuales
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'alquiler_pagos' 
AND column_name IN ('fecha_pago', 'periodo_desde', 'periodo_hasta');

-- Cambiar fecha_pago de DATE a TEXT
ALTER TABLE alquiler_pagos ALTER COLUMN fecha_pago TYPE TEXT;

-- Cambiar periodo_desde de DATE a TEXT  
ALTER TABLE alquiler_pagos ALTER COLUMN periodo_desde TYPE TEXT;

-- Cambiar periodo_hasta de DATE a TEXT
ALTER TABLE alquiler_pagos ALTER COLUMN periodo_hasta TYPE TEXT;

-- 2. Cambiar columnas en alquiler_configs
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'alquiler_configs' 
AND column_name = 'suscripcion_vence_en';

-- Cambiar suscripcion_vence_en de DATE a TEXT
ALTER TABLE alquiler_configs ALTER COLUMN suscripcion_vence_en TYPE TEXT;

-- 3. Verificar que los cambios se aplicaron
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('alquiler_pagos', 'alquiler_configs')
AND column_name IN ('fecha_pago', 'periodo_desde', 'periodo_hasta', 'suscripcion_vence_en')
ORDER BY table_name, ordinal_position;
