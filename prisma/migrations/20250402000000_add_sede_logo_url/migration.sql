-- Add logo_url column to sedes table
ALTER TABLE "sedes" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
