# Kimi Context - FairPadel V2

> **Documento de respaldo de acciones realizadas**  
> **Propósito:** Mantener registro de decisiones técnicas, entregables completados y estado del proyecto para continuidad entre conversaciones.
> **Última actualización:** 2026-03-09 22:50
> **Conversación actual:** Sistema de gestión integral de torneos V2 | Checklist + Comisiones + Bloqueo

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

### ✅ Completado (2026-03-09)
- [x] Sistema de Autenticación (JWT, Guards, Roles)
- [x] CRUD de Usuarios con Roles
- [x] CRUD de Sedes y Canchas
- [x] Modalidades configurables (PY vs Mundo)
- [x] **Wizard de Creación de Torneos (simplificado)**
- [x] **Checklist Inteligente de Preparación**
- [x] **Sistema de Comisiones por Jugador**
- [x] **Bloqueo Estratégico de Torneos**
- [x] **Panel FairPadel (Dashboard del dueño)**

### ⏳ En Progreso / Pendiente
- [ ] Integración de pagos (Bancard)
- [ ] Sistema de Fixture dinámico
- [ ] Rankings automáticos
- [ ] Notificaciones push/SMS (Tigo)

---

## 🏗️ ARQUITECTURA DE REPOSITORIOS

| Repo | URL | Tecnología | Deploy |
|------|-----|------------|--------|
| Backend | https://github.com/herto2007-prog/fairpadel-backend.git | NestJS + Prisma + PostgreSQL | Railway (api.fairpadel.com) |
| Frontend | https://github.com/herto2007-prog/fairpadel-frontend.git | React 18 + Vite + Tailwind | Railway/Vercel (www.fairpadel.com) |

---

## 🆕 ENTREGABLES HOY (2026-03-09)

### 1. Modelo de Negocio Definido ✅

**Comisión por Jugador:**
- Monto fijo configurable (ej: Gs. 5.000 o Gs. 10.000 por jugador)
- Se cobra solo si el jugador confirma asistencia (juega al menos 1 partido)
- Walk Over = no se cobra
- Pago offline: organizador cobra en efectivo/transferencia directa

**Bloqueo Estratégico:**
- Detonante: Último partido de cuartos de final cargado
- Efecto: Torneo se bloquea completamente (no ver bracket, no cargar resultados)
- Liberación: Subir comprobante → Admin verifica → Libera manualmente

### 2. Nuevas Tablas en BD ✅

| Tabla | Propósito |
|-------|-----------|
| `fairpadel_config` | Config global (comisión, datos bancarios, whatsapp) |
| `torneo_comisiones` | Tracking de pago por torneo + estado de bloqueo |
| `checklist_templates` | Templates reutilizables de checklist |
| `checklist_template_items` | Ítems de cada template |
| `checklist_items` | Instancia de checklist por torneo |
| `notificaciones_enviadas` | Log de SMS/emails |

### 3. API Unificada `/admin/torneos` ✅

**Endpoints principales:**
- `GET /admin/torneos` - Lista de torneos
- `POST /admin/torneos` - Crear torneo (con checklist automático)
- `GET /admin/torneos/:id/detalle` - Detalle completo (torneo + comisión + checklist)
- `GET /admin/torneos/:id/checklist` - Ver checklist
- `PUT /admin/torneos/:id/checklist/:itemId` - Completar ítem
- `POST /admin/torneos/:id/comision/comprobante` - Subir comprobante de pago
- `GET /admin/torneos/:id/estado` - Verificar si está bloqueado

### 4. Panel Admin Limpio ✅

**Tabs (5 únicamente):**
1. **Torneos** - Lista, Wizard, Detalle con Checklist y Comisión
2. **Sedes** - CRUD sedes y canchas
3. **Modalidades** - Configurar formatos de juego
4. **Usuarios** - Gestión de roles
5. **FairPadel** - Panel exclusivo del dueño

**Panel FairPadel (sub-tabs):**
- Dashboard: Stats generales, ingresos del mes, comisión configurada
- Bloqueados: Lista de torneos bloqueados con botón "Liberar"
- Configuración: Edición de comisión, datos bancarios, WhatsApp

