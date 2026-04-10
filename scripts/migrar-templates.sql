-- Migración de Templates WhatsApp - Meta 2026
-- Ejecutar en Railway SQL Editor

-- ============================================
-- PASO 1: Desactivar templates antiguos
-- ============================================
UPDATE whatsapp_templates 
SET activo = false
WHERE nombre IN (
  'confirmacion_consentimiento',
  'bienvenida_consentimiento', 
  'consentimiento_cancelado',
  'torneo_pareja',
  'torneo_partido_rival',
  'reserva_ubicacion',
  'reserva_recordatorio_24h',
  'reserva_recordatorio_4h',
  'torneo_inscripcion',
  'torneo_partido_fecha'
);

-- ============================================
-- PASO 2: Insertar/Actualizar nuevos templates
-- ============================================

-- 1. Solicitud de consentimiento (MARKETING)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'solicitud_consentimiento', 'MARKETING', 'es',
  'Bienvenido a FairPadel. Para recibir datos de tus reservas y torneos por este canal, responde SI. Responde NO para omitir.',
  ARRAY[]::text[], 'fairpadel_consent_solicitud', true,
  'Solicitud inicial de opt-in para notificaciones', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  activo = true,
  updated_at = NOW();

-- 2. Confirmación de opt-in (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'bienvenida_consentimiento', 'UTILITY', 'es',
  'Gracias por confirmar. Ahora recibiras mensajes de FairPadel sobre tus reservas activas.',
  ARRAY[]::text[], 'fairpadel_consent_confirmado', true,
  'Confirmacion de opt-in UTILITY', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  activo = true,
  updated_at = NOW();

-- 3. Cancelación de opt-in (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'consentimiento_cancelado', 'UTILITY', 'es',
  'Has cancelado los mensajes de FairPadel. Para reactivar, accede a tu cuenta.',
  ARRAY[]::text[], 'fairpadel_consent_cancelado', true,
  'Confirmacion de cancelacion UTILITY', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  activo = true,
  updated_at = NOW();

-- 4. Pareja asignada (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, ejemplo, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'torneo_pareja_asignada', 'UTILITY', 'es',
  'Informacion de tu torneo: La pareja asignada es el jugador {{1}} en categoria {{2}} segun registro.',
  ARRAY['nombre_pareja', 'categoria']::text[], 'fairpadel_torneo_pareja', true,
  'Pareja asignada UTILITY', '{"body_text": [["Pedro Gomez", "3ra Masculina"]]}', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  ejemplo = EXCLUDED.ejemplo,
  activo = true,
  updated_at = NOW();

-- 5. Rival asignado (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, ejemplo, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'torneo_rival_asignado', 'UTILITY', 'es',
  'Informacion del fixture: El rival asignado es {{1}} en el torneo {{2}} segun programacion.',
  ARRAY['nombre_rival', 'nombre_torneo']::text[], 'fairpadel_torneo_rival', true,
  'Rival del partido UTILITY', '{"body_text": [["Martinez-Lopez", "Verano 2026"]]}', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  ejemplo = EXCLUDED.ejemplo,
  activo = true,
  updated_at = NOW();

-- 6. Reserva confirmada (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, ejemplo, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'reserva_confirmada', 'UTILITY', 'es',
  'Datos de tu reserva confirmada: Cancha numero {{1}} asignada para fecha {{2}} segun disponibilidad.',
  ARRAY['numero_cancha', 'fecha']::text[], 'fairpadel_reserva_ok', true,
  'Confirmacion de reserva - datos basicos UTILITY', '{"body_text": [["3", "15/01/2026"]]}', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  ejemplo = EXCLUDED.ejemplo,
  activo = true,
  updated_at = NOW();

-- 7. Reserva sede info (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, ejemplo, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'reserva_sede_info', 'UTILITY', 'es',
  'Detalles de tu sede confirmada: {{1}}. Presentarse 15 minutos antes del horario.',
  ARRAY['nombre_sede']::text[], 'fairpadel_reserva_sede', true,
  'Informacion de sede para reserva UTILITY', '{"body_text": [["Sede Central"]]}', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  ejemplo = EXCLUDED.ejemplo,
  activo = true,
  updated_at = NOW();

-- 8. Recordatorio 24h (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, ejemplo, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'recordatorio_24h', 'UTILITY', 'es',
  'Recordatorio de tu reserva: El partido es manana en sede {{1}} a las {{2}} segun confirmacion previa.',
  ARRAY['sede', 'hora']::text[], 'fairpadel_recordatorio_24h', true,
  'Recordatorio 24 horas antes UTILITY', '{"body_text": [["Sede Central", "18:00"]]}', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  ejemplo = EXCLUDED.ejemplo,
  activo = true,
  updated_at = NOW();

-- 9. Recordatorio 4h (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, ejemplo, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'recordatorio_4h', 'UTILITY', 'es',
  'Recordatorio para hoy: Te esperamos en sede {{1}} a las {{2}} segun tu reserva registrada.',
  ARRAY['sede', 'hora']::text[], 'fairpadel_recordatorio_4h', true,
  'Recordatorio 4 horas antes UTILITY', '{"body_text": [["Sede Central", "18:00"]]}', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  ejemplo = EXCLUDED.ejemplo,
  activo = true,
  updated_at = NOW();

-- 10. Torneo inscripción confirmada (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, ejemplo, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'torneo_inscripcion_confirmada', 'UTILITY', 'es',
  'Tu inscripcion al torneo {{1}} esta registrada en la categoria {{2}}.',
  ARRAY['nombre_torneo', 'categoria']::text[], 'fairpadel_torneo_insc_ok', true,
  'Confirmacion de inscripcion a torneo UTILITY', '{"body_text": [["Verano 2026", "3ra Masculina"]]}', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  ejemplo = EXCLUDED.ejemplo,
  activo = true,
  updated_at = NOW();

-- 11. Torneo fecha partido (UTILITY)
INSERT INTO whatsapp_templates (
  id, nombre, categoria, lenguaje, contenido, 
  variables, wa_template_name, activo, descripcion, ejemplo, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'torneo_fecha_partido', 'UTILITY', 'es',
  'Fecha confirmada para tu partido: {{1}} a las {{2}} segun fixture oficial.',
  ARRAY['fecha', 'hora']::text[], 'fairpadel_torneo_fecha', true,
  'Fecha del partido UTILITY', '{"body_text": [["20/01/2026", "19:00"]]}', NOW(), NOW()
) ON CONFLICT (nombre) DO UPDATE SET
  categoria = EXCLUDED.categoria,
  contenido = EXCLUDED.contenido,
  variables = EXCLUDED.variables,
  wa_template_name = EXCLUDED.wa_template_name,
  descripcion = EXCLUDED.descripcion,
  ejemplo = EXCLUDED.ejemplo,
  activo = true,
  updated_at = NOW();

-- ============================================
-- PASO 3: Verificación
-- ============================================
SELECT nombre, categoria, wa_template_name, activo 
FROM whatsapp_templates 
WHERE activo = true 
ORDER BY nombre;
