-- Migración: Control de Pagos del Organizador (Individual por jugador)
-- Fecha: 2026-03-25
-- Descripción: Tabla para que el organizador controle quién le pagó la inscripción

-- Crear tabla de control de pagos
CREATE TABLE "control_pagos_organizador" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "inscripcion_id" TEXT NOT NULL,
    "jugador_id" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "metodo" TEXT NOT NULL CHECK ("metodo" IN ('EFECTIVO', 'TRANSFERENCIA')),
    "fecha" TEXT NOT NULL, -- YYYY-MM-DD
    "nota" TEXT,
    "registrado_por" TEXT NOT NULL, -- Organizador que registró el pago
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT "control_pagos_inscripcion_fk" 
        FOREIGN KEY ("inscripcion_id") REFERENCES "inscripciones"("id") ON DELETE CASCADE,
    CONSTRAINT "control_pagos_jugador_fk" 
        FOREIGN KEY ("jugador_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Índices para búsquedas rápidas
CREATE INDEX "idx_control_pagos_inscripcion" ON "control_pagos_organizador"("inscripcion_id");
CREATE INDEX "idx_control_pagos_jugador" ON "control_pagos_organizador"("jugador_id");
CREATE INDEX "idx_control_pagos_fecha" ON "control_pagos_organizador"("fecha");

-- Comentarios
COMMENT ON TABLE "control_pagos_organizador" IS 'Control de pagos de inscripciones por parte del organizador (sistema paralelo al de pagos premium)';
COMMENT ON COLUMN "control_pagos_organizador"."monto" IS 'Monto en guaraníes pagado por el jugador';
COMMENT ON COLUMN "control_pagos_organizador"."metodo" IS 'EFECTIVO o TRANSFERENCIA';
