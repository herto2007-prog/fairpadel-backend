# Reglas de Programación - FairPadel

> Documento de oro para desarrollo. Violaciones = bugs en producción.
> **Para nuevos agentes:** Leer completo antes de tocar código. Cuando dudes, preguntar.

---

## 0. Información Crítica del Proyecto (LEER PRIMERO)

### URLs y Accesos
| Servicio | URL | Notas |
|----------|-----|-------|
| Frontend Prod | https://www.fairpadel.com | Deploy automático desde main |
| Backend Prod | https://api.fairpadel.com | Railway + PostgreSQL |
| Health Check | https://api.fairpadel.com/api/health | Para verificar estado |

### Repositorios (GitHub)
```bash
# Backend (este repo)
https://github.com/herto2007-prog/fairpadel-backend.git

# Frontend (repo separado - SIEMPRE CLONAR EN d:\fairpadel\frontend)
https://github.com/herto2007-prog/fairpadel-frontend.git
```

### Estructura de Carpetas del Frontend
**Ruta local:** `d:\fairpadel\frontend\`

```
frontend/
├── src/
│   ├── features/
│   │   ├── organizador/          ← Panel de organizador
│   │   │   ├── components/
│   │   │   │   ├── bracket/      ← BracketManager, ConfigurarBracketModal
│   │   │   │   ├── checklist/
│   │   │   │   ├── disponibilidad/
│   │   │   │   └── inscripciones/
│   │   │   └── pages/
│   │   ├── tournaments/
│   │   ├── auth/
│   │   └── ...
│   ├── components/
│   ├── pages/
│   └── services/
```

**IMPORTANTE:** El frontend NUNCA debe estar dentro de `node_modules/`, `dist/` o `docs/`.

### Stack Tecnológico
- **Backend:** NestJS + Prisma + PostgreSQL + TypeScript
- **Frontend:** React 18 + Vite + Tailwind CSS + framer-motion
- **Deploy:** Railway (Docker) + GitHub Actions
- **BD:** PostgreSQL en Railway (producción), SQLite local (dev opcional)

### Documentación de Contexto
- **`Kimi_Context_Fairpadel.md`** - Historial completo de decisiones, features implementados, estado del proyecto
- **`REGLAS_PROGRAMACION.md`** - Este documento (reglas de código)

**REGLA DE ORO:** Siempre leer `Kimi_Context_Fairpadel.md` al inicio de sesión para entender el estado actual.

---

## 1. Ley de Oro del Deploy

**"Probar localmente y si todo corre bien, ahí recién pushear"**

- Siempre ejecutar `npm run build` antes de pushear
- Verificar 0 errores de TypeScript
- Verificar 0 errores de ESLint
- Solo entonces: `git push`

❌ **NUNCA** pushear código sin compilar localmente primero.

**Para nuevos agentes:** Si ves errores de TypeScript que no entiendes, NO uses `any`. Pregunta primero.

---

## 2. Visión Sistémica vs. Apagar Incendios

**"Entender el sistema como un todo, no solamente apagar el incendio, ver más allá y prever todo"**

- No hacer fixes rápidos sin entender el impacto completo
- Analizar cómo el cambio afecta otras partes del sistema
- Pensar en la arquitectura a largo plazo
- Prever consecuencias antes de implementar

❌ **NUNCA** aplicar un parche sin entender por qué falla y qué más podría romper.

---

## 3. Regla del Negocio Primero

**"No apagues incendios, soluciona según la regla del negocio"**

- Cada solución debe alinearse con la lógica real de FairPadel
- Entender el dominio antes de codear (pádel, torneos, categorías PY, etc.)
- Cuando hay duda, preguntar cómo funciona en la realidad
- El código debe reflejar el negocio, no al revés

✅ **SIEMPRE** preguntar: "¿Así es como funciona en un torneo real de pádel en Paraguay?"

---

## 4. Validación Estricta Backend

- Usar `class-validator` con decoradores (`@IsString`, `@IsOptional`, `@IsEnum`, etc.)
- Enviar `undefined` en lugar de strings vacíos (`""`) para campos opcionales
- Configuración obligatoria del ValidationPipe:
  ```typescript
  whitelist: true,
  forbidNonWhitelisted: true,
  ```
- Los DTOs deben tener decoradores, no solo tipos TypeScript

❌ **NUNCA** enviar strings vacíos a campos opcionales de Prisma.

---

## 5. Protección de Datos

**La base de datos es sagrada.**

- **NUNCA** usar `--force-reset` en producción
- Usar `--accept-data-loss` solo cuando sea absolutamente necesario
- Schema changes con migraciones controladas
- Backup mental: cada deploy podría afectar datos reales

❌ **PROHIBIDO** en Dockerfile/CI/CD: `prisma db push --force-reset`

---

## 6. Formatos Locales Paraguay

- **Moneda**: Guaraníes (Gs.) con separador de miles (ej: `Gs. 1.500.000`)
- **Fechas**: Locale `'es-PY'` (dd/mm/yyyy)
- **Teléfono**: Código país + número sin 0 inicial (ej: `+595 981 123456`)
- **Ciudades**: Autocomplete con ciudades de Paraguay

✅ **SIEMPRE** usar componentes específicos: `GuaraniesInput`, `CityAutocomplete`, `PhoneSelector`.

### 🕐 Manejo de Fechas y Timezone (CRÍTICO)

**Timezone del sistema:** `America/Asuncion` (Paraguay, UTC-3)

**REGLA DE ORO:** Todas las fechas se manejan en hora de Paraguay. NUNCA usar `new Date()` directamente sin considerar el timezone.

**✅ NUEVO FORMATO DE ALMACENAMIENTO (Marzo 2025):**
Las fechas se almacenan como **String `YYYY-MM-DD`** en PostgreSQL, NO como DateTime. Esto elimina completamente los bugs de timezone.

```typescript
// Base de datos (Prisma schema)
// ✅ CORRECTO - Almacenar como String
model Tournament {
  fechaInicio String // "2026-03-27" - Sin timezone, sin hora
  fechaFin    String // "2026-03-27"
}

