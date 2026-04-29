-- Migration: Agregar tipoCategoria y reglas al modelo Category
-- Fecha: 2026-04-26
--
-- Permite soportar categorías STANDARD, MIXTO y SUMAS en los torneos

-- 1. Crear enum TipoCategoria (seguro si ya existe)
DO $$ BEGIN
  CREATE TYPE "TipoCategoria" AS ENUM ('STANDARD', 'MIXTO', 'SUMAS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Agregar columna tipoCategoria a categories (default STANDARD)
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "tipoCategoria" "TipoCategoria" NOT NULL DEFAULT 'STANDARD';

-- 3. Agregar columna reglas (JSONB) a categories
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "reglas" JSONB;
