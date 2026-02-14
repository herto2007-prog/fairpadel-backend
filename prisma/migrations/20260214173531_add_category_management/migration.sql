-- CreateEnum
CREATE TYPE "TipoCambioCategoria" AS ENUM ('ASCENSO_AUTOMATICO', 'ASCENSO_POR_DEMOSTRACION', 'ASCENSO_MANUAL', 'DESCENSO_MANUAL', 'ASIGNACION_INICIAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "categoria_actual_id" TEXT;

-- CreateTable
CREATE TABLE "reglas_ascenso" (
    "id" TEXT NOT NULL,
    "categoria_origen_id" TEXT NOT NULL,
    "categoria_destino_id" TEXT NOT NULL,
    "campeonatos_consecutivos" INTEGER,
    "campeonatos_alternados" INTEGER,
    "finalista_califica" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglas_ascenso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_categorias" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "categoria_anterior_id" TEXT,
    "categoria_nueva_id" TEXT NOT NULL,
    "tipo" "TipoCambioCategoria" NOT NULL,
    "motivo" TEXT NOT NULL,
    "tournament_id" TEXT,
    "realizado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reglas_ascenso_categoria_origen_id_categoria_destino_id_key" ON "reglas_ascenso"("categoria_origen_id", "categoria_destino_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_categoria_actual_id_fkey" FOREIGN KEY ("categoria_actual_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_ascenso" ADD CONSTRAINT "reglas_ascenso_categoria_origen_id_fkey" FOREIGN KEY ("categoria_origen_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_ascenso" ADD CONSTRAINT "reglas_ascenso_categoria_destino_id_fkey" FOREIGN KEY ("categoria_destino_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_categorias" ADD CONSTRAINT "historial_categorias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