// ❌ INCORRECTO - DateTime causa bugs de timezone
model Tournament {
  fechaInicio DateTime // No usar para fechas sin hora
}
```

**¿Por qué String YYYY-MM-DD?**
- Elimina conversiones de timezone innecesarias
- Una fecha "27 de marzo" siempre es "27 de marzo" sin importar el timezone
- El backend recibe YYYY-MM-DD y lo guarda directamente
- El frontend recibe YYYY-MM-DD y lo formatea sin crear Date objects

**⚠️ REGla CRÍTICA DE FORMATO (Anti-Bug de Fechas):**
NUNCA usar `new Date('YYYY-MM-DD')` en el frontend. Esto interpreta la fecha como UTC y al convertir a Paraguay (UTC-3) muestra el día anterior.

```typescript
// ❌ PROHIBIDO - Causa el bug de día anterior
new Date('2026-03-27').toLocaleDateString('es-PY') 
// → "26/03/2026" (¡UN DÍA ANTES!)

// ✅ CORRECTO - Usar funciones de date.ts que trabajan con strings
import { formatDatePY, formatDatePYLong, formatDatePYShort } from '../utils/date';

formatDatePY('2026-03-27')        // → "27/03/2026"
formatDatePYLong('2026-03-27')    // → "viernes, 27 de marzo"
formatDatePYShort('2026-03-27')   // → "27 Mar"
formatDatePYShort('2026-03-27', true) // → "27 Mar, 2026"
```

#### Backend (NestJS) - Manejo de Fechas

**DTOs - Recibir fechas del frontend:**
```typescript
// ✅ CORRECTO - Usar @Transform para extraer YYYY-MM-DD de ISO strings
import { Transform } from 'class-transformer';

