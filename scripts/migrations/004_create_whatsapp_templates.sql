-- ============================================
-- MIGRACIÓN 4: Crear tabla whatsapp_templates
-- Fecha: 2026-04-05
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) UNIQUE NOT NULL, -- Nombre interno ej: 'confirmacion_reserva'
  wa_template_name VARCHAR(100) NOT NULL, -- Nombre en Meta ej: 'fairpadel_reserva_confirmada'
  categoria VARCHAR(30) NOT NULL, -- 'RESERVA', 'TORNEO', 'RECORDATORIO', 'SISTEMA'
  descripcion TEXT,
  parametros JSONB NOT NULL DEFAULT '{}', -- { "variables": ["nombre", "fecha", "hora"] }
  idioma VARCHAR(10) NOT NULL DEFAULT 'es',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Comentarios
COMMENT ON TABLE whatsapp_templates IS 'Plantillas de mensajes aprobadas por Meta';
COMMENT ON COLUMN whatsapp_templates.nombre IS 'Nombre interno del sistema';
COMMENT ON COLUMN whatsapp_templates.wa_template_name IS 'Nombre exacto en la plataforma de Meta';
COMMENT ON COLUMN whatsapp_templates.categoria IS 'Agrupación: RESERVA, TORNEO, RECORDATORIO, SISTEMA';
COMMENT ON COLUMN whatsapp_templates.parametros IS 'Variables requeridas en formato JSON';
COMMENT ON COLUMN whatsapp_templates.activo IS 'Si está disponible para uso';

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_categoria 
ON whatsapp_templates(categoria);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_activo 
ON whatsapp_templates(activo) 
WHERE activo = true;

-- ============================================
-- INSERTAR TEMPLATES INICIALES
-- ============================================

-- Template 1: Solicitud de consentimiento
INSERT INTO whatsapp_templates (nombre, wa_template_name, categoria, descripcion, parametros) 
VALUES (
  'confirmacion_consentimiento', 
  'fairpadel_consentimiento', 
  'SISTEMA', 
  'Solicitud de confirmación de consentimiento para recibir notificaciones',
  '{"variables": ["nombre"], "ejemplo": "Hola {{nombre}}, confirmá que querés recibir notificaciones de FairPadel respondiendo SI"}'
)
ON CONFLICT (nombre) DO NOTHING;

-- Template 2: Bienvenida tras confirmar
INSERT INTO whatsapp_templates (nombre, wa_template_name, categoria, descripcion, parametros) 
VALUES (
  'bienvenida_consentimiento', 
  'fairpadel_bienvenida', 
  'SISTEMA', 
  'Mensaje de bienvenida después de confirmar el consentimiento',
  '{"variables": ["nombre"], "ejemplo": "¡Bienvenido {{nombre}}! Ya estás suscrito a las notificaciones de FairPadel."}'
)
ON CONFLICT (nombre) DO NOTHING;

-- Template 3: Confirmación de reserva
INSERT INTO whatsapp_templates (nombre, wa_template_name, categoria, descripcion, parametros) 
VALUES (
  'confirmacion_reserva', 
  'fairpadel_reserva_confirmada', 
  'RESERVA', 
  'Confirmación de reserva de cancha',
  '{"variables": ["nombre", "fecha", "hora", "cancha", "sede"], "ejemplo": "Hola {{nombre}}, tu reserva está confirmada: {{fecha}} a las {{hora}} en {{cancha}} ({{sede}})"}'
)
ON CONFLICT (nombre) DO NOTHING;

-- Template 4: Recordatorio de partido
INSERT INTO whatsapp_templates (nombre, wa_template_name, categoria, descripcion, parametros) 
VALUES (
  'recordatorio_partido', 
  'fairpadel_recordatorio', 
  'RECORDATORIO', 
  'Recordatorio 24h o 4h antes del partido',
  '{"variables": ["nombre", "tiempo", "fecha", "hora", "cancha", "sede"], "ejemplo": "{{nombre}}, te recordamos que en {{tiempo}} tenés partido: {{fecha}} {{hora}} en {{cancha}} ({{sede}})"}'
)
ON CONFLICT (nombre) DO NOTHING;

-- Template 5: Inscripción a torneo
INSERT INTO whatsapp_templates (nombre, wa_template_name, categoria, descripcion, parametros) 
VALUES (
  'inscripcion_torneo', 
  'fairpadel_inscripcion_torneo', 
  'TORNEO', 
  'Confirmación de inscripción a torneo',
  '{"variables": ["nombre", "torneo", "categoria", "fecha_sorteo"], "ejemplo": "{{nombre}}, tu inscripción en {{torneo}} ({{categoria}}) está confirmada. Sorteo: {{fecha_sorteo}}"}'
)
ON CONFLICT (nombre) DO NOTHING;

-- Template 6: Partido programado
INSERT INTO whatsapp_templates (nombre, wa_template_name, categoria, descripcion, parametros) 
VALUES (
  'partido_programado', 
  'fairpadel_partido_programado', 
  'TORNEO', 
  'Notificación de partido programado en torneo',
  '{"variables": ["nombre", "torneo", "fecha", "hora", "cancha", "sede", "rival"], "ejemplo": "{{nombre}}, tu partido de {{torneo}} es el {{fecha}} a las {{hora}} vs {{rival}} en {{cancha}} ({{sede}})"}'
)
ON CONFLICT (nombre) DO NOTHING;
