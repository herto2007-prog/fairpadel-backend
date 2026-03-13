# Kimi Context - FairPadel V2

> **Documento de respaldo de acciones realizadas**  
> **Propósito:** Mantener registro de decisiones técnicas, entregables completados y estado del proyecto para continuidad entre conversaciones.
> **Última actualización:** 2026-03-11 13:36
> **Conversación actual:** Sistema de Resultados completado - Carga directa y marcador en vivo con soporte para Set Completo y Súper Tie-Break

---

## 🚨 REGLAS DE PROGRAMACIÓN (VER REGLAS_PROGRAMACION.md)

**Archivo oficial:** `REGLAS_PROGRAMACION.md` en la raíz del proyecto backend.

### Resumen de Oro:
1. **Ley del Deploy:** Compilar localmente antes de pushear (`npm run build`)
2. **Visión Sistémica:** Entender el todo antes de cambiar partes
3. **Regla del Negocio:** Soluciones alineadas con lógica real de pádel PY
4. **Validación Estricta:** Usar class-validator con decoradores
5. **Protección de Datos:** NUNCA `--force-reset` en producción
6. **Formatos PY:** Guaraníes con miles, fechas es-PY
7. **UX Compacta:** Páginas internas usan clase `compact-ui`
8. **Repos Separados:** Backend y Frontend en URLs distintas
9. **Actitud Kimi:** Preguntar dudas, sugerir mejoras, un tema a la vez
10. **Separación Responsabilidades:** Usuario NUNCA toca BD directamente
11. **Deploy Automático:** Dockerfile ejecuta migrate + seed

### 🕐 Manejo de Fechas - Timezone Paraguay (CRÍTICO)

**Timezone:** `America/Asuncion` (UTC-3)

**REGLA:** Todas las fechas en el sistema son hora de Paraguay. **NUNCA** usar `new Date()` sin normalizar.

**Backend:**
```typescript
// Usar DateService SIEMPRE
import { DateService } from '../../common/services/date.service';
const fecha = this.dateService.parse(dto.fecha); // Parsea como PY
const ahora = this.dateService.now(); // Ahora en PY
const rango = this.dateService.getDatesRange(inicio, fin);
```

**Frontend:**
```typescript
// Usar utilidades de date.ts
import { formatDatePY, toISOStringPY, getDatesRangePY } from '../utils/date';
const str = formatDatePY(fechaISO); // "12/03/2025"
const iso = toISOStringPY(fechaLocal); // Envía al backend
const fechas = getDatesRangePY('2025-03-12', '2025-03-15');
```

**Archivos:**
- Backend: `src/common/services/date.service.ts`
- Backend: `src/common/interceptors/paraguay-timezone.interceptor.ts`
- Frontend: `src/utils/date.ts`

---

## 📋 RESUMEN EJECUTIVO

**Proyecto:** FairPadel - Sistema de gestión de torneos de pádel para Paraguay  
**Estado:** 🚀 **EN PRODUCCIÓN** - Backend y Frontend online  
**URLs:**
- Frontend: https://www.fairpadel.com
- Backend API: https://api.fairpadel.com/api
- Health Check: https://api.fairpadel.com/api/health

**Stack:** NestJS + React + PostgreSQL + Prisma + Railway  
**Metodología:** MVP breadth-first, entregables atómicos y desplegables

---

## 🎯 ROADMAP - ESTADO ACTUAL

### ✅ Completado (2026-03-10)
- [x] Sistema de Autenticación (JWT, Guards, Roles)
- [x] CRUD de Usuarios con Roles
- [x] CRUD de Sedes y Canchas
- [x] Modalidades configurables (PY vs Mundo)
- [x] **Wizard de Creación de Torneos (5 pasos completo)**
- [x] **Checklist Estilo Cuaderno con Tabs (hasta 10)**
- [x] **Sistema de Comisiones por Jugador**
- [x] **Bloqueo Estratégico de Torneos**
- [x] **Gestión de Inscripciones (Fase 1 - Vista Organizador)**
- [x] **Panel /mis-torneos para Organizadores**

### ✅ Completado (2026-03-11)
- [x] **Ventana Pública de Inscripción V2**
- [x] **Página Lista de Torneos (/torneos, /tournaments)**
- [x] **Página Detalle del Torneo (/t/:slug)**
- [x] **Wizard de Inscripción 4 pasos (/t/:slug/inscribirse)**
- [x] **Sistema de Invitaciones para Jugador2 no registrado**
- [x] **Validaciones de Categorías por Género/Nivel**
- [x] **Endpoints públicos: /t/public, /inscripciones/public**

### ✅ Completado (2026-03-11) - Refactor UI
- [x] **Refactor UI Wizard de Inscripción** - Diseño compacto/minimalista (3 pasos)
- [x] **Refactor UI Wizard de Creación** - Mismo estilo minimalista aplicado
- [x] **Selector de código de país** - En teléfono del jugador 2
- [x] **Filtro inteligente de categorías** - Validaciones automáticas por género/nivel
- [x] **Sistema de fondo consistente** - BackgroundEffects en toda la app
- [x] **Componente PageLayout** - Plantilla reutilizable para nuevas páginas

### ✅ Completado (2026-03-12) - Sistema de Bracket V2 (Paraguayo Correcto)
- [x] **Fórmula del Sistema Paraguayo** (corregida):
  ```
  PartidosZona = floor(parejas / 2)
  ObjetivoBracket = (parejas <= 15) ? 8 : 16
  Eliminaciones = parejas - ObjetivoBracket
  PartidosRondaAjuste = Eliminaciones
  ```
