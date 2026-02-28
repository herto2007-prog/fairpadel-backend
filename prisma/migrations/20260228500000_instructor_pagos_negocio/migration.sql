-- CreateEnum
CREATE TYPE "MetodoPagoInstructor" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'QR', 'OTRO');

-- CreateEnum
CREATE TYPE "ConceptoPago" AS ENUM ('CLASE', 'PAQUETE', 'DEUDA', 'ADELANTO', 'OTRO');

-- AlterTable: add montoCobrado to reservas_instructor
ALTER TABLE "reservas_instructor" ADD COLUMN "monto_cobrado" INTEGER;

-- CreateTable: pagos_instructor
CREATE TABLE "pagos_instructor" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "alumno_id" TEXT,
    "alumno_externo_nombre" TEXT,
    "alumno_externo_telefono" TEXT,
    "reserva_id" TEXT,
    "monto" INTEGER NOT NULL,
    "metodo_pago" "MetodoPagoInstructor" NOT NULL,
    "concepto" "ConceptoPago" NOT NULL DEFAULT 'CLASE',
    "descripcion" TEXT,
    "fecha" DATE NOT NULL,
    "numero_recibo" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_instructor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pagos_instructor" ADD CONSTRAINT "pagos_instructor_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_instructor" ADD CONSTRAINT "pagos_instructor_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_instructor" ADD CONSTRAINT "pagos_instructor_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas_instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
