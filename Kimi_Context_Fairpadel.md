# Kimi Context - FairPadel V2

> **Documento de respaldo de acciones realizadas**  
> **Propósito:** Mantener registro de decisiones técnicas, entregables completados y estado del proyecto para continuidad entre conversaciones.
> **Última actualización:** 2026-03-11 11:15
> **Conversación actual:** Refactor UI - Fondo consistente + Wizard compacto + Layout system

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

### ✅ Completado (2026-03-11)
- [x] **Refactor UI Wizard de Inscripción** - Diseño compacto/minimalista
- [x] **Selector de código de país** - En teléfono del jugador 2
- [x] **Filtro inteligente de categorías** - Validaciones automáticas por género/nivel
- [x] **Sistema de fondo consistente** - BackgroundEffects en toda la app
- [x] **Componente PageLayout** - Plantilla reutilizable para nuevas páginas

### ⏳ En Progreso / Pendiente
- [ ] Integración de pagos (Bancard)
- [ ] Sistema de Fixture dinámico
- [ ] Rankings automáticos
- [ ] Notificaciones push/SMS (Tigo) - Backend listo, falta provider

---

## 🏗️ ARQUITECTURA DE REPOSITORIOS

| Repo | URL | Tecnología | Deploy |
|------|-----|------------|--------|
| Backend | https://github.com/herto2007-prog/fairpadel-backend.git | NestJS + Prisma + PostgreSQL | Railway (api.fairpadel.com) |
| Frontend | https://github.com/herto2007-prog/fairpadel-frontend.git | React 18 + Vite + Tailwind | Railway (www.fairpadel.com) |

---

## 🆕 ENTREGABLES HOY (2026-03-10)

### 1. Wizard de Creación de Torneos (5 pasos) ✅

**Pasos implementados:**
1. **Identidad & Fechas** - Nombre, descripción, ciudad (con auto-region), sede, fechas
2. **Inversión** - Costo en Guaraníes con formato, duración por partido (slider 60-180min)
3. **Flyer** - Upload a Cloudinary con drag & drop, preview de card
4. **Categorías** - Grid separado por género (Caballeros/Damas), selección múltiple
5. **Confirmar** - Resumen y crear torneo

**Características:**
- Validación por paso
- Navegación con teclado
- Animaciones entre pasos
- Post-creación: muestra link de inscripción y botón "Gestionar"

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
- `fdbb63e` - refactor(wizard): UI compacta y minimalista
- `dfe9086` - fix(wizard): restaurar BackgroundEffects
- `f3b008d` - feat(ui): aplicar fondo consistente a todas las páginas
- `96aaa2a` - fix(wizard): aplicar BackgroundEffects al wizard de creación

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
│   │   │   ├── TorneoWizard.tsx             ✅ 5 pasos crear torneo + fondo
│   │   │   └── SedeAutocomplete.tsx         
│   │   └── pages/
│   │       ├── MisTorneosPage.tsx           ✅ Lista + wizard + fondo
│   │       └── GestionarTorneoPage.tsx      ✅ Tabs gestión + fondo
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

### Para mañana (continuación):
1. **Conectar checklist al backend** - Persistencia de tareas y recordatorios
2. **Inscripción manual** - Formulario para que organizador inscriba parejas directamente
3. **Fixture/Bracket** - Generar cuadro de juego
4. **Mejorar UX del wizard** - Animaciones más fluidas, mejor feedback

### Futuro cercano:
5. **Integración Bancard** - Pasarela de pagos online
6. **Notificaciones reales** - Conectar con proveedor SMS/email (Tigo, SendGrid)
7. **Rankings automáticos** - Cálculo de puntos por torneo
8. **Modo offline/PWA** - Cache de datos para uso sin conexión

---

## 📞 COMUNICACIÓN CON KIMI

**Para continuar mañana:**
1. Leer este contexto completamente
2. Verificar Railway logs si hay issues
3. Preguntar al usuario qué prioridad tiene para el día
4. Recordar: un tema a la vez, entregables desplegables

**Estado de ánimo del usuario:** Muy satisfecho con el resultado visual del nuevo diseño compacto y el fondo consistente. Destacó que el wizard de inscripción "quedó espectacular". Solicitó aplicar el mismo fondo a toda la app, lo cual ya está completado. Interesado en continuar con funcionalidades core como fixture y pagos.

---

*Documento actualizado automáticamente tras sesión de desarrollo.*
