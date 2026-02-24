-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "CategoriaMovimiento" AS ENUM ('PREMIO', 'ARBITRAJE', 'ALQUILER_CANCHA', 'PELOTAS', 'PUBLICIDAD', 'LOGISTICA', 'ALIMENTACION', 'AUSPICIO_EFECTIVO', 'OTRO');

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "categoria" "CategoriaMovimiento" NOT NULL,
    "concepto" VARCHAR(300) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "creado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auspiciantes_especie" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "sponsor_id" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "valor_estimado" DECIMAL(10,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "creado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auspiciantes_especie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_financieros_tournament_id_tipo_idx" ON "movimientos_financieros"("tournament_id", "tipo");

-- CreateIndex
CREATE INDEX "auspiciantes_especie_tournament_id_idx" ON "auspiciantes_especie"("tournament_id");

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auspiciantes_especie" ADD CONSTRAINT "auspiciantes_especie_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auspiciantes_especie" ADD CONSTRAINT "auspiciantes_especie_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "tournament_sponsors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auspiciantes_especie" ADD CONSTRAINT "auspiciantes_especie_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
