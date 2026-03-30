# Planificación: Sistema de Sorteo de Torneos

## Visión General

El sorteo de un torneo se divide en **4 partes secuenciales** que se ejecutan en orden específico.

---

## Flujo del Sorteo

```
┌─────────────────────────────────────────────────────────────────────┐
│  PARTE 2: Guardar Bracket (sin slots)                               │
│  • Cerrar inscripciones                                             │
│  • Generar estructura del bracket                                   │
│  • Crear partidos en BD (sin cancha/horario)                        │
│  • Guardar fixtureVersionId                                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PARTE 3: Asignar Slots                                             │
│  • Asignación estricta por fase                                     │
│  • TODAS ZONAS → TODOS REPECHAJES → TODOS OCTAVOS...                │
│  • Prioridad: más inscriptos primero                                │
│  • Descanso 3h solo si mismo día                                    │
│  • BYE ignorados                                                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PARTE 1: Validación de Slots                                       │
│  • Verificar si quedaron partidos sin slot                          │
│  • Si hay sin slot → Error detallado (cuántos, de qué fase)         │
│  • Si todos tienen slot → Éxito                                     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  PARTE 4: Rollback (solo si hay error)                              │
│  • Limpiar partidos creados                                         │
│  • Restaurar fixtureVersionId anterior                              │
│  • Liberar slots reservados                                         │
│  • Volver estado de categorías a INSCRIPCIONES_ABIERTAS             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Parte 2: Guardar Bracket (sin slots)

### Objetivo
Crear la estructura del bracket en la base de datos sin asignar horarios ni canchas.

### Entrada
- `categoriasData`: Array de categorías con sus inscripciones
- `tournamentId`: ID del torneo

### Proceso
1. Para cada categoría:
   - Cambiar estado a `INSCRIPCIONES_CERRADAS`
   - Si existe fixture anterior → archivarlo
   - Llamar `bracketService.generarBracket()` → obtiene config + partidos
   - Llamar `bracketService.guardarBracket(slots=[])` → crea partidos en BD sin slots
   - Guardar `fixtureVersionId` en `TournamentCategory`

### Salida
- Partidos creados en tabla `Match` (sin fechaProgramada, horaProgramada, torneoCanchaId)
- `fixtureVersionId` guardado en cada categoría
- **Botón "Ver" debe aparecer ahora** (el frontend detecta fixtureVersionId)

### Notas
- Los partidos BYE se crean pero marcan `esBye = true`
- Ningún partido tiene slot asignado todavía

---

## Parte 3: Asignar Slots

### Objetivo
Asignar slots (cancha + horario) a cada partido no-BYE respetando las reglas.

### Entrada
- `tournamentId`: ID del torneo
- `categoriasData`: Categorías con sus fixtureVersionId
- `diasConfig`: Días configurados con sus fases permitidas

### Proceso

```javascript
// 1. Ordenar categorías por cantidad de inscriptos (descendente)
//    Más inscriptos = prioridad para mejores horarios

categoriasOrdenadas = categoriasData.sort((a, b) => 
  b.inscripciones.length - a.inscripciones.length
)

