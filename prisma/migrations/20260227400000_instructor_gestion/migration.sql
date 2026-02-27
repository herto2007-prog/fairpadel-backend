-- AlterTable: make solicitante_id nullable
ALTER TABLE "reservas_instructor" ALTER COLUMN "solicitante_id" DROP NOT NULL;

-- AddColumn: alumno externo fields
ALTER TABLE "reservas_instructor" ADD COLUMN "alumno_externo_nombre" TEXT;
ALTER TABLE "reservas_instructor" ADD COLUMN "alumno_externo_telefono" TEXT;

-- AddColumn: attendance tracking
ALTER TABLE "reservas_instructor" ADD COLUMN "asistio" BOOLEAN;

-- AddColumn: payment tracking
ALTER TABLE "reservas_instructor" ADD COLUMN "pagado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reservas_instructor" ADD COLUMN "metodo_pago" TEXT;

-- AddColumn: instructor notes
ALTER TABLE "reservas_instructor" ADD COLUMN "notas" TEXT;

-- AddColumn: flag for instructor-created classes
ALTER TABLE "reservas_instructor" ADD COLUMN "creado_por_instructor" BOOLEAN NOT NULL DEFAULT false;
