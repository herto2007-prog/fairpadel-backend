-- Agregar columna para ejemplos de variables en plantillas de WhatsApp
ALTER TABLE "whatsapp_templates" ADD COLUMN IF NOT EXISTS "ejemplos_variables" JSONB;
