-- ============================================
-- MIGRACIÓN 3: Crear tabla whatsapp_mensajes
-- Fecha: 2026-04-05
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wa_message_id VARCHAR(100), -- ID del mensaje en WhatsApp (de Meta)
  tipo VARCHAR(20) NOT NULL, -- 'ENVIADO', 'RECIBIDO'
  categoria VARCHAR(30) NOT NULL, -- 'CONSENTIMIENTO', 'NOTIFICACION', 'RESPUESTA'
  contenido TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'ENVIADO', -- 'ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO'
  error_info JSONB, -- Detalles si falló el envío
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Comentarios
COMMENT ON TABLE whatsapp_mensajes IS 'Historial de mensajes enviados y recibidos por WhatsApp';
COMMENT ON COLUMN whatsapp_mensajes.wa_message_id IS 'ID único del mensaje asignado por Meta';
COMMENT ON COLUMN whatsapp_mensajes.tipo IS 'ENVIADO (nosotros) o RECIBIDO (usuario)';
COMMENT ON COLUMN whatsapp_mensajes.categoria IS 'Propósito: CONSENTIMIENTO, NOTIFICACION, RESPUESTA';
COMMENT ON COLUMN whatsapp_mensajes.estado IS 'Estado de entrega: ENVIADO, ENTREGADO, LEIDO, FALLIDO';
COMMENT ON COLUMN whatsapp_mensajes.error_info IS 'Detalles del error si estado es FALLIDO';

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_user 
ON whatsapp_mensajes(user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_conversation 
ON whatsapp_mensajes(conversation_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_wa_id 
ON whatsapp_mensajes(wa_message_id) 
WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_categoria 
ON whatsapp_mensajes(categoria);

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_estado 
ON whatsapp_mensajes(estado);

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensajes_created 
ON whatsapp_mensajes(created_at);
