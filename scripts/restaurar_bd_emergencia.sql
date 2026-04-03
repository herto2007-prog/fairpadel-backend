-- RESTAURACIÓN DE BD - Tablas y columnas eliminadas por error
-- Ejecutar en Railway para restaurar compatibilidad con código anterior

-- ============================================
-- 1. RECREAR TABLA alquiler_precios
-- ============================================
CREATE TABLE IF NOT EXISTS alquiler_precios (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id TEXT NOT NULL,
    tipo_cancha TEXT NOT NULL DEFAULT 'SINTETICO',
    tipo_dia TEXT NOT NULL DEFAULT 'SEMANA',
    franja TEXT NOT NULL DEFAULT 'TARDE',
    precio INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT alquiler_precios_sede_id_tipo_cancha_tipo_dia_franja_key UNIQUE (sede_id, tipo_cancha, tipo_dia, franja),
    CONSTRAINT alquiler_precios_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE CASCADE
);

-- ============================================
-- 2. RECREAR TABLA alquiler_pagos
-- ============================================
CREATE TABLE IF NOT EXISTS alquiler_pagos (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sede_id TEXT NOT NULL,
    sede_config_id TEXT NOT NULL,
    monto INTEGER NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'USD',
    estado TEXT NOT NULL DEFAULT 'PENDIENTE',
    metodo TEXT,
    referencia TEXT,
    fecha_pago TEXT,
    periodo_desde TEXT NOT NULL,
    periodo_hasta TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT alquiler_pagos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE CASCADE,
    CONSTRAINT alquiler_pagos_sede_config_id_fkey FOREIGN KEY (sede_config_id) REFERENCES alquiler_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alquiler_pagos_sede_id ON alquiler_pagos(sede_id);
CREATE INDEX IF NOT EXISTS idx_alquiler_pagos_estado ON alquiler_pagos(estado);
CREATE INDEX IF NOT EXISTS idx_alquiler_pagos_created_at ON alquiler_pagos(created_at);

-- ============================================
-- 3. AGREGAR COLUMNA alquilerPagos EN sedes
-- ============================================
-- Nota: Esta es una relación de Prisma, no necesita columna física
-- Prisma la maneja mediante foreign keys

-- ============================================
-- 4. AGREGAR COLUMNAS EN alquiler_configs
-- ============================================
ALTER TABLE alquiler_configs 
ADD COLUMN IF NOT EXISTS suscripcion_activa BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS suscripcion_vence_en TEXT,
ADD COLUMN IF NOT EXISTS tipo_suscripcion TEXT DEFAULT 'MENSUAL';

-- ============================================
-- 5. AGREGAR COLUMNAS EN reservas_canchas
-- ============================================
ALTER TABLE reservas_canchas 
ADD COLUMN IF NOT EXISTS precio INTEGER,
ADD COLUMN IF NOT EXISTS pagado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS metodo_pago TEXT,
ADD COLUMN IF NOT EXISTS compromiso_pago BOOLEAN DEFAULT false;

-- ============================================
-- 6. AGREGAR COLUMNA requiereAprobacion EN alquiler_configs (si no existe)
-- ============================================
ALTER TABLE alquiler_configs 
ADD COLUMN IF NOT EXISTS requiere_aprobacion BOOLEAN DEFAULT true;

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT 'alquiler_precios' as tabla, COUNT(*) as registros FROM alquiler_precios
UNION ALL
SELECT 'alquiler_pagos', COUNT(*) FROM alquiler_pagos
UNION ALL
SELECT 'alquiler_configs (con suscripcion)', COUNT(*) FROM alquiler_configs WHERE suscripcion_activa IS NOT NULL;
