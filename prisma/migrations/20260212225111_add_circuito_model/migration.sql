-- CreateEnum
CREATE TYPE "CircuitoEstado" AS ENUM ('ACTIVO', 'FINALIZADO', 'CANCELADO');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "circuito_id" TEXT;

-- CreateTable
CREATE TABLE "circuitos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "pais" TEXT NOT NULL,
    "region" TEXT,
    "ciudad" TEXT,
    "temporada" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "estado" "CircuitoEstado" NOT NULL DEFAULT 'ACTIVO',
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circuitos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "circuitos_nombre_key" ON "circuitos"("nombre");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_circuito_id_fkey" FOREIGN KEY ("circuito_id") REFERENCES "circuitos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
