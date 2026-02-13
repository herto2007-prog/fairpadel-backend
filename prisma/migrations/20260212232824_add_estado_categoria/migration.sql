-- CreateEnum
CREATE TYPE "CategoriaEstado" AS ENUM ('INSCRIPCIONES_ABIERTAS', 'INSCRIPCIONES_CERRADAS', 'SORTEO_REALIZADO', 'EN_CURSO', 'FINALIZADA');

-- AlterTable
ALTER TABLE "tournament_categories" ADD COLUMN     "estado" "CategoriaEstado" NOT NULL DEFAULT 'INSCRIPCIONES_ABIERTAS';

-- Backfill: categories with inscripcion_abierta = false should be INSCRIPCIONES_CERRADAS
UPDATE "tournament_categories" SET "estado" = 'INSCRIPCIONES_CERRADAS' WHERE "inscripcion_abierta" = false;
