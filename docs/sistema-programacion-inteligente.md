# Sistema de Programación Inteligente - FairPadel

## 🎯 Objetivo
Distribuir partidos de múltiples categorías optimizando:
- Recursos (canchas/horas disponibles)
- Tiempos de descanso entre partidos del mismo jugador
- Progresión lógica del torneo (Zona → Ronda → Bracket)
- Predicción de necesidades futuras

---

## 📊 Fases del Torneo por Día (Ejemplo Típico)

### Caso: Torneo de 4 días (Jueves a Domingo)

| Día | Mañana (08:00-12:00) | Tarde (14:00-18:00) | Noche (18:00-22:00) |
|-----|---------------------|---------------------|---------------------|
| **Jueves** | ZONA Cat A, B | ZONA Cat C, D | - |
| **Viernes** | ZONA Cat E, F | RONDA (ajustes) | - |
| **Sábado** | OCTAVOS | CUARTOS | CUARTOS |
| **Domingo** | SEMIS | FINAL | - |

### Caso: Torneo de 3 días (Sábado a Lunes)

| Día | Mañana | Tarde | Noche |
|-----|--------|-------|-------|
| **Sábado** | ZONA (todas las categorías) | ZONA + RONDA | - |
| **Domingo** | OCTAVOS | CUARTOS | SEMIS |
| **Lunes** | - | FINAL | - |

### Caso: Muchas categorías (>8)

| Día | Mañana | Tarde | Noche |
|-----|--------|-------|-------|
| **Jueves** | ZONA (cats 1-4) | ZONA (cats 5-8) | - |
| **Viernes** | ZONA (cats 9-12) | RONDA (ajustes) | - |
| **Sábado** | OCTAVOS | CUARTOS | - |
| **Domingo** | SEMIS | FINAL | - |

---

## 🤖 Algoritmo de Distribución

### Paso 1: Cálculo de Recursos Necesarios

```typescript
// Para cada categoría
const recursosPorCategoria = {
  zonaPartidos: floor(parejas / 2),
  rondaPartidos: max(0, parejas - (parejas <= 15 ? 8 : 16)),
  octavos: bracket === 16 ? 8 : 0,
  cuartos: 4,
  semis: 2,
  final: 1
};

// Total de partidos del torneo
const totalPartidos = sum(categorias.map(c => 
  c.zonaPartidos + c.rondaPartidos + c.octavos + c.cuartos + c.semis + c.final
));

// Horas necesarias (asumiendo 90 min por partido promedio)
const horasNecesarias = totalPartidos * 1.5;

// Slots disponibles (de la disponibilidad configurada)
const slotsDisponibles = calcularSlotsTotales(disponibilidadConfigurada);

// Verificación
if (horasNecesarias > slotsDisponibles * 0.8) {
  alerta: "Faltan canchas/horas. Considerar:\n" +
         "- Extender días del torneo\n" +
         "- Usar canchas adicionales\n" +
         "- Usar otra sede";
}
```

### Paso 2: Asignación por Fases

**Prioridad 1: ZONA (todas las categorías)**
```typescript
// Distribuir zonas en días disponibles
// Máximo 4 categorías por slot de tiempo (mañana/tarde)
// Máximo 2 partidos simultáneos por pareja

for (categoria of categoriasPorOrdenar) {
  const partidosZona = categoria.partidosZona;
  const slotsNecesarios = ceil(partidosZona / canchasDisponibles);
  
  // Buscar días con disponibilidad
  const dia = encontrarDiaConDisponibilidad(slotsNecesarios);
  
  // Asignar slots consecutivos
  asignarPartidos(categoria.faseZona, dia, horario);
}
```

**Prioridad 2: RONDA DE AJUSTE**
```typescript
// Siempre el día siguiente al último día de zonas
// O mismo día si hay pocos partidos
const diaRonda = ultimoDiaZona + 1;
asignarPartidos(rondaAjuste, diaRonda, preferenciaTarde);
```