export class ConfigurarDiaJuegoDto {
  @Transform(({ value }) => {
    // Extrae "2026-03-27" de "2026-03-27T00:00:00.000Z" o deja el string
    if (typeof value === 'string' && value.length > 10) {
      return value.substring(0, 10);
    }
    return value;
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD',
  })
  fecha: string; // "2026-03-27"
}
```

**Servicios - Guardar en BD:**
```typescript
// ✅ CORRECTO - Usar string YYYY-MM-DD directamente
async configurarDiaJuego(dto: ConfigurarDiaJuegoDto) {
  const fecha = dto.fecha; // Ya es "YYYY-MM-DD" desde el DTO
  
  await this.prisma.torneoDisponibilidadDia.upsert({
    where: { tournamentId_fecha: { tournamentId: dto.tournamentId, fecha } },
    create: {
      tournamentId: dto.tournamentId,
      fecha, // String YYYY-MM-DD - ¡Sin conversiones!
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
    },
    update: { /* ... */ }
  });
}
```

#### Frontend (React) - Manejo de Fechas

**Mostrar fechas al usuario:**
```typescript
// ✅ CORRECTO - Usar utilidades de date.ts
import { 
  formatDatePY,      // Formato: "27/03/2026"
  formatDatePYLong,  // Formato: "viernes, 27 de marzo"
  formatDatePYShort, // Formato: "27 Mar" o "27 Mar, 2026"
  formatDateTimePY,  // Formato: "27/03/2026 18:30"
  parseDatePY,       // Parsear a Date (solo cuando sea necesario)
  getDatesRangePY    // Generar rango de fechas
} from '../utils/date';

// El backend envía fechas como string "YYYY-MM-DD"
const fechaDesdeBackend = '2026-03-27';

// ✅ CORRECTO - Usar funciones que trabajan con strings directamente
<span>{formatDatePY(fechaDesdeBackend)}</span>           // "27/03/2026"
<span>{formatDatePYLong(fechaDesdeBackend)}</span>       // "viernes, 27 de marzo"
<span>{formatDatePYShort(fechaDesdeBackend, true)}</span> // "27 Mar, 2026"
```

**Enviar fechas al backend:**
```typescript
// ✅ CORRECTO - Enviar string YYYY-MM-DD
const fecha = '2026-03-27'; // String en formato YYYY-MM-DD

await api.post('/endpoint', {
  fecha, // El backend extraerá YYYY-MM-DD si viene como ISO
  // o usa el string directamente
});
```

#### ❌ PROHIBIDO
```typescript
// ❌ NUNCA usar new Date() con strings YYYY-MM-DD del backend
const fecha = new Date('2026-03-27'); // Interpreta como UTC 00:00
fecha.toLocaleDateString('es-PY');    // → "26/03/2026" (¡BUG! día anterior)

// ❌ NUNCA usar toLocaleDateString directamente
new Date(fechaString).toLocaleDateString('es-PY'); // Bug de timezone

// ❌ NUNCA asumir que Date() interpreta en hora local
const fecha = new Date(); // Puede dar hora UTC en el servidor
```

**Archivos clave:**
- **Frontend:** `src/utils/date.ts` - Funciones `formatDatePY`, `formatDatePYLong`, `formatDatePYShort`
- **Backend:** DTOs con `@Transform` para extraer YYYY-MM-DD de ISO strings
- **Backend:** `paraguay-timezone.interceptor.ts` - Desactivado para fechas (solo para datetimes)

**Migración completada (Marzo 2025):**
- ✅ 18 tablas migradas de DateTime a String (YYYY-MM-DD)
- ✅ Todos los DTOs actualizados con `@Transform`
- ✅ Frontend: ~23 reemplazos de `toLocaleDateString` por funciones de `date.ts`
- ✅ Nuevas funciones: `formatDatePYLong()`, `formatDatePYShort()`
- Frontend: `src/utils/date.ts`

---

## 7. Sistema de Diseño UI/UX

### Estilo Visual FairPadel
- **Fondo:** `bg-dark` (#0a0b0f) + `BackgroundEffects` (gradientes + grid)
- **Color primario:** `#df2531` (rojo FairPadel)
- **Bordes sutiles:** `border-white/5` o `border-white/10`
- **Fondos cards:** `bg-white/[0.02]` o `bg-white/5`
- **Tipografía:** Blanco con opacidades (`text-white/40` para secundarios)

