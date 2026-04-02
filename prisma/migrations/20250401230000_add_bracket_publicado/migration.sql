-- Add bracketPublicado column to Tournament table
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "bracket_publicado" BOOLEAN NOT NULL DEFAULT false;
