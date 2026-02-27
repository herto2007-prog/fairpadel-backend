-- CreateEnum
CREATE TYPE "TipoClase" AS ENUM ('INDIVIDUAL', 'GRUPAL');

-- CreateEnum
CREATE TYPE "ReservaEstado" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA', 'CANCELADA', 'COMPLETADA');

-- CreateTable
CREATE TABLE "instructor_disponibilidad" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_bloqueos" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_bloqueos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_instructor" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "solicitante_id" TEXT NOT NULL,
    "tipo" "TipoClase" NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "duracion_minutos" INTEGER NOT NULL DEFAULT 60,
    "precio" INTEGER NOT NULL,
    "estado" "ReservaEstado" NOT NULL DEFAULT 'PENDIENTE',
    "mensaje" TEXT,
    "respuesta" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_instructor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "instructor_disponibilidad" ADD CONSTRAINT "instructor_disponibilidad_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_bloqueos" ADD CONSTRAINT "instructor_bloqueos_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_instructor" ADD CONSTRAINT "reservas_instructor_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_instructor" ADD CONSTRAINT "reservas_instructor_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