### Densidad de UI
Tenemos **DOS modos** de UI:

**1. Landing (Marketing):**
- Espaciado generoso (`py-16`, `p-8`)
- Textos grandes (`text-4xl`, `text-lg`)
- Hero con impacto visual

**2. Páginas Internas (Compacta):**
- Espaciado reducido (`py-4`, `p-4`)
- Textos densos (`text-base`, `text-sm`, `text-xs`)
- Máxima información por pantalla
- Wizards con pasos comprimidos

**REGLA:** Si es página de gestión/admin/inscripción → usar estilo compacto.

### Componentes Base Obligatorios

**BackgroundEffects** (`src/components/ui/BackgroundEffects.tsx`)
```tsx
// Siempre incluir en páginas:
<BackgroundEffects variant="subtle" showGrid={true} />
// Variantes: 'subtle' | 'default' | 'intense'
```

**PageLayout** (`src/components/layout/PageLayout.tsx`)
```tsx
import { PageLayout } from '../components/layout';

<PageLayout showHeader backUrl="/torneos">
  <Contenido />
</PageLayout>
```

**CityAutocomplete** - Para selección de ciudades paraguayas
**PhoneSelector** - Para teléfonos con código de país

### Animaciones
- Usar `framer-motion` para transiciones
- Duración: 200ms para UI compacta, 300ms para landing
- Transiciones de página: `AnimatePresence` con `mode="wait"`

---

## 8. Arquitectura de Repositorios

**Estructura de repos separados:**

| Repo | URL | Tecnología | Deploy |
|------|-----|------------|--------|
| Backend | https://github.com/herto2007-prog/fairpadel-backend.git | NestJS + Prisma + PostgreSQL | Railway |
| Frontend | https://github.com/herto2007-prog/fairpadel-frontend.git | React 18 + Vite + Tailwind | Railway/Vercel |

**Convenciones:**
- Commits descriptivos en español
- Commits atómicos (un cambio lógico por commit)
- Backend primero, luego frontend (cuando hay dependencias)

### Estructura de Carpetas (Frontend)
```
src/
├── components/
│   ├── ui/              # Componentes base (Button, Input, Modal)
│   ├── layout/          # PageLayout, BackgroundEffects
│   └── landing/         # Componentes solo para landing
├── features/            # Por dominio funcional
│   ├── auth/            # Login, register, context
│   ├── tournaments/     # Torneos públicos
│   ├── inscripciones/   # Wizard de inscripción
│   ├── organizador/     # Panel de organizador
│   └── admin/           # Panel admin
├── services/            # API calls (api.ts, authService.ts)
├── hooks/               # Custom hooks
└── utils/               # Helpers
```

### Patrones de Código (Frontend)

**1. Llamadas API centralizadas:**
```typescript
// SIEMPRE usar el api.ts configurado
import { api } from '../services/api';

// ✅ Correcto
const { data } = await api.get('/endpoint');

// ❌ Incorrecto
const res = await fetch('https://api.fairpadel.com/endpoint');
```

**2. Manejo de errores consistente:**
```typescript
try {
  const { data } = await api.post('/endpoint', payload);
  if (data.success) {
    // éxito
  }
} catch (err: any) {
  // Mensaje amigable para usuario
  const message = err.response?.data?.message || 'Error inesperado';
  setError(message);
}
```

**3. Fondo consistente en páginas:**
```typescript
// Toda página debe tener:
<div className="min-h-screen bg-dark relative overflow-hidden">
  <BackgroundEffects variant="subtle" showGrid={true} />
  <div className="relative z-10">
    {/* contenido */}
  </div>
</div>
```

---

## 9. Actitud de Kimi en FairPadel

### Mentalidad
- **Siempre ver el sistema como un todo** (arquitectura, no solo features)
- **Sugerir mejoras constantemente** (proactividad, no solo obedecer)
- **Pensar en escalabilidad y mantenibilidad**

