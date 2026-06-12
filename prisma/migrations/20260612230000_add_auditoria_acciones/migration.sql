-- Tabla de auditoría de acciones sensibles (aditiva: no toca datos existentes)
CREATE TABLE "auditoria_acciones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "detalle" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_acciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_acciones_user_id_idx" ON "auditoria_acciones"("user_id");
CREATE INDEX "auditoria_acciones_entidad_id_idx" ON "auditoria_acciones"("entidad_id");
CREATE INDEX "auditoria_acciones_accion_idx" ON "auditoria_acciones"("accion");
