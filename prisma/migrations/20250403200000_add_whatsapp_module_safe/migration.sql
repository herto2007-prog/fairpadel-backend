-- Migration: WhatsApp Business API Module (Safe - Idempotent)
-- Created: 2026-04-03
-- This migration uses IF NOT EXISTS to be safe if objects already exist

-- ============================================
-- ENUMS (create if not exists using DO blocks)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsappConsentStatus') THEN
        CREATE TYPE "WhatsappConsentStatus" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'REVOCADO');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificacionPreferencia') THEN
        CREATE TYPE "NotificacionPreferencia" AS ENUM ('EMAIL', 'WHATSAPP', 'AMBOS');
    END IF;
END $$;

-- ============================================
-- USERS TABLE - Add WhatsApp consent columns (only if not exist)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='consent_checkbox_whatsapp') THEN
        ALTER TABLE "users" ADD COLUMN "consent_checkbox_whatsapp" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='consent_whatsapp_status') THEN
        ALTER TABLE "users" ADD COLUMN "consent_whatsapp_status" "WhatsappConsentStatus";
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='consent_whatsapp_date') THEN
        ALTER TABLE "users" ADD COLUMN "consent_whatsapp_date" TIMESTAMP(3);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='preferencia_notificacion') THEN
        ALTER TABLE "users" ADD COLUMN "preferencia_notificacion" "NotificacionPreferencia" NOT NULL DEFAULT 'EMAIL';
    END IF;
END $$;

-- ============================================
-- WHATSAPP CONVERSATIONS TABLE
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name='whatsapp_conversations') THEN
        CREATE TABLE "whatsapp_conversations" (
            "id" TEXT NOT NULL,
            "user_id" TEXT NOT NULL,
            "wa_id" TEXT NOT NULL,
            "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
            "categoria" TEXT NOT NULL DEFAULT 'MARKETING',
            "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "fecha_expiracion" TIMESTAMP(3) NOT NULL,
            "ultimo_mensaje_at" TIMESTAMP(3),
            "metadata" JSONB,
            CONSTRAINT "whatsapp_conversations_pkey" PRIMARY KEY ("id")
        );
        
        CREATE UNIQUE INDEX "whatsapp_conversations_wa_id_key" ON "whatsapp_conversations"("wa_id");
        CREATE INDEX "whatsapp_conversations_user_id_idx" ON "whatsapp_conversations"("user_id");
        CREATE INDEX "whatsapp_conversations_estado_fecha_expiracion_idx" ON "whatsapp_conversations"("estado", "fecha_expiracion");
        
        ALTER TABLE "whatsapp_conversations" 
        ADD CONSTRAINT "whatsapp_conversations_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================
-- WHATSAPP MENSAJES TABLE
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name='whatsapp_mensajes') THEN
        CREATE TABLE "whatsapp_mensajes" (
            "id" TEXT NOT NULL,
            "conversation_id" TEXT NOT NULL,
            "user_id" TEXT,
            "wa_message_id" TEXT NOT NULL,
            "direccion" TEXT NOT NULL,
            "tipo" TEXT NOT NULL,
            "contenido" TEXT NOT NULL,
            "template_name" TEXT,
            "estado" TEXT NOT NULL DEFAULT 'ENVIADO',
            "error_msg" TEXT,
            "error_code" TEXT,
            "categorizacion" TEXT,
            "enviado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "entregado_at" TIMESTAMP(3),
            "leido_at" TIMESTAMP(3),
            CONSTRAINT "whatsapp_mensajes_pkey" PRIMARY KEY ("id")
        );
        
        CREATE UNIQUE INDEX "whatsapp_mensajes_wa_message_id_key" ON "whatsapp_mensajes"("wa_message_id");
        CREATE INDEX "whatsapp_mensajes_conversation_id_idx" ON "whatsapp_mensajes"("conversation_id");
        CREATE INDEX "whatsapp_mensajes_user_id_idx" ON "whatsapp_mensajes"("user_id");
        CREATE INDEX "whatsapp_mensajes_enviado_at_idx" ON "whatsapp_mensajes"("enviado_at");
        
        ALTER TABLE "whatsapp_mensajes" 
        ADD CONSTRAINT "whatsapp_mensajes_conversation_id_fkey" 
        FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        
        ALTER TABLE "whatsapp_mensajes" 
        ADD CONSTRAINT "whatsapp_mensajes_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================
-- WHATSAPP TEMPLATES TABLE
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_name='whatsapp_templates') THEN
        CREATE TABLE "whatsapp_templates" (
            "id" TEXT NOT NULL,
            "nombre" TEXT NOT NULL,
            "categoria" TEXT NOT NULL,
            "lenguaje" TEXT NOT NULL DEFAULT 'es',
            "contenido" TEXT NOT NULL,
            "variables" TEXT[],
            "aprobado" BOOLEAN NOT NULL DEFAULT false,
            "wa_template_id" TEXT,
            "wa_template_name" TEXT,
            "activo" BOOLEAN NOT NULL DEFAULT true,
            "descripcion" TEXT,
            "ejemplo" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
        );
        
        CREATE UNIQUE INDEX "whatsapp_templates_nombre_key" ON "whatsapp_templates"("nombre");
        CREATE INDEX "whatsapp_templates_categoria_idx" ON "whatsapp_templates"("categoria");
        CREATE INDEX "whatsapp_templates_aprobado_activo_idx" ON "whatsapp_templates"("aprobado", "activo");
    END IF;
