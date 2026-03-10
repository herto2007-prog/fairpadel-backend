-- Crear tabla de configuración global de FairPadel
CREATE TABLE "fairpadel_config" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fairpadel_config_pkey" PRIMARY KEY ("id")
);

-- Crear índice único para clave
CREATE UNIQUE INDEX "fairpadel_config_clave_key" ON "fairpadel_config"("clave");

-- Crear tabla de comisiones por torneo
CREATE TABLE "torneo_comisiones" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "monto_estimado" INTEGER NOT NULL,
    "monto_pagado" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "bloqueo_activo" BOOLEAN NOT NULL DEFAULT false,
    "ronda_bloqueo" TEXT,
    "comprobante_url" TEXT,
    "comprobante_notas" TEXT,
    "pagado_at" TIMESTAMP(3),
    "revisado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "torneo_comisiones_pkey" PRIMARY KEY ("id")
);

-- Crear índices y constraints únicos
CREATE UNIQUE INDEX "torneo_comisiones_tournament_id_key" ON "torneo_comisiones"("tournament_id");

-- Crear tabla de templates de checklist
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "es_default" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- Crear tabla de items de template
CREATE TABLE "checklist_template_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "es_calculado" BOOLEAN NOT NULL DEFAULT false,
    "formula" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- Crear tabla de items de checklist (instancias por torneo)
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "template_item_id" TEXT,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha_recordatorio" TIMESTAMP(3),
    "recordatorio_enviado" BOOLEAN NOT NULL DEFAULT false,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "completado_at" TIMESTAMP(3),
    "notas" TEXT,
    "valor_calculado" INTEGER,
    "valor_real" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- Crear tabla de notificaciones enviadas
CREATE TABLE "notificaciones_enviadas" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "inscripcion_id" TEXT,
    "tipo" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "error_msg" TEXT,
    "enviado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "leido_at" TIMESTAMP(3),

    CONSTRAINT "notificaciones_enviadas_pkey" PRIMARY KEY ("id")
);

-- Crear índices para notificaciones
CREATE INDEX "notificaciones_enviadas_tournament_id_tipo_idx" ON "notificaciones_enviadas"("tournament_id", "tipo");

-- Agregar foreign keys
ALTER TABLE "torneo_comisiones" ADD CONSTRAINT "torneo_comisiones_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notificaciones_enviadas" ADD CONSTRAINT "notificaciones_enviadas_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
