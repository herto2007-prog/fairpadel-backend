-- CreateEnum
CREATE TYPE "ModoPagoInscripcion" AS ENUM ('COMPLETO', 'INDIVIDUAL');

-- AlterTable: Add modoPago to inscripciones
ALTER TABLE "inscripciones" ADD COLUMN "modo_pago" "ModoPagoInscripcion";

-- AlterTable: Add jugadorId to pagos, remove unique constraint on inscripcion_id
ALTER TABLE "pagos" ADD COLUMN "jugador_id" TEXT;

-- Drop the unique constraint on inscripcion_id (allow multiple pagos per inscripcion)
ALTER TABLE "pagos" DROP CONSTRAINT IF EXISTS "pagos_inscripcion_id_key";

-- AlterTable: Add comisionPorcentaje to tournaments
ALTER TABLE "tournaments" ADD COLUMN "comision_porcentaje" DECIMAL(5,2);

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_jugador_id_fkey" FOREIGN KEY ("jugador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
