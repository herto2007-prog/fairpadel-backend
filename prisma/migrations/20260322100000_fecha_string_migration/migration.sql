-- Migration: Convertir fechas de DateTime a String (YYYY-MM-DD)
-- Fecha: 2026-03-22
-- 
-- Este script migra todas las fechas de negocio de timestamptz a varchar(10)
-- Eliminando problemas de timezone para siempre
-- 
-- NOTA: Usa DO $$ BEGIN ... EXCEPTION ... END $$ para manejar columnas inexistentes

-- Función auxiliar para convertir fecha
CREATE OR REPLACE FUNCTION convert_fecha_to_string(fecha timestamptz) RETURNS varchar(10) AS $$
BEGIN
  RETURN to_char(fecha::timestamp, 'YYYY-MM-DD');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. TORNEO - fechas principales
-- ============================================
DO $$
BEGIN
  ALTER TABLE "tournaments" ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING convert_fecha_to_string("fecha_inicio");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "tournaments" ALTER COLUMN "fecha_fin" TYPE varchar(10) USING convert_fecha_to_string("fecha_fin");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "tournaments" ALTER COLUMN "fecha_finales" TYPE varchar(10) USING convert_fecha_to_string("fecha_finales");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "tournaments" ALTER COLUMN "fecha_limite_inscr" TYPE varchar(10) USING convert_fecha_to_string("fecha_limite_inscr");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 2. CIRCUITOS - fechas de circuito
-- ============================================
DO $$
BEGIN
  ALTER TABLE "circuitos" ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING convert_fecha_to_string("fecha_inicio");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "circuitos" ALTER COLUMN "fecha_fin" TYPE varchar(10) USING convert_fecha_to_string("fecha_fin");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "circuitos" ALTER COLUMN "fecha_limite_inscripcion" TYPE varchar(10) USING convert_fecha_to_string("fecha_limite_inscripcion");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- fecha_aprobacion está en torneo_circuitos, no en circuitos
DO $$
BEGIN
  ALTER TABLE "circuitos" ALTER COLUMN "fecha_aprobacion" TYPE varchar(10) USING convert_fecha_to_string("fecha_aprobacion");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 3. DISPONIBILIDAD DE DÍAS - fecha del día de juego
-- ============================================
DO $$
BEGIN
  ALTER TABLE "torneo_disponibilidad_dias" ALTER COLUMN "fecha" TYPE varchar(10) USING convert_fecha_to_string("fecha");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 4. PARTIDOS - fecha programada
-- ============================================
DO $$
BEGIN
  ALTER TABLE "matches" ALTER COLUMN "fecha_programada" TYPE varchar(10) USING convert_fecha_to_string("fecha_programada");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 5. USUARIOS - fecha de nacimiento
-- ============================================
DO $$
BEGIN
  ALTER TABLE "users" ALTER COLUMN "fecha_nacimiento" TYPE varchar(10) USING convert_fecha_to_string("fecha_nacimiento");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "users" ALTER COLUMN "fecha_fin_premium" TYPE varchar(10) USING convert_fecha_to_string("fecha_fin_premium");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 6. PAGOS - fechas de pago
-- ============================================
DO $$
BEGIN
  ALTER TABLE "pagos" ALTER COLUMN "fecha_pago" TYPE varchar(10) USING convert_fecha_to_string("fecha_pago");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "pagos" ALTER COLUMN "fecha_confirmacion" TYPE varchar(10) USING convert_fecha_to_string("fecha_confirmacion");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 7. HISTORIAL DE PUNTOS - fecha del torneo
-- ============================================
DO $$
BEGIN
  ALTER TABLE "historial_puntos" ALTER COLUMN "fecha_torneo" TYPE varchar(10) USING convert_fecha_to_string("fecha_torneo");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 8. SOLICITUDES JUGAR - fecha propuesta
-- ============================================
DO $$
BEGIN
  ALTER TABLE "solicitudes_jugar" ALTER COLUMN "fecha_propuesta" TYPE varchar(10) USING convert_fecha_to_string("fecha_propuesta");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 9. SUSCRIPCIONES - fechas de suscripción
-- ============================================
DO $$
BEGIN
  ALTER TABLE "suscripciones" ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING convert_fecha_to_string("fecha_inicio");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "suscripciones" ALTER COLUMN "fecha_fin" TYPE varchar(10) USING convert_fecha_to_string("fecha_fin");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "suscripciones" ALTER COLUMN "fecha_renovacion" TYPE varchar(10) USING convert_fecha_to_string("fecha_renovacion");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 10. CUPONES - fechas de validez
-- ============================================
DO $$
BEGIN
  ALTER TABLE "cupones" ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING convert_fecha_to_string("fecha_inicio");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "cupones" ALTER COLUMN "fecha_expiracion" TYPE varchar(10) USING convert_fecha_to_string("fecha_expiracion");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 11. BANNERS - fechas de publicación
-- ============================================
DO $$
BEGIN
  ALTER TABLE "banners" ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING convert_fecha_to_string("fecha_inicio");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "banners" ALTER COLUMN "fecha_fin" TYPE varchar(10) USING convert_fecha_to_string("fecha_fin");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 12. ASCENSOS PENDIENTES - fechas de cálculo y revisión
-- ============================================
DO $$
BEGIN
  ALTER TABLE "ascensos_pendientes" ALTER COLUMN "fecha_calculo" TYPE varchar(10) USING convert_fecha_to_string("fecha_calculo");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "ascensos_pendientes" ALTER COLUMN "fecha_revision" TYPE varchar(10) USING convert_fecha_to_string("fecha_revision");
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 13. INSTRUCTORES BLOQUEOS - fechas de bloqueo
-- ============================================
DO $$
BEGIN
  ALTER TABLE "instructor_bloqueos" ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::date, 'YYYY-MM-DD');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "instructor_bloqueos" ALTER COLUMN "fecha_fin" TYPE varchar(10) USING to_char("fecha_fin"::date, 'YYYY-MM-DD');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 14. RESERVAS INSTRUCTOR - fecha de clase
-- ============================================
DO $$
BEGIN
  ALTER TABLE "reservas_instructor" ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::date, 'YYYY-MM-DD');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 15. PAGOS INSTRUCTOR - fecha de pago
-- ============================================
DO $$
BEGIN
  ALTER TABLE "pagos_instructor" ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::date, 'YYYY-MM-DD');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 16. ALQUILER BLOQUEOS - fechas de bloqueo
-- ============================================
DO $$
BEGIN
  ALTER TABLE "alquiler_bloqueos" ALTER COLUMN "fecha_inicio" TYPE varchar(10) USING to_char("fecha_inicio"::date, 'YYYY-MM-DD');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "alquiler_bloqueos" ALTER COLUMN "fecha_fin" TYPE varchar(10) USING to_char("fecha_fin"::date, 'YYYY-MM-DD');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 17. RESERVAS CANCHA - fecha de reserva
-- ============================================
DO $$
BEGIN
  ALTER TABLE "reservas_canchas" ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::date, 'YYYY-MM-DD');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- ============================================
-- 18. RESERVAS MENSUALERO - fecha de reserva
-- ============================================
DO $$
BEGIN
  ALTER TABLE "reservas_mensualeros" ALTER COLUMN "fecha" TYPE varchar(10) USING to_char("fecha"::date, 'YYYY-MM-DD');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- Limpiar función auxiliar
DROP FUNCTION IF EXISTS convert_fecha_to_string;

-- ============================================
-- Verificación: consultar las columnas modificadas
-- ============================================
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND column_name LIKE '%fecha%'
-- ORDER BY table_name, column_name;
