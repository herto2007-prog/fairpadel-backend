-- CreateEnum
CREATE TYPE "ReservaCanchaEstado" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'RECHAZADA', 'CANCELADA', 'COMPLETADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "FranjaHoraria" AS ENUM ('MANANA', 'TARDE', 'NOCHE');

-- CreateEnum
CREATE TYPE "TipoDia" AS ENUM ('SEMANA', 'FIN_DE_SEMANA');

-- CreateEnum
CREATE TYPE "MetodoPagoAlquiler" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'QR', 'OTRO');

-- CreateTable
CREATE TABLE "alquiler_configs" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "encargado_id" TEXT,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "requiere_aprobacion" BOOLEAN NOT NULL DEFAULT true,
    "duracion_slot_minutos" INTEGER NOT NULL DEFAULT 90,
    "anticipacion_max_dias" INTEGER NOT NULL DEFAULT 14,
    "cancelacion_min_horas" INTEGER NOT NULL DEFAULT 4,
    "mensaje_bienvenida" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alquiler_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alquiler_precios" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "tipo_cancha" "TipoCancha" NOT NULL,
    "tipo_dia" "TipoDia" NOT NULL,
    "franja" "FranjaHoraria" NOT NULL,
    "precio" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alquiler_precios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alquiler_disponibilidades" (
    "id" TEXT NOT NULL,
    "sede_cancha_id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alquiler_disponibilidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alquiler_bloqueos" (
    "id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "sede_cancha_id" TEXT,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "motivo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alquiler_bloqueos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_canchas" (
    "id" TEXT NOT NULL,
    "sede_cancha_id" TEXT NOT NULL,
    "user_id" TEXT,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "duracion_minutos" INTEGER NOT NULL,
    "precio" INTEGER NOT NULL,
    "estado" "ReservaCanchaEstado" NOT NULL DEFAULT 'PENDIENTE',
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "metodo_pago" "MetodoPagoAlquiler",
    "nombre_externo" TEXT,
    "telefono_externo" TEXT,
    "creado_por_encargado" BOOLEAN NOT NULL DEFAULT false,
    "compromiso_pago" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_canchas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alquiler_configs_sede_id_key" ON "alquiler_configs"("sede_id");

-- CreateIndex
CREATE UNIQUE INDEX "alquiler_precios_sede_id_tipo_cancha_tipo_dia_franja_key" ON "alquiler_precios"("sede_id", "tipo_cancha", "tipo_dia", "franja");

-- AddForeignKey
ALTER TABLE "alquiler_configs" ADD CONSTRAINT "alquiler_configs_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alquiler_configs" ADD CONSTRAINT "alquiler_configs_encargado_id_fkey" FOREIGN KEY ("encargado_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alquiler_precios" ADD CONSTRAINT "alquiler_precios_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alquiler_disponibilidades" ADD CONSTRAINT "alquiler_disponibilidades_sede_cancha_id_fkey" FOREIGN KEY ("sede_cancha_id") REFERENCES "sede_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alquiler_bloqueos" ADD CONSTRAINT "alquiler_bloqueos_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alquiler_bloqueos" ADD CONSTRAINT "alquiler_bloqueos_sede_cancha_id_fkey" FOREIGN KEY ("sede_cancha_id") REFERENCES "sede_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_canchas" ADD CONSTRAINT "reservas_canchas_sede_cancha_id_fkey" FOREIGN KEY ("sede_cancha_id") REFERENCES "sede_canchas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_canchas" ADD CONSTRAINT "reservas_canchas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