**Prioridad 3: BRACKET (Octavos → Final)**
```typescript
// Calcular días restantes
const diasRestantes = fechaFinTorneo - diaRonda;

// Distribución
if (diasRestantes >= 3) {
  // Distribución ideal
  octavos: sabadoMañana;
  cuartos: sabadoTarde;
  semis: domingoMañana;
  final: domingoTarde;
} else if (diasRestantes === 2) {
  // Comprimido
  octavos: dia1Mañana;
  cuartos: dia1Tarde;
  semis: dia2Mañana;
  final: dia2Tarde;
}
```

### Paso 3: Validación de Conflictos

```typescript
// Verificar que ninguna pareja juegue >2 partidos por día
// Verificar 4h mínimo entre partidos de la misma pareja
// Verificar que la cancha no esté ocupada

function validarAsignacion(partido, slot): boolean {
  const pareja1 = partido.inscripcion1;
  const pareja2 = partido.inscripcion2;
  
  // Revisar otros partidos de estas parejas el mismo día
  const otrosPartidos = buscarPartidosMismoDia(pareja1, pareja2, slot.fecha);
  
  if (otrosPartidos.length >= 2) return false; // Máximo 2 por día
  
  // Verificar 4h de descanso
  for (p of otrosPartidos) {
    const diff = Math.abs(slot.hora - p.hora);
    if (diff < 4) return false; // Menos de 4h
  }
  
  return true;
}
```

---

## 📱 UI de Programación

### Vista General
```
┌─────────────────────────────────────────────────────────────┐
│  PROGRAMACIÓN INTELIGENTE                    [Auto] [Guardar]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 PREDICCIÓN DE RECURSOS                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Partidos totales: 142                                │  │
│  │  Horas necesarias: 213h                               │  │
│  │  Slots disponibles: 180h ⚠️                           │  │
│  │                                                       │  │
│  │  ⚠️ Faltan 33 horas. Sugerencias:                     │  │
│  │     • Extender 1 día más                              │  │
│  │     • Agregar 2 canchas más                           │  │
│  │     • Usar sede "Club 2" los sábados                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  📅 DISTRIBUCIÓN POR DÍA                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  JUEVES 14/03 - ZONA                                  │  │
│  │  ├─ 08:00-12:00  Canchas 1-4  → 4ª Cat Damas (4p)     │  │
│  │  ├─ 08:00-12:00  Canchas 5-8  → 5ª Cat Caballeros (5p)│  │
│  │  ├─ 14:00-18:00  Canchas 1-4  → 6ª Cat Damas (4p)     │  │
│  │  └─ 14:00-18:00  Canchas 5-8  → 3ª Cat Caballeros (4p)│  │
│  │                                                       │  │
│  │  VIERNES 15/03 - ZONA + RONDA                         │  │
│  │  ├─ 08:00-12:00  Canchas 1-4  → 2ª Cat Damas (4p)     │  │
│  │  ├─ 14:00-18:00  Canchas 1-4  → 7ª Cat Damas (3p)     │  │
│  │  └─ 14:00-18:00  Canchas 5-6  → RONDA (2p)            │  │
│  │                                                       │  │
│  │  SÁBADO 16/03 - OCTAVOS + CUARTOS                     │  │
│  │  └─ ...                                               │  │
│  │                                                       │  │
│  │  DOMINGO 17/03 - SEMIS + FINAL                        │  │
│  │  └─ ...                                               │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  🔧 ACCIONES                                                │
│  [Re-calcular automático]  [Exportar PDF]  [Editar manual]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Modal de Edición Manual
```
┌─────────────────────────────────────────┐
│  Editar Partido #12                     │
├─────────────────────────────────────────┤
│                                         │
│  Parejas:                               │
│  • Pérez/González vs López/Silva        │
│                                         │
│  Fecha:     [📅 16/03/2025    ]         │
│                                         │
│  Hora:      [🕐 14:00 ▼      ]         │
│                                         │
│  Cancha:    [Cancha 3 - Club Principal ▼]│
│                                         │
│  ⚠️ Advertencias:                       │
│     • Pérez/González ya juegan 14:00    │
│     • Sugerir: 18:00 o día siguiente    │
│                                         │
│           [Cancelar]  [Guardar]         │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔌 Endpoints Backend Necesarios

