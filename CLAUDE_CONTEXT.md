# CLAUDE CONTEXT — FairPadel Project Knowledge Base

> Última actualización: Marzo 2026
> Estado: CRÍTICO — Migración v2 de enums en progreso

---

## 1. ¿QUÉ ES FAIRPADEL?

**FairPadel** es una plataforma full-stack para gestión de torneos de pádel (padel tennis) enfocada en el mercado paraguayo.

**Funcionalidades principales:**
- Gestión de torneos (crear, publicar, inscribir, sortear fixture)
- Inscripciones de parejas con pagos (Bancard, transferencia, efectivo)
- Fixture con acomodación paraguaya (R1 → R2 → Bracket)
- Rankings globales y por categoría
- Gestión de sedes y canchas
- Circuitos/ligas de torneos
- Galería de fotos (Cloudinary)
- Sistema de notificaciones
- Subscripciones Premium
- Instructores y reservas de canchas

---

## 2. ESTRUCTURA TÉCNICA

### Monorepo
```
d:\fairpadel/
├── backend/          # API NestJS (puerto 3000)
│   ├── prisma/
│   │   ├── schema.prisma    # Schema actual (V2 en desarrollo)
│   │   ├── seed.ts          # Seed de datos iniciales
│   │   └── migrations/      # Migraciones de BD
│   └── src/
│       ├── auth/
│       ├── tournaments/
│       ├── inscripciones/   # ✅ NUEVO: Invitaciones
│       ├── matches/         # ✅ NUEVO: R2 Engine + Scheduling Engine
│       ├── commands/        # ✅ NUEVO: API v2 CQRS
│       └── ...
├── frontend/         # React + Vite (puerto 5173)
└── [docs]
```

### Tech Stack
- **Backend:** NestJS 10, Prisma 5, PostgreSQL, JWT Auth, Cloudinary, Resend
- **Frontend:** React 19, TailwindCSS, Zustand, React Query, Axios

---

## 3. PROBLEMA CRÍTICO ACTUAL — ENUMS INCONSISTENTES

### Historial del Problema
La migración `20260215140000_simplify_plans_add_feed` simplificó varios enums, pero el schema de Prisma v2 fue actualizado posteriormente con valores completos, causando inconsistencias.

### Enums Afectados (CRÍTICO)

| Enum | Estado en BD | Estado en Schema v2 | Migración Creada |
|------|--------------|---------------------|------------------|
| **PlanTipo** | `UNICO` | `MENSUAL`, `ANUAL` | ✅ `20260305000003_fix_plan_tipo_values` |
| **PeriodoSuscripcion** | `MENSUAL` | `MENSUAL`, `TRIMESTRAL`, `SEMESTRAL`, `ANUAL` | ✅ `20260305000004_fix_periodo_suscripcion` |
| **SuscripcionEstado** | `ACTIVA`, `VENCIDA`, `CANCELADA`, `PENDIENTE_PAGO` | `PENDIENTE`, `ACTIVA`, `CANCELADA`, `EXPIRADA` | ✅ `20260305000005_fix_suscripcion_estado` |

### Error Actual
```
Invalid input value for enum "PlanTipo": "MENSUAL"
```

### Causa Raíz
La migración `20260215140000_simplify_plans_add_feed` (15 Feb 2026) hizo:
```sql
CREATE TYPE "PlanTipo_new" AS ENUM ('UNICO');
DROP TYPE "PlanTipo";
ALTER TYPE "PlanTipo_new" RENAME TO "PlanTipo";
```

Pero el schema actual espera `MENSUAL`/`ANUAL`.

### Solución Implementada
Se crearon migraciones para restaurar los enums a los valores del schema v2:
1. `20260305000003_fix_plan_tipo_values` — Restaura PlanTipo
2. `20260305000004_fix_periodo_suscripcion` — Restaura PeriodoSuscripcion
3. `20260305000005_fix_suscripcion_estado` — Restaura SuscripcionEstado

---

## 4. MIGRACIONES V2 COMPLETADAS

### Semana 1-3: Fundamentos
- Corrección de enums (RECHAZADO/RECHAZADA, etc.)
- Actualización de tipos en frontend
- Tests pasando

### Semana 4: R2 Engine + Scheduling Engine ✅
- `src/matches/r2-engine/` — Motor de reglas para Zona 2
- `src/matches/scheduling-engine/` — Motor de scheduling de partidos

