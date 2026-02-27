-- CreateEnum
CREATE TYPE "EstadoAscenso" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "ascensos_pendientes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "categoria_anterior_id" TEXT,
    "categoria_nueva_id" TEXT NOT NULL,
    "tipo" "TipoCambioCategoria" NOT NULL,
    "motivo" TEXT NOT NULL,
    "tournament_id" TEXT,
    "estado" "EstadoAscenso" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "revisado_por" TEXT,
    "revisado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ascensos_pendientes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ascensos_pendientes" ADD CONSTRAINT "ascensos_pendientes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ascensos_pendientes" ADD CONSTRAINT "ascensos_pendientes_categoria_nueva_id_fkey" FOREIGN KEY ("categoria_nueva_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert config
INSERT INTO "configuracion_sistema" ("id", "clave", "valor", "descripcion", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'ASCENSOS_REQUIEREN_APROBACION', 'true', 'Cuando está activo, los ascensos automáticos requieren aprobación de un administrador', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("clave") DO NOTHING;
