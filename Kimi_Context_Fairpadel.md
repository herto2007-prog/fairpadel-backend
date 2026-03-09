# Kimi Context - FairPadel V2

> **Documento de respaldo de acciones realizadas**  
> **Propósito:** Mantener registro de decisiones técnicas, entregables completados y estado del proyecto para continuidad entre conversaciones.
> **Última actualización:** 2026-03-09 15:30
> **Conversación actual:** Admin Panel completo - CRUD Sedes + Gestión Roles | Esperando deploy Railway (outage)

---

## 🏆 REGLAS DE ORO (Nunca olvidar)

### 1. Entender el Sistema como un Todo
**Antes de cambiar cualquier cosa, preguntar:**
- ¿Dónde más se usa este dato/componente?
- ¿Qué otros flujos dependen de esto?
- ¿El frontend/backend están sincronizados?

**Ejemplo real:** Cambiar nombres de categorías en el backend sin actualizar el frontend rompió el registro. Las categorías se usan en:
- Seed inicial
- Registro de usuario
- Creación de torneos
- Filtros de búsqueda

### 2. Compilar Localmente Antes de Push
Nunca enviar código sin verificar que compila:
```bash
npm run build  # Backend
npm run build  # Frontend
```

### 3. Una Base de Datos = Una Verdad
- Local desarrollo → Base local
- Producción → Base de Railway (la que inyecta Railway, no otra)
- Nunca mezclar datos entre entornos

---

## 📋 RESUMEN EJECUTIVO

**Proyecto:** FairPadel - Sistema de gestión de torneos de pádel para Paraguay  
**Estado:** 🚀 **DEPLOY PRODUCCIÓN EXITOSO** - Backend y Frontend online  
**URLs:**
- Frontend: https://www.fairpadel.com
- Backend API: https://api.fairpadel.com/api
- Health Check: https://api.fairpadel.com/api/health

**Stack:** NestJS + React + PostgreSQL + Prisma  
**Metodología:** MVP breadth-first, entregables atómicos y desplegables

---

## 🎯 ROADMAP V2 - ENTREGABLES

### Semana 1: Fundación ✅
- [x] Setup proyecto NestJS + Prisma + PostgreSQL
- [x] Modelos core: User, Tournament, Category, TournamentCategory
- [x] Autenticación JWT, Guards, Roles
- [x] Deploy inicial funcionando
- [x] Auth Frontend (Login, Register)

### Semana 2: Inscripciones y Notificaciones ✅
- [x] Sistema de inscripciones directas (sin Pareja)
- [x] Estados de inscripción (PENDIENTE_CONFIRMACION → CONFIRMADA)
- [x] Confirmación manual por organizador
- [x] Frontend Mis Inscripciones
- [x] Frontend Gestión de Inscripciones

### Semana 3: Fixture Versionado ✅
- [x] Modelo FixtureVersion (inmutable, JSON)
- [x] Modelo Match con estados y resultados
- [x] Sistema de acomodación paraguaya (R1, R2, Bracket)
- [x] API Backend Fixture y Matches
- [x] Frontend Bracket visual
- [x] Frontend Cargar resultados

### Semana 4: Partidos y Rankings ✅
- [x] Modelo Ranking en Prisma
- [x] Sistema de cálculo de rankings
- [x] Rankings globales y por categoría
- [x] API de rankings

### Semana 5: Pagos y Finanzas ⏳
- [ ] Entidad Pago independiente
- [ ] Integración Bancard
- [ ] Comprobantes de transferencia

### Semana 6: Sedes, Alquileres, Instructores ✅ (COMPLETADA)
- [x] Módulo de sedes y canchas
- [x] Alquileres de canchas (mensualeros)
- [x] Sistema de instructores
- [x] Frontend Sedes (listado, detalle)
- [x] Frontend Alquileres (reservar, mis reservas)
- [x] Frontend Instructores (directorio, perfil)
- [x] Configuración completa para deploy

### Deploy a Producción ✅ (2026-03-08)
- [x] Backend deployado en Railway: confident-ambition-production.up.railway.app
- [x] Frontend deployado en Railway: fairpadel-frontend-production.up.railway.app
- [x] Dominio custom configurado: api.fairpadel.com
- [x] Dominio custom configurado: www.fairpadel.com
- [x] CORS configurado para dominios custom
- [x] Base de datos reiniciada con schema completo
- [x] Seed automático de categorías y roles funcionando

---

## 🔧 PROBLEMAS RESUELTOS (2026-03-08)

### 1. ConfigModule en Módulos
**Problema:** Error `Nest can't resolve dependencies` en EmailModule, UploadsModule y AuthModule.
**Solución:** Agregar `ConfigModule` a los `imports` de los módulos que usan `ConfigService`.

