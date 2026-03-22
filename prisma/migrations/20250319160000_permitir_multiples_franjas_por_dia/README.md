# Migración: Permitir Múltiples Franjas Horarias por Día

## Descripción
Cambia la restricción única de la tabla `torneo_disponibilidad_dias` para permitir configurar el mismo día con diferentes horarios.

## Cambio Técnico

**Antes:**
```sql
UNIQUE (tournament_id, fecha)
```
Solo permitía un registro por día por torneo.

**Después:**
```sql
UNIQUE (tournament_id, fecha, hora_inicio)
```
Permite múltiples registros con la misma fecha pero diferente hora de inicio.

## Caso de Uso

```
📅 Días configurados:
├─ 27/03/2026 | 14:00 - 18:00 | Canchas 1,2 | Mañana
├─ 27/03/2026 | 18:00 - 23:00 | Canchas 1,2,3,4 | Tarde
└─ 28/03/2026 | 10:00 - 14:00 | Canchas 3,4 | Otro día
```

Esto permite:
- Configurar franjas horarias diferentes en el mismo día
- Usar diferentes canchas en cada franja
- Mayor flexibilidad para torneos complejos

## SQL de Aplicación

```bash
# En Railway Console o psql directo:
psql $DATABASE_URL -f prisma/migrations/20250319160000_permitir_multiples_franjas_por_dia/migration.sql
```

O aplicar automáticamente con el deploy (Dockerfile ejecuta `prisma migrate deploy`).

## Archivos Modificados

- `prisma/schema.prisma` - Cambio en @@unique
- `src/modules/bracket/canchas-sorteo.service.ts` - Usa nueva clave
- `src/modules/admin/admin-disponibilidad.controller.ts` - Usa nueva clave
- `src/modules/admin/admin-torneos.controller.ts` - Usa nueva clave