// 2. Para cada día configurado
for (dia of diasConfig) {
  
  // Obtener fases permitidas para este día
  fasesPermitidas = dia.fasesPermitidas || obtenerPorDiaSemana(dia.fecha)
  
  // Obtener slots libres del día
  slotsLibres = obtenerSlotsLibres(dia.id)
  
  // 3. ASIGNACIÓN ESTRICTA POR FASE
  //    Toda la fase N se asigna antes que cualquier fase N+1
  //    Esto garantiza orden cronológico (Zona → Repechaje → Octavos...)
  
  for (fase of fasesPermitidas) {  // ZONA, luego REPECHAJE, luego OCTAVOS...
    
    // Repetir hasta vaciar todos los partidos de esta fase
    do {
      huboAsignaciones = false
      
      for (catData of categoriasOrdenadas) {
        // Buscar primer partido de esta fase/categoría sin slot
        partido = buscarPartidoSinSlot(catData.fixtureVersionId, fase)
        
        if (!partido) continue
        
        // Buscar primer slot disponible que cumpla descanso
        for (slot of slotsLibres) {
          if (slot.usado) continue
          
          // Verificar descanso de 3h para ambas parejas
          // Solo si es mismo día (día diferente = siempre válido)
          
          puedeJugar = true
          
          for (parejaId of [partido.inscripcion1Id, partido.inscripcion2Id]) {
            if (parejaId && ultimoPartido[parejaId]?.fecha === dia.fecha) {
              ultimaHoraFin = ultimoPartido[parejaId].horaFin
              
              // Validar 3h de descanso
              if (!validarDescanso(dia.fecha, ultimaHoraFin, slot.horaInicio, 180)) {
                puedeJugar = false
                break
              }
            }
          }
          
          if (puedeJugar) {
            // Asignar slot
            asignarSlotAPartido(partido, slot, dia)
            marcarSlotComoUsado(slot)
            
            // Registrar último partido de cada pareja
            actualizarUltimoPartido(partido.inscripcion1Id, dia.fecha, slot.horaFin)
            actualizarUltimoPartido(partido.inscripcion2Id, dia.fecha, slot.horaFin)
            
            huboAsignaciones = true
            break
          }
        }
      }
    } while (huboAsignaciones)
  }
}
```

### Reglas Clave

1. **Prioridad**: Categorías con más inscriptos primero
2. **Asignación estricta por fase**: TODAS las ZONAS primero, luego TODOS los REPECHAJES, etc.
3. **Garantía cronológica**: Fase N+1 nunca tiene horario anterior a fase N
4. **Descanso**: Solo 3h si es **mismo día**. Día diferente = siempre válido.
5. **BYE**: No reciben slots (se filtran con `esBye = false`)
6. **Slots huecos**: Si un slot no puede usarse (descanso), se deja libre para otra fase permitida ese día

### Salida
- Partidos actualizados con: `fechaProgramada`, `horaProgramada`, `torneoCanchaId`
- Slots marcados como `OCUPADO` con `matchId`
- Contador de partidos asignados por día

---

## Parte 1: Validación de Slots

### Objetivo
Verificar si todos los partidos tienen slot asignado.

### Entrada
- `categoriasData`: Categorías sorteadas

### Proceso
```javascript
for (catData of categoriasData) {
  totalPartidos = contarPartidos(catData.fixtureVersionId)
  partidosConSlot = contarPartidosConSlot(catData.fixtureVersionId)
  
  partidosSinSlot = totalPartidos - partidosConSlot
  
  if (partidosSinSlot > 0) {
    // Obtener detalle de qué fases quedaron sin slot
    detalle = obtenerPartidosSinSlotPorFase(catData.fixtureVersionId)
    
    error = {
      categoria: catData.nombre,
      sinSlot: partidosSinSlot,
      detalle: detalle  // Ej: "ZONA: 3, OCTAVOS: 2"
    }
  }
}

if (hayErrores) {
  throw BadRequestException("No se pudieron asignar X partidos:\n" + detalle)
}
```

### Mensaje de Error
Debe indicar exactamente:
- Cuántos partidos quedaron sin slot
- De qué categoría
- De qué fase
- Sugerencia: "Agrega más canchas o días de juego"

### Nota
Esta validación corre **después** de intentar asignar. Por eso sabe exactamente qué faltó.

---

## Parte 4: Rollback

### Objetivo
Si ocurre cualquier error durante el proceso, restaurar todo al estado anterior.

### Entrada
- `estadoInicialCategorias`: Snapshot de categorías antes del sorteo
- `tournamentId`: ID del torneo

### Proceso
```javascript
// 1. Restaurar estado de categorías
for (cat of estadoInicialCategorias) {
  await prisma.tournamentCategory.update({
    where: { id: cat.id },
    data: { 
      estado: cat.estado,                    // Volver a INSCRIPCIONES_ABIERTAS
      fixtureVersionId: cat.fixtureVersionId // Restaurar anterior (null o versión previa)
    }
  })
}

// 2. Liberar slots reservados
await prisma.torneoSlot.updateMany({
  where: { 
    disponibilidad: { tournamentId },
    estado: 'RESERVADO'  // Solo los que tomamos en este sorteo
  },
  data: { 
    estado: 'LIBRE', 
    matchId: null 
  }
})

// 3. Eliminar partidos creados (los nuevos fixtureVersionId)
fixtureVersionIdsNuevos = obtenerFixtureVersionIdsNuevos()

await prisma.match.deleteMany({
  where: { fixtureVersionId: { in: fixtureVersionIdsNuevos } }
})