### 5. Componentes Frontend ✅

- `ChecklistTorneo.tsx` - Checklist con progreso visual y recordatorios
- `ComisionTorneo.tsx` - Estado de comisión + pantalla de bloqueo
- `FairpadelPanel.tsx` - Panel del dueño con dashboard y config
- `TorneosManager.tsx` - Reestructurado: Lista → Wizard → Detalle

---

## 📁 ESTRUCTURA DE ARCHIVOS IMPORTANTES

### Backend
```
src/
├── modules/
│   ├── admin/
│   │   ├── admin-torneos.controller.ts      ✅ UNIFICADO (v2 eliminado)
│   │   ├── fairpadel-admin.controller.ts    ✅ NUEVO - Panel del dueño
│   │   └── ...
│   └── notificaciones/
│       └── notificaciones.service.ts        ✅ NUEVO
├── prisma/
│   ├── schema.prisma                        ✅ 6 tablas nuevas
│   └── seed.ts                              ✅ Seed con configs vacías
└── REGLAS_PROGRAMACION.md                   ✅ 11 reglas
```

### Frontend
```
src/
├── features/
│   └── admin/
│       ├── components/
│       │   ├── TorneosManager.tsx           ✅ REESTRUCTURADO
│       │   ├── ChecklistTorneo.tsx          ✅ NUEVO
│       │   ├── ComisionTorneo.tsx           ✅ NUEVO
│       │   └── FairpadelPanel.tsx           ✅ NUEVO
│       └── pages/
│           └── AdminPage.tsx                ✅ LIMPIO (5 tabs)
├── services/
│   └── torneoV2Service.ts                   ✅ Actualizado a rutas unificadas
└── utils/
    ├── date.ts                              ✅ NUEVO
    └── currency.ts                          ✅ NUEVO
```

---

## 🎛️ PANEL DE ADMINISTRACIÓN - FUNCIONALIDADES

### Tabs Implementados:

| Tab | Funcionalidad | Estado |
|-----|---------------|--------|
| Torneos | Lista + Wizard + Checklist + Comisión | ✅ |
| Sedes | CRUD sedes + canchas | ✅ |
| Modalidades | Configurar PY vs Mundo | ✅ |
| Usuarios | Gestión de roles | ✅ |
| FairPadel | Dashboard del dueño + Config | ✅ |

---

## 🔧 DECISIONES TÉCNICAS CLAVE

### Flujo de Creación de Torneo
1. Organizador crea torneo (Wizard simplificado 3 pasos)
2. Se genera checklist automático desde template
3. Se crea registro de comisión en estado PENDIENTE
4. Organizador completa checklist mientras se inscriben jugadores
5. Al llegar a cuartos, el torneo se bloquea si no pagó comisión
6. Organizador sube comprobante o paga por WhatsApp
7. Admin verifica y libera el torneo

### Cálculo de Comisión
- Fórmula: `jugadores_confirmados × 2 × comision_por_jugador`
- Confirmación: Jugador con resultado en al menos 1 partido
- Pago: Offline (efectivo/transferencia directa a FairPadel)

### Checklist Template (5 ítems por defecto)
1. **Pelotas** - Calculado automático según parejas inscriptas
2. **Auspiciantes** - Manual
3. **Premios/Medallas** - Manual
4. **Infraestructura** - Manual
5. **Bebidas/Refrescos** - Manual

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
- Tablas nuevas: 6 tablas para gestión integral de torneos

### Autenticación
- Token JWT en localStorage (`fairpadel_token`)
- Guards protegen rutas admin
- Panel FairPadel solo accesible para usuarios con rol 'admin'

---

## 🎯 PRÓXIMOS PASOS SUGERIDOS

1. **Configurar valores iniciales** en panel FairPadel (comisión, datos bancarios)
2. **Testing completo** del flujo: Crear torneo → Checklist → Bloqueo → Liberación
3. **Integración SMS** con Tigo para notificaciones
4. **Sistema de Fixture** - Generar bracket automático
5. **Notificaciones** - Email/SMS a jugadores

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
*Actualizado: 2026-03-09 22:50*
