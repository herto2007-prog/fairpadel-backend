-- CreateEnum
CREATE TYPE "BannerZona" AS ENUM ('HEADER', 'SIDEBAR', 'ENTRE_TORNEOS', 'FOOTER', 'HOME_HERO', 'HOME_MEDIO', 'TORNEO_DETALLE');

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "imagen_url" TEXT NOT NULL,
    "imagen_public_id" TEXT,
    "link_url" VARCHAR(500),
    "zona" "BannerZona" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "orden" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impresiones" INTEGER NOT NULL DEFAULT 0,
    "anunciante" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banners_zona_activo_idx" ON "banners"("zona", "activo");
