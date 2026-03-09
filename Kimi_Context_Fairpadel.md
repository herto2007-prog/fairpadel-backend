# Kimi Context - FairPadel V2

> **Documento de respaldo de acciones realizadas**  
> **Propósito:** Mantener registro de decisiones técnicas, entregables completados y estado del proyecto para continuidad entre conversaciones.
> **Última actualización:** 2026-03-09 17:00
> **Conversación actual:** Wizard de Torneos completado | Reglas de Programación definidas

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

### ✅ Completado
- [x] Sistema de Autenticación (JWT, Guards, Roles)
- [x] CRUD de Usuarios con Roles
- [x] CRUD de Sedes y Canchas
- [x] Modalidades configurables (PY vs Mundo)
- [x] Panel de Admin completo
- [x] **Wizard de Creación de Torneos (5 pasos)**

### ⏳ En Progreso / Pendiente
- [ ] Integración de pagos (Bancard)
- [ ] Sistema de Fixture dinámico
- [ ] Rankings automáticos
- [ ] Notificaciones push

---

## 🏗️ ARQUITECTURA DE REPOSITORIOS

| Repo | URL | Tecnología | Deploy |
|------|-----|------------|--------|
| Backend | https://github.com/herto2007-prog/fairpadel-backend.git | NestJS + Prisma + PostgreSQL | Railway (api.fairpadel.com) |
| Frontend | https://github.com/herto2007-prog/fairpadel-frontend.git | React 18 + Vite + Tailwind | Railway/Vercel (www.fairpadel.com) |

**Convenciones:**
- Commits descriptivos en español
- Backend primero cuando hay dependencias
- Build local obligatorio antes de push

---

## 🆕 ENTREGABLES RECIENTES (2026-03-09)

### 1. Wizard de Creación de Torneos ✅

**Ubicación:** `/admin` → Tab "Torneos"

**5 Pasos Animados:**
1. **Datos Básicos:** Nombre, fechas, ciudad, sede, costo
2. **Modalidad:** Selector visual PY vs Mundo (checkbox múltiple)
3. **Categorías:** Grid de categorías (1ª a Principiante)
4. **Configuración:** Sets por partido, duración, límite inscripción
5. **Preview:** Resumen visual antes de publicar

**Features especiales:**
- Input de Guaraníes con formato miles (`Gs. 1.500.000`)
- Buscador de Sedes estilo CityAutocomplete (no dropdown)
- Validación por paso con mensajes de error
- Animaciones con framer-motion
- Autenticación automática vía `api` service (JWT)

**Endpoints Backend:**
- `GET /admin/torneos/datos/wizard` - Sedes, modalidades, categorías
- `POST /admin/torneos` - Crear torneo
- `POST /admin/torneos/:id/modalidades` - Asignar modalidades
- `POST /admin/torneos/:id/categorias` - Asignar categorías
- `PUT /admin/torneos/:id/configuracion` - Reglas del torneo
- `PUT /admin/torneos/:id/publicar` - Publicar torneo

### 2. UI Compacta ✅

- Clase `compact-ui` aplicada en AppLayout
- Reduce tamaños ~15% en páginas internas
- Landing preservado con tamaños originales

---

## 📁 ESTRUCTURA DE ARCHIVOS IMPORTANTES

### Backend
```
src/
├── modules/
│   ├── admin/
│   │   ├── admin-torneos.controller.ts      ✅ NUEVO
│   │   ├── admin-modalidades.controller.ts  ✅
│   │   ├── admin-categorias.controller.ts   ✅
│   │   └── admin.controller.ts              ✅
│   ├── sedes/
│   │   └── sedes-admin.controller.ts        ✅
│   └── tournaments/
│       └── tournaments.controller.ts
├── prisma/
│   └── schema.prisma                        ✅ ModalidadConfig, SedeCancha
└── REGLAS_PROGRAMACION.md                   ✅ DOCUMENTO DE ORO
```

