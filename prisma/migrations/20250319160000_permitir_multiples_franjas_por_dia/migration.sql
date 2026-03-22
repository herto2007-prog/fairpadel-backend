-- Migración: Permitir múltiples franjas horarias por día
-- Cambia la restricción única de (tournamentId, fecha) a (tournamentId, fecha, horaInicio)
-- Esto permite configurar el mismo día con diferentes horarios (ej: mañana y tarde)

-- 1. Eliminar el índice único anterior
ALTER TABLE "torneo_disponibilidad_dias" 
DROP CONSTRAINT IF EXISTS "torneo_disponibilidad_dias_tournament_id_fecha_key";

-- 2. Crear el nuevo índice único incluyendo hora_inicio
ALTER TABLE "torneo_disponibilidad_dias" 
ADD CONSTRAINT "torneo_disponibilidad_dias_tournament_id_fecha_hora_key" 
UNIQUE ("tournament_id", "fecha", "hora_inicio");

-- Nota: Si hay datos duplicados (misma fecha, mismo torneo, misma hora_inicio),
-- esta migración fallará. En ese caso, se deben eliminar los duplicados primero.