### 2. Railway Dockerfile CMD
**Problema:** Railway ignoraba el `startCommand` del `railway.json` y usaba el `CMD` del Dockerfile.
**Solución:** Remover `startCommand` de `railway.json` y usar solo el `CMD` del Dockerfile.

### 3. Puerto y Host Binding
**Problema:** El backend no respondía porque escuchaba solo en `localhost`.
**Solución:** Agregar `'0.0.0.0'` al `app.listen()` en `main.ts`.

### 4. Base de Datos - Schema Desactualizado
**Problema:** La DB tenía datos viejos y el schema nuevo requería columnas nuevas.
**Solución:** Usar `prisma db push --force-reset` para recrear el schema completo.

### 5. Timezone Paraguay
**Problema:** El servidor mostraba hora UTC en vez de hora de Paraguay (UTC-3).
**Solución:** Crear `DateService` reutilizable con zona horaria `America/Asuncion`.

---

## 🆕 NUEVOS SERVICIOS CREADOS

### DateService (src/common/services/date.service.ts)
Servicio global para manejar fechas en zona horaria de Paraguay:
```typescript
@Injectable()
export class DateService {
  formatNow(): string;        // "08/03/2026, 23:10:45"
  getDateOnly(): string;      // "2026-03-08"
  getTimeOnly(): string;      // "23:10:45"
  isToday(date: Date): boolean;
}
```

---

## 🚀 ESTADO ACTUAL

### Estructura V2 Completa

```
v2/
├── backend/
│   ├── src/
│   │   ├── common/             ✅ NUEVO (DateService global)
│   │   │   ├── common.module.ts
│   │   │   └── services/
│   │   │       └── date.service.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── tournaments/
│   │   │   ├── sedes/          ✅ NUEVO
│   │   │   ├── alquileres/     ✅ NUEVO
│   │   │   └── instructores/   ✅ NUEVO
│   │   ├── prisma/
│   │   ├── seed/               ✅ Seed automático
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/schema.prisma
│   ├── Dockerfile              ✅ Configurado para Railway
│   ├── railway.json            ✅ Configurado
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── .env.example
│   ├── .gitignore
│   └── README.md
│
└── frontend/
    ├── src/
    │   ├── features/
    │   │   ├── auth/
    │   │   ├── sedes/          ✅ NUEVO
    │   │   ├── alquileres/     ✅ NUEVO
    │   │   └── instructores/   ✅ NUEVO
    │   ├── services/
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── Dockerfile              ✅ Configurado para Railway
    ├── railway.json            ✅ Configurado
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env.example
    ├── .gitignore
    └── README.md
```

---

## 📦 ARCHIVOS DE CONFIGURACIÓN CREADOS

### Backend

| Archivo | Propósito |
|---------|-----------|
| `package.json` | Dependencias NestJS 10.x, Prisma 5.x, JWT |
| `tsconfig.json` | Config TypeScript para NestJS |
| `nest-cli.json` | CLI config de NestJS |
| `Dockerfile` | Multi-stage build para Railway |
| `railway.json` | Config deploy Railway |
| `.env.example` | Variables de entorno de ejemplo |
| `.gitignore` | Excluir node_modules, dist, .env |

### Frontend

| Archivo | Propósito |
|---------|-----------|
| `package.json` | React 18, Vite 5, Tailwind 3, Axios |
| `tsconfig.json` | Config TypeScript para React |
| `tsconfig.node.json` | Config para Vite |
| `vite.config.ts` | Config Vite con proxy /api |
| `tailwind.config.js` | Tema Dark Mokoto |
| `postcss.config.js` | PostCSS con Tailwind |
| `index.html` | Entry point HTML |
| `Dockerfile` | Build + nginx para Railway |
| `railway.json` | Config deploy Railway |
| `.env.example` | Variables de entorno de ejemplo |
| `.gitignore` | Excluir node_modules, dist, .env |

---

## 🏗️ DECISIONES ARQUITECTÓNICAS IMPORTANTES

### Categorías vs Género (2026-03-09)

**Decisión:** Las categorías de pádel NO tienen género. Son las PERSONAS (usuarios) las que tienen género.

**Modelo correcto:**
```
Categoría: "1ª Categoría", "2ª Categoría", etc. (sin género)
Usuario: { categoriaActualId, genero: MASCULINO|FEMENINO }
Torneo: { categorias: [...], separaPorGenero: true }
```

**En la UI:**
- Registro: Usuario selecciona categoría + género
- Torneos: El sistema organiza competencias separadas por género (Caballeros/Damas)
- Rankings: Separados por categoría Y género

**Por qué es importante:**
- Una mujer puede jugar en "1ª Categoría" y eso no cambia por ser mujer
- El género separa la competencia, no la categoría
- Facilita organizar torneos mixtos o por género según se requiera

---

## 🛡️ MEDIDAS DE PROTECCIÓN IMPLEMENTADAS

