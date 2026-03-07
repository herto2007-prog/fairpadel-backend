# FAIRPADEL - TRANSFERENCIA A NUEVA CONVERSACIÓN

## 📋 RESUMEN EJECUTIVO
Proyecto FairPadel: Sistema completo de gestión de torneos de pádel para Paraguay.
Backend NestJS + Frontend React + PostgreSQL.

Estado actual: Sistema crasheado en producción (Railway). BD corrupta. 
Decisión: Reconstrucción completa desde cero en 6 semanas.

---

## 🎯 OBJETIVO DE LA NUEVA CONVERSACIÓN
Reconstruir FairPadel desde cero con arquitectura limpia, siguiendo el plan de 6 semanas acordado.

---

## 📚 CONTEXTO DEL NEGOCIO

### Qué es FairPadel
Plataforma full-stack para gestión de torneos de pádel con:
- Creación y gestión de torneos
- Inscripciones de parejas
- Sistema de acomodación paraguaya (todos juegan mínimo 2 partidos)
- Fixture con brackets
- Rankings y estadísticas
- Pagos integrados (Bancard Paraguay)
- Gestión de sedes y canchas
- Sistema de instructores y alquileres
- Feed social, logros, notificaciones

### Usuarios del sistema
- **Jugadores**: Se inscriben, ven fixture, reciben notificaciones
- **Organizadores**: Crean torneos, gestionan inscripciones, cargan resultados
- **Admins**: Aprobación de torneos, gestión de usuarios, publicidad
- **Instructores**: Agenda de clases

---

## 🏗️ ARQUITECTURA DESEADA (V2.0)

### Stack Tecnológico
- **Backend**: NestJS 10.x + TypeScript + Prisma ORM
- **Frontend**: React 19 + Vite + TailwindCSS + Zustand
- **Base de datos**: PostgreSQL 15+
- **Cola de tareas**: Redis + Bull (para notificaciones async)
- **Pagos**: Bancard (Paraguay)
- **Almacenamiento**: Cloudinary (imágenes)
- **Notificaciones**: Email (Resend) + SMS (Tigo)

### Arquitectura de Datos (Modelos Core)

```
USER
├── id, email, password_hash, nombre, apellido
├── documento (único), teléfono, fecha_nacimiento
├── género, ciudad, país
├── estado: NO_VERIFICADO | ACTIVO | INACTIVO | SUSPENDIDO
├── esPremium, fechaFinPremium
├── categoriaActualId (relación con Category)
└── Relaciones: roles[], inscripcionesJugador1[], inscripcionesJugador2[]

TOURNAMENT (Torneo)
├── id, nombre, descripción, slug
├── país, región, ciudad
├── fechaInicio, fechaFin, fechaLimiteInscr
├── estado: BORRADOR | PENDIENTE_APROBACION | PUBLICADO | EN_CURSO | FINALIZADO
├── costoInscripcion, flyerUrl
├── sedeId (relación principal)
├── organizadorId (User)
├── circuitoId (Circuito opcional)
├── minutosPorPartido, precioPelota
├── habilitarBancard, comisionPorcentaje
└── Relaciones: categorias[], modalidades[], sedes[], canchas[]

CATEGORY (Categoría Maestra)
├── id, nombre (único), tipo: MASCULINO | FEMENINO
├── orden (1=1ra, 8=8va)
└── Usada en: TournamentCategory, Inscripcion, Match, Ranking

TOURNAMENT_CATEGORY (Categoría en un torneo específico)
├── tournamentId, categoryId
├── inscripcionAbierta: boolean
├── estado: INSCRIPCIONES_ABIERTAS | INSCRIPCIONES_CERRADAS | FIXTURE_BORRADOR | SORTEO_REALIZADO
├── fixtureVersionId (para fixture versionado)
└── Relaciones: tournament, category, fixtureVersion

INSCRIPCION (Inscripción directa - SIN entidad Pareja separada)
├── id, tournamentId, categoryId
├── jugador1Id (obligatorio), jugador2Id (nullable hasta confirmar)
├── jugador2Email (para invitar), jugador2Estado: PENDIENTE | ACEPTADA | RECHAZADA
├── modalidad: TRADICIONAL | MIXTO | SUMA
├── estado: PENDIENTE_PAGO | PENDIENTE_CONFIRMACION | CONFIRMADA | CANCELADA
├── modoPago: COMPLETO | INDIVIDUAL
├── montoTotal, montoPagado
└── Relaciones: pagos[], comprobantes[]

MATCH (Partido)
├── id, tournamentId, categoryId
├── ronda: ACOMODACION_1 | ACOMODACION_2 | OCTAVOS | CUARTOS | SEMIS | FINAL
├── numeroRonda
├── pareja1Id, pareja2Id (nullable)
├── slotDefinitionId (referencia a FixtureVersion.slots)
├── canchaId, fechaProgramada, horaProgramada, horaFinEstimada
├── estado: PROGRAMADO | EN_JUEGO | FINALIZADO | WO | SUSPENDIDO | CANCELADO
├── sets resultados (set1-3 para cada pareja)
├── parejaGanadoraId, parejaPerdedoraId
└── Enlaces: partidoSiguienteId, posicionEnSiguiente (para bracket)

FIXTURE_VERSION (NUEVO: Fixture inmutable)
├── id, tournamentId, categoryId, version (int)
├── estado: BORRADOR | PUBLICADO | ARCHIVADO
├── definicion: JSON con { slots, rondas, reglas }
├── totalPartidos
├── publicadoAt, archivadoAt
└── Relaciones: matches[], tournamentCategory

RANKING
├── id, jugadorId, tipoRanking: GLOBAL | PAIS | REGION | CIUDAD | CATEGORIA | LIGA
├── alcance, referenciaAlcance, categoriaId (si aplica)
├── puntosTotales, torneosJugados
├── partidosGanados, partidosPerdidos
├── victorias, finales, semifinales, mejorPuestoHistorico
├── temporada, ultimaActualizacion

PAGO (Entidad separada del flujo de inscripción)
├── id, concepto: INSCRIPCION | PREMIUM | ALQUILER
├── referenciaId (ID de inscripción, suscripción, etc.)
├── monto, moneda
├── estado: PENDIENTE | PROCESANDO | COMPLETADO | FALLIDO | REEMBOLSADO
├── metodo: BANCARD | TRANSFERENCIA | EFECTIVO
├── metadatos: JSON (datos específicos del método)
├── intentos (contador de reintentos)
└── Relaciones: transiciones[] (historial de cambios)

SEDE / CANCHA / ALQUILERES / INSTRUCTORES / SOCIAL / LOGROS
(Estructuras similares, detalles en especificación completa)
```

