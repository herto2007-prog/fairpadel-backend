# Arquitectura de Canchas, Slots y Programación

## 📊 Diagrama de Entidades

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   TOURNAMENT    │────▶│  TORNEO_CANCHA   │────▶│   SEDE_CANCHA   │
│   (Torneo)      │     │ (Cancha asignada │     │  (Cancha física │
└─────────────────┘     │    al torneo)    │     │    de la sede)  │
                        └──────────────────┘     └─────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  TORNEO_SLOT     │
                        │  (Slot de juego) │
                        └──────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
        ┌─────────────────────┐    ┌─────────────────────┐
        │ TORNEO_DISPONIBILIDAD│    │       MATCH         │
        │      _DIA            │    │     (Partido)       │
        │ (Config horaria por  │    │                     │
        │      fecha)          │    │                     │
        └─────────────────────┘    └─────────────────────┘
```

## 🔄 Flujo Completo

### 1️⃣ FASE: CONFIGURACIÓN DE CANCHAS
**Quién:** Organizador antes del sorteo

```
Sede (ej: "Club Padel PY") 
    └── Canchas físicas ("Cancha 1", "Cancha 2")
            └── Se agregan al torneo → TORNEO_CANCHA
```

**Código:**
```typescript
// El organizador selecciona qué canchas físicas usará el torneo
await disponibilidadService.agregarCancha(tournamentId, sedeCanchaId)
// Crea un registro en TORNEO_CANCHA (la cancha "vinculada" al torneo)
```

---

### 2️⃣ FASE: CONFIGURACIÓN DE DISPONIBILIDAD  
**Quién:** Organizador define CUÁNDO se juega

```
TORNEO_CANCHA
    └── TORNEO_DISPONIBILIDAD_DIA (fecha específica: "2025-04-15")
            ├── horaInicio: "18:00"
            ├── horaFin: "23:00"
            └── minutosSlot: 90
```

**Código:**
```typescript
// Configura que el 15/04 se juega de 18:00 a 23:00
await disponibilidadService.configurarDia(tournamentId, {
  fecha: '2025-04-15',
  horaInicio: '18:00',
  horaFin: '23:00',
  minutosSlot: 90  // Cada partido dura 90 min
})
```

---

### 3️⃣ FASE: GENERACIÓN DE SLOTS
**Quién:** Sistema (automático al generar)

```
TORNEO_DISPONIBILIDAD_DIA (2025-04-15, 18:00-23:00, 90min)
    └── Genera SLOTS automáticamente:
        ├── Slot 1: 18:00 - 19:30 (LIBRE)
        ├── Slot 2: 19:30 - 21:00 (LIBRE)
        └── Slot 3: 21:00 - 22:30 (LIBRE)
    
    (Por CADA cancha del torneo)
```

**Código:**
```typescript
// Genera los slots para esa fecha en todas las canchas
await disponibilidadService.generarSlots(tournamentId, diaId)
// Crea registros en TORNEO_SLOT
```

---

### 4️⃣ FASE: SORTEO (BRACKET)
**Quién:** Sistema cuando cierran inscripciones

```
Inscripciones confirmadas
    └── Se crean MATCH (partidos) con:
        ├── inscripcion1Id (pareja A)
        ├── inscripcion2Id (pareja B)
        ├── ronda ("Zona A", "Octavos", etc)
        └── torneoCanchaId: NULL (aún no asignado)
        └── fecha/hora: NULL (aún no programado)
```

**NO se asigna cancha/horario todavía**, solo se crea el bracket.

---

### 5️⃣ FASE: PROGRAMACIÓN
**Quién:** Organizador o sistema automático

```
MATCH (partidos sin horario)
    └── Programación inteligente:
        ├── Busca SLOTS LIBRES
        ├── Asigna: match.torneoCanchaId = slot.torneoCanchaId
        ├── Asigna: match.fecha = slot.fecha
        ├── Asigna: match.horaInicio = slot.horaInicio
        └── Slot pasa a estado: OCUPADO
```

**Código:**
```typescript
// La programación asigna partidos a slots
await api.post(`/programacion/torneos/${id}/aplicar`, {
  asignaciones: [{
    partidoId: '...',
    torneoCanchaId: '...',
    fecha: '2025-04-15',
    horaInicio: '18:00',
    horaFin: '19:30'
  }]
})
```

---

## 📋 Resumen de Tablas

| Tabla | Propósito | Ejemplo |
|-------|-----------|---------|
| `Sede` | Lugar físico | "Club Padel PY" |
| `SedeCancha` | Cancha física de la sede | "Cancha 1" (cemento) |
| `TorneoCancha` | Cancha vinculada al torneo | "Cancha 1" del torneo X |
| `TorneoDisponibilidadDia` | Día/horario configurado | "2025-04-15 de 18:00 a 23:00" |
| `TorneoSlot` | Franja horaria específica | "18:00-19:30 en Cancha 1" |
| `Match` | Partido entre parejas | "Pareja A vs Pareja B" |

---

## ❓ Preguntas Frecuentes

### ¿Por qué no usar las canchas directamente?
Porque un torneo puede usar **subconjunto** de canchas de una sede, y cada torneo tiene su propia **disponibilidad horaria**.

### ¿Qué pasa si cambio la disponibilidad después del sorteo?
Los slots existentes quedan, pero puedes regenerarlos. Los partidos ya asignados NO se mueven automáticamente.

### ¿Puedo tener más slots que partidos?
Sí, sobrarán slots libres. La programación solo usa los necesarios.

### ¿Y si tengo menos slots que partidos?
La programación te avisará con un CONFLICTO de tipo `SIN_DISPONIBILIDAD`.
