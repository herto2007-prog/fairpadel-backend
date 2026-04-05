-- ============================================
-- MIGRACIÓN 2: Crear tabla whatsapp_conversations
-- Fecha: 2026-04-05
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wa_conversation_id VARCHAR(100), -- ID de conversación de Meta
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA', -- 'ACTIVA', 'EXPIRADA'
  iniciada_por VARCHAR(20) NOT NULL, -- 'USUARIO', 'EMPRESA'
  fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion TIMESTAMP, -- 24h después del último mensaje
  mensajes_count INTEGER NOT NULL DEFAULT 0,
  ultimo_mensaje TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Comentarios
COMMENT ON TABLE whatsapp_conversations IS 'Conversaciones activas de WhatsApp con usuarios';
COMMENT ON COLUMN whatsapp_conversations.wa_conversation_id IS 'ID único de conversación asignado por Meta';
COMMENT ON COLUMN whatsapp_conversations.estado IS 'ACTIVA (dentro de 24h) o EXPIRADA';
COMMENT ON COLUMN whatsapp_conversations.iniciada_por IS 'Quién inició: USUARIO o EMPRESA';
COMMENT ON COLUMN whatsapp_conversations.fecha_expiracion IS 'Fecha límite para enviar mensajes de sesión (24h)';

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user 
ON whatsapp_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_wa_id 
ON whatsapp_conversations(wa_conversation_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_estado 
ON whatsapp_conversations(estado) 
WHERE estado = 'ACTIVA';

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_expiracion 
ON whatsapp_conversations(fecha_expiracion) 
WHERE estado = 'ACTIVA';
