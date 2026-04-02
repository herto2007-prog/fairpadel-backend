-- Agregar campos de suscripción a alquiler_configs
ALTER TABLE "alquiler_configs" 
ADD COLUMN IF NOT EXISTS "suscripcion_activa" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "suscripcion_vence_en" DATE,
ADD COLUMN IF NOT EXISTS "suscripcion_stripe_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "tipo_suscripcion" VARCHAR(20) DEFAULT 'MENSUAL';

-- Crear tabla de pagos de suscripción
CREATE TABLE IF NOT EXISTS "alquiler_pagos" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sede_id" UUID NOT NULL REFERENCES "sedes"("id") ON DELETE CASCADE,
    "monto" INTEGER NOT NULL, -- en centavos (999 = 9.99 USD)
    "moneda" VARCHAR(3) DEFAULT 'USD',
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, COMPLETADO, FALLIDO, REEMBOLSADO
    "metodo" VARCHAR(50), -- BANCARD, STRIPE, TRANSFERENCIA
    "referencia" VARCHAR(255), -- ID de transacción externo
    "fecha_pago" DATE,
    "periodo_desde" DATE NOT NULL,
    "periodo_hasta" DATE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS "idx_alquiler_pagos_sede" ON "alquiler_pagos"("sede_id");
CREATE INDEX IF NOT EXISTS "idx_alquiler_pagos_estado" ON "alquiler_pagos"("estado");
CREATE INDEX IF NOT EXISTS "idx_alquiler_pagos_fecha" ON "alquiler_pagos"("created_at");

-- Comentarios para documentación
COMMENT ON COLUMN "alquiler_configs"."suscripcion_activa" IS 'Indica si la suscripción está activa';
COMMENT ON COLUMN "alquiler_configs"."suscripcion_vence_en" IS 'Fecha de vencimiento YYYY-MM-DD';
COMMENT ON COLUMN "alquiler_pagos"."monto" IS 'Monto en centavos (ej: 999 = 9.99 USD)';
