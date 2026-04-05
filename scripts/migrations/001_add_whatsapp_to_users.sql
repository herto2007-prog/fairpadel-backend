-- ============================================
-- MIGRACIÓN 1: Agregar campos WhatsApp a tabla users
-- Fecha: 2026-04-05
-- ============================================

-- 1. Agregar teléfono de WhatsApp
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS telefono_whatsapp VARCHAR(20);

-- 2. Campos para consentimiento del checkbox
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS consent_checkbox_whatsapp BOOLEAN DEFAULT false;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS consent_checkbox_date TIMESTAMP;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS consent_checkbox_ip VARCHAR(45);

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS consent_checkbox_text TEXT;

-- 3. Estado del consentimiento de WhatsApp
-- Valores: 'NO_APLICA', 'PENDIENTE', 'CONFIRMADO', 'RECHAZADO'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS consent_whatsapp_status VARCHAR(20) DEFAULT 'NO_APLICA';

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS consent_whatsapp_date TIMESTAMP;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS consent_whatsapp_message_id VARCHAR(100);

-- 4. Preferencia de notificación del usuario
-- Valores: 'EMAIL', 'AMBOS', 'WHATSAPP'
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferencia_notificacion VARCHAR(20) DEFAULT 'EMAIL';

-- 5. Comentarios explicativos (documentación en BD)
COMMENT ON COLUMN users.telefono_whatsapp IS 'Número de WhatsApp del usuario (formato internacional +595981XXXXXX)';
COMMENT ON COLUMN users.consent_checkbox_whatsapp IS 'Usuario marcó checkbox de consentimiento en registro';
COMMENT ON COLUMN users.consent_checkbox_date IS 'Fecha/hora del consentimiento del checkbox';
COMMENT ON COLUMN users.consent_checkbox_ip IS 'IP desde donde se dio el consentimiento';
COMMENT ON COLUMN users.consent_checkbox_text IS 'Texto exacto del checkbox que aceptó';
COMMENT ON COLUMN users.consent_whatsapp_status IS 'Estado: NO_APLICA, PENDIENTE, CONFIRMADO, RECHAZADO';
COMMENT ON COLUMN users.consent_whatsapp_date IS 'Fecha de confirmación vía mensaje WhatsApp';
COMMENT ON COLUMN users.consent_whatsapp_message_id IS 'ID del mensaje de confirmación enviado por Meta';
COMMENT ON COLUMN users.preferencia_notificacion IS 'Preferencia: EMAIL, AMBOS, WHATSAPP';

-- 6. Índice para búsquedas por teléfono (útil para webhooks)
CREATE INDEX IF NOT EXISTS idx_users_telefono_whatsapp 
ON users(telefono_whatsapp) 
WHERE telefono_whatsapp IS NOT NULL;

-- 7. Índice para usuarios con consentimiento pendiente
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_pending 
ON users(consent_whatsapp_status) 
WHERE consent_whatsapp_status = 'PENDIENTE';