### Comunicación
- **Cuando hay dudas, preguntar** (mejor preguntar que asumir mal)
- **Preguntas cortas y por turnos** (no 10 preguntas de una vez)
- **Un tema a la vez** (terminar uno antes de empezar otro)

### Calidad
- **No entregar código que "funciona" pero está mal** (deuda técnica)
- **Refactorizar cuando sea necesario**, no solo agregar código nuevo
- **Documentar decisiones importantes** (por qué se hizo así)

---

## Checklist Pre-Push

```bash
# Backend
npm run build          # Debe pasar sin errores
npm run lint           # Debe pasar sin errores
npm run test           # Debe pasar (si hay tests)

# Frontend
npm run build          # Debe pasar sin errores
npm run lint           # Debe pasar sin errores
```

✅ Todo verde → `git add . && git commit -m "mensaje" && git push`

---

## Violaciones Conocidas (Aprendizajes)

| Fecha | Error | Consecuencia | Solución |
|-------|-------|--------------|----------|
| Mar 2025 | Push sin build | Backend crash en Railway | Implementar Regla #1 |
| Mar 2025 | DTOs sin decoradores | 400 Bad Request en endpoints | Implementar Regla #4 |
| Mar 2025 | `--force-reset` en Dockerfile | Pérdida de datos | Implementar Regla #5 |
| Mar 2025 | `any` en TypeScript | Pérdida de type safety, bugs | Usar tipos estrictos, interfaces |
| Mar 2025 | Fondos inconsistentes | UX fragmentada | Implementar Regla #7 (BackgroundEffects) |
| Mar 2025 | Strings vacíos en opcionales | Validaciones fallan | Usar `undefined` (Regla #4) |
| Mar 2025 | Cambiar a `migrate deploy` sin baseline | Error P3005, backend crash | Hacer baseline de migraciones primero |

### Lecciones Aprendidas

**TypeScript estricto SIEMPRE:**
```typescript
// ❌ NUNCA
const data: any = await api.get('/endpoint');

// ✅ SIEMPRE
interface ApiResponse { success: boolean; data: Torneo[]; }
const { data }: { data: ApiResponse } = await api.get('/endpoint');
```

**Consistencia visual:**
Si ves `bg-[#0B0E14]`, `bg-[#151921]`, `bg-dark` mezclados → unificar a `bg-dark` + `BackgroundEffects`.

**Manejo de errores:**
Siempre mostrar error al usuario, no solo en console.log.

---

## 10. Separación de Responsabilidades (Kimi vs Usuario)

**"El usuario (dueño) NUNCA realiza acciones directas en la base de datos"**

- Toda interacción con datos debe ser a través de la API/UI
- No ejecutar `prisma studio`, SQL directo, ni migraciones manuales en producción
- Kimi gestiona migraciones, seeds y cambios de schema
- El usuario gestiona configuración a través del panel admin

❌ **PROHIBIDO para usuario:** Acceso directo a BD, modificaciones manuales de tablas.
✅ **PERMITIDO para usuario:** Configuración vía `/fairpadel/admin`, dashboards, reportes.

---

## 11. Deploy Automático en Railway

**"Las migraciones y seeds se ejecutan automáticamente en deploy"**

### Configuración Docker
El `Dockerfile` está configurado para:
1. Build de la aplicación
2. `npx prisma migrate deploy` - Aplicar migraciones pendientes
3. `npx prisma db seed` - Ejecutar seed si hay datos nuevos
4. Iniciar la aplicación

**Archivos críticos:**
- `Dockerfile` - Flujo completo de build + deploy
- `railway.json` - Configura healthcheck y builder
- `prisma/migrations/` - Migraciones versionadas (NUNCA borrar)
- `prisma/seed.ts` - Datos iniciales del sistema

### Variables de Entorno (Producción)
Configuradas en Railway Dashboard:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Para tokens de autenticación
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Para imágenes
- `FRONTEND_URL` - https://www.fairpadel.com

⚠️ **NUNCA hardcodear secrets en código. Siempre usar `process.env.XXX`.**

### Sistema de Migraciones (CORRECTAMENTE CONFIGURADO)

**Estado actual:** Baseline completado, `migrate deploy` funcional

```bash
# 1. Desarrollo local - crear migración
npx prisma migrate dev --name nombre_descriptivo

# 2. Commit de los archivos generados en prisma/migrations/
git add prisma/migrations/
git commit -m "migrate: descripción del cambio"

# 3. Push - Railway aplica automáticamente con migrate deploy
git push
```

**⚠️ REGLAS CRÍTICAS:**
- ✅ **Siempre usar `migrate deploy`** - Aplica migraciones formales de forma segura
- ❌ **NUNCA usar `db push --accept-data-loss` en producción** - Solo para emergencias
- ❌ **NUNCA modificar el Dockerfile** sin validar el flujo de migraciones
- ✅ **Siempre crear migraciones formales** - Archivos SQL en `prisma/migrations/`

**📋 Si la BD fue creada con `db push` (sin historial):**
Si ocurre error P3005 ("database schema is not empty"), hacer baseline:
```sql
-- 1. Crear tabla de migraciones manualmente en BD
CREATE TABLE "_prisma_migrations" (
    "id" VARCHAR(36) PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP WITH TIME ZONE,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP WITH TIME ZONE,
    "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

-- 2. Insertar migraciones existentes como "ya aplicadas"
-- (usar checksums SHA256 de los archivos migration.sql)
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (gen_random_uuid(), 'CHECKSUM_AQUI', NOW(), '20250310013000_add_tournament_management_v2', NOW(), 1);
```

---

## 12. Flujo de Trabajo para Nuevos Agentes

### Al Iniciar una Sesión
1. **Leer `Kimi_Context_Fairpadel.md`** - Entender estado actual del proyecto
2. **Verificar último commit** - `git log --oneline -5`
3. **Hacer pull** - `git pull` en ambos repos
4. **Verificar build local** - `npm run build` en frontend y backend

### Antes de Cualquier Cambio
1. **Entender el contexto** - ¿Qué se quiere lograr?
2. **Buscar código similar** - `grep -r "patrón" src/`
3. **Seguir convenciones existentes** - No inventar nuevos patrones

### Durante el Desarrollo
1. **Commits frecuentes** - Un cambio lógico por commit
2. **Mensajes descriptivos** - En español: `feat:`, `fix:`, `refactor:`, `docs:`
3. **Testear localmente** - Build sin errores antes de push

### Al Finalizar
1. **Verificar build** - `npm run build` en ambos repos
2. **Commit y push** - Con mensaje descriptivo
3. **Verificar deploy** - Revisar Railway dashboard
4. **Actualizar Kimi_Context** - Documentar cambios importantes

---

## 13. Checklist de Transferencia (Para Agentes)

Antes de dejar el proyecto, documentar:
- [ ] Features en progreso (qué falta, qué está a medias)
- [ ] Bugs conocidos (workarounds, causas)
- [ ] Deuda técnica (qué se "aplanó" para entregar rápido)
- [ ] Configuraciones especiales (env vars, providers)
- [ ] Contactos/proveedores (si hay integraciones externas)

---

## 14. Decisiones Arquitectónicas Clave

**¿Por qué Prisma + PostgreSQL?**
- Type safety, migrations automáticas, relaciones claras

**¿Por qué NestJS?**
- Estructura modular, inyección de dependencias, decorators

**¿Por qué Railway?**
- Deploy automático desde GitHub, PostgreSQL managed, variables de entorno fáciles

**¿Por qué diseño compacto en páginas internas?**
- Usuarios gestionan torneos (organizadores) → necesitan ver mucha info rápido
- Landing es para conversión → necesita impacto visual

---

*Última actualización: Marzo 2025*
*Responsable: Kimi Code CLI + Equipo FairPadel*
*Para nuevos agentes: Leer completo, preguntar dudas, nunca asumir.*
