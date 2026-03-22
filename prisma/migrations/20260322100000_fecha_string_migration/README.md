# Migración: DateTime → String para Fechas

## Resumen

Todas las fechas de "negocio" han sido migradas de `DateTime @db.Timestamptz` a `String` en formato `YYYY-MM-DD`.

## Motivación

- **Eliminar bugs de timezone** - Paraguay (UTC-3) causaba que las fechas mostraran un día antes
- **Simplicidad** - Las fechas se guardan y muestran exactamente como se ingresan
- **Consistencia** - Igual que las horas que ya eran String (HH:mm)

## Tablas Modificadas

| Tabla | Columnas |
|-------|----------|
| `tournaments` | `fecha_inicio`, `fecha_fin`, `fecha_finales`, `fecha_limite_inscr` |
| `circuitos` | `fecha_inicio`, `fecha_fin`, `fecha_limite_inscripcion` |
| `torneo_disponibilidad_dias` | `fecha` |
| `matches` | `fecha_programada` |
| `users` | `fecha_nacimiento`, `fecha_fin_premium` |
| `pagos` | `fecha_pago`, `fecha_confirmacion` |
| `historial_puntos` | `fecha_torneo` |
| `solicitudes_jugar` | `fecha_propuesta` |
| `suscripciones` | `fecha_inicio`, `fecha_fin`, `fecha_renovacion` |
| `cupones` | `fecha_inicio`, `fecha_expiracion` |
| `banners` | `fecha_inicio`, `fecha_fin` |
| `ascensos_pendientes` | `fecha_calculo`, `fecha_revision` |
| `instructor_bloqueos` | `fecha_inicio`, `fecha_fin` |
| `reservas_instructor` | `fecha` |
| `pagos_instructor` | `fecha` |
| `alquiler_bloqueos` | `fecha_inicio`, `fecha_fin` |
| `reservas_canchas` | `fecha` |
| `reservas_mensualeros` | `fecha` |

## Deploy en Producción

```bash
# Opción 1: SQL directo (recomendado para control)
psql $DATABASE_URL -f prisma/migrations/20260322100000_fecha_string_migration/migration.sql

# Opción 2: Prisma migrate (si funciona conexión)
npx prisma migrate deploy
```

## Recuperación de Error P3009 (Migración Fallida)

Si la migración falla con error P3009:

```bash
# 1. Conectar a BD de Railway
psql $DATABASE_URL

# 2. Marcar la migración fallida como resuelta (baselining)
DELETE FROM "_prisma_migrations" 
WHERE "migration_name" = '20260322100000_fecha_string_migration' 
AND "finished_at" IS NULL;

# 3. O si está parcialmente aplicada, marcar como completada:
UPDATE "_prisma_migrations" 
SET "finished_at" = NOW(), "applied_steps_count" = 1
WHERE "migration_name" = '20260322100000_fecha_string_migration';

# 4. Verificar estado
SELECT * FROM "_prisma_migrations" ORDER BY "started_at" DESC;
```

## Notas Post-Migración

- Las fechas se comparan ahora como strings: `hoy > torneo.fechaInicio`
- Se eliminaron todos los `new Date(fecha + 'T03:00:00.000Z')`
- Los castings `(as unknown as string)` pueden eliminarse tras regenerar tipos de Prisma
- **Fechas de sistema** (createdAt, updatedAt, expiresAt) se mantienen como DateTime

## Historial de Fixes

- **2026-03-22**: SQL original falló por columna `fecha_aprobacion` inexistente en `circuitos`
- **2026-03-22**: SQL actualizado con bloques DO/EXCEPTION para manejar columnas inexistentes
