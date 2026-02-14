-- AlterTable
ALTER TABLE "notificaciones" ADD COLUMN     "email_enviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enlace" VARCHAR(500),
ADD COLUMN     "sms_enviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "titulo" VARCHAR(200);

-- CreateTable
CREATE TABLE "preferencias_notificacion" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tipo_notificacion" "TipoNotificacion" NOT NULL,
    "recibir_email" BOOLEAN NOT NULL DEFAULT true,
    "recibir_sms" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferencias_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "preferencias_notificacion_user_id_tipo_notificacion_key" ON "preferencias_notificacion"("user_id", "tipo_notificacion");

-- AddForeignKey
ALTER TABLE "preferencias_notificacion" ADD CONSTRAINT "preferencias_notificacion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
