-- Agregar campos de suscripción a alquiler_configs
ALTER TABLE "alquiler_configs" 
ADD COLUMN IF NOT EXISTS "suscripcion_activa" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "suscripcion_vence_en" DATE,
ADD COLUMN IF NOT EXISTS "suscripcion_stripe_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "tipo_suscripcion" VARCHAR(20) DEFAULT 'MENSUAL';

-- Crear tabla de pagos de suscripción
-- NOTA: sedes.id es TEXT, no UUID, por eso usamos VARCHAR(255)
CREATE TABLE IF NOT EXISTS "alquiler_pagos" (
    "id" VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "sede_id" VARCHAR(255) NOT NULL REFERENCES "sedes"("id") ON DELETE CASCADE,
    "sede_config_id" VARCHAR(255) NOT NULL REFERENCES "alquiler_configs"("id") ON DELETE CASCADE,
    "monto" INTEGER NOT NULL,
    "moneda" VARCHAR(3) DEFAULT 'USD',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "metodo" VARCHAR(50),
    "referencia" VARCHAR(255),
    "fecha_pago" DATE,
    "periodo_desde" DATE NOT NULL,
    "periodo_hasta" DATE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS "idx_alquiler_pagos_sede" ON "alquiler_pagos"("sede_id");
CREATE INDEX IF NOT EXISTS "idx_alquiler_pagos_estado" ON "alquiler_pagos"("estado");
CREATE INDEX IF NOT EXISTS "idx_alquiler_pagos_fecha" ON "alquiler_pagos"("created_at");
