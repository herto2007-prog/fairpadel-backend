# 📋 RESUMEN EJECUTIVO PARA PROGRAMADOR

## 🎯 EL PROBLEMA EN 1 FRASE

> **Los slots se asignan secuencialmente sin considerar qué fases deben jugarse en qué días, causando que partidos de OCTAVOS terminen en Jueves y partidos de ZONA terminen en Domingo.**

---

## 🔴 PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. **No hay mapeo de FASES a DÍAS** 🔴
**Archivo:** `canchas-sorteo.service.ts` (líneas 460-505)

```typescript
// ❌ CÓDIGO ACTUAL (Problemático)
const slotsDisponibles = await this.obtenerSlotsDisponiblesOrdenados(tournamentId);
// Toma TODOS los slots del torneo sin filtrar por fase

for (const categoria of categorias) {
  const slotsReservados = await this.reservarSlotsParaCategoria(
    categoria,
    slotsDisponibles,  // ← TODOS los slots, mezclados
    slotIndex,
  );
}
```

**Resultado:** Una categoría con 20 partidos toma los primeros 20 slots disponibles (que pueden ser todos del Jueves), sin importar que 8 sean OCTAVOS (que deberían ser Sábado).

---

### 2. **Los slots no saben qué fases pueden albergar** 🔴
**Archivo:** `canchas-sorteo.service.ts` (líneas 221-272)

```typescript
// ❌ CÓDIGO ACTUAL
await this.prisma.torneoSlot.create({
  data: {
    disponibilidadId,
    torneoCanchaId: canchaId,
    horaInicio: slotInicio,
    horaFin: slotFin,
    estado: 'LIBRE',
    // ← FALTA: información de qué fases puede albergar este slot
  },
});
```

**Resultado:** No hay forma de validar que un partido de SEMIFINAL solo se asigne a slots del Domingo.

---

### 3. **No hay Round-Robin entre categorías** 🟡
**Archivo:** `canchas-sorteo.service.ts` (líneas 607-659)

```typescript
// ❌ CÓDIGO ACTUAL
for (const faseInfo of calculo.detallePorFase) {
  for (let i = 0; i < faseInfo.partidos; i++) {
    const slot = slotsDisponibles[slotIndex++]; // ← Secuencial
    // Una categoría toma todos los slots consecutivos
  }
}
```

**Resultado:** Si hay 2 categorías, la primera toma todos los mejores horarios y la segunda queda con los horarios restantes.

---

## ✅ LA SOLUCIÓN EN 3 PASOS

### PASO 1: Agregar fases permitidas a los días

```typescript
// Al configurar un día, especificar qué fases pueden jugarse
await prisma.torneoDisponibilidadDia.create({
  data: {
    fecha: '2026-03-27',
    horaInicio: '18:00',
    horaFin: '23:00',
    fasesPermitidas: 'ZONA,REPECHAJE',  // ← NUEVO
  }
});
```

### PASO 2: Procesar por día (no por categoría)

```typescript
// ✅ NUEVO FLUJO
for (const dia of diasOrdenadosCronologicamente) {
  const fasesPermitidas = dia.fasesPermitidas;
  const slotsDelDia = dia.slots;
  
  // Obtener partidos de TODAS las categorías que correspondan a estas fases
  const partidos = [];
  for (const categoria of categorias) {
    const partidosCategoria = getPartidosPorFases(categoria, fasesPermitidas);
    partidos.push(...partidosCategoria);
  }
  
  // Ordenar con Round-Robin
  const partidosOrdenados = ordenarRoundRobin(partidos, categorias);
  
  // Asignar a slots del día
  asignarPartidosASlots(partidosOrdenados, slotsDelDia);
}
```

### PASO 3: Implementar Round-Robin

```typescript
// ✅ NUEVO: Alternar entre categorías
// Ejemplo con 2 categorías (CatA, CatB):
// Slot 1: CatA-Zona-1
// Slot 2: CatB-Zona-1
// Slot 3: CatA-Zona-2
// Slot 4: CatB-Zona-2
// ...
```

---

## 📁 ARCHIVOS A MODIFICAR

| Archivo | Cambios | Prioridad |
|---------|---------|-----------|
| `prisma/schema.prisma` | Agregar `fasesPermitidas` a `TorneoDisponibilidadDia` | 🔴 Crítica |
| `canchas-sorteo.dto.ts` | Agregar campo `fasesPermitidas` | 🔴 Crítica |
| `canchas-sorteo.service.ts` | Refactorizar `cerrarInscripcionesYsortear()` | 🔴 Crítica |
| `bracket.service.ts` | Actualizar `guardarBracket()` | 🟡 Media |

---

## 🧪 TESTING MÍNIMO REQUERIDO

### Test 1: Verificar distribución por fases
```
Configuración:
- Jueves: Zona (10 slots)
- Viernes: Repechaje (5 slots)
- Sábado: Octavos (8 slots)
- Domingo: Semis/Final (3 slots)

Categoría: 26 parejas (10 Zona + 5 Repechaje + 8 Octavos + 3 Semis/Final)

Resultado Esperado:
✅ Los 10 de ZONA van al Jueves
✅ Los 5 de REPECHAJE van al Viernes
✅ Los 8 de OCTAVOS van al Sábado
✅ Los 3 de SEMIS/FINAL van al Domingo
```

### Test 2: Verificar Round-Robin
```
Configuración:
- Sábado: Octavos (16 slots)
- CatA: 8 partidos de Octavos
- CatB: 8 partidos de Octavos

Resultado Esperado:
✅ Slot 1: CatA-Octavo-1
✅ Slot 2: CatB-Octavo-1
✅ Slot 3: CatA-Octavo-2
✅ Slot 4: CatB-Octavo-2
```

---

## ⏱️ ESTIMACIÓN DE TIEMPO

| Tarea | Tiempo Estimado |
|-------|-----------------|
| Modificar schema de Prisma | 30 min |
| Actualizar DTOs | 15 min |
| Implementar lógica de fases por día | 2-3 horas |
| Implementar Round-Robin | 1-2 horas |
| Testing y debugging | 2-3 horas |
| **TOTAL** | **6-8 horas** |

---

## 🎯 CRITERIOS DE ACEPTACIÓN

- [ ] Los partidos de ZONA solo se asignan a días configurados para ZONA
- [ ] Los partidos de OCTAVOS solo se asignan a días configurados para OCTAVOS
- [ ] Los partidos de SEMIS/FINAL solo se asignan a días configurados para SEMIS/FINAL
- [ ] Cuando hay múltiples categorías, los slots se distribuyen equitativamente (Round-Robin)
- [ ] Los slots se ocupan cronológicamente dentro de cada día

---

## 📞 ¿PREGUNTAS?

Si tienes dudas durante la implementación, revisa:
1. `SOLUCION_FAIRPADEL_IMPLEMENTACION.md` - Código detallado paso a paso
2. `ANALISIS_FAIRPADEL_PROBLEMA.md` - Análisis completo del problema

---

*Resumen ejecutivo para equipo de desarrollo - Fairpadel*
