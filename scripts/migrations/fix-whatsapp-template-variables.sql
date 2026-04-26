-- Migracion: Corregir variables de templates de WhatsApp
-- Fecha: 2026-04-15
-- Issue: El codigo pasa variables como {'1': valor, '2': valor} pero los templates
--        en BD tenian nombres descriptivos que no coincidian.
-- Solucion: Actualizar el campo parametros para usar keys numericas.

UPDATE whatsapp_templates
SET parametros = '{"contenido":"Datos de tu reserva confirmada: Cancha numero {{1}} asignada para fecha {{2}} segun disponibilidad.","variables":["1","2"]}'
WHERE nombre = 'reserva_confirmada';

UPDATE whatsapp_templates
SET parametros = '{"contenido":"Detalles de tu sede confirmada: {{1}}. Presentarse 15 minutos antes del horario.","variables":["1"]}'
WHERE nombre = 'reserva_sede_info';

UPDATE whatsapp_templates
SET parametros = '{"contenido":"Fecha confirmada para tu partido: {{1}} a las {{2}} segun fixture oficial.","variables":["1","2"]}'
WHERE nombre = 'torneo_fecha_partido';

UPDATE whatsapp_templates
SET parametros = '{"contenido":"Tu inscripcion al torneo {{1}} esta registrada en la categoria {{2}}.","variables":["1","2"]}'
WHERE nombre = 'torneo_inscripcion_confirmada';

UPDATE whatsapp_templates
SET parametros = '{"contenido":"Recordatorio de tu reserva: El partido es manana en sede {{1}} a las {{2}} segun confirmacion previa.","variables":["1","2"]}'
WHERE nombre = 'recordatorio_24h';

UPDATE whatsapp_templates
SET parametros = '{"contenido":"Recordatorio para hoy: Te esperamos en sede {{1}} a las {{2}} segun tu reserva registrada.","variables":["1","2"]}'
WHERE nombre = 'recordatorio_4h';

UPDATE whatsapp_templates
SET parametros = '{"contenido":"Informacion de tu torneo: La pareja asignada es el jugador {{1}} en categoria {{2}} segun registro.","variables":["1","2"]}'
WHERE nombre = 'torneo_pareja_asignada';

UPDATE whatsapp_templates
SET parametros = '{"contenido":"Informacion del fixture: El rival asignado es {{1}} en el torneo {{2}} segun programacion.","variables":["1","2"]}'
WHERE nombre = 'torneo_rival_asignado';

-- Verificacion
SELECT nombre, parametros FROM whatsapp_templates WHERE nombre IN (
  'reserva_confirmada', 'reserva_sede_info', 'torneo_fecha_partido',
  'torneo_inscripcion_confirmada', 'recordatorio_24h', 'recordatorio_4h',
  'torneo_pareja_asignada', 'torneo_rival_asignado'
);
