# 🔍 ANÁLISIS CRÍTICO - FAIRPADEL SCHEDULING

## 📊 RESUMEN EJECUTIVO

He analizado tu implementación completa y encontré **varios problemas críticos** que explican por qué los slots no se están ocupando cronológicamente según las fases del torneo.

---

## 🚨 PROBLEMAS CRÍTICOS DETECTADOS

### **PROBLEMA #1: NO HAY MAPEO DE FASES A DÍAS** 🔴 CRÍTICO

**Ubicación:** `canchas-sorteo.service.ts` - `cerrarInscripcionesYsortear()` y `reservarSlotsParaCategoria()`

**Descripción:**
Tu código obtiene slots ordenados cronológicamente, pero **NO filtra ni valida que ciertas fases solo puedan jugar en ciertos días**.

```typescript
// Tu código actual (líneas 460-505 en canchas-sorteo.service.ts)
const slotsDisponibles = await this.obtenerSlotsDisponiblesOrdenados(tournamentId);
// ...
for (const categoriaInfo of calculo.detallePorCategoria) {
  // ...
  const slotsReservados = await this.reservarSlotsParaCategoria(
    categoriaConInscripciones,
    categoriaInfo.nombre,
    slotsDisponibles,  // ← TODOS los slots, sin filtrar por fase
    slotIndex,
    distribucionPorDia,
  );
}
```

**El problema:**
- `obtenerSlotsDisponiblesOrdenados()` devuelve **TODOS** los slots del torneo ordenados por fecha/hora
- `reservarSlotsParaCategoria()` asigna slots secuencialmente sin verificar si la fase corresponde al día
- **Resultado:** Si configuras Jueves, Viernes, Sábado y Domingo, y una categoría necesita 20 partidos, tomará los primeros 20 slots disponibles (que podrían ser todos del Jueves), independientemente de las fases.

**Impacto:**
- ❌ Los partidos de ZONA (que deberían ser Jueves/Viernes) pueden terminar en Sábado
- ❌ Los partidos de OCTAVOS (que deberían ser Sábado) pueden terminar en Domingo
- ❌ Las SEMIFINALES (que deberían ser Domingo) pueden terminar en Jueves

---

### **PROBLEMA #2: LOS SLOTS NO TIENEN INFORMACIÓN DE FASE PERMITIDA** 🔴 CRÍTICO

**Ubicación:** Base de datos y `generarSlotsParaDia()`

**Descripción:**
Cuando generas slots, no estás marcando qué fases pueden jugarse en cada slot.

```typescript
// Tu código (líneas 221-272 en canchas-sorteo.service.ts)
private async generarSlotsParaDia(...) {
  // ...
  await this.prisma.torneoSlot.upsert({
    // ...
    data: {
      disponibilidadId,
      torneoCanchaId: canchaId,
      horaInicio: slotInicio,
      horaFin: slotFin,
      estado: 'LIBRE',
      // ← FALTA: fasesPermitidas: ['ZONA', 'REPECHAJE'] etc.
    },
  });
}
```

**El problema:**
- Los slots se generan sin información de qué fases pueden albergar
- No hay forma de validar que un partido de SEMIFINAL solo se asigne a slots del Domingo

---

### **PROBLEMA #3: LA ASIGNACIÓN DE SLOTS EN `guardarBracket` ES SECUENCIAL, NO POR FASE** 🟡 ALTO

**Ubicación:** `bracket.service.ts` - `guardarBracket()` (líneas 728-845)

**Descripción:**
Cuando no pasas slots pre-reservados, el código intenta asignar automáticamente, pero lo hace secuencialmente sin respetar la distribución por días.

```typescript
// Tu código (líneas 788-829 en bracket.service.ts)
const fasesEnOrden = [
  FaseBracket.ZONA,
  FaseBracket.REPECHAJE,
  FaseBracket.OCTAVOS,
  FaseBracket.CUARTOS,
  FaseBracket.SEMIS,
  FaseBracket.FINAL,
];

for (const fase of fasesEnOrden) {
  const partidosFase = partidos.filter(p => p.fase === fase);
  // Asigna slots secuencialmente desde slotIndexGlobal
  // PERO: No verifica si esos slots están en el día correcto para la fase
}
```

**El problema:**
- Asume que los slots están ordenados cronológicamente (lo cual está bien)
- PERO no hay una **política explícita** de qué días corresponden a qué fases
- Si hay pocos slots en los días tempranos, las fases tempranas pueden "invadir" días posteriores

---

### **PROBLEMA #4: NO HAY VALIDACIÓN DE CONFLICTOS ENTRE CATEGORÍAS** 🟡 MEDIO

**Ubicación:** `reservarSlotsParaCategoria()`

**Descripción:**
Cuando múltiples categorías compiten por slots, tu código no verifica:
- Que un jugador no tenga 2 partidos simultáneos
- Que haya balanceo equitativo entre categorías
- Que una categoría no monopolice todos los slots de un día