END $$;

-- ============================================
-- INITIAL TEMPLATES SEED (only if table is empty)
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='whatsapp_templates')
       AND NOT EXISTS (SELECT 1 FROM "whatsapp_templates" LIMIT 1) THEN
        
        INSERT INTO "whatsapp_templates" ("id", "nombre", "categoria", "lenguaje", "contenido", "variables", "aprobado", "wa_template_name", "activo", "descripcion", "ejemplo", "updated_at")
        VALUES 
        (gen_random_uuid(), 'confirmacion_consentimiento', 'SISTEMA', 'es', 'Hola {{nombre}}, bienvenido a FairPadel. Para recibir notificaciones por WhatsApp, responde SI a este mensaje. Puedes cancelar en cualquier momento respondiendo NO.', ARRAY['nombre'], false, 'fairpadel_consent_confirmation', true, 'Mensaje para solicitar confirmación de consentimiento (doble opt-in)', 'Hola Juan, bienvenido a FairPadel. Para recibir notificaciones por WhatsApp, responde SI a este mensaje. Puedes cancelar en cualquier momento respondiendo NO.', CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'bienvenida_consentimiento', 'SISTEMA', 'es', '✅ ¡Perfecto {{nombre}}! Ahora recibirás notificaciones de FairPadel por WhatsApp. Te enviaremos recordatorios de reservas, actualizaciones de torneos y más.', ARRAY['nombre'], false, 'fairpadel_welcome', true, 'Mensaje de bienvenida después de confirmar consentimiento', '✅ ¡Perfecto Juan! Ahora recibirás notificaciones de FairPadel por WhatsApp. Te enviaremos recordatorios de reservas, actualizaciones de torneos y más.', CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'confirmacion_reserva', 'RESERVA', 'es', 'Hola {{nombre}}, tu reserva fue confirmada:\n\n📅 Fecha: {{fecha}}\n🎾 Cancha: {{cancha}}\n⏰ Hora: {{hora}}\n\nNos vemos en la cancha!', ARRAY['nombre', 'fecha', 'cancha', 'hora'], false, 'fairpadel_reserva_confirmada', true, 'Confirmación de reserva de cancha', 'Hola Juan, tu reserva fue confirmada:\n\n📅 Fecha: 15/01/2026\n🎾 Cancha: Cancha 1\n⏰ Hora: 18:00\n\nNos vemos en la cancha!', CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'recordatorio_reserva_24h', 'RECORDATORIO', 'es', '⏰ Recordatorio: Tenés una reserva mañana!\n\n📅 {{fecha}}\n🎾 {{cancha}}\n⏰ {{hora}}\n\nSi no podés asistir, cancelá con anticipación.', ARRAY['fecha', 'cancha', 'hora'], false, 'fairpadel_recordatorio_24h', true, 'Recordatorio 24 horas antes de la reserva', '⏰ Recordatorio: Tenés una reserva mañana!\n\n📅 15/01/2026\n🎾 Cancha 1\n⏰ 18:00\n\nSi no podés asistir, cancelá con anticipación.', CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'recordatorio_reserva_4h', 'RECORDATORIO', 'es', '🔔 ¡Te esperamos en unas horas!\n\n📅 {{fecha}}\n🎾 {{cancha}}\n⏰ {{hora}}\n\nNo olvides tu equipo. ¡Buen partido!', ARRAY['fecha', 'cancha', 'hora'], false, 'fairpadel_recordatorio_4h', true, 'Recordatorio 4 horas antes de la reserva', '🔔 ¡Te esperamos en unas horas!\n\n📅 15/01/2026\n🎾 Cancha 1\n⏰ 18:00\n\nNo olvides tu equipo. ¡Buen partido!', CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'inscripcion_torneo', 'TORNEO', 'es', '¡Felicidades {{nombre}}! Te inscribiste en {{torneo}}\n\n🎾 Categoría: {{categoria}}\n👤 Pareja: {{pareja}}\n\nTe avisaremos cuando se publique el fixture.', ARRAY['nombre', 'torneo', 'categoria', 'pareja'], false, 'fairpadel_inscripcion_torneo', true, 'Confirmación de inscripción a torneo', '¡Felicidades Juan! Te inscribiste en Torneo Verano 2026\n\n🎾 Categoría: 3ra Masculina\n👤 Pareja: Pedro Gomez\n\nTe avisaremos cuando se publique el fixture.', CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'fixture_publicado', 'TORNEO', 'es', '¡El fixture de {{torneo}} ya está disponible!\n\n🎾 Tu primer partido:\n📅 {{fecha}}\n⏰ {{hora}}\n🆚 Vs: {{rival}}\n\nVer fixture: {{link}}', ARRAY['torneo', 'fecha', 'hora', 'rival', 'link'], false, 'fairpadel_fixture_publicado', true, 'Notificación de fixture publicado', '¡El fixture de Torneo Verano 2026 ya está disponible!\n\n🎾 Tu primer partido:\n📅 20/01/2026\n⏰ 19:00\n🆚 Vs: Martinez/Lopez\n\nVer fixture: https://fairpadel.com/fixture/123', CURRENT_TIMESTAMP);
    END IF;
END $$;
