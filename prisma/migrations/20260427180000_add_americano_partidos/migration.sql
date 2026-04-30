-- Migration: Add AmericanoPartido table for match tracking with court assignment
-- Created: 2026-04-27
-- NOTE: Idempotent - safe to run even if table already exists

-- ═══════════════════════════════════════════════════════════════════════════════
-- Create americano_partidos table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "americano_partidos" (
  "id" TEXT NOT NULL,
  "ronda_id" TEXT NOT NULL,
  "pareja_a_id" TEXT NOT NULL,
  "pareja_b_id" TEXT NOT NULL,
  "cancha" INTEGER NOT NULL DEFAULT 1,
  "estado" VARCHAR(255) NOT NULL DEFAULT 'PENDIENTE',
  "sets" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "americano_partidos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_americano_partidos_ronda_id" ON "americano_partidos"("ronda_id");
CREATE INDEX IF NOT EXISTS "idx_americano_partidos_pareja_a_id" ON "americano_partidos"("pareja_a_id");
CREATE INDEX IF NOT EXISTS "idx_americano_partidos_pareja_b_id" ON "americano_partidos"("pareja_b_id");

-- Add foreign keys idempotently using DO blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'americano_partidos_ronda_fkey' 
    AND table_name = 'americano_partidos'
  ) THEN
    ALTER TABLE "americano_partidos" 
      ADD CONSTRAINT "americano_partidos_ronda_fkey" 
      FOREIGN KEY ("ronda_id") REFERENCES "americano_rondas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'americano_partidos_pareja_a_fkey' 
    AND table_name = 'americano_partidos'
  ) THEN
    ALTER TABLE "americano_partidos" 
      ADD CONSTRAINT "americano_partidos_pareja_a_fkey" 
      FOREIGN KEY ("pareja_a_id") REFERENCES "americano_parejas_ronda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'americano_partidos_pareja_b_fkey' 
    AND table_name = 'americano_partidos'
  ) THEN
    ALTER TABLE "americano_partidos" 
      ADD CONSTRAINT "americano_partidos_pareja_b_fkey" 
      FOREIGN KEY ("pareja_b_id") REFERENCES "americano_parejas_ronda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