- [x] **Lógica de Ronda de Ajuste** - Puede incluir ganadores O perdedores de zona
- [x] **Modelos de BD extendidos** - Campos opcionales en Match (esBye, tipoEntrada, partidoSiguienteId, etc.)
- [x] **Servicio BracketService** - Cálculo automático con fórmula correcta
- [x] **Endpoints REST completos:**
  - `GET /admin/torneos/:id/categorias` - Listar con conteo de inscripciones
  - `GET /admin/categorias/:id/bracket/config` - Obtener configuración previa
  - `POST /admin/categorias/:id/bracket/sortear` - Realizar sorteo (preview/guardar)
  - `POST /admin/categorias/:id/bracket/generar` - Generar y guardar bracket
  - `POST /admin/categorias/:id/cerrar-inscripciones` - Cerrar inscripciones
  - `POST /admin/categorias/:id/abrir-inscripciones` - Reabrir inscripciones
  - `GET /admin/bracket/:fixtureVersionId/partidos` - Obtener partidos
  - `POST /admin/bracket/:fixtureVersionId/publicar` - Publicar bracket
  - `POST /admin/bracket/:fixtureVersionId/sortear-nuevo` - Re-sortear
- [x] **Validaciones:**
  - Mínimo 8 parejas para sortear
  - Inscripciones deben estar cerradas
  - No permite re-sortear si ya está publicado
- [x] **UI Frontend - Estilo Minimalista:**
  - `BracketManager` - Lista separada por género (Damas/Caballeros/Mixto), orden ascendente
  - `ConfigurarBracketModal` - Vista previa con fórmula del sistema
  - `BracketView` - Visualización por fases
  - Botón "Cerrar inscripciones" en pestaña Inscripciones Y Fixture
- [x] **Integración:** Tab "Fixture" en `/mis-torneos/:id/gestionar`

### ✅ Completado (2026-03-11) - Sistema Demo / Datos de Prueba
- [x] **Modelo JugadorDemo** - Tabla separada para jugadores de prueba
- [x] **Seed de 400 jugadores** - 200 masculinos + 200 femeninos distribuidos en categorías
- [x] **Servicio DemoService** - Lógica para llenar/limpiar torneos automáticamente
- [x] **Endpoints REST:**
  - `POST /admin/demo/torneos/:id/llenar` - Llena torneo con inscripciones demo (12-32 parejas por categoría)
  - `DELETE /admin/demo/torneos/:id/limpiar` - Elimina inscripciones demo
  - `GET /admin/demo/status` - Info del sistema
- [x] **Distribución REALISTA** - Más parejas en categorías bajas (ej: 3ra=12, 7ma=20)
- [x] **Estados mixtos** - 60% CONFIRMADA, 30% PENDIENTE_PAGO, 10% PENDIENTE_CONFIRMACION
- [x] **Pagos ficticios** - Las confirmadas incluyen pago automático

**Flujo de prueba completo:**
1. Crear torneo → 2. `POST /admin/demo/torneos/:id/llenar` → 3. Generar bracket → 4. Probar flujo → 5. `DELETE .../limpiar`

### ✅ Completado (2026-03-11) - Sistema de Fechas/Timezone Paraguay
- [x] **DateService mejorado** - Métodos: parse(), addHours(), addDays(), startOfDay(), endOfDay(), getDatesRange(), compareDates(), getDayName(), getMonthName()
- [x] **ParaguayTimezoneInterceptor** - Normaliza automáticamente fechas entrantes/salientes
- [x] **date.utils.ts frontend** - Funciones timezone-aware: formatDatePY(), formatDateTimePY(), toISOStringPY(), parseDatePY(), getDatesRangePY(), isTodayPY(), compareDatesPY()
- [x] **ConfiguradorSede actualizado** - Usa utilidades de fecha Paraguay
- [x] **Sistema 100% en hora Paraguay (UTC-3)** - Sin desfases entre frontend y backend

### ✅ Completado (2026-03-12) - Módulo de Programación Inteligente - BACKEND
- [x] **Servicio ProgramacionService** - Algoritmo de distribución automática
- [x] **Distribución por fases:** Zona → Ronda de Ajuste → Bracket (Octavos → Cuartos → Semis → Final)
- [x] **Validaciones inteligentes:**
  - Máximo 2 partidos por pareja por día
  - 4 horas mínimo entre partidos de misma pareja
  - No sobrepasar slots disponibles
- [x] **Predicción de recursos:**
  - Calcula horas necesarias vs disponibles
  - Detecta déficit antes de aplicar
  - Sugiere agregar canchas o extender días
- [x] **Endpoints REST:**
  - `POST /programacion/torneos/:id/calcular` - Calcula distribución óptima
  - `POST /programacion/torneos/:id/aplicar` - Aplica la programación
  - `GET /programacion/torneos/:id/preview` - Vista previa
- [x] **Integración con disponibilidad** - Usa TorneoSlot configurados
- [x] **Soporta sorteo por lotes** - Programa categorías a medida que se sortean

### ✅ Completado (2026-03-11) - Módulo de Programación Inteligente - FRONTEND
- [x] **Componente ProgramacionManager** - Vista principal de programación
  - Predicción de recursos (horas necesarias vs disponibles)
  - Distribución por días con slots ocupados
  - Vista por fases: Zona → Ronda → Octavos → Cuartos → Semis → Final
  - Estados: SIN_CALCULAR → CALCULADO → APLICADO
- [x] **Acciones disponibles:**
  - Calcular automáticamente
  - Recalcular distribución
  - Aplicar programación a la base de datos
- [x] **Validaciones visuales:**
  - Conflictos destacados en rojo
  - Alertas de déficit de recursos
  - Loading states con spinners