### Semana 5: Sistema de Invitaciones ✅
- `src/inscripciones/invitaciones.service.ts`
- Tabla `InvitacionJugador` en schema
- Sistema de email tokens para jugador2

### Semana 6: API de Comandos (CQRS) ✅
- `src/commands/` — Command Bus + Handlers
- API v2 en `/api/v2/commands/*`

---

## 5. MIGRACIONES DE SCHEMA PENDIENTES

### ✅ Completadas:
1. Columnas de User: `password`, `pais`, `fecha_fin_premium`, etc.
2. Enum PlanTipo: `UNICO` → `MENSUAL`, `ANUAL`
3. Enum PeriodoSuscripcion: `MENSUAL` → 4 valores
4. Enum SuscripcionEstado: valores actualizados

### Pendiente de Deploy:
- Todas las migraciones están commiteadas y listas para Railway

---

## 6. REGLAS PARA EL AGENTE (CLAUDE)

### ❌ PROHIBIDO HACER:
1. **NO** asumir que el schema es correcto
2. **NO** crear migraciones sin verificar BD real primero
3. **NO** cambiar campos en schema sin comparar con BD
4. **NO** agregar "auto-fixes" al código
5. **NO** eliminar campos existentes sin confirmar
6. **NO** pushear sin revisar migraciones anteriores

### ✅ OBLIGATORIO HACER:
1. **SIEMPRE** comparar schema vs BD real antes de cambiar
2. **SIEMPRE** revisar backups del schema
3. **SIEMPRE** preguntar cuando haya inconsistencias
4. **SIEMPRE** probar en local antes de pushear
5. **SIEMPRE** documentar cambios en este archivo
6. **SIEMPRE** revisar historial de migraciones antes de crear nuevas

### 🔍 INVESTIGAR PRIMERO:
- ¿Existe backup del schema original?
- ¿Qué campos tiene la BD real?
- ¿Cuál es el objetivo final de la migración v2?
- ¿Qué valores tienen los enums en la BD vs schema?

---

## 7. ESTADO ACTUAL DE REPOS

| Repo | Commit | Estado |
|------|--------|--------|
| fairpadel-backend | `416cfe2` | ⚠️ Enums corregidos, pendiente deploy |
| fairpadel-frontend | `7fc8003` | ✅ Tipos actualizados |

### Migraciones Creadas (no deployadas):
1. `20260305000001_migrate_to_v2_schema` — Columnas User
2. `20260305000002_fix_plan_tipo_enum` — (versión alternativa, puede ignorarse)
3. `20260305000003_fix_plan_tipo_values` — Enum PlanTipo (CORRECTO)
4. `20260305000004_fix_periodo_suscripcion` — Enum PeriodoSuscripcion
5. `20260305000005_fix_suscripcion_estado` — Enum SuscripcionEstado

---

## 8. ANÁLISIS DE INCONSISTENCIAS

### Proceso de Investigación Realizado:

1. **Error inicial:** Seed fallaba con `users.password` no existe
2. **Investigación:** Schema tenía campos que BD no tenía
3. **Decisión:** Schema es fuente de verdad, migrar BD
4. **Nuevo error:** `PlanTipo` no acepta `MENSUAL`
5. **Investigación profunda:**
   - Revisé migración `20260215140000_simplify_plans_add_feed`
   - Encontré que cambió PlanTipo a `UNICO`
   - Encontré que cambió PeriodoSuscripcion a solo `MENSUAL`
   - Comparé con schema actual
6. **Solución:** Crear migraciones para restaurar enums

### Lección Aprendida:
Siempre revisar el historial de migraciones antes de crear nuevas. Los enums modificados en el pasado pueden causar conflictos si el schema se actualiza posteriormente.

---

## 9. PRÓXIMOS PASOS

1. ✅ Commit y push de migraciones de enums
2. 🔄 Deploy en Railway (ejecutará `migrate deploy`)
3. 🔄 Verificar que seed funcione correctamente
4. 🔄 Si hay más errores, repetir proceso de investigación

---

## NOTAS ADICIONALES

- Railway ejecuta: `npx prisma migrate deploy && npm run seed`
- Las migraciones son idempotentes donde es posible
- Datos existentes se migran (ej: 'UNICO' → 'MENSUAL')
- Documentar cualquier nuevo conflicto encontrado

---

**Documento actualizado después de investigación exhaustiva de enums.**