```typescript
// Calcular programación sugerida
POST /admin/torneos/:id/programacion/calcular
Request: {
  fechaInicioTorneo: "2025-03-14",
  fechaFinTorneo: "2025-03-17",
  categoriasSorteadas: ["cat1", "cat2", "cat3"]
}
Response: {
  prediccion: {
    totalPartidos: 142,
    horasNecesarias: 213,
    slotsDisponibles: 180,
    deficit: 33,
    sugerencias: ["extender_dia", "agregar_canchas"]
  },
  distribucion: [
    {
      fecha: "2025-03-14",
      fase: "ZONA",
      categorias: ["cat1", "cat2"],
      partidos: [...],
      slotsAsignados: [...]
    }
  ]
}

// Aplicar programación
POST /admin/torneos/:id/programacion/aplicar
Request: {
  distribucion: [...],
  modo: "AUTOMATICA" | "MANUAL"
}

// Actualizar partido individual
PATCH /admin/matches/:id/programar
Request: {
  fechaProgramada: "2025-03-14",
  horaProgramada: "14:00",
  torneoCanchaId: "cancha123"
}

// Validar cambio
POST /admin/matches/:id/validar-programacion
Request: { fecha, hora, canchaId }
Response: {
  valido: boolean,
  conflictos: [
    { tipo: "MISMA_PAREJA", pareja: "Pérez/González", partidoId: "..." },
    { tipo: "CANCHA_OCUPADA", partido: "..." }
  ]
}
```

---

## 📋 Flujo de Trabajo del Organizador

### Escenario 1: Sorteo Completo de Una Vez
```
1. Cierra inscripciones de TODAS las categorías
2. Sortea todas las categorías
3. Sistema calcula programación automática
4. Revisa predicción de recursos
5. Ajusta manualmente si es necesario
6. Publica fixture con fechas/horas/canchas
```

### Escenario 2: Sorteo por Lotes (Tu caso)
```
1. Miércoles 23:59 - Cierra lote 1 (cats A, B, C)
2. Sistema calcula ZONA/RONDA solo para estas
3. Jueves - Juegan ZONA cats A, B, C
4. Jueves 23:59 - Cierra lote 2 (cats D, E, F)
5. Sistema recalcula considerando:
   - Partidos de ZONA de A, B, C que ya jugaron
   - ZONA/RONDA para D, E, F
   - Brackets de A, B, C (si ya tienen resultados)
6. Viernes - Juegan ZONA cats D, E, F + RONDA si aplica
7. ... y así sucesivamente
```

---

## 🎓 Ejemplo de Simulación

### Torneo con 6 Categorías

**Inscritos:**
- 4ª Damas: 12 parejas → Zona: 6p, Ronda: 4p, Bracket: 8
- 5ª Damas: 16 parejas → Zona: 8p, Ronda: 0p, Bracket: 16
- 6ª Damas: 10 parejas → Zona: 5p, Ronda: 2p, Bracket: 8
- 4ª Caballeros: 18 parejas → Zona: 9p, Ronda: 2p, Bracket: 16
- 5ª Caballeros: 14 parejas → Zona: 7p, Ronda: 6p, Bracket: 8
- 7ª Caballeros: 8 parejas → Zona: 4p, Ronda: 0p, Bracket: 8

**Total partidos:**
- Zona: 39 partidos
- Ronda: 14 partidos
- Octavos: 12 partidos (solo cats con bracket 16)
- Cuartos: 24 partidos (todas)
- Semis: 12 partidos
- Final: 6 partidos

**Total: 107 partidos × 1.5h = 160.5 horas**

**Con 6 canchas disponibles 8h/día = 48h/día:**
- Necesita: 160.5 / 48 = **3.3 días → 4 días mínimo**

**Distribución sugerida:**
```
JUEVES:  Zona 4ªD(6) + Zona 5ªD(8) + Zona 6ªD(5) = 19p
VIERNES: Zona 4ªC(9) + Zona 5ªC(7) + Zona 7ªC(4) = 20p
         + Ronda todas las cats = 14p
         Total: 34p (ocupado todo el día)
SÁBADO:  Octavos(12) + Cuartos(24) = 36p
DOMINGO: Semis(12) + Final(6) = 18p
```

**Conclusión:** Si cerrás todo el miércoles, el torneo cabe perfecto en Jueves-Domingo con 6 canchas.

---

¿Te parece bien este diseño? ¿Querés que implemente el backend del algoritmo primero o el frontend de visualización?
