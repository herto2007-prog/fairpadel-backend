-- Clean up existing data before enum changes
DELETE FROM "suscripciones" WHERE "periodo" = 'ANUAL';

-- CreateEnum
CREATE TYPE "TipoPublicacion" AS ENUM ('FOTO', 'RESULTADO', 'LOGRO', 'ASCENSO');

-- AlterEnum PeriodoSuscripcion (remove ANUAL)
ALTER TYPE "PeriodoSuscripcion" RENAME TO "PeriodoSuscripcion_old";
CREATE TYPE "PeriodoSuscripcion" AS ENUM ('MENSUAL');
ALTER TABLE "suscripciones" ALTER COLUMN "periodo" TYPE "PeriodoSuscripcion" USING ("periodo"::text::"PeriodoSuscripcion");
DROP TYPE "PeriodoSuscripcion_old";

-- AlterEnum PlanTipo (replace JUGADOR/ORGANIZADOR with UNICO)
-- Step 1: Drop existing default
ALTER TABLE "planes_premium" ALTER COLUMN "tipo" DROP DEFAULT;
-- Step 2: Create new enum with UNICO
CREATE TYPE "PlanTipo_new" AS ENUM ('UNICO');
-- Step 3: Convert column using text cast
ALTER TABLE "planes_premium" ALTER COLUMN "tipo" TYPE "PlanTipo_new" USING 'UNICO'::"PlanTipo_new";
-- Step 4: Drop old enum and rename new
DROP TYPE "PlanTipo";
ALTER TYPE "PlanTipo_new" RENAME TO "PlanTipo";
-- Step 5: Set new default
ALTER TABLE "planes_premium" ALTER COLUMN "tipo" SET DEFAULT 'UNICO'::"PlanTipo";

-- AlterTable (remove precioAnual from planes_premium)
ALTER TABLE "planes_premium" DROP COLUMN IF EXISTS "precio_anual";

-- CreateTable
CREATE TABLE "publicaciones_feed" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tipo" "TipoPublicacion" NOT NULL,
    "contenido" TEXT,
    "foto_id" TEXT,
    "match_id" TEXT,
    "tournament_id" TEXT,
    "categoria_id" TEXT,
    "datos_extra" TEXT,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "comentarios_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publicaciones_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes_publicaciones" (
    "id" TEXT NOT NULL,
    "publicacion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_publicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios_publicaciones" (
    "id" TEXT NOT NULL,
    "publicacion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_publicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publicaciones_feed_user_id_created_at_idx" ON "publicaciones_feed"("user_id", "created_at");
CREATE INDEX "publicaciones_feed_tipo_idx" ON "publicaciones_feed"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "likes_publicaciones_publicacion_id_user_id_key" ON "likes_publicaciones"("publicacion_id", "user_id");

-- AddForeignKey
ALTER TABLE "publicaciones_feed" ADD CONSTRAINT "publicaciones_feed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publicaciones_feed" ADD CONSTRAINT "publicaciones_feed_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "fotos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "publicaciones_feed" ADD CONSTRAINT "publicaciones_feed_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "publicaciones_feed" ADD CONSTRAINT "publicaciones_feed_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes_publicaciones" ADD CONSTRAINT "likes_publicaciones_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "publicaciones_feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "likes_publicaciones" ADD CONSTRAINT "likes_publicaciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_publicaciones" ADD CONSTRAINT "comentarios_publicaciones_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "publicaciones_feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comentarios_publicaciones" ADD CONSTRAINT "comentarios_publicaciones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
