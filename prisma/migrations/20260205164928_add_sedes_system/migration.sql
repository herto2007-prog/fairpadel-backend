/*
  Warnings:

  - You are about to drop the column `cancha_id` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the `canchas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `complejos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `horarios_competencia` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TipoCancha" AS ENUM ('INDOOR', 'OUTDOOR', 'SEMI_TECHADA');

-- DropForeignKey
ALTER TABLE "canchas" DROP CONSTRAINT "canchas_complejo_id_fkey";

-- DropForeignKey
ALTER TABLE "complejos" DROP CONSTRAINT "complejos_tournament_id_fkey";

-- DropForeignKey
ALTER TABLE "horarios_competencia" DROP CONSTRAINT "horarios_competencia_complejo_id_fkey";

-- DropForeignKey
ALTER TABLE "matches" DROP CONSTRAINT "matches_cancha_id_fkey";

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "cancha_id",
ADD COLUMN     "torneo_cancha_id" TEXT;

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "sede_id" TEXT;

-- DropTable
DROP TABLE "canchas";

-- DropTable
DROP TABLE "complejos";

-- DropTable
DROP TABLE "horarios_competencia";

-- CreateTable
CREATE TABLE "sedes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "direccion" TEXT,
    "maps_url" TEXT,
    "telefono" TEXT,
    "logo_url" TEXT,
    "imagen_fondo" TEXT,
    "horario_atencion" TEXT,
    "contacto_encargado" TEXT,
    "canvas_width" INTEGER NOT NULL DEFAULT 800,
    "canvas_height" INTEGER NOT NULL DEFAULT 600,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sede_canchas" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCancha" NOT NULL DEFAULT 'OUTDOOR',
    "posicion_x" INTEGER NOT NULL DEFAULT 0,
    "posicion_y" INTEGER NOT NULL DEFAULT 0,
    "ancho" INTEGER NOT NULL DEFAULT 100,
    "alto" INTEGER NOT NULL DEFAULT 150,
    "rotacion" INTEGER NOT NULL DEFAULT 0,
    "imagen_url" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sede_canchas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torneo_sedes" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torneo_sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torneo_canchas" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "sede_cancha_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torneo_canchas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "torneo_cancha_horarios" (
    "id" TEXT NOT NULL,
    "torneo_cancha_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torneo_cancha_horarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "torneo_sedes_tournament_id_sede_id_key" ON "torneo_sedes"("tournament_id", "sede_id");

-- CreateIndex
CREATE UNIQUE INDEX "torneo_canchas_tournament_id_sede_cancha_id_key" ON "torneo_canchas"("tournament_id", "sede_cancha_id");

-- AddForeignKey
ALTER TABLE "sede_canchas" ADD CONSTRAINT "sede_canchas_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneo_sedes" ADD CONSTRAINT "torneo_sedes_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneo_sedes" ADD CONSTRAINT "torneo_sedes_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneo_canchas" ADD CONSTRAINT "torneo_canchas_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneo_canchas" ADD CONSTRAINT "torneo_canchas_sede_cancha_id_fkey" FOREIGN KEY ("sede_cancha_id") REFERENCES "sede_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneo_cancha_horarios" ADD CONSTRAINT "torneo_cancha_horarios_torneo_cancha_id_fkey" FOREIGN KEY ("torneo_cancha_id") REFERENCES "torneo_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_torneo_cancha_id_fkey" FOREIGN KEY ("torneo_cancha_id") REFERENCES "torneo_canchas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