- [x] **Integración:** Tab "Programación" en `/mis-torneos/:id/gestionar`
- [x] **Preparación para edición manual** - Estructura lista para futura implementación

### ✅ Completado (2026-03-12) - Vista Demo (Datos Estáticos)
- [x] **Tab "Vista Demo"** en panel de gestión `/mis-torneos/:id/gestionar`
- [x] **Banner de estado del torneo** con info del torneo demo
- [x] **Stats cards** - Inscripciones, confirmadas, pendientes, ingresos
- [x] **Timeline del flujo** - 6 fases del torneo con estados visuales
- [x] **Categorías sorteadas** - Grid con 6 categorías de ejemplo (Damas/Caballeros)
- [x] **Programación preview** - Distribución de 72 partidos en 4 días
- [x] **Bracket preview** - Estructura de fases para 2 categorías ejemplo
- [x] **Nota informativa** - Indica que son datos estáticos de ejemplo
- **Nota:** Esta vista es temporal y se puede eliminar cuando ya no sea necesaria

### ✅ Completado (2026-03-12) - Sistema de Resultados y Marcador en Vivo
- [x] **Schema Prisma extendido** - `formatoSet3`, `liveScore`, `duracionMinutos`
- [x] **ResultadosModule (Backend)**:
  - `POST /admin/resultados/matches/:id/resultado` - Carga directa post-partido
  - `POST /admin/resultados/matches/:id/resultado-especial` - Retiro/Descalificación/WO
  - `POST /admin/resultados/matches/:id/iniciar` - Iniciar partido en vivo
  - `POST /admin/resultados/matches/:id/punto` - Registrar punto
  - `POST /admin/resultados/matches/:id/deshacer` - Deshacer último punto
  - `POST /admin/resultados/matches/:id/finalizar` - Finalizar y avanzar ganador
  - `GET /admin/resultados/matches/:id/marcador` - Obtener marcador actual
- [x] **Lógica de juego completa**:
  - Sets 1 y 2: games 0-6/7 con diferencia de 2
  - Set 3 modo **Set Completo**: games 0-6/7
  - Set 3 modo **Súper Tie-Break**: puntos hasta 10 con diferencia de 2
  - Avance automático del ganador al siguiente partido del bracket
- [x] **Resultados especiales**:
  - Nuevos estados: `RETIRADO`, `DESCALIFICADO`, `WO`
  - Campos: `parejaRetirada` (1 o 2), `razonResultado`
  - Tipos: Retiro por lesión, Retiro otro, Descalificación, No se presentó (WO)
  - La pareja NO afectada avanza automáticamente como ganadora
- [x] **RegistroResultadoModal (Frontend)** - Tabs: Resultado Normal / Retiro-Descalif.
  - Formulario para resultado normal con selección de formato set3
  - Formulario para incidencias con selección de tipo y pareja afectada
  - Visualización destacada de la pareja afectada (borde rojo)
- [x] **MarcadorEnVivo (Frontend)** - Pantalla de marcador punto a punto
- [x] **Integración en BracketView** - Botones "En Vivo" y "Resultado" en cada partido

### ✅ Completado (2026-03-13) - Sistema de Rankings y Ascensos
- [x] **Schema Prisma extendido**:
  - `ConfiguracionPuntos` - Configuración base de puntos por posición
  - `ReglaAscenso` - Reglas configurables de ascenso por categoría
  - `AscensoPendiente` - Tracking de ascensos detectados
  - `multiplicadorPuntos` en Tournament
- [x] **RankingsModule (Backend)**:
  - Endpoints públicos: `/rankings`, `/rankings/jugador/:id`
  - Endpoints admin: config puntos, reglas ascenso, cálculo de puntos
  - Cálculo automático de puntos al finalizar torneo
  - Detección automática de ascensos por campeonatos ganados
  - Procesamiento de ascensos (confirmar/rechazar)
- [x] **Seed de configuración**:
  - Puntos base: 1ro=100, 2do=70, 3ro-4to=45, 5to-8vo=25, 9no-16to=15, participación=5
  - Reglas de ascenso basadas en FEPARPA (3-4 campeonatos según categoría)
- [x] **RankingsPage (Frontend)**:
  - Filtros: categoría, género, temporada, ciudad
  - Tabla con top 3 destacado, tendencias, marcado de usuario logueado
  - Integración con datos del jugador (foto, categoría actual)

### ⏳ En Progreso / Pendiente
- [x] ~~Sistema de Bracket Paraguayo~~ ✅ **COMPLETADO**
- [x] ~~Programación Inteligente~~ ✅ **COMPLETADO**
- [x] ~~Registro de resultados~~ ✅ **COMPLETADO**
- [x] ~~Rankings automáticos~~ ✅ **COMPLETADO**
- [ ] **Testing completo** - Probar flujo end-to-end con datos de demo
- [ ] Integración de pagos (Bancard)
- [ ] Notificaciones push/SMS (Tigo)

---

## 🏗️ ARQUITECTURA DE REPOSITORIOS

| Repo | URL | Tecnología | Deploy | Ruta Local |
|------|-----|------------|--------|------------|
| Backend | https://github.com/herto2007-prog/fairpadel-backend.git | NestJS + Prisma + PostgreSQL | Railway (api.fairpadel.com) | `d:\fairpadel\` |
| Frontend | https://github.com/herto2007-prog/fairpadel-frontend.git | React 18 + Vite + Tailwind | Railway (www.fairpadel.com) | `d:\fairpadel\frontend\` |

