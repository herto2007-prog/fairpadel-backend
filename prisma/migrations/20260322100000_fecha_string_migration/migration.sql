-- Migration: Convertir fechas de DateTime a String (YYYY-MM-DD)
-- Fecha: 2026-03-19
-- 
-- Este script migra todas las fechas de negocio de timestamptz a varchar(10)
-- Eliminando problemas de timezone para siempre

-- ============================================
-- 1. TORNEO - fechas principales
-- ============================================
ALTER TABLE "tournaments" 
  ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_fin" TYPE varchar(10) USING to_char("fecha_fin"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_finales" TYPE varchar(10) USING to_char("fecha_finales"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_limite_inscr" TYPE varchar(10) USING to_char("fecha_limite_inscr"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 2. CIRCUITOS - fechas de circuito
-- ============================================
ALTER TABLE "circuitos" 
  ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_fin" TYPE varchar(10) USING to_char("fecha_fin"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_limite_inscripcion" TYPE varchar(10) USING to_char("fecha_limite_inscripcion"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_aprobacion" TYPE varchar(10) USING to_char("fecha_aprobacion"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 3. DISPONIBILIDAD DE DÍAS - fecha del día de juego
-- ============================================
ALTER TABLE "torneo_disponibilidad_dias" 
  ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 4. PARTIDOS - fecha programada
-- ============================================
ALTER TABLE "matches" 
  ALTER COLUMN "fecha_programada" TYPE varchar(10) USING to_char("fecha_programada"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 5. USUARIOS - fecha de nacimiento
-- ============================================
ALTER TABLE "users" 
  ALTER COLUMN "fecha_nacimiento" TYPE varchar(10) USING to_char("fecha_nacimiento"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_fin_premium" TYPE varchar(10) USING to_char("fecha_fin_premium"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 6. PAGOS - fechas de pago
-- ============================================
ALTER TABLE "pagos" 
  ALTER COLUMN "fecha_pago" TYPE varchar(10) USING to_char("fecha_pago"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_confirmacion" TYPE varchar(10) USING to_char("fecha_confirmacion"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 7. HISTORIAL DE PUNTOS - fecha del torneo
-- ============================================
ALTER TABLE "historial_puntos" 
  ALTER COLUMN "fecha_torneo" TYPE varchar(10) USING to_char("fecha_torneo"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 8. SOLICITUDES JUGAR - fecha propuesta
-- ============================================
ALTER TABLE "solicitudes_jugar" 
  ALTER COLUMN "fecha_propuesta" TYPE varchar(10) USING to_char("fecha_propuesta"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 9. SUSCRIPCIONES - fechas de suscripción
-- ============================================
ALTER TABLE "suscripciones" 
  ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_fin" TYPE varchar(10) USING to_char("fecha_fin"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_renovacion" TYPE varchar(10) USING to_char("fecha_renovacion"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 10. CUPONES - fechas de validez
-- ============================================
ALTER TABLE "cupones" 
  ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_expiracion" TYPE varchar(10) USING to_char("fecha_expiracion"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 11. BANNERS - fechas de publicación
-- ============================================
ALTER TABLE "banners" 
  ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_fin" TYPE varchar(10) USING to_char("fecha_fin"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 12. ASCENSOS PENDIENTES - fechas de cálculo y revisión
-- ============================================
ALTER TABLE "ascensos_pendientes" 
  ALTER COLUMN "fecha_calculo" TYPE varchar(10) USING to_char("fecha_calculo"::timestamp, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_revision" TYPE varchar(10) USING to_char("fecha_revision"::timestamp, 'YYYY-MM-DD');

-- ============================================
-- 13. INSTRUCTORES BLOQUEOS - fechas de bloqueo
-- ============================================
ALTER TABLE "instructor_bloqueos" 
  ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::date, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_fin" TYPE varchar(10) USING to_char("fecha_fin"::date, 'YYYY-MM-DD');

-- ============================================
-- 14. RESERVAS INSTRUCTOR - fecha de clase
-- ============================================
ALTER TABLE "reservas_instructor" 
  ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::date, 'YYYY-MM-DD');

-- ============================================
-- 15. PAGOS INSTRUCTOR - fecha de pago
-- ============================================
ALTER TABLE "pagos_instructor" 
  ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::date, 'YYYY-MM-DD');

-- ============================================
-- 16. ALQUILER BLOQUEOS - fechas de bloqueo
-- ============================================
ALTER TABLE "alquiler_bloqueos" 
  ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::date, 'YYYY-MM-DD'),
  ALTER COLUMN "fecha_fin" TYPE varchar(10) USING to_char("fecha_fin"::date, 'YYYY-MM-DD');

-- ============================================
-- 17. RESERVAS CANCHA - fecha de reserva
-- ============================================
ALTER TABLE "reservas_canchas" 
  ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::date, 'YYYY-MM-DD');

-- ============================================
-- 18. RESERVAS MENSUALERO - fecha de reserva
-- ============================================
ALTER TABLE "reservas_mensualeros" 
  ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::date, 'YYYY-MM-DD');

-- ============================================
-- Verificación: consultar las columnas modificadas
-- ============================================
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND column_name LIKE '%fecha%'
-- ORDER BY table_name, column_name;
