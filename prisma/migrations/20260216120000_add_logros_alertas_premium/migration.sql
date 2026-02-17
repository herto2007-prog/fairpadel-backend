-- CreateEnum
CREATE TYPE "TipoAlertaPersonalizada" AS ENUM ('TORNEO_EN_MI_CIUDAD', 'TORNEO_MI_CATEGORIA', 'RIVAL_INSCRITO', 'RANKING_CAMBIO');

-- AlterTable: Add new columns to logros
ALTER TABLE "logros" ADD COLUMN "categoria" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "logros" ADD COLUMN "requiere_premium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "logros" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: alertas_personalizadas
CREATE TABLE "alertas_personalizadas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tipo" "TipoAlertaPersonalizada" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertas_personalizadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alertas_personalizadas_user_id_tipo_key" ON "alertas_personalizadas"("user_id", "tipo");

-- AddForeignKey
ALTER TABLE "alertas_personalizadas" ADD CONSTRAINT "alertas_personalizadas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
