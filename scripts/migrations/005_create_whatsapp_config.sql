-- ============================================
-- MIGRACIÓN 5 (OPCIONAL): Crear tabla de configuración global
-- Fecha: 2026-04-05
-- ============================================
-- NOTA: Esta tabla es opcional. El feature flag principal
-- se controla por variable de entorno WHATSAPP_ENABLED.
-- Esta tabla permite overrides dinámicos sin redeploy.

CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave VARCHAR(100) UNIQUE NOT NULL,
  valor TEXT NOT NULL,
  descripcion TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id)
);

-- Comentarios
COMMENT ON TABLE whatsapp_config IS 'Configuración dinámica del módulo WhatsApp';

-- Configuración inicial: Feature flag
INSERT INTO whatsapp_config (clave, valor, descripcion) 
VALUES (
  'ENABLED', 
  'false', 
  'Feature flag global: true=activado, false=desactivado. Override a variable de entorno.'
)
ON CONFLICT (clave) DO NOTHING;

-- Configuración: Modo desarrollo (logs adicionales)
INSERT INTO whatsapp_config (clave, valor, descripcion) 
VALUES (
  'DEBUG_MODE', 
  'false', 
  'Si true, loguea todos los mensajes y respuestas para debugging'
)
ON CONFLICT (clave) DO NOTHING;

-- Configuración: Horario de envío (para no molestar de noche)
INSERT INTO whatsapp_config (clave, valor, descripcion) 
VALUES (
  'QUIET_HOURS_START', 
  '22:00', 
  'Hora inicio de horario silencioso (no enviar notificaciones)'
)
ON CONFLICT (clave) DO NOTHING;

INSERT INTO whatsapp_config (clave, valor, descripcion) 
VALUES (
  'QUIET_HOURS_END', 
  '08:00', 
  'Hora fin de horario silencioso'
)
ON CONFLICT (clave) DO NOTHING;

-- Vista para obtener config fácilmente
CREATE OR REPLACE VIEW v_whatsapp_config AS
SELECT clave, valor FROM whatsapp_config;
