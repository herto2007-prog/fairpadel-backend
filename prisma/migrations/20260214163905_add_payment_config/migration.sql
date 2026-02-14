-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "habilitar_bancard" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cuentas_bancarias" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "titular" TEXT NOT NULL,
    "cedula_ruc" TEXT NOT NULL,
    "nro_cuenta" TEXT,
    "alias_spi" TEXT,
    "telefono_comprobante" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