### Frontend
```
src/
├── features/
│   └── admin/
│       ├── components/
│       │   ├── TorneosManager.tsx           ✅ WIZARD
│       │   ├── ModalidadesManager.tsx       ✅
│       │   └── SedesManager.tsx             ✅
│       └── pages/
│           └── AdminPage.tsx                ✅
├── components/
│   └── ui/
│       └── CityAutocomplete.tsx             ✅ Reutilizable
└── index.css                                ✅ compact-ui
```

---

## 🎛️ PANEL DE ADMINISTRACIÓN - FUNCIONALIDADES

### Tabs Implementados:

| Tab | Funcionalidad | Estado |
|-----|---------------|--------|
| Roles | Gestión de usuarios y roles | ✅ |
| Sedes | CRUD sedes + canchas | ✅ |
| Modalidades | Configurar PY vs Mundo | ✅ |
| Torneos | Wizard creación torneos | ✅ |
| Ascensos | Próximamente | ⏳ |
| Premium | Próximamente | ⏳ |

---

## 🔧 DECISIONES TÉCNICAS CLAVE

### Modalidades PY vs Mundo
- Cada modalidad tiene `variante: 'PY' | 'MUNDIAL'`
- Reglas configurables en JSON (sets, bracket, iluminación, etc.)
- Frontend agrupa por variante con badges 🇵🇾 y 🌍

### Input de Guaraníes
- Componente `GuaraniesInput` con formato automático de miles
- Display: `Gs. 1.500.000`
- Almacenamiento: número entero (1500000)

### Buscador de Sedes
- Reemplaza dropdown tradicional
- Busca por nombre de sede o ciudad
- Autocomplete con lista filtrada
- Mensaje si no existe ("Crear sede primero")

### Validación de Pasos
- Cada paso valida antes de permitir avanzar
- Mensajes de error específicos por campo
- No validación al retroceder

---

## 🚀 INSTRUCCIONES DE DEPLOY

### Checklist Pre-Push (OBLIGATORIO)

```bash
# Backend
cd fairpadel
npm run build          # Debe pasar 0 errores

# Frontend  
cd fairpadel-frontend
npm run build          # Debe pasar 0 errores

# Si todo OK:
git add .
git commit -m "feat: descripción clara"
git push origin master
```

### Variables de Entorno Backend (Railway)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
FRONTEND_URL=https://www.fairpadel.com
```

### Variables de Entorno Frontend (Railway)
```
VITE_API_URL=https://api.fairpadel.com/api
```

---

## ⚠️ PROTECCIÓN CRÍTICA

### Base de Datos
- **NUNCA** usar `--force-reset` en producción
- Usar `--accept-data-loss` solo cuando sea necesario
- Dockerfile actualizado para preservar datos

### Autenticación
- Token JWT en localStorage (`fairpadel_token`)
- Interceptor axios añade header Authorization automáticamente
- Guards protegen rutas admin

---

## 🎯 PRÓXIMOS PASOS SUGERIDOS

1. **Testing del Wizard** - Verificar flujo completo de creación
2. **Integración Bancard** - Pagos de inscripción
3. **Fixture Automático** - Generar bracket según modalidad
4. **Notificaciones** - Email/SMS a jugadores

---

## 📞 COMUNICACIÓN CON KIMI

### Preferencias del Usuario:
- **Preguntas cortas y por turnos** (no todo de una vez)
- **Sugerir mejoras** constantemente (proactividad)
- **Ver el sistema como un todo** antes de cambiar partes
- **Preguntar cuando hay dudas** sobre reglas de negocio

### Documentación de Referencia:
- `REGLAS_PROGRAMACION.md` - Reglas de oro
- `prisma/schema.prisma` - Modelo de datos
- Este archivo - Historial de decisiones

---

*Documento mantenido por Kimi Code CLI*
*Actualizado: 2026-03-09*
