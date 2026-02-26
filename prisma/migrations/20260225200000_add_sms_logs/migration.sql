-- CreateTable
CREATE TABLE "sms_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "telefono" TEXT NOT NULL,
    "mensaje" VARCHAR(320) NOT NULL,
    "tipo" "TipoNotificacion",
    "exitoso" BOOLEAN NOT NULL DEFAULT true,
    "provider_response" TEXT,
    "costo_estimado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_logs_created_at_idx" ON "sms_logs"("created_at");

-- CreateIndex
CREATE INDEX "sms_logs_user_id_idx" ON "sms_logs"("user_id");

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