### Protección de Base de Datos (Crítico)
**Problema:** El Dockerfile tenía `prisma db push --force-reset` que borraba TODOS los datos en cada deploy.

**Solución:** Cambiado a `prisma db push --accept-data-loss` (solo actualiza schema, mantiene datos).

**Verificación:** 
- ✅ Base de datos persistente entre deploys
- ✅ Usuarios permanecen registrados
- ✅ Datos de sedes/canchas se mantienen

---

## 🎛️ PANEL DE ADMINISTRACIÓN

### Funcionalidades Implementadas

#### 1. Gestión de Roles ✅
- **URL:** `/admin` → Tab "Roles"
- **Features:**
  - Lista de usuarios con búsqueda
  - Toggle de roles (Jugador, Organizador, Admin)
  - Estadísticas en tiempo real
  - Protección por guards (solo admin puede modificar)

#### 2. CRUD de Sedes ✅
- **URL:** `/admin` → Tab "Sedes"
- **Features:**
  - Crear nueva sede (nombre, ciudad, dirección, teléfono, maps)
  - Editar sede existente
  - Desactivar/Reactivar sede (soft delete)
  - Cards visuales con info de canchas
  - Estadísticas (total, activas, inactivas)

#### 3. Próximos Módulos Admin
- Ascensos de categoría
- Configuración Premium
- Sistema de puntos por torneo
- Gestión de torneos

---

## 🚀 INSTRUCCIONES DE DEPLOY

### 1. Backend (Ya en Producción)

```bash
cd v2/backend

# Variables de entorno en Railway:
DATABASE_URL=postgresql://...  # Inyectado por Railway
JWT_SECRET=your-secret-key
FRONTEND_URL=https://www.fairpadel.com
PORT=3000  # Inyectado por Railway

# Deploy automático en Railway
git add .
git commit -m "Backend update"
git push origin master
```

### 2. Frontend (Ya en Producción)

```bash
cd v2/frontend

# Variables de entorno en Railway:
VITE_API_URL=https://api.fairpadel.com/api

# Deploy automático en Railway
git add .
git commit -m "Frontend update"
git push origin master
```

---

## 🎯 PRÓXIMO PASO

La V2 está **EN PRODUCCIÓN** y funcionando. Próximas tareas:

1. **Week 5: Pagos y Finanzas** ⏳
   - Entidad Pago independiente
   - Integración Bancard
   - Comprobantes de transferencia

2. **Testing End-to-End**
   - Flujo completo de registro
   - Flujo de inscripción a torneo
   - Flujo de fixture y resultados

3. **Optimizaciones**
   - Cache de rankings
   - WebSockets para notificaciones en tiempo real
   - Optimización de queries Prisma

**¿Qué preferís hacer mañana?**

---

---

## 📚 PLAN DE DOCUMENTACIÓN

### 1. Documentación Técnica (Para desarrolladores)

#### API Documentation (Swagger/OpenAPI)
- **Qué es:** Documentación automática de todos los endpoints
- **Cómo se usa:** Acceder a `/api/docs` y ver todos los endpoints con ejemplos
- **Beneficio:** Facilita que otros devs integren con la API

#### Diagrama de Arquitectura
- **Flujo de datos:** Usuario → Frontend → Backend → Database
- **Autenticación:** JWT flow
- **Modelos de datos:** Entidad-Relación completo

### 2. Documentación de Usuario (Para jugadores/organizadores)

#### Manual de Usuario (PDF/Web)
- **Cómo registrarse** paso a paso
- **Cómo inscribirse en un torneo**
- **Cómo ver rankings**
- **Cómo subir resultados**

#### Videos tutoriales (Loom/Youtube)
- Registro e inicio de sesión
- Creación de torneos (para organizadores)
- Gestión de sedes (para admin)

### 3. Documentación de Admin

#### Guía del Administrador
- **Gestión de usuarios y roles**
- **Creación y gestión de sedes**
- **Configuración de sistema de puntos**
- **Gestión de ascensos**

#### Checklist de operaciones diarias
- Verificar registros pendientes
- Validar sedes nuevas
- Monitorear torneos activos

### 4. Documentación de Despliegue (DevOps)

#### Guía de Deploy
- Cómo hacer deploy en Railway
- Variables de entorno requeridas
- Backups de base de datos
- Rollback en caso de errores

#### Monitoreo
- Logs de Railway
- Métricas de uso
- Alertas de errores

---

## 🎯 PRIORIDADES DE DOCUMENTACIÓN

**Alta Prioridad:**
1. ✅ API Docs (Swagger) - Técnico
2. ✅ Guía de Admin - Panel de gestión
3. 🔄 Manual de Usuario básico

**Media Prioridad:**
4. Diagramas de arquitectura
5. Videos tutoriales
6. Guía de Deploy detallada

**Baja Prioridad:**
7. Documentación de código inline
8. Wiki del proyecto

---

*Documento mantenido por Kimi Code CLI*
