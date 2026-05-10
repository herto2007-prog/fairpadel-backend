-- Defensive migration: all operations use IF NOT EXISTS
-- This ensures idempotency regardless of partial prior application state

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "ultima_accion_en" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "americano_rondas" ADD COLUMN IF NOT EXISTS "grupo_id" TEXT;

-- AlterTable
ALTER TABLE "americano_partidos" ADD COLUMN IF NOT EXISTS "formato_partido" TEXT;
ALTER TABLE "americano_partidos" ADD COLUMN IF NOT EXISTS "sistema_puntos" TEXT;

-- AlterTable
ALTER TABLE "americano_puntajes" ADD COLUMN IF NOT EXISTS "grupo_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "americano_grupos" (
    "id" TEXT NOT NULL,
    "torneo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'DEFAULT',
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "americano_grupos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "americano_grupos_torneo_id_idx" ON "americano_grupos"("torneo_id");
CREATE INDEX IF NOT EXISTS "americano_grupos_tipo_idx" ON "americano_grupos"("tipo");
CREATE INDEX IF NOT EXISTS "inscripciones_grupo_id_idx" ON "inscripciones"("grupo_id");
CREATE INDEX IF NOT EXISTS "americano_rondas_grupo_id_idx" ON "americano_rondas"("grupo_id");
CREATE INDEX IF NOT EXISTS "americano_puntajes_grupo_id_idx" ON "americano_puntajes"("grupo_id");

-- AddForeignKey (defensive via DO blocks)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'inscripciones_grupo_id_fkey' AND table_name = 'inscripciones'
    ) THEN
        ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_grupo_id_fkey"
        FOREIGN KEY ("grupo_id") REFERENCES "americano_grupos"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'americano_grupos_torneo_id_fkey' AND table_name = 'americano_grupos'
    ) THEN
        ALTER TABLE "americano_grupos" ADD CONSTRAINT "americano_grupos_torneo_id_fkey"
        FOREIGN KEY ("torneo_id") REFERENCES "tournaments"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'americano_rondas_grupo_id_fkey' AND table_name = 'americano_rondas'
    ) THEN
        ALTER TABLE "americano_rondas" ADD CONSTRAINT "americano_rondas_grupo_id_fkey"
        FOREIGN KEY ("grupo_id") REFERENCES "americano_grupos"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'americano_puntajes_grupo_id_fkey' AND table_name = 'americano_puntajes'
    ) THEN
        ALTER TABLE "americano_puntajes" ADD CONSTRAINT "americano_puntajes_grupo_id_fkey"
        FOREIGN KEY ("grupo_id") REFERENCES "americano_grupos"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