// Nota: No eliminamos FixtureVersion, solo los partidos
// El FixtureVersion queda como huérfano (se puede limpiar después)
```

### Cuándo se ejecuta
- Error en Parte 2 (guardar bracket)
- Error en Parte 3 (asignar slots)
- Error en Parte 1 (validación)
- Cualquier excepción no controlada

---

## Comunicación entre Partes

```
Parte 2 ──crea──→ Partidos en BD
       ──guarda──→ fixtureVersionId en categoría

Parte 3 ──lee──→ Partidos de BD (por fixtureVersionId)
       ──asigna──→ fecha/hora/cancha a cada partido
       ──actualiza──→ Slots como OCUPADO

Parte 1 ──cuenta──→ Partidos con/sin slot
       ──valida──→ Todos tienen slot?

Parte 4 ──recibe──→ Error de cualquier parte
       ──restaura──→ Estado inicial
```

---

## Datos Necesarios

### Tablas involucradas
- `TournamentCategory`: estado, fixtureVersionId
- `FixtureVersion`: version, definición del bracket
- `Match`: partidos (ronda, esBye, inscripciones, fecha/hora/cancha)
- `TorneoDisponibilidadDia`: días configurados
- `TorneoSlot`: slots disponibles/ocupados

### Estructuras en memoria
```typescript
interface CategoriaData {
  categoria: TournamentCategory;
  nombre: string;
  inscripciones: Inscripcion[];
}

interface SlotDelDia {
  id: string;
  torneoCanchaId: string;
  horaInicio: string;
  horaFin: string;
  estado: 'LIBRE' | 'OCUPADO' | 'RESERVADO';
  matchId?: string;
}

interface UltimoPartidoPareja {
  fecha: string;    // "2026-06-04"
  horaFin: string;  // "19:30"
}
```

---

## Orden de Implementación

1. **Primero**: Parte 2 (guardar bracket sin slots)
2. **Segundo**: Parte 3 (asignar slots con round-robin)
3. **Tercero**: Parte 1 (validación post-asignación)
4. **Cuarto**: Parte 4 (rollback)

Cada parte se prueba individualmente antes de pasar a la siguiente.

---

## Notas de Implementación

### Sobre el cálculo de descanso
```typescript
// La función validarDescanso debe:
// 1. Si fechaSlot !== fechaUltimoPartido → return true (siempre válido)
// 2. Si misma fecha → calcular diferencia en minutos
// 3. Return true si diferencia >= 180 minutos (3h)
```

### Sobre BYE
```typescript
// Al buscar partidos en Parte 3:
// WHERE esBye = false
// Los BYE nunca entran en el algoritmo de asignación
```

### Sobre el orden de categorías
```typescript
// Más inscriptos primero:
// Ej: 8ª Categoría (17 inscriptos) → prioridad
//     7ª Categoría (17 inscriptos) → misma prioridad, ordenar por nombre
//     6ª Categoría (16 inscriptos) → después
```

---

## Checklist de Pruebas

### Parte 2
- [ ] Al cerrar inscripciones, el estado cambia a INSCRIPCIONES_CERRADAS
- [ ] Se crean partidos en BD
- [ ] Los BYE tienen esBye = true
- [ ] Ningún partido tiene fecha/hora/cancha
- [ ] fixtureVersionId se guarda en TournamentCategory
- [ ] El botón "Ver" aparece en el frontend

### Parte 3
- [ ] Las categorías con más inscriptos toman slots primero
- [ ] TODAS las ZONAS se asignan antes que cualquier REPECHAJE
- [ ] TODOS los REPECHAJES se asignan antes que cualquier OCTAVOS
- [ ] Garantía: Fase N+1 nunca tiene horario anterior a fase N
- [ ] Una pareja no juega dos partidos con menos de 3h de diferencia (mismo día)
- [ ] Una pareja PUEDE jugar días diferentes sin importar la hora
- [ ] Los BYE no tienen slots asignados
- [ ] Todos los partidos no-BYE tienen slot al finalizar

### Parte 1
- [ ] Si todos tienen slot → éxito
- [ ] Si faltan slots → error con detalle exacto

### Parte 4
- [ ] Si hay error en cualquier parte, el rollback ejecuta
- [ ] Los slots vuelven a LIBRE
- [ ] Los partidos se eliminan
- [ ] Las categorías vuelven a INSCRIPCIONES_ABIERTAS
- [ ] fixtureVersionId se restaura al valor anterior