**IMPORTANTE:** El frontend debe clonarse en `d:\fairpadel\frontend\` (esperado por tsconfig.json que excluye "frontend" del build del backend).

---

## 🆕 ENTREGABLES HOY (2026-03-10)

### 1. Wizard de Creación de Torneos (5 pasos) ✅ - REFACTOR MINIMALISTA

**Diseño:** UI compacta, minimalista, tecnológica (mismo estilo que wizard de inscripción)

**Cambios de estilo aplicados:**
| Elemento | Antes | Después |
|----------|-------|---------|
| Padding general | `py-8` | `py-4` |
| Padding card | `p-6 md:p-8` | `p-4` |
| Título | `text-2xl` | `text-base` |
| Iconos header | `w-16 h-16` | `w-10 h-10` |
| Bordes | `border-[#232838]` | `border-white/5` |
| Fondos cards | `bg-[#151921]` | `bg-white/[0.02]` |
| Progress bar | `h-1.5` | `h-0.5` |
| Espaciado | `space-y-6` | `space-y-4` |

**Pasos implementados:**
1. **Identidad & Fechas** - Nombre, descripción, ciudad (auto-region), sede, fechas
2. **Inversión** - Costo en Guaraníes, duración por partido (slider 60-180min)
3. **Flyer** - Upload drag & drop, preview compacto de card
4. **Categorías** - Grid 3 columnas compacto, selección múltiple
5. **Confirmar** - Resumen denso, crear torneo

**Características:**
- Validación por paso con errores inline
- Navegación fluida con animaciones 200ms
- Post-creación: link de inscripción y botón "Gestionar"

### 2. Checklist Estilo Cuaderno ✅

**Diseño:**
- Fondos pastel tipo papel de cuaderno
- Fuente handwriting (Kalam/Caveat)
- Hasta 10 tabs/secciones personalizables
- Colores diferentes por tab

**Funcionalidades:**
- Tareas sugeridas por sección (General, Logística, Premios, Día del Torneo)
- Agregar/quitar tareas
- Marcar como completada (tachado)
- Recordatorios con fecha/hora
- Editar nombre de tabs

**Estado:** Visual completo, persistencia local (pendiente conectar full con backend)

### 3. Gestión de Inscripciones (Fase 1) ✅

**Vista del Organizador:**
- Stats cards: Total, Confirmados, Pendientes, Sin Pareja, Ingresos
- Filtros: Todos, Confirmados, Pendientes, Sin pareja
- Búsqueda por nombre
- Tabs de categorías agrupados por género:
  - Damas arriba (contorno rosa)
  - Caballeros abajo (contorno azul)
- Cards de inscripción con:
  - Datos de jugadores (nombre, teléfono con link a WhatsApp)
  - Estado visual (confirmado/pendiente)
  - Indicador "Esperando pareja" si aplica
  - Monto pagado
- Acciones: Confirmar, Cancelar (con modal y motivo)

**Endpoints:**
- `GET /admin/torneos/:id/inscripciones` - Lista con stats
- `PUT /admin/torneos/:id/inscripciones/:id/confirmar`
- `PUT /admin/torneos/:id/inscripciones/:id/cancelar`

### 4. Rutas y Navegación ✅

**Nuevas rutas:**
- `/mis-torneos` - Lista de torneos del organizador
- `/mis-torneos/:id/gestionar` - Panel de gestión con tabs:
  - Checklist
  - Inscripciones
  - Comisión
  - Información

**Fix importante:**
- Cambio de `@Body('user')` a `@Request() req` en admin-torneos.controller.ts para fix de 401

### 5. Fixes Técnicos ✅

- **Cloudinary:** Configuración con variables de entorno, fix de `Invalid cloud_name`
- **DTOs:** Agregar `pais` opcional a CreateTorneoDto
- **Validación:** Manejo de errores en uploads multipart
- **JWT:** Uso correcto de `user.userId` en lugar de `user.id`

---

## 🆕 ENTREGABLES HOY (2026-03-11)

### 1. Ventana Pública de Inscripción V2 ✅

#### Backend - Nuevos Endpoints

**Torneos Públicos:**
- `GET /t/public` - Lista de torneos con filtros (ciudad, categoría, período)
- `GET /t/:slug` - Detalle de torneo por slug
- `GET /t/datos/filtros` - Datos para filtros del frontend
- `GET /t/:slug/categorias` - Categorías disponibles con validaciones

**Inscripciones Públicas:**
- `GET /inscripciones/public/buscar-pareja` - Buscar jugador2 por nombre/apellido/documento
- `POST /inscripciones/public/validar-categoria` - Validar reglas de categoría
- `POST /inscripciones/public` - Crear inscripción (con o sin invitación)
- `GET /inscripciones/public/pendientes` - Inscripciones pendientes del usuario
- `POST /inscripciones/public/:id/aceptar` - Aceptar invitación
- `POST /inscripciones/public/:id/rechazar` - Rechazar invitación

**Invitaciones:**
- `GET /invitacion/:token` - Verificar validez de invitación
- `POST /invitacion/:token/registrar` - Registrar usuario desde invitación

#### Frontend - Nuevas Páginas

**TorneosPublicListPage (`/torneos`, `/tournaments`):**
- Lista de torneos con diseño moderno
- Búsqueda por nombre/descripción/ciudad
- Filtros: ciudad, categoría, período (próximos/en curso/finalizados)
- Cards con flyer, precio, fecha, inscritos
- Badges "Inscripciones abiertas"
- Paginación
- Responsive

**TorneoPublicDetailPage (`/t/:slug`):**
- Hero con flyer grande
- Info completa: fechas, ubicación, categorías, premios
- Mapa de sede (Google Maps)
- Organizador
- Sponsors
- Card de inscripción sticky

**InscripcionWizardPage (`/t/:slug/inscribirse`):**

**Diseño:** UI compacta, minimalista, tecnológica (padding reducido, textos densos)

**Paso 1 - Equipo (fusión J1 + J2):**
- **Jugador 1:** Detecta usuario logueado automáticamente, redirect a login si no
- **Búsqueda Jugador 2:** Por nombre/apellido o documento (debounce)
- **Resultados:** Lista compacta con foto, nombre, documento, categoría
- **Invitación:** Si no existe → formulario para crear invitación
  - Selector de código de país (dropdown banderas)
  - Campos: nombre, apellido, documento, teléfono, email

**Paso 2 - Categoría (filtrado inteligente):**
- Categorías auto-filtradas por género del equipo
- Validaciones de nivel aplicadas automáticamente
- Mensajes explicativos inline según reglas de negocio
- Solo muestra opciones válidas (no hay opciones deshabilitadas)

**Paso 3 - Confirmación:**
- Resumen compacto de la inscripción
- Checkbox de consentimiento obligatorio
- Datos bancarios del organizador
- Botón confirmar inscripción

### 2. Sistema de Invitaciones ✅

**Flujo:**
1. Jugador1 inscribe a pareja no registrada
2. Se crea inscripción con estado PENDIENTE_CONFIRMACION
3. Se envía invitación (email/token) a jugador2
4. Jugador2 recibe email con link al registro
5. Al registrarse, se vincula automáticamente a la inscripción
6. Estado cambia a PENDIENTE_PAGO
7. Notificaciones a ambos jugadores

**Modelo InvitacionJugador:**
- token único
- expira en 48 horas
- estados: PENDIENTE, ACEPTADA, RECHAZADA, EXPIRADA

### 3. Validaciones de Categorías ✅

**Reglas implementadas:**

| Jugador | Categoría Damas | Categoría Caballeros |
|---------|-----------------|---------------------|
| **Hombre** | ❌ No puede | ✅ Puede (superiores e iguales)<br>❌ No puede bajar a inferiores |
| **Mujer** | ✅ Puede (superiores e iguales)<br>❌ No puede bajar a inferiores | ✅ Puede<br>✅ Puede bajar **UNA** como excepción |

**Nota:** La excepción de bajar una categoría solo aplica cuando la mujer juega en categorías Caballeros, NO en su propio género.

### 4. Schema Prisma Actualizado ✅

```prisma
model Inscripcion {
  // ... campos existentes
  notas String? @db.Text  // NUEVO
  invitacion InvitacionJugador?  // NUEVO
}

model InvitacionJugador {
  id String @id @default(uuid())
  inscripcionId String @unique
  email String
  token String @unique
  estado String @default("PENDIENTE")
  expiraAt DateTime
  createdAt DateTime @default(now())
  respondedAt DateTime?
  
  inscripcion Inscripcion @relation(fields: [inscripcionId], references: [id])
}
```

### 5. Refactor UI Wizard de Inscripción ✅

**Cambios realizados:**
- **Pasos fusionados:** De 4 a 3 pasos (Jugador1+Pareja → Categoría → Confirmar)
- **Diseño compacto:** Menos padding, tipografía más densa, bordes sutiles
- **Selector de país:** Dropdown de códigos de país (🇸🇻 +503, 🇨🇷 +506, etc.)
- **Filtro inteligente:** Categorías filtradas automáticamente según género/nivel
- **Validaciones visuales:** Mensajes explicativos inline según reglas de negocio

### 6. Sistema de Fondo Consistente ✅

**Componente `BackgroundEffects`:**
- Gradientes difuminados animados (orbs de color primary)
- Grid pattern sutil con color de marca
- Partículas flotantes animadas
- Variantes: `subtle`, `default`, `intense`

**Páginas actualizadas:**
- `InscripcionWizardPage` - Wizard de inscripción
- `TorneosPublicListPage` - Lista pública de torneos
- `TorneoPublicDetailPage` - Detalle de torneo
- `LoginPage` - Login (ya tenía)
- `DashboardPage` - Dashboard del usuario
- `SedesListPage` / `SedeDetailPage` - Sedes
- `RankingsPage` - Rankings
- `TournamentsListPage` / `TournamentDetailPage` - Torneos (legacy)
- `MisTorneosPage` - Panel del organizador
- `TorneoWizard` - Wizard de creación de torneos

### 7. Componente PageLayout (Nuevo) ✅

**Ubicación:** `src/components/layout/PageLayout.tsx`

**Props:**
```typescript
variant?: 'default' | 'centered' | 'full'
bgVariant?: 'default' | 'subtle' | 'intense'
showGrid?: boolean
showEffects?: boolean
showHeader?: boolean
backUrl?: string
maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
```

**Uso:**
```tsx
import { PageLayout, PageLoading, PageError } from '../components/layout';

// Página estándar
<PageLayout showHeader backUrl="/torneos">
  <Contenido />
</PageLayout>

// Página centrada (login, etc)
<PageLayout variant="centered">
  <Formulario />
</PageLayout>
```

### 8. Commits Realizados ✅

**Backend:**
- `d0aa7f5` - feat: Ventana pública de inscripción V2 - Backend completo
- `db5a0fd` - fix: Corrección en validaciones de categorías para mujeres

**Frontend:**
- `99b736b` - feat: Ventana pública de inscripción V2 - Frontend completo
- `fb66539` - feat: Actualizar ruta /tournaments para usar la nueva vista V2
- `fdbb63e` - refactor(wizard): UI compacta y minimalista (inscripción)
- `dfe9086` - fix(wizard): restaurar BackgroundEffects
- `f3b008d` - feat(ui): aplicar fondo consistente a todas las páginas
- `96aaa2a` - fix(wizard): aplicar BackgroundEffects al wizard de creación
- `046a962` - refactor(wizard): diseño minimalista para wizard de creación de torneos

---

## 📁 ESTRUCTURA DE ARCHIVOS IMPORTANTES

### Backend
```
src/
├── modules/
│   ├── admin/
│   │   ├── admin-torneos.controller.ts      ✅ CRUD torneos + checklist + comisiones
│   │   ├── fairpadel-admin.controller.ts    ✅ Panel del dueño
│   │   └── ...
│   ├── auth/
│   │   └── strategies/jwt.strategy.ts       ✅ Retorna userId
│   ├── tournaments/
│   │   └── public-tournaments.controller.ts ✅ NUEVO: Endpoints públicos /t/*
│   ├── inscripciones/
│   │   ├── inscripciones.controller.ts      ✅ CRUD inscripciones
│   │   └── public-inscripciones.controller.ts ✅ NUEVO: Wizard inscripción pública
│   ├── invitaciones/
│   │   ├── invitaciones.controller.ts       ✅ NUEVO: Sistema de invitaciones
│   │   └── invitaciones.module.ts           ✅ NUEVO
│   └── notificaciones/
│       └── notificaciones.service.ts        ✅ Envío de invitaciones
├── prisma/
│   ├── schema.prisma                        ✅ Modelos: Inscripcion, InvitacionJugador
│   └── seed.ts                              
└── uploads/
    └── uploads.controller.ts                ✅ Fix para ValidationPipe
```

### Frontend
```
src/
├── features/
│   ├── organizador/
│   │   ├── components/
│   │   │   ├── checklist/
│   │   │   │   └── ChecklistCuaderno.tsx    ✅ Cuaderno con tabs
│   │   │   ├── inscripciones/
│   │   │   │   ├── InscripcionesManager.tsx ✅ Vista organizador
│   │   │   │   ├── InscripcionCard.tsx      
│   │   │   │   ├── ResumenStats.tsx         
│   │   │   │   ├── ModalConfirmar.tsx       
│   │   │   │   └── ModalCancelar.tsx        
│   │   │   ├── bracket/
│   │   │   │   ├── BracketManager.tsx       ✅ Lista de categorías sorteadas
│   │   │   │   ├── ConfigurarBracketModal.tsx ✅ Vista previa del sorteo
│   │   │   │   └── BracketView.tsx          ✅ Visualización del bracket
│   │   │   ├── programacion/
│   │   │   │   ├── ProgramacionManager.tsx  ✅ Distribución automática de partidos
│   │   │   │   ├── ServiceProgramacion.ts   ✅ API service
│   │   │   │   └── TypesProgramacion.ts     ✅ Tipos TypeScript
│   │   │   ├── TorneoWizard.tsx             ✅ 5 pasos crear torneo + fondo
│   │   │   └── SedeAutocomplete.tsx         
│   │   └── pages/
│   │       ├── MisTorneosPage.tsx           ✅ Lista + wizard + fondo
│   │       └── GestionarTorneoPage.tsx      ✅ Tabs gestión + fondo (incluye Programación)
│   ├── tournaments/
│   │   └── pages/
│   │       ├── TorneosPublicListPage.tsx    ✅ /torneos + fondo
│   │       ├── TorneoPublicDetailPage.tsx   ✅ /t/:slug + fondo
│   │       ├── TournamentsListPage.tsx      (Legacy + fondo)
│   │       └── TournamentDetailPage.tsx     (Legacy + fondo)
│   ├── inscripciones/
│   │   └── pages/
│   │       └── InscripcionWizardPage.tsx    ✅ Wizard 3 pasos compacto + fondo
│   ├── sedes/
│   │   └── pages/
│   │       ├── SedesListPage.tsx            ✅ + fondo
│   │       └── SedeDetailPage.tsx           ✅ + fondo
│   ├── rankings/
│   │   └── pages/
│   │       └── RankingsPage.tsx             ✅ + fondo
│   └── auth/
│       └── pages/
│           ├── LoginPage.tsx                ✅ + fondo
│           └── components/
│               └── RegisterWizard.tsx       ✅ + fondo
├── components/
│   ├── ui/
│   │   ├── BackgroundEffects.tsx            ✅ Fondo animado reutilizable
│   │   └── CityAutocomplete.tsx             
│   └── layout/
│       ├── PageLayout.tsx                   ✅ NUEVO: Layout system
│       └── index.ts                         ✅ Exports
├── pages/
│   └── DashboardPage.tsx                    ✅ + fondo
└── App.tsx                                  ✅ Rutas actualizadas
```

---

## 🎛️ PANEL DE GESTIÓN DE TORNEO - TABS

| Tab | Funcionalidad | Estado |
|-----|---------------|--------|
| Checklist | Cuaderno con tareas y recordatorios | ✅ Visual completo |
| Inscripciones | Stats, lista por categoría, confirmar/cancelar | ✅ Funcional |
| Disponibilidad | Configuración de slots por día/cancha | ✅ Funcional |
| Fixture | Sorteo de bracket (Zona + Ronda + Eliminación) | ✅ Funcional |
| Programación | Distribución automática de partidos en slots | ✅ Funcional |
| Comisión | Estado de pago y bloqueo | ✅ |
| Información | Datos básicos del torneo | ✅ |

---

## 🔧 DECISIONES TÉCNICAS CLAVE

### Flujo de Creación de Torneo
1. Organizador va a `/mis-torneos`
2. Clic en "Crear Torneo" → Wizard de 5 pasos
3. Al crear: se genera checklist automático, se asignan categorías
4. Redirect a `/mis-torneos/:id/gestionar`
5. Organizador gestiona checklist e inscripciones desde los tabs

### Estructura de Inscripciones
- Tabla `Inscripcion` con jugador1 y jugador2 (nullable)
- Estado: PENDIENTE_PAGO, PENDIENTE_CONFIRMACION, CONFIRMADA, CANCELADA
- Pagos relacionados en tabla `Pago`
- Agrupación por categoría con conteo de confirmados/pendientes

### Diseño Responsive
- Mobile: Tabs de categorías apilados verticalmente
- Desktop: Damas arriba, Caballeros abajo, cada grupo con contorno de color

---

## 🚀 INSTRUCCIONES DE DEPLOY

### Dockerfile (Auto-deploy)
```dockerfile
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx prisma db seed && exec node dist/main.js"]
```

Flujo automático:
1. Sincroniza schema con BD
2. Ejecuta seed si hay datos nuevos
3. Inicia aplicación

---

## 🏆 SISTEMA DE BRACKET (IMPLEMENTADO V2)

### Sistema Paraguayo - Fórmula Correcta

**Objetivo:** Garantizar **mínimo 2 partidos** por pareja eliminada.

**Fórmula:**
```
PartidosZona = floor(parejas / 2)
ObjetivoBracket = (parejas <= 15) ? 8 : 16
Eliminaciones = parejas - ObjetivoBracket
PartidosRondaAjuste = Eliminaciones
```

**Flujo para 18 parejas (ejemplo):**
```
FASE DE ZONA (9 partidos)
├── 18 parejas → 9 ganan / 9 pierden
├── Los 9 ganadores pasan al bracket principal
└── De los 9 perdedores, 4 juegan ronda de ajuste / 5 van directo

RONDA DE AJUSTE (2 partidos)
├── 4 parejas juegan (mix de ganadores/perdedores según necesidad)
├── 2 ganan y pasan al bracket
└── 2 pierden y quedan ELIMINADOS (jugaron zona + ajuste = 2 partidos) ✓

BRACKET DE 16 (Eliminación directa)
├── 9 ganadores zona + 2 ganadores ajuste + 5 directos = 16 parejas
├── Octavos → Cuartos → Semis → Final
└── Eliminación directa, no hay segunda chance
```

### Tablas de Configuración

**Torneos que terminan en CUARTOS (8 parejas):**
| Parejas | Zona | Eliminaciones | Ronda Ajuste | Bracket |
|---------|------|---------------|--------------|---------|
| 8 | 4p | 0 | 0p | 8 |
| 9 | 4p | 1 | 1p | 8 |
| 10 | 5p | 2 | 2p | 8 |
| 11 | 5p | 3 | 3p | 8 |
| 12 | 6p | 4 | 4p | 8 |
| 13 | 6p | 5 | 5p | 8 |
| 14 | 7p | 6 | 6p | 8 |
| 15 | 7p | 7 | 7p | 8 |

**Torneos que terminan en OCTAVOS (16 parejas):**
| Parejas | Zona | Eliminaciones | Ronda Ajuste | Bracket |
|---------|------|---------------|--------------|---------|
| 16 | 8p | 0 | 0p | 16 |
| 17 | 8p | 1 | 1p | 16 |
| 18 | 9p | 2 | 2p | 16 |
| 19 | 9p | 3 | 3p | 16 |
| 20 | 10p | 4 | 4p | 16 |
| 21 | 10p | 5 | 5p | 16 |
| 22 | 11p | 6 | 6p | 16 |
| 23 | 11p | 7 | 7p | 16 |
| 24 | 12p | 8 | 8p | 16 |

### Flujo de Sorteo

1. **Inscripciones Abiertas** → Recibir inscripciones
2. **Cerrar Inscripciones** (mínimo 8 parejas) → Estado: `INSCRIPCIONES_CERRADAS`
3. **Sortear** → Genera bracket en estado `BORRADOR`
4. **Publicar** → Estado: `SORTEO_REALIZADO`, visible para jugadores

**Ubicación en el sistema:**
- Frontend: `/mis-torneos/:id/gestionar` → Tab "Fixture"
- También disponible: Botón "Cerrar inscripciones" en Tab "Inscripciones"

### Estructura de Datos

**Match (extendido):**
```prisma
esBye: Boolean              // true = partido con BYE
tipoEntrada1: String        // INSCRIPCION | GANADOR_ZONA | PERDEDOR_ZONA | etc.
tipoEntrada2: String
partidoOrigen1Id: String    // De qué partido viene entrada1
partidoOrigen2Id: String
// Campos existentes:
// - partidoSiguienteId (ganador)
// - partidoPerdedorSiguienteId (perdedor va a repechaje)
```

**FixtureVersion.definicion (JSON):**
```typescript
{
  config: {
    totalParejas: 18,
    tamanoBracket: 16,
    parejasConBye: 1,
    partidosZona: 9,
    parejasEnRepechaje: 4,
    // ...
  },
  partidos: [...],      // Estructura completa del bracket
  inscripciones: [...]  // Datos de parejas para mostrar
}
```

### Archivos Creados/Modificados

**Backend (`d:\fairpadel\`):**
- `src/modules/bracket/bracket.service.ts` - Servicio con fórmula correcta
- `src/modules/admin/admin-bracket.controller.ts` - Endpoints REST (sortear, cerrar/abrir inscripciones)

**Frontend (`d:\fairpadel\frontend\`):**
- `src/features/organizador/components/bracket/BracketManager.tsx` - Lista por género, estilo minimalista
- `src/features/organizador/components/bracket/ConfigurarBracketModal.tsx` - Vista previa del sorteo
- `src/features/organizador/components/bracket/BracketView.tsx` - Visualización del bracket
- `src/features/organizador/components/inscripciones/InscripcionesManager.tsx` - Agregado botón cerrar/reabrir inscripciones
- Integrado en `GestionarTorneoPage` como tab "Fixture"

---

## 📅 SISTEMA DE PROGRAMACIÓN INTELIGENTE (IMPLEMENTADO)

### Algoritmo de Distribución

**Objetivo:** Distribuir partidos de múltiples categorías optimizando recursos y tiempos.

**Fases de asignación:**
```
1. ZONA (todas las categorías) - Primeros días
2. RONDA DE AJUSTE - Día después de última zona
3. BRACKET:
   ├── OCTAVOS - Sábado mañana (si aplica)
   ├── CUARTOS - Sábado tarde
   ├── SEMIS - Domingo mañana
   └── FINAL - Domingo tarde
```

**Reglas de negocio:**
- Jueves/Viernes: Horario 18:00-00:00 (solo noche, amateur trabaja)
- Sábados: Horario 14:00-00:00 (tarde/noche)
- Domingos: Horario 08:00-20:00 (todo el día)
- Máximo 2 partidos por pareja por día
- 4 horas mínimo entre partidos de la misma pareja
- Soporte para horarios personalizados (no comunes en PY)

### Predicción de Recursos

```typescript
// Cálculo automático
const horasNecesarias = totalPartidos * 1.5; // 90 min promedio
const horasDisponibles = slots * duracionSlot;
const deficit = horasNecesarias - horasDisponibles;

// Sugerencias si falta capacidad:
- Extender días del torneo
- Agregar canchas adicionales
- Usar sede alternativa
```

### Endpoints REST

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/programacion/torneos/:id/calcular` | POST | Calcula distribución óptima |
| `/programacion/torneos/:id/aplicar` | POST | Aplica programación a partidos |
| `/programacion/torneos/:id/preview` | GET | Vista previa sin aplicar |

### Flujo de Trabajo

**Escenario 1: Sorteo completo de una vez**
```
1. Cerrar inscripciones de TODAS las categorías
2. Sortear todas las categorías
3. POST /programacion/torneos/:id/calcular
4. Revisar predicción de recursos
5. Ajustar manualmente si es necesario
6. POST /programacion/torneos/:id/aplicar
7. Publicar fixture completo
```

**Escenario 2: Sorteo por lotes (recomendado)**
```
Miércoles 23:59 - Cierra lote 1 (cats A, B, C)
  → Sistema calcula ZONA/RONDA solo para estas
  → Jueves - Juegan ZONA cats A, B, C

Jueves 23:59 - Cierra lote 2 (cats D, E, F)
  → Sistema recalcula considerando:
     - Partidos de ZONA de A, B, C ya jugados
     - ZONA/RONDA para D, E, F
     - Brackets de A, B, C (si tienen resultados)
  → Viernes - Juegan ZONA cats D, E, F + RONDA

Y así sucesivamente...
```

### Archivos Creados

**Backend:**
- `src/modules/programacion/programacion.service.ts` - Algoritmo de distribución
- `src/modules/programacion/programacion.controller.ts` - Endpoints REST
- `src/modules/programacion/programacion.module.ts` - Módulo NestJS

**Frontend:**
- `frontend/src/features/organizador/components/programacion/ProgramacionManager.tsx` - Componente principal
- `frontend/src/features/organizador/components/programacion/ServiceProgramacion.ts` - Servicio de API
- `frontend/src/features/organizador/components/programacion/TypesProgramacion.ts` - Tipos TypeScript

**Documentación:**
- `docs/sistema-programacion-inteligente.md` - Especificación completa

---

## ⚠️ PROTECCIÓN CRÍTICA

### Base de Datos
- Migraciones aplicadas vía `db push` (no `migrate deploy` por ahora)
- Seed ejecuta configs iniciales vacías
- Tablas nuevas: checklist_items, torneo_comisiones, etc.

### Autenticación
- Token JWT en localStorage (`fairpadel_token`)
- Guards protegen rutas admin y organizador
- Admin tiene acceso a todo

---

## 🎯 PRÓXIMOS PASOS SUGERIDOS

### Para hoy (testing y refinamiento):
1. **Testing completo con datos de demo** - Usar sistema demo para probar flujo:
   - Crear torneo → Llenar con demo → Sortear categorías → Calcular programación → Aplicar
2. **Registro de resultados** - Formulario para ingresar sets y avanzar ganadores
3. **Conectar checklist al backend** - Persistencia de tareas y recordatorios

### Futuro cercano:
4. **Edición manual de programación** - Drag & drop para ajustar partidos
5. **Calendario de partidos** - Vista semanal con canchas como columnas
6. **Notificaciones reales** - Conectar con proveedor SMS/email (Tigo, SendGrid)
7. **Rankings automáticos** - Cálculo de puntos por torneo
8. **Integración Bancard** - Pasarela de pagos online (postergado)

---

## 📞 COMUNICACIÓN CON KIMI

**Para continuar mañana:**
1. Leer este contexto completamente
2. Verificar Railway logs si hay issues
3. Preguntar al usuario qué prioridad tiene para el día
4. Recordar: un tema a la vez, entregables desplegables

**Estado de ánimo del usuario:** Satisfecho con el sistema completo de bracket y programación. Backend de programación inteligente implementado con algoritmo de distribución automática. Frontend de programación completado con vista de predicción, distribución por fases y acciones de calcular/aplicar. Sistema listo para testing con datos de demo (400 jugadores disponibles).

---

*Documento actualizado: 2026-03-12 - Sistema de Resultados implementado. Backend con lógica completa de juego (sets, tie-breaks, súper tie-break) y avance automático de ganadores. Frontend con modal de registro post-partido y marcador en vivo punto a punto. Listo para testing.*
