-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'PUBLICADO', 'EN_CURSO', 'FINALIZADO', 'RECHAZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('TRADICIONAL', 'MIXTO', 'SUMA');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "pais" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "fecha_limite_inscripcion" TIMESTAMP(3) NOT NULL,
    "flyer_url" TEXT NOT NULL,
    "estado" "TournamentStatus" NOT NULL DEFAULT 'BORRADOR',
    "costo_inscripcion" DECIMAL(10,2) NOT NULL,
    "organizador_id" TEXT NOT NULL,
    "sede" TEXT,
    "direccion" TEXT,
    "maps_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "Gender" NOT NULL,
    "orden" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_categories" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "limite_parejas" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_modalidades" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_modalidades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_nombre_key" ON "categories"("nombre");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizador_id_fkey" FOREIGN KEY ("organizador_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_categories" ADD CONSTRAINT "tournament_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_modalidades" ADD CONSTRAINT "tournament_modalidades_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
