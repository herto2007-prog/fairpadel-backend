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
| `circuitos` | `fecha_inicio`, `fecha_fin`, `fecha_limite_inscripcion`, `fecha_aprobacion` |
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

## Campos QUE NO cambiaron (se mantienen DateTime)

- `createdAt`, `updatedAt` (todos los modelos)
- `expiresAt`, `expiraAt` (tokens, invitaciones)
- `respondedAt`, `confirmadoEn`
- `fechaAprobacion` (circuitos - timestamp de sistema)
- `horaInicioReal`, `horaFinReal` (matches - timestamps reales)
- `fechaRecordatorio` (checklist - incluye hora)

## Aplicar en Producción

### Opción 1: SQL Directo (Recomendado)

```bash
# Conectarse a la BD de Railway y ejecutar:
psql $DATABASE_URL -f prisma/migrations/fecha_string_migration/migration.sql
```

### Opción 2: Prisma Migrate (si funciona la conexión)

```bash
npx prisma migrate dev --name fecha_string_migration
```

## Verificación

```sql
-- Verificar que las columnas son varchar
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name LIKE '%fecha%'
ORDER BY table_name, column_name;
```

## Notas para Desarrollo

- Las fechas ahora se comparan como strings: `hoy > torneo.fechaInicio`
- El formato siempre es `YYYY-MM-DD`
- Los DTOs usan `@Matches(/^\d{4}-\d{2}-\d{2}$/)` para validar
- Se eliminaron todos los `new Date(fecha + 'T03:00:00.000Z')`
- Se agregaron castings temporales `(fecha as unknown as string)` hasta regenerar tipos de Prisma
