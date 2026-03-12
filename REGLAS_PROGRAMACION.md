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

#### Backend (NestJS)
```typescript
// ✅ CORRECTO - Usar DateService
import { DateService } from '../../common/services/date.service';

constructor(private dateService: DateService) {}

// Parsear fechas de requests
const fecha = this.dateService.parse(dto.fecha); // Detecta YYYY-MM-DD o ISO

// Obtener fecha actual en Paraguay
const ahora = this.dateService.now();

// Formatear para respuesta
const fechaStr = this.dateService.format(date);

// Rango de fechas
const fechas = this.dateService.getDatesRange(fechaInicio, fechaFin);
```

#### Frontend (React)
```typescript
// ✅ CORRECTO - Usar utilidades de date.ts
import { 
  formatDatePY, 
  formatDateTimePY, 
  toISOStringPY,
  parseDatePY,
  getDatesRangePY 
} from '../utils/date';

// Mostrar fecha al usuario
const fechaStr = formatDatePY(fechaISO); // "12/03/2025"

// Mostrar fecha y hora
const fechaHora = formatDateTimePY(fechaISO); // "12/03/2025 18:30"

// Enviar al backend (mantiene hora Paraguay)
const isoPY = toISOStringPY(fechaLocal); 

// Generar rango de fechas
const fechas = getDatesRangePY('2025-03-12', '2025-03-15');
```

#### ❌ PROHIBIDO
```typescript
// ❌ NUNCA usar directamente sin timezone
const fecha = new Date(); // Puede dar hora UTC
const fecha = new Date(dto.fecha); // Puede interpretar mal el timezone
fecha.toISOString(); // Siempre UTC, pierde hora Paraguay
```

**Archivos clave:**
- Backend: `src/common/services/date.service.ts`
- Backend: `src/common/interceptors/paraguay-timezone.interceptor.ts`
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
2. `prisma migrate deploy` - Aplicar migraciones pendientes
3. `prisma db seed` - Ejecutar seed si hay datos nuevos
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

### Proceso de Migraciones
```bash
# 1. Desarrollo local - crear migración
npx prisma migrate dev --name nombre_descriptivo

# 2. Commit de los archivos generados en prisma/migrations/
git add prisma/migrations/
git commit -m "migrate: descripción del cambio"

# 3. Push - Railway aplica automáticamente
git push
```

⚠️ **NUNCA modificar el Dockerfile sin validar el flujo de migraciones.**
✅ **Siempre crear migraciones formales, nunca usar `db push` en prod.**

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