---

## 🔄 FLUJOS PRINCIPALES

### 1. Creación de Torneo (Organizador)
```
BORRADOR → Configurar sedes/canchas → Configurar finanzas → PUBLICADO
```

### 2. Inscripción (Jugador)
```
Selecciona categoría → Ingresa email de compañero → Invitación enviada
→ Compañero acepta → Selecciona método de pago → Pago procesado → CONFIRMADA
```

### 3. Sorteo - Sistema de Acomodación Paraguaya
```
CLOSE INSCRIPCIONES → GENERAR FIXTURE:

Fase 1 (Acomodación 1 - R1):
- Todos juegan
- Emparejamiento serpentina por seeding
- Ganadores → Bracket principal
- Perdedores → Acomodación 2

Fase 2 (Acomodación 2 - R2):
- Solo perdedores de R1
- Rankeados por games ganados en R1
- Mejor perdedor → BYE directo al bracket
- Resto → juegan R2
- Ganadores R2 → Bracket
- Perdedores R2 → Eliminados (jugaron 2 partidos)

Fase 3 (Bracket Principal):
- Potencia de 2
- Octavos → Cuartos → Semis → Final
- Seeding posiciones estándar de tenis
```

### 4. Carga de Resultados
```
Organizador carga resultado → Avance automático en bracket
→ Actualización de rankings → Notificaciones a jugadores
```

---

## ⚠️ DECISIONES ARQUITECTÓNICAS CLAVE

### 1. NO hay entidad Pareja separada
- La inscripción incluye jugador1Id + jugador2Id directamente
- jugador2 puede ser null hasta que acepte invitación
- Simplifica el modelo, elimina "parejas huérfanas"

### 2. Fixture Versionado (inmutable)
- FixtureDefinition guarda la estructura completa como JSON
- MatchExecution es la instancia de ejecución
- Permite re-sorteo manteniendo historial
- Auditoría completa de cambios

### 3. Máquina de Estados explícita
- Cada entidad con estados tiene transiciones definidas
- Validaciones automáticas de cambios de estado
- No se puede pasar de cualquier estado a cualquier otro

### 4. Cola de Notificaciones (async)
- Redis + Bull para notificaciones
- Si falla el envío, no afecta la operación principal
- Retry automático con backoff exponencial

### 5. Pagos como entidad independiente
- Desacoplado de inscripciones
- Su propio ciclo de vida y máquina de estados
- Extensible para suscripciones, alquileres, etc.

---

## 📅 PLAN DE 6 SEMANAS

### Semana 1: Fundación
- [ ] Setup proyecto NestJS + Prisma + PostgreSQL
- [ ] Modelos core: User, Tournament, Category, TournamentCategory
- [ ] Autenticación JWT, Guards, Roles
- [ ] Tests de integración base
- [ ] Deploy inicial funcionando