```typescript
// Tu código (líneas 607-659 en canchas-sorteo.service.ts)
private async reservarSlotsParaCategoria(...) {
  // Simplemente toma slots secuencialmente
  for (const faseInfo of calculo.detallePorFase) {
    for (let i = 0; i < faseInfo.partidos; i++) {
      const slot = slotsDisponibles[slotIndex];  // ← Toma el siguiente disponible
      // No hay validación de conflictos ni balanceo
    }
  }
}
```

---

## 📋 COMPARACIÓN: TU IMPLEMENTACIÓN vs SOLUCIÓN IDEAL

### Flujo Actual (Problemático)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TU FLUJO ACTUAL                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Configurar días (Jueves, Viernes, Sábado, Domingo)         │
│     └── Slots generados sin información de fase                │
│                                                                 │
│  2. Sortear categorías                                          │
│     └── Para cada categoría:                                   │
│         └── Tomar slots secuencialmente de TODOS los días      │
│             sin filtrar por fase                                │
│                                                                 │
│  3. Resultado:                                                  │
│     └── Categoría A toma 20 slots del Jueves (todas las fases) │
│     └── Categoría B toma 20 slots del Viernes (todas las fases)│
│     └── ❌ Las fases no respetan los días asignados            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo Ideal (Solución Propuesta)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO IDEAL                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Configurar días con fases permitidas                       │
│     └── Jueves:   [ZONA, REPECHAJE]                            │
│     └── Viernes:  [ZONA, REPECHAJE]                            │
│     └── Sábado:   [OCTAVOS, CUARTOS]                           │
│     └── Domingo:  [SEMIS, FINAL]                               │
│                                                                 │
│  2. Para cada día (cronológicamente):                          │
│     └── Filtrar slots del día                                  │
│     └── Obtener partidos de las fases permitidas               │
│     └── Asignar cronológicamente                               │
│                                                                 │
│  3. Resultado:                                                  │
│     └── Todos los partidos de ZONA en Jueves/Viernes           │
│     └── Todos los partidos de OCTAVOS en Sábado                │
│     └── Todos los partidos de SEMIS en Domingo                 │
│     └── ✅ Las fases respetan los días asignados               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ SOLUCIONES REQUERIDAS

### **SOLUCIÓN #1: Agregar Fases Permitidas a los Slots**

**Cambio en base de datos:**
```prisma
model TorneoSlot {
  id                String   @id @default(uuid())
  disponibilidadId  String
  torneoCanchaId    String
  horaInicio        String
  horaFin           String
  estado            String   // LIBRE, RESERVADO, OCUPADO
  fase              String?  // ← AGREGAR: ZONA, REPECHAJE, OCTAVOS, etc.
  matchId           String?
  
  @@unique([disponibilidadId, torneoCanchaId, horaInicio])
}
```

**Cambio en `generarSlotsParaDia`:**
```typescript
// Al generar slots para un día, especificar qué fases pueden usarse
private async generarSlotsParaDiaConFase(
  disponibilidadId: string,
  canchasIds: string[],
  horaInicio: string,
  horaFin: string,
  minutosSlot: number,
  fasesPermitidas: FaseBracket[],  // ← NUEVO PARÁMETRO
): Promise<number> {
  // ...
  await this.prisma.torneoSlot.create({
    data: {
      // ... campos existentes
      fasesPermitidas: fasesPermitidas.join(','), // o relación many-to-many
    },
  });
}
```

---

### **SOLUCIÓN #2: Modificar `cerrarInscripcionesYsortear` para Procesar por Día**

```typescript
async cerrarInscripcionesYsortear(dto: CerrarInscripcionesSortearDto): Promise<SorteoMasivoResponse> {
  // 1. Obtener configuración de días con sus fases permitidas
  const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
    where: { tournamentId },
    include: { 
      slots: { where: { estado: 'LIBRE' } }
    },
    orderBy: { fecha: 'asc' },
  });

  // 2. Definir qué fases van en qué días (esto debería venir de la configuración)
  const fasesPorDia = new Map<string, FaseBracket[]>();
  diasConfig.forEach(dia => {
    // Esto debería configurarse al crear el día
    fasesPorDia.set(dia.fecha, this.obtenerFasesParaDia(dia.fecha));
  });

  // 3. Para cada día (cronológicamente)
  for (const dia of diasConfig) {
    const fasesPermitidas = fasesPorDia.get(dia.fecha) || [];
    const slotsDelDia = dia.slots.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    
    // Obtener partidos de TODAS las categorías que correspondan a estas fases
    const partidosDelDia = [];
    for (const categoria of categorias) {
      const partidosCategoria = await this.obtenerPartidosPorFases(
        categoria.id, 
        fasesPermitidas
      );
      partidosDelDia.push(...partidosCategoria);
    }
    
    // Ordenar con Round-Robin y asignar a slots del día
    const partidosOrdenados = this.ordenarRoundRobin(partidosDelDia, categorias);
    await this.asignarPartidosASlots(partidosOrdenados, slotsDelDia);
  }
}
```

---

### **SOLUCIÓN #3: Implementar Round-Robin para Múltiples Categorías**

