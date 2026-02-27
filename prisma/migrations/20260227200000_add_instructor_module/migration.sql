-- CreateEnum
CREATE TYPE "InstructorEstado" AS ENUM ('APROBADO', 'SUSPENDIDO');

-- CreateTable
CREATE TABLE "solicitudes_instructor" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "experiencia_anios" INTEGER NOT NULL,
    "certificaciones" TEXT,
    "especialidades" TEXT,
    "niveles_ensenanza" TEXT,
    "descripcion" TEXT,
    "precio_individual" INTEGER,
    "precio_grupal" INTEGER,
    "ciudades" TEXT,
    "estado" "SolicitudEstado" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "estado" "InstructorEstado" NOT NULL DEFAULT 'APROBADO',
    "experiencia_anios" INTEGER NOT NULL,
    "certificaciones" TEXT,
    "especialidades" TEXT,
    "niveles_ensenanza" TEXT,
    "descripcion" TEXT,
    "precio_individual" INTEGER,
    "precio_grupal" INTEGER,
    "acepta_domicilio" BOOLEAN NOT NULL DEFAULT false,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_ubicaciones" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "sede_id" TEXT,
    "nombre_custom" TEXT,
    "ciudad" TEXT NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instructores_user_id_key" ON "instructores"("user_id");

-- AddForeignKey
ALTER TABLE "solicitudes_instructor" ADD CONSTRAINT "solicitudes_instructor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructores" ADD CONSTRAINT "instructores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_ubicaciones" ADD CONSTRAINT "instructor_ubicaciones_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_ubicaciones" ADD CONSTRAINT "instructor_ubicaciones_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