### Semana 2: Inscripciones y Notificaciones
- [ ] Sistema de inscripciones directas (sin Pareja)
- [ ] Invitaciones por email con tokens
- [ ] Redis + Bull para cola de notificaciones
- [ ] Notificaciones async (email/push)

### Semana 3: Fixture Versionado
- [ ] Modelo FixtureVersion
- [ ] Generación de fixture con seeding
- [ ] Sistema de acomodación paraguaya (R1, R2, Bracket)
- [ ] Algoritmo de scheduling de canchas

### Semana 4: Partidos y Rankings
- [ ] Modelo Match con estados
- [ ] Carga de resultados
- [ ] Avance automático en bracket
- [ ] Actualización de rankings

### Semana 5: Pagos y Finanzas
- [ ] Entidad Pago independiente
- [ ] Integración Bancard
- [ ] Comprobantes de transferencia
- [ ] Gestión de deudas y reembolsos

### Semana 6: Sedes, Alquileres, Instructores, Feed
- [ ] Módulo de sedes y canchas
- [ ] Alquileres de canchas (mensualeros)
- [ ] Sistema de instructores
- [ ] Feed social y logros
- [ ] Documentación técnica completa

---

## 🚨 PROBLEMAS CONOCIDOS A EVITAR

1. **Migraciones cronológicas**: Mantener orden temporal correcto (timestamp)
2. **Enums**: Validar valores de enums entre schema y código
3. **Seed idempotente**: Usar upsert, no create directo
4. **Transacciones**: Envolver operaciones críticas en transactions
5. **N+1 queries**: Usar include/select apropiadamente
6. **Concurrencia**: Locks pesimistas en operaciones de sorteo

---

## 🎯 PRIMER ENTREGABLE (Semana 1)

### Backend funcionando con:
- [ ] PostgreSQL conectado
- [ ] Migraciones aplicadas limpiamente
- [ ] Seed creando admin automáticamente
- [ ] Endpoints:
  - POST /auth/login
  - POST /auth/register
  - GET /tournaments (listado público)
  - POST /tournaments (crear - solo organizador)
  - GET /tournaments/:id
- [ ] Tests de integración pasando
- [ ] Deploy en Railway funcionando

### Frontend mínimo:
- [ ] Login funcional
- [ ] Listado de torneos
- [ ] Formulario de creación de torneo

---

## 📁 ESTRUCTURA DE CARPETAS SUGERIDA

```
fairpadel-v2/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── tournaments/
│   │   │   ├── inscripciones/
│   │   │   ├── fixture/
│   │   │   ├── matches/
│   │   │   ├── rankings/
│   │   │   ├── pagos/
│   │   │   ├── notificaciones/
│   │   │   └── common/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── config/
│   │   └── main.ts
│   ├── test/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── features/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/
│   │   └── App.tsx
│   └── package.json
└── docker-compose.yml (para desarrollo local)
```

---

## 🔐 VARIABLES DE ENTORNO NECESARIAS

```
# Backend
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_EXPIRATION=24h
FRONTEND_URL=...

# Bancard
BANCARD_PUBLIC_KEY=...
BANCARD_PRIVATE_KEY=...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Email
RESEND_API_KEY=...
FROM_EMAIL=...

# SMS
TIGO_BEEKUN_API_KEY=...

# Redis (para cola)
REDIS_URL=...
```

---

## ✅ CRITERIOS DE ACEPTACIÓN

Cada semana debe cumplir:
1. Código compila sin errores
2. Tests de integración pasan
3. Deploy en Railway funciona
4. Usuario admin puede hacer login
5. Funcionalidades de la semana operativas

---

## 📞 COMUNICACIÓN

Usuario (herto2007@gmail.com) es dueño del proyecto.
Soy el desarrollador (Kimi Code CLI).

Reglas de comunicación:
- Yo propongo soluciones técnicas
- Usuario aprueba o solicita cambios
- Decisiones arquitectónicas importantes: consenso
- NO doy instrucciones al usuario para ejecutar, yo implemento todo

---

## 🚀 INICIO INMEDIATO

EMPEZAR CON:
1. Crear estructura de proyecto NestJS limpia
2. Configurar Prisma con modelos User, Tournament, Category iniciales
3. Setup Docker Compose para desarrollo local
4. Implementar autenticación básica
5. Primer deploy a Railway

---

## NOTAS FINALES

- Prioridad: ESTABILIDAD sobre features
- Cada cambio debe ser reversible (git)
- Tests son obligatorios, no opcionales
- Documentar decisiones técnicas en código (comentarios)
- Nunca asumir que "funcionará en producción", probar siempre

---

**Generado:** 2026-03-05
**Versión:** FairPadel v2.0 - Reconstrucción Completa
**Estado:** Listo para iniciar