```typescript
private ordenarRoundRobin(
  partidos: Partido[], 
  categorias: Categoria[]
): Partido[] {
  // Agrupar por categoría
  const porCategoria = new Map<string, Partido[]>();
  for (const partido of partidos) {
    if (!porCategoria.has(partido.categoriaId)) {
      porCategoria.set(partido.categoriaId, []);
    }
    porCategoria.get(partido.categoriaId)!.push(partido);
  }

  // Ordenar dentro de cada categoría por ordenFase
  for (const [, lista] of porCategoria) {
    lista.sort((a, b) => a.ordenFase - b.ordenFase);
  }

  // Construir lista alternando categorías
  const resultado: Partido[] = [];
  const indices = new Map<string, number>();
  
  let hayMas = true;
  while (hayMas) {
    hayMas = false;
    for (const categoria of categorias) {
      const lista = porCategoria.get(categoria.id) || [];
      const idx = indices.get(categoria.id) || 0;
      
      if (idx < lista.length) {
        resultado.push(lista[idx]);
        indices.set(categoria.id, idx + 1);
        hayMas = true;
      }
    }
  }
  
  return resultado;
}
```

---

## 📊 NIVEL ACTUAL vs NIVEL REQUERIDO

| Aspecto | Nivel Actual | Nivel Requerido | Gap |
|---------|--------------|-----------------|-----|
| **Ordenamiento cronológico** | ✅ Sí, slots ordenados por fecha/hora | ✅ Sí | Ninguno |
| **Mapeo fases a días** | ❌ No existe | ✅ Configuración explícita | **CRÍTICO** |
| **Validación de fases** | ❌ No valida | ✅ Valida fase vs día | **CRÍTICO** |
| **Balanceo entre categorías** | ❌ Secuencial | ✅ Round-robin | **ALTO** |
| **Conflictos de jugadores** | ❌ No valida | ✅ Valida descanso mínimo | **MEDIO** |
| **Slots insuficientes** | ✅ Sí, pre-calcula | ✅ Sí | Ninguno |

---

## 🎯 RECOMENDACIONES INMEDIATAS

### **Prioridad 1 (CRÍTICA):** Agregar configuración de fases por día

1. Modificar `ConfigurarDiaJuegoDto` para incluir fases permitidas
2. Guardar fases permitidas en `TorneoDisponibilidadDia`
3. Modificar `generarSlotsParaDia` para marcar slots con fases

### **Prioridad 2 (ALTA):** Refactorizar `cerrarInscripcionesYsortear`

1. Procesar días cronológicamente (ya lo haces)
2. Para cada día, filtrar slots y partidos por fases permitidas
3. Implementar Round-Robin entre categorías

### **Prioridad 3 (MEDIA):** Agregar validaciones

1. Verificar conflictos de jugadores (60 min descanso)
2. Limitar slots por categoría (60% máximo)
3. Pre-calcular distribución óptima

---

## 💡 EJEMPLO DE CONFIGURACIÓN IDEAL

```typescript
// Al configurar un día, especificar qué fases pueden jugarse
const diaJueves = await canchasSorteoService.configurarDiaJuego({
  tournamentId: 'torneo-001',
  fecha: '2026-03-27',
  horaInicio: '18:00',
  horaFin: '23:00',
  canchasIds: ['cancha-1', 'cancha-2', 'cancha-3', 'cancha-4'],
  fasesPermitidas: ['ZONA', 'REPECHAJE'],  // ← NUEVO
});

const diaSabado = await canchasSorteoService.configurarDiaJuego({
  tournamentId: 'torneo-001',
  fecha: '2026-03-29',
  horaInicio: '09:00',
  horaFin: '22:00',
  canchasIds: ['cancha-1', 'cancha-2', 'cancha-3', 'cancha-4'],
  fasesPermitidas: ['OCTAVOS', 'CUARTOS'],  // ← NUEVO
});

const diaDomingo = await canchasSorteoService.configurarDiaJuego({
  tournamentId: 'torneo-001',
  fecha: '2026-03-30',
  horaInicio: '09:00',
  horaFin: '20:00',
  canchasIds: ['cancha-1', 'cancha-2'],
  fasesPermitidas: ['SEMIS', 'FINAL'],  // ← NUEVO
});
```

---

## 📁 ARCHIVOS MODIFICADOS NECESARIOS

| Archivo | Cambios Requeridos |
|---------|-------------------|
| `prisma/schema.prisma` | Agregar `fasesPermitidas` a `TorneoDisponibilidadDia` y/o `TorneoSlot` |
| `canchas-sorteo.dto.ts` | Agregar `fasesPermitidas` a `ConfigurarDiaJuegoDto` |
| `canchas-sorteo.service.ts` | Refactorizar `cerrarInscripcionesYsortear` y `reservarSlotsParaCategoria` |
| `bracket.service.ts` | Modificar `guardarBracket` para validar fases vs días |

---

*Análisis generado para Fairpadel - Sistema de Gestión de Torneos*
