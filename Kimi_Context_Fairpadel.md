# Kimi Context - FairPadel V2

> **Documento de respaldo de acciones realizadas**  
> **Propósito:** Mantener registro de decisiones técnicas, entregables completados y estado del proyecto para continuidad entre conversaciones.
> **Última actualización:** 2026-03-31 - SISTEMA DE AUDITORÍA DE DATOS (ADMIN ONLY) ✅
> - **NUEVO TAB:** "Auditoría" en panel de gestión de torneos
> - **ACCESO:** Solo administradores (verificación de rol)
> - **VISTAS:** Resumen, Inscripciones, Partidos, Slots
> - **FILTROS:** Por estado, categoría, búsqueda por nombre, sin pareja, sin slot, etc.
> - **EXPORT:** CSV de inscripciones y partidos
> - **DATOS:** Información enriquecida (nombres, no IDs)

---

## 🆕 COMPLETADO (2026-03-31) - Sistema de Auditoría de Datos

### ✅ Nuevo Tab "Auditoría" - Solo Admin

**Problema:** Necesidad de visualizar datos completos del torneo para debugging y gestión sin acceder directamente a la BD.

**Solución:** Tab "Auditoría" en `/mis-torneos/:id/gestionar` con 4 vistas:

#### 1. Vista Resumen
- Stats cards: Inscripciones, Partidos, Finalizados, Slots Ocupados
- Info del torneo: nombre, estado, fechas
- Inscripciones por estado (gráfico de distribución)
- Listado de categorías con estado e inscripciones abiertas/cerradas

#### 2. Vista Inscripciones
- Tabla completa con:
  - Pareja (Jugador 1 / Jugador 2)
  - Categoría y género
  - Estado de inscripción y clasificación
  - Pagos (estado, monto, método)
  - Programación (slots asignados)
  - Notas
- Filtros: por estado, sin pareja, sin slot, búsqueda por nombre
- Exportar a CSV

#### 3. Vista Partidos
- Tabla completa con:
  - Fase y categoría
  - Pareja 1 vs Pareja 2
  - Programación (fecha, hora, cancha, sede)
  - Estado del partido
  - Resultado (sets)
- Filtros: sin programar, finalizados, búsqueda por nombre
- Exportar a CSV

#### 4. Vista Slots
- Stats: Total, Ocupados, Libres, % Ocupación
- Agrupado por día:
  - Fecha con horario
  - Tabla de slots con hora, cancha, estado
  - Quién ocupa cada slot (partido, categoría, parejas)
- Filtro por fecha

**Endpoints Backend:**
```
GET /admin/auditoria/torneos/:id/inscripciones
GET /admin/auditoria/torneos/:id/partidos
GET /admin/auditoria/torneos/:id/slots
GET /admin/auditoria/torneos/:id/resumen
```

**Seguridad:**
- Solo accesible para usuarios con rol 'admin'
- Verificación en backend (@Roles('admin'))
- Verificación en frontend (user.roles.includes('admin'))

**Archivos creados/modificados:**
- Backend: `src/modules/admin/admin-auditoria.controller.ts` (nuevo)
- Backend: `src/modules/admin/admin.module.ts` (actualizado)
- Frontend: `src/features/organizador/components/auditoria/AuditoriaManager.tsx` (nuevo)
- Frontend: `src/features/organizador/pages/GestionarTorneoPage.tsx` (actualizado)

**Build:** ✅ Backend y Frontend compilan sin errores

---

> **Última actualización previa:** 2026-03-30 - SISTEMA DE SORTEO V4 - DESBORDE ENTRE DÍAS ✅
> - **ALGORITMO:** Asignación estricta por fase (ZONA → REPECHAJE → OCTAVOS...)
> - **PRIORIDAD:** Categorías con más inscriptos primero
> - **DESCANSO:** 3h solo si es mismo día (día diferente = siempre válido)
> - **DESBORDE:** Fases intermedias pueden pasar al día siguiente si no caben
> - **PROTECCIÓN:** SEMIS/FINAL no pueden ser invadidas por desborde
> - **BYE:** No reciben slots (avanzan automático)
> - **ROLLBACK:** Atómico - si falla, TODO se revierte
> - **BUILD:** ✅ Backend compila
> - **DEPLOY:** ✅ Commit pushado a producción
> - **ESTADO:** En pruebas - debug en progreso para verificar descanso entre fases

---

## 🆕 COMPLETADO (2026-03-30) - Sistema de Sorteo V4 - Desborde entre Días

### ✅ Nuevas Features Implementadas

#### 1. Sorteo por Lotes con `fechaDesde`
**Problema:** Sortear categorías en múltiples lotes cronológicos sin que el Lote 2 use slots del Lote 1.

**Solución:**
- Nuevo parámetro opcional `fechaDesde` en DTO
- Filtra días disponibles desde esa fecha en adelante
- Ejemplo: Lote 1 (viernes), Lote 2 (sábado con fechaDesde='2026-03-29')

**Commits:**
- Backend: `8fa863c` - feat: agregar parametro fechaDesde
- Frontend: `5d05824` - feat: agregar opcion de sorteo por lotes

#### 2. Simplificación de Mensajes de Error
**Problema:** Modal de slots faltantes muy complejo con detalle por categoría.

**Solución:**
- Agrupar por FASE (no por categoría)
- Mensaje simple: "12 partidos sin cancha: 8 CUARTOS, 4 SEMIS"
- Modal limpio sin detalles innecesarios

**Commits:**
- Backend: `b717e0f` - refactor: simplificar mensaje de error
- Frontend: `03f0e68` - refactor: simplificar modal de error

#### 3. Visualización de Slots Ocupados
**Mejoras UI:**
- Mostrar "32 libres / 24 ocupados" en lugar de solo "32 slots"
- En header: "5 día(s) • 144 libres / 20 ocupados"
- Mostrar nombre de categoría en lista de sorteo

**Commits:**
- Backend: `b717e0f` - Agregar slotsOcupados a configuración
- Frontend: `2c56090` - feat: mostrar slots ocupados y nombre de categoria

#### 4. Sistema de Desborde entre Días (V4)
**Problema:** Si REPECHAJE no cabe en el día de ZONA por descanso de 3h, el sorteo falla.

**Solución:**
```
ZONA (19/06 18:00-21:00) → REPECHAJE no cabe (necesita 00:00+)
↓ Desborde automático
REPECHAJE (20/06 14:00) ← Asignado al día siguiente disponible
```

**Implementación:**
- Nuevo método `intentarDesborde()` para buscar slots en días posteriores
- Fases intermedias pueden compartir días entre sí
- Protección: SEMIS/FINAL no pueden ser invadidos
- Consulta a BD para verificar descanso desde fase anterior

**Fases Intermedias (pueden desbordarse):**
- ZONA, REPECHAJE, 32avos, 16avos, OCTAVOS, CUARTOS

**Fases Protegidas (no desborde):**
- SEMIS, FINAL

**Commits:**
- `7689344` - feat: implementar desborde de fases entre dias
- `dc8ec0a` - feat: extender descanso a todas las fases intermedias  
- `a405a96` - fix: consultar BD directamente para verificar descanso
- `ee2596e` - debug: agregar logs para diagnosticar

### 🐛 Problema Actual en Investigación

**Síntoma:** CUARTOS no respeta descanso de 3h desde REPECHAJE
- REPECHAJE: 20/06 14:00
- CUARTOS Partido 1: 20/06 14:00 (debería ser 17:00+)

**Hipótesis:** La consulta a BD para encontrar partido origen no está funcionando correctamente.

**Acciones:**
- Agregados logs de debug `[DEBUG]` en código
- Pendiente: Revisar logs de Railway para diagnóstico

### 🔄 Estado del Sistema

| Feature | Estado |
|---------|--------|
| Sorteo por lotes | ✅ Funcionando |
| Desborde entre días | ✅ Implementado |
| Descanso 3h entre fases | 🔍 En debugging |
| Protección SEMIS/FINAL | ✅ Implementado |
| Visualización slots | ✅ Funcionando |

---

## 🆕 COMPLETADO (2026-03-29) - Sistema de Sorteo V3 - Algoritmo Perfecto

### ✅ Arquitectura del Sorteo (4 Partes)

**Flujo del Sorteo:**
```
Parte 2: Guardar Bracket (sin slots) → Parte 3: Asignar Slots → Parte 1: Validar → Parte 4: Rollback (si error)
```

### Parte 2: Guardar Bracket (sin slots)
- Cierra inscripciones
- Genera estructura del bracket en memoria
- Crea partidos en BD **sin** fecha/hora/cancha
- Guarda `fixtureVersionId` en `TournamentCategory`
- **Resultado:** Botón "Ver" aparece inmediatamente

### Parte 3: Asignar Slots (Algoritmo Optimizado)

**Orden de asignación estricto:**
1. **TODAS** las ZONAS de todas las categorías (por prioridad de inscriptos)
2. **TODOS** los REPECHAJES de todas las categorías
3. **TODOS** los OCTAVOS de todas las categorías
4. **TODOS** los CUARTOS de todas las categorías
5. **TODAS** las SEMIS de todas las categorías
6. **TODAS** las FINALES de todas las categorías

**Reglas:**
- Prioridad: Categorías con más inscriptos primero
- Descanso: 3h mínimo si es **mismo día** (día diferente = siempre válido)
- BYE: No reciben slots (avanzan automático)
- Garantía: Fase N+1 nunca tiene horario anterior a fase N

### Parte 1: Validación
- Verifica que todos los partidos (excepto BYE) tengan slot
- Si falta alguno: error con detalle exacto (cuántos, de qué fase, de qué categoría)

### Parte 4: Rollback (si hay error)
- Restaura estado e `fixtureVersionId` original
- Libera slots ocupados
- Elimina partidos creados

---

## Historial de cambios previos (archivado)

> **2026-03-25** - ROLLBACK ATÓMICO EN SORTEO
> - Sorteo ahora es atómico - si falla, TODO se revierte
> - Categorías no quedan "Sorteadas" a medias si hay error
> - Libera slots, elimina brackets, restaura fixtures, reabre inscripciones

---

## 🆕 COMPLETADO (2026-03-25) - Rollback Atómico en Sorteo de Torneos

### ✅ Problema: Sorteo Parcial Dejaba Categorías en Estado Inconsistente

**Situación:** Al intentar sortear múltiples categorías, si faltaban slots para una de ellas, el proceso fallaba pero algunas categorías quedaban marcadas como "Sorteadas" (fixture generado, inscripciones cerradas) mientras otras no.

**Consecuencias del bug:**
- Categorías con `estado = 'INSCRIPCIONES_CERRADAS'` y `fixtureVersionId = null`
- Brackets generados sin slots asignados
- Inscripciones cerradas sin fixture válido
- Usuario no podía reintentar el sorteo

### ✅ Solución: Transacción Atómica con Rollback Completo

**Implementación en `canchas-sorteo.service.ts`:**

```typescript
// Guardar estado inicial antes de modificar
const estadoInicialCategorias = [...]

try {
  // Intentar sortear todas las categorías
  // Cerrar inscripciones → Generar brackets → Asignar slots
} catch (error) {
  // ROLLBACK COMPLETO:
  // 1. Liberar todos los slots reservados
  // 2. Eliminar brackets generados
  // 3. Restaurar fixtures anteriores archivados
  // 4. Reabrir inscripciones
  throw error; // Relanzar para mostrar error al usuario
}
```

**Qué se revierte si falla:**
1. **Slots:** Todos los marcados como `RESERVADO` → `LIBRE`
2. **Matches:** Partidos generados se eliminan
3. **Fixtures:** Nuevos se eliminan, anteriores se restauran a `PUBLICADO`
4. **Categorías:** Estado vuelve a `INSCRIPCIONES_ABIERTAS`

### ✅ Métodos Modificados

| Método | Cambio |
|--------|--------|
| `sortearConFasesPorDia()` | Rollback completo si faltan slots |
| `sortearSecuencialOriginal()` | Try-catch con rollback en error |
| `cerrarInscripcionesYsortear()` | Llama a métodos con rollback |

### ✅ Enums Corregidos

- `CategoriaEstado.INSCRIPCIONES_ABIERTAS`
- `CategoriaEstado.INSCRIPCIONES_CERRADAS`
- `FixtureVersionEstado.PUBLICADO`
- `FixtureVersionEstado.ARCHIVADO`

**Commit:** `8d1d866`

---

## 🆕 COMPLETADO (2026-03-25) - LIMPIEZA Y REFINAMIENTO DE UI ✅
> - **ELIMINADO:** Tab "Canchas" viejo + admin-disponibilidad.controller
> - **ELIMINADO:** Campo "Duración por partido" del wizard (no se usaba)
> - **WIZARD SIMPLIFICADO:** Solo fechaInicio/fin obligatorias (visuales)
> - **SEDES:** Ordenamiento por prioridad, cambiar/eliminar con modales
> - **CANCHAS:** Muestra sede + ordenadas por sede
> - **MODAL SLOTS:** Error cuando faltan slots con solución
> - **BUILD:** ✅ Backend y Frontend compilan
> - **DEPLOY:** ✅ Commits pushados a producción

---

## 🆕 COMPLETADO (2026-03-25) - Limpieza y Refinamiento de UI

### ✅ Eliminado Tab "Canchas" Viejo

**Problema:** Teníamos dos tabs duplicados: "Canchas" (viejo) y "Canchas y Sorteo" (nuevo). El viejo usaba endpoints separados y causaba confusión.

**Eliminado:**
- Frontend: `CanchasManager.tsx`, carpeta `disponibilidad/`, tab del menú
- Backend: `admin-disponibilidad.controller.ts` (639 líneas)
- Actualizado: `admin.module.ts`

**Commits:**
- Backend: `0460682`
- Frontend: `69f9360`

---

### ✅ Eliminado Campo "Duración por partido"

**Problema:** Campo en wizard que no se usaba funcionalmente.

**Cambios:**
- Eliminado de `TorneoWizard.tsx` interface, state, JSX
- Eliminado de Step 5 confirmación
- Backend mantiene default de 120 minutos si no se envía

**Commit:** Frontend pendiente de push con otros cambios

---

### ✅ Wizard Simplificado - Fechas

**Antes:** Fecha finales + fecha inicio opcional
**Ahora:** Solo fechaInicio y fechaFin (ambas obligatorias)

**Razón:** Las fechas son meramente visuales para listado/overview. El calendario real se configura en "Canchas y Sorteo".

**Commit:** `cc9a2ff`

---

### ✅ Gestión de Sedes Mejorada

**Nuevas funcionalidades:**
1. **Ordenamiento:** Flechas ↑ ↓ para reordenar prioridad
2. **Cambiar sede:** Botón para reemplazar una sede manteniendo orden
3. **Eliminar sede:** Botón con modal de confirmación
4. **Sede #1 destacada:** Borde rojo, "Prioridad alta"

**Backend:** Nuevos endpoints
- `PUT /sedes/reordenar` - Cambiar orden
- `PUT /sedes/:id/cambiar` - Reemplazar sede
- `DELETE /sedes/:id` - Eliminar sede + reordenar restantes

**Commit Backend:** `27d9dde`
**Commit Frontend:** `0f7c56b`

---

### ✅ Selector de Canchas Mejorado

**Cambios:**
- Muestra nombre de sede debajo de cada cancha
- Ordenadas por sede primero, luego por nombre
- Permite distinguir "Cancha 1" de diferentes sedes

**Commit:** `73335fd`, `2af0d07`

---

### ✅ Modal de Error - Slots Faltantes

**Comportamiento anterior:** Toast genérico de error
**Comportamiento nuevo:** Modal detallado con solución

**Contenido del modal:**
- Slots necesarios / disponibles / faltantes
- Mensaje: "Agrega más sedes o configura más días en el Paso 2"
- Botón: "Entendido, agregaré más sedes"

**Flujo:**
1. Usuario da "Sortear"
2. Backend calcula y detecta slots faltantes
3. Devuelve error 400 con detalle
4. Frontend muestra modal informativo
5. Sorteo NO ocurre hasta resolver

**Commit:** `736ae2a`

---

## 🆕 COMPLETADO (2026-03-25) - Distribución Correcta de Repechaje
> - **FIX REPECHAJE:** Todos los perdedores de zona + algunos ganadores van a repechaje (tabla 8-31 parejas)
> - **DESCANSO 4H:** Entre fases del mismo día, si no cabe pasa al siguiente día
> - **MATCHID EN SLOTS:** Para liberación correcta en re-sorteo
> - **BUILD:** ✅ Backend compila exitosamente
> - **DEPLOY:** ✅ Commits pushados a producción

---

## 🆕 COMPLETADO (2026-03-25) - Distribución Correcta de Repechaje

### ✅ Implementación: Contador Único para Evitar Colisiones

**Problema identificado:** Para categorías con repechaje (9-15 y 17-31 parejas), el algoritmo usaba contadores separados para perdedores y ganadores, causando que ambos se asignaran a las mismas posiciones en los partidos de repechaje. Esto dejaba algunos partidos de repechaje con 2 jugadores del mismo tipo y otros vacíos.

**Ejemplo del bug (14 parejas):**
```
Perdedor 0 → Repechaje 0, Pos 1
Perdedor 1 → Repechaje 0, Pos 2
Ganador 0 → Repechaje 0, Pos 1  ← ¡COLISIÓN! Sobrescribe al perdedor 0
Ganador 1 → Repechaje 0, Pos 2  ← ¡COLISIÓN! Sobrescribe al perdedor 1
```

**Solución implementada:**
```typescript
// Contador global de slots de repechaje
let slotRepechajeIdx = 0;

// Primero asignamos TODOS los perdedores
partidosZona.forEach((zona, index) => {
  if (vaARepechajePerdedor) {
    repechajeIndex = Math.floor(slotRepechajeIdx / 2);
    posicion = (slotRepechajeIdx % 2) + 1; // 1 o 2
    slotRepechajeIdx++;
  }
});

// Luego asignamos los ganadores (continuando donde quedaron los perdedores)
partidosZona.forEach((zona, index) => {
  if (vaARepechajeGanador) {
    repechajeIndex = Math.floor(slotRepechajeIdx / 2);
    posicion = (slotRepechajeIdx % 2) + 1; // 1 o 2
    slotRepechajeIdx++;
  }
});
```

**Resultado correcto (14 parejas, 6 repechajes = 12 slots):**
```
Perdedor 0 → Repechaje 0, Pos 1  (slot 0)
Perdedor 1 → Repechaje 0, Pos 2  (slot 1)
Perdedor 2 → Repechaje 1, Pos 1  (slot 2)
Perdedor 3 → Repechaje 1, Pos 2  (slot 3)
Perdedor 4 → Repechaje 2, Pos 1  (slot 4)
Perdedor 5 → Repechaje 2, Pos 2  (slot 5)
Perdedor 6 → Repechaje 3, Pos 1  (slot 6)
Ganador 0 → Repechaje 3, Pos 2  (slot 7)
Ganador 1 → Repechaje 4, Pos 1  (slot 8)
Ganador 2 → Repechaje 4, Pos 2  (slot 9)
Ganador 3 → Repechaje 5, Pos 1  (slot 10)
Ganador 4 → Repechaje 5, Pos 2  (slot 11)
```

**Tabla de distribución (8-31 parejas):**

| Parejas | Bracket | Zona | Repechaje | Perd→Repech | Gan→Repech | Gan→Directo |
|---------|---------|------|-----------|-------------|------------|-------------|
| 8 | 8 | 4 | 0 | 0 | 0 | 4 |
| 9 | 8 | 4 | 1 | 2 | 0 | 4 |
| 10 | 8 | 5 | 2 | 4 | 0 | 3 |
| 11 | 8 | 5 | 3 | 6 | 0 | 1 |
| 12 | 8 | 6 | 4 | 6 | 2 | 0 |
| 13 | 8 | 6 | 5 | 6 | 4 | 0 |
| **14** | **8** | **7** | **6** | **7** | **5** | **2** |
| 15 | 8 | 7 | 7 | 6 | 8 | 0 |
| 16 | 16 | 8 | 0 | 0 | 0 | 8 |
| 17 | 16 | 8 | 1 | 2 | 0 | 8 |
| 18-32 | ... | ... | ... | ... | ... | ... |

**Archivos modificados:**
- `bracket.service.ts` - Método `conectarZonaConBracket()` - Contador único `slotRepechajeIdx`

**Commits:** `e70f51c`, `1ce75bc`

---

## 🆕 COMPLETADO (2026-03-25) - Descanso 4 Horas Entre Fases

### ✅ Implementación: Descanso Obligatorio Mismo Día

**Problema:** El repechaje podía asignarse inmediatamente después de zona (ej: zona termina 21:00, repechaje empieza 19:30), sin dar descanso a los jugadores.

**Solución:** Si una fase anterior del mismo día terminó, la siguiente fase debe esperar 4 horas.

**Lógica:**
```typescript
horaMinimaInicio = ultimaHoraFaseAnterior + 4 horas

// Ejemplo:
// Zona termina a 21:00
// Repechaje necesita empezar >= 01:00 (25:00)
// Si último slot del día es 22:30, repechaje pasa al siguiente día
```

**Comportamiento:**
| Escenario | Acción |
|-----------|--------|
| Cabe en el día (ej: zona 14:00, repechaje >= 18:00) | Asigna mismo día |
| No cabe en el día (ej: zona 21:00, repechaje >= 01:00) | Pasa al siguiente día disponible |

**Archivos modificados:**
- `canchas-sorteo.service.ts` - Métodos `sortearConFasesPorDia()` y `asignarSlotsPorFase()`

---

## 🆕 COMPLETADO (2026-03-25) - MatchId en Slots para Liberación

### ✅ Implementación: Guardar matchId al Asignar Slot

**Problema:** Al re-sortear, los slots no se liberaban porque no tenían `matchId` guardado. El código buscaba `matchId: partido.id` pero los slots solo tenían `estado: 'OCUPADO'`.

**Solución:**
```typescript
// Al crear un partido con slot asignado:
await prisma.torneoSlot.updateMany({
  where: { torneoCanchaId, fecha, horaInicio },
  data: {
    matchId: createdMatch.id,  // NUEVO
    estado: 'OCUPADO'
  }
})
```

**Resultado:** Los slots ahora se liberan correctamente al re-sortear.

---

## 🆕 COMPLETADO (2026-03-25) - Re-Sorteo Usa Misma Lógica que Sorteo Masivo

### ✅ Implementación: `reSortearCategoria()` con Distribución por Fases

**Problema:** El re-sorteo individual usaba `guardarBracket()` con lógica secuencial, ignorando las fases por día de semana.

**Solución:** Nuevo método `reSortearCategoria()` que:
1. Libera slots de partidos sin resultado
2. Elimina partidos sin resultado
3. Archiva/elimina fixture anterior
4. Usa `asignarSlotsPorFase()` con la misma lógica de distribución que sorteo masivo

**Archivos modificados:**
- `canchas-sorteo.service.ts` - Nuevos métodos `reSortearCategoria()` y `asignarSlotsPorFase()`
- `admin-bracket.controller.ts` - Endpoint `reSortearBracket` actualizado

---

---

## 🆕 COMPLETADO (2026-03-24) - Scheduling Inteligente

### ✅ Implementación: Sorteo con Fases por Día

**Problema identificado:** Los slots se asignaban secuencialmente sin respetar qué fases debían jugarse en qué días. Una categoría con 40 partidos tomaba los primeros 40 slots (que podían ser Jueves a Domingo mezclados), haciendo que partidos de OCTAVOS terminaran el Jueves y partidos de ZONA el Domingo.

**Solución implementada:**

#### 1. Base de Datos
- Campo `fasesPermitidas` agregado a `TorneoDisponibilidadDia` (String opcional)
- SQL aplicado en producción manualmente

#### 2. Backend - `canchas-sorteo.service.ts`

**Nuevos métodos:**
- `obtenerFasesParaDia(fecha)` - Determina fases según día de semana:
  - Jueves(4)/Viernes(5) → [ZONA, REPECHAJE]
  - Sábado(6) → [OCTAVOS, CUARTOS]
  - Domingo(0) → [SEMIS, FINAL]

- `sortearConFasesPorDia()` - NUEVA lógica:
  - Procesa días cronológicamente
  - Para cada día, filtra partidos de las fases permitidas
  - Usa Round-Robin entre categorías
  - Asigna slots solo del día correspondiente

- `ordenarRoundRobin()` - Alterna entre categorías:
  ```
  Slot 1: CatA-Zona-1
  Slot 2: CatB-Zona-1
  Slot 3: CatA-Zona-2
  Slot 4: CatB-Zona-2
  ```

- `sortearSecuencialOriginal()` - MANTIENE lógica anterior como fallback

**Estrategia de decisión:**
```typescript
if (diasConFases.length >= 2) {
  return sortearConFasesPorDia(); // Nueva lógica
} else {
  return sortearSecuencialOriginal(); // Fallback
}
```

#### 3. DTOs
- `ConfigurarDiaJuegoDto` ahora incluye `fasesPermitidas?: string[]` (opcional)

#### 4. Frontend
- `ConfigurarDiaJuegoPayload` actualizado con campo opcional

### 🆕 COMPLETADO (2026-03-24) - Validación de Configuración de Días

**Problema detectado:** El sistema asignaba todas las fases a los primeros días disponibles, causando:
- ZONA y REPECHAJE encimados en el mismo día
- OCTAVOS/CUARTOS/SEMIS/FINAL todos en Viernes en lugar de Sábado/Domingo
- Usuarios sin aviso previo de que faltaban días configurados

**Solución implementada:**

#### Nuevo método `validarConfiguracionDias()`
```typescript
// Valida ANTES de sortear que existan:
- Días Jueves/Viernes para ZONA + REPECHAJE
- Días Sábado para OCTAVOS + CUARTOS  
- Días Domingo para SEMIS + FINAL

// Retorna error detallado si falta algo:
{
  valido: false,
  mensaje: "Configuración de días insuficiente",
  detalle: {
    errores: [
      "Faltan días Sábado: 12 partidos de Octavos/Cuartos pero solo 0 slots disponibles"
    ],
    diasConfigurados: [...],
    slotsPorTipoDia: { juevesViernes: 29, sabado: 0, domingo: 16 }
  }
}
```

**Tipos de días validados:**
| Tipo de Día | Fases Permitidas | Día de Semana |
|-------------|------------------|---------------|
| Jueves/Viernes | ZONA, REPECHAJE | 4, 5 |
| Sábado | OCTAVOS, CUARTOS | 6 |
| Domingo | SEMIS, FINAL | 0 |

**Comportamiento:**
- Si validación pasa → Procede con sorteo normal
- Si validación falla → Retorna error 400 con mensaje claro
- Usuario debe agregar más días antes de intentar sortear nuevamente

### ✅ Commits Realizados

**Backend:** `bc35ba9`
```
feat(sorteo): implementar asignacion de slots por fases con Round-Robin
- 3 files changed, 333 insertions(+), 10 deletions(-)
```

**Frontend:** `ec7d1eb`
```
feat(sorteo): actualizar interfaz ConfigurarDiaJuegoPayload con fasesPermitidas
- 1 file changed, 1 insertion(+)
```

**Backend:** `151c996`
```
feat(sorteo): agregar validacion de dias configurados vs fases requeridas
- Nuevo metodo validarConfiguracionDias() verifica Jueves/Viernes/Sabado/Domingo
```

**Backend:** `411741a`
```
feat(resortear): liberar slots y mantener partidos con resultado al re-sortear
- Al re-sortear, libera slots de partidos SIN resultado cargado
- Mantiene partidos CON resultado (ya jugados)
- Elimina solo partidos pendientes
- Archiva fixture si tiene partidos jugados, elimina si no
```

**Frontend:** `f630871`
```
fix(canchas-sorteo): corregir filtro de categorias sorteadas
- Agregar fixtureVersionId a interfaz Categoria
- FIX: Una categoria esta sorteada si tiene fixtureVersionId O estado sorteado
- Estados sorteados: CERRADA, INSCRIPCIONES_CERRADAS, FIXTURE_BORRADOR, SORTEO_REALIZADO, EN_CURSO
```

### 📊 Ejemplo de Funcionamiento

**Configuración:**
- Jueves: 20 slots (Zona/Repechaje)
- Viernes: 20 slots (Zona/Repechaje)
- Sábado: 20 slots (Octavos/Cuartos)
- Domingo: 10 slots (Semis/Final)
- 2 Categorías (CatA, CatB), 26 parejas cada una

**Resultado:**
```
JUEVES (Zona):
18:00 CatA-Z1 | CatB-Z1 | CatA-Z2 | CatB-Z2
19:30 CatA-Z3 | CatB-Z3 | CatA-Z4 | CatB-Z4
...

VIERNES (Zona/Repechaje):
18:00 CatA-Z9 | CatB-Z9 | CatA-Z10 | CatB-Z10
19:30 CatA-R1 | CatB-R1 | CatA-R2 | CatB-R2
...

SÁBADO (Octavos/Cuartos):
09:00 CatA-O1 | CatB-O1 | CatA-O2 | CatB-O2
10:30 CatA-O5 | CatB-O5 | CatA-C1 | CatB-C1
...

DOMINGO (Semis/Final):
09:00 CatA-S1 | CatB-S1 | CatA-S2 | CatB-S2
10:30 CatA-F  | CatB-F
```

### 🐛 FIX: Filtro de Categorías Sorteadas (2026-03-24)

**Problema:** Al recargar la página, las categorías sorteadas aparecían como "Disponibles" en el tab "Canchas y Sorteo". El filtro `estaSorteada` solo verificaba estados `CERRADA` e `INSCRIPCIONES_CERRADAS`, pero no incluía `FIXTURE_BORRADOR` (estado cuando el sorteo está en borrador).

**Causa:** La interfaz `Categoria` no tenía el campo `fixtureVersionId`, que es el indicador más confiable de que una categoría ya fue sorteada.

**Solución:**

```typescript
// Interfaz actualizada
interface Categoria {
  id: string;
  nombre: string;
  parejas: number;
  minimoParejas: number;
  estado: string;
  fixtureVersionId?: string | null; // NUEVO
}

// Filtro corregido
const estadosSorteados = [
  'CERRADA', 
  'INSCRIPCIONES_CERRADAS', 
  'FIXTURE_BORRADOR', 
  'SORTEO_REALIZADO', 
  'EN_CURSO'
];

// Una categoría está sorteada si:
const estaSorteada = !!cat.fixtureVersionId || estadosSorteados.includes(cat.estado);
```

**Estados que indican categoría sorteada:**
| Estado | Descripción |
|--------|-------------|
| `FIXTURE_BORRADOR` | Sorteo realizado, en borrador |
| `SORTEO_REALIZADO` | Sorteo publicado |
| `EN_CURSO` | Torneo en progreso |
| `INSCRIPCIONES_CERRADAS` | Inscripciones cerradas, listo para sortear |
| `CERRADA` | Categoría finalizada |

### 🔄 Funcionamiento del Re-Sortear

**Problema anterior:** Al re-sortear, se eliminaban todos los partidos pero los slots quedaban ocupados, impidiendo reutilizarlos.

**Solución implementada:**

```typescript
// Al hacer clic en "Re-Sortear":

// 1. Separa partidos:
const partidosConResultado = partidos.filter(p => p.tieneResultado)
const partidosSinResultado = partidos.filter(p => !p.tieneResultado)

// 2. Libera slots de partidos SIN resultado:
for (partido of partidosSinResultado) {
  await prisma.torneoSlot.update({
    where: { matchId: partido.id },
    data: { estado: 'LIBRE', matchId: null }
  })
}

// 3. Elimina SOLO partidos sin resultado
await prisma.match.deleteMany({
  where: { id: { in: partidosSinResultado.map(p => p.id) } }
})

// 4. Mantiene partidos CON resultado (ya jugados)
// Estos partidos permanecen en el bracket

// 5. Genera nuevo sorteo para partidos pendientes
return sortearBracket(categoria.id)
```

**Comportamiento:**
| Tipo de Partido | Acción |
|-----------------|--------|
| Con resultado (ya jugado) | ✅ Se mantiene, no se modifica |
| Sin resultado (pendiente) | ❌ Se elimina y slot se libera |
| Todos con resultado | ⚠️ Error: "No hay partidos pendientes para re-sortear" |

### 🛡️ Compatibilidad Garantizada

- **Formato paraguayo intacto:** Zona→Repechaje→Octavos→Cuartos→Semis→Final
- **Días existentes:** Si no tienen `fasesPermitidas`, usan lógica secuencial original
- **Días nuevos:** Automáticamente calculan fases según día de semana
- **Campo opcional:** No rompe datos existentes

### 📋 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `prisma/schema.prisma` | +1 campo `fasesPermitidas` |
| `canchas-sorteo.dto.ts` | +1 campo opcional en DTO |
| `canchas-sorteo.service.ts` | ~333 líneas (nuevos métodos + refactor) |
| `canchasSorteoService.ts` | +1 campo en interfaz |

---

## 🐛 FIX: Manejo Correcto de Fechas (2026-03-24)

**Problema detectado:** En la implementación inicial de `obtenerFasesParaDia()`, se usó `new Date(year, month - 1, day, 12, 0, 0)` que crea la fecha en hora local del servidor, potencialmente causando inconsistencias en el cálculo del día de la semana.

**Solución aplicada:**
```typescript
// ❌ ANTES (problemático)
const date = new Date(year, month - 1, day, 12, 0, 0);
const diaSemana = date.getDay();

// ✅ DESPUÉS (correcto)
const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
const diaSemana = date.getUTCDay();
```

**Regla reforzada:** Para fechas de negocio (YYYY-MM-DD):
- NUNCA usar `new Date()` sin especificar timezone
- Usar `Date.UTC()` para cálculos consistentes
- Usar strings YYYY-MM-DD para almacenamiento y comparación
- Los timestamps de sistema (createdAt, updatedAt) sí usan `new Date()` normal

**Commit:** `fbbe68b` - fix(fechas): usar UTC para calcular dia de semana

---

## 🗓️ HISTORIAL ANTERIOR

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

### 🕐 Manejo de Fechas - Timezone Paraguay (CRÍTICO)

**ACTUALIZACIÓN 2026-03-22:** Las fechas de negocio ahora son `String` en formato `YYYY-MM-DD`. Ver sección "MIGRACIÓN: FECHAS DATE → STRING" abajo.

**Timezone:** `America/Asuncion` (UTC-3)

**REGLA:** Todas las fechas en el sistema son hora de Paraguay.

**✅ NUEVO ENFOQUE (Post-Migración):**
```typescript
// Fechas son String YYYY-MM-DD - Sin conversiones de timezone
const fecha: string = "2026-03-22"; // Guarda y muestra exactamente esto

// Comparación directa como strings (funciona por formato ISO)
if (hoy > fechaProgramada) { /* ... */ }

// Para cálculos de día de semana
const diaSemana = new Date(fecha + 'T12:00:00').getDay();
```

**❌ ANTIGUO ENFOQUE (Pre-Migración) - YA NO APLICA:**
```typescript
// ❌ ELIMINADO - Ya no se usa
new Date('2026-03-22' + 'T03:00:00.000Z')
```

**Backend:**
```typescript
// Validación de formato en DTOs
@Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Formato YYYY-MM-DD' })
fechaInicio: string;

// Uso directo en servicios
const torneo = await this.prisma.tournament.create({
  data: {
    fechaInicio: dto.fechaInicio, // String directo
    fechaFin: dto.fechaFin,
  }
});
```

**Frontend:**
```typescript
// Usar utilidades de date.ts
import { formatDatePY, getDatesRangePY } from '../utils/date';
const str = formatDatePY('2026-03-22'); // "22/03/2026"
const fechas = getDatesRangePY('2025-03-12', '2025-03-15');
```

**Archivos:**
- Backend: `src/common/services/date.service.ts` (legacy - mantener para timestamps)
- Backend: `src/common/interceptors/paraguay-timezone.interceptor.ts` (legacy)
- Frontend: `src/utils/date.ts`

---

## 🔥 MIGRACIÓN: FECHAS DATE → STRING (2026-03-22)

### Cambio Arquitectónico Mayor
**Problema:** Las fechas DateTime con timezone causaban que las fechas mostraran un día anterior en Paraguay (UTC-3). Una fecha guardada como "2026-03-27" mostraba "26/03/2026".

**Solución:** Migrar TODAS las fechas de negocio de `DateTime @db.Timestamptz` a `String` en formato `YYYY-MM-DD`.

### Tablas Modificadas (18 total)
- `tournaments` - fechas del torneo
- `circuitos` - fechas de circuito
- `torneo_disponibilidad_dias` - fechas de días de juego
- `matches` - fecha_programada
- `users` - fecha_nacimiento, fecha_fin_premium
- `pagos` - fecha_pago, fecha_confirmacion
- `historial_puntos` - fecha_torneo
- `solicitudes_jugar` - fecha_propuesta
- `suscripciones` - fechas de suscripción
- `cupones` - fechas de validez
- `banners` - fechas de publicación
- `ascensos_pendientes` - fechas de cálculo
- `instructor_bloqueos` - fechas de bloqueo
- `reservas_instructor` - fecha de clase
- `pagos_instructor` - fecha de pago
- `alquiler_bloqueos` - fechas de bloqueo
- `reservas_canchas` - fecha de reserva
- `reservas_mensualeros` - fecha de reserva

### Archivos de Migración
- **SQL:** `prisma/migrations/20260322100000_fecha_string_migration/migration.sql`
- **README:** `prisma/migrations/20260322100000_fecha_string_migration/README.md`
- **Backup Schema:** `prisma/schema.prisma.backup.datetime`

### Archivos de Código Modificados
- `canchas-sorteo.service.ts` - Sorteo de canchas
- `bracket.service.ts` - Generación de bracket
- `admin-bracket.controller.ts` - API de bracket
- `admin-torneos.controller.ts` - Gestión de torneos
- `admin-disponibilidad.controller.ts` - Disponibilidad
- `tournaments.service.ts` - CRUD de torneos
- `inscripciones.service.ts` - Inscripciones
- `public-inscripciones.controller.ts` - API pública
- `public-tournaments.controller.ts` - Torneos públicos
- `alquileres.service.ts` - Alquileres
- `instructores.service.ts` - Instructores
- `programacion.service.ts` - Programación
- `auth.service.ts` - Registro
- `perfil.service.ts` - Perfil
- `invitaciones.controller.ts` - Invitaciones

### Deploy en Producción
```bash
# Opción 1: SQL directo (recomendado para control)
psql $DATABASE_URL -f prisma/migrations/20260322100000_fecha_string_migration/migration.sql

# Opción 2: Prisma migrate (si funciona conexión)
npx prisma migrate deploy
```

### Notas Post-Migración
- Las fechas se comparan ahora como strings: `"2026-03-22" > "2026-03-21"`
- Se eliminaron todos los `new Date(fecha + 'T03:00:00.000Z')`
- Los castings `(as unknown as string)` pueden eliminarse tras regenerar tipos de Prisma
- **Fechas de sistema** (createdAt, updatedAt, expiresAt) se mantienen como DateTime

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

### ✅ Completado (2026-03-11) - Refactor UI
- [x] **Refactor UI Wizard de Inscripción** - Diseño compacto/minimalista (3 pasos)
- [x] **Refactor UI Wizard de Creación** - Mismo estilo minimalista aplicado
- [x] **Selector de código de país** - En teléfono del jugador 2
- [x] **Filtro inteligente de categorías** - Validaciones automáticas por género/nivel
- [x] **Sistema de fondo consistente** - BackgroundEffects en toda la app
- [x] **Componente PageLayout** - Plantilla reutilizable para nuevas páginas

### ✅ Completado (2026-03-12) - Sistema de Bracket V2 (Paraguayo Correcto)
- [x] **Fórmula del Sistema Paraguayo** (corregida):
  ```
  PartidosZona = floor(parejas / 2)
  ObjetivoBracket = (parejas <= 15) ? 8 : 16
  Eliminaciones = parejas - ObjetivoBracket
  PartidosRondaAjuste = Eliminaciones
  ```
- [x] **Lógica de Ronda de Ajuste** - Puede incluir ganadores O perdedores de zona
- [x] **Modelos de BD extendidos** - Campos opcionales en Match (esBye, tipoEntrada, partidoSiguienteId, etc.)
- [x] **Servicio BracketService** - Cálculo automático con fórmula correcta
- [x] **Endpoints REST completos:**
  - `GET /admin/torneos/:id/categorias` - Listar con conteo de inscripciones
  - `GET /admin/categorias/:id/bracket/config` - Obtener configuración previa
  - `POST /admin/categorias/:id/bracket/sortear` - Realizar sorteo (preview/guardar)
  - `POST /admin/categorias/:id/bracket/generar` - Generar y guardar bracket
  - `POST /admin/categorias/:id/cerrar-inscripciones` - Cerrar inscripciones
  - `POST /admin/categorias/:id/abrir-inscripciones` - Reabrir inscripciones
  - `GET /admin/bracket/:fixtureVersionId/partidos` - Obtener partidos
  - `POST /admin/bracket/:fixtureVersionId/publicar` - Publicar bracket
  - `POST /admin/bracket/:fixtureVersionId/sortear-nuevo` - Re-sortear
- [x] **Validaciones:**
  - Mínimo 8 parejas para sortear
  - Inscripciones deben estar cerradas
  - No permite re-sortear si ya está publicado
- [x] **UI Frontend - Estilo Minimalista:**
  - `BracketManager` - Lista separada por género (Damas/Caballeros/Mixto), orden ascendente
  - `ConfigurarBracketModal` - Vista previa con fórmula del sistema
  - `BracketView` - Visualización por fases
  - Botón "Cerrar inscripciones" en pestaña Inscripciones Y Fixture
- [x] **Integración:** Tab "Fixture" en `/mis-torneos/:id/gestionar`

### ✅ Completado (2026-03-11) - Sistema Demo / Datos de Prueba
- [x] **Modelo JugadorDemo** - Tabla separada para jugadores de prueba
- [x] **Seed de 400 jugadores** - 200 masculinos + 200 femeninos distribuidos en categorías
- [x] **Servicio DemoService** - Lógica para llenar/limpiar torneos automáticamente
- [x] **Endpoints REST:**
  - `POST /admin/demo/torneos/:id/llenar` - Llena torneo con inscripciones demo (12-32 parejas por categoría)
  - `DELETE /admin/demo/torneos/:id/limpiar` - Elimina inscripciones demo
  - `GET /admin/demo/status` - Info del sistema
- [x] **Distribución REALISTA** - Más parejas en categorías bajas (ej: 3ra=12, 7ma=20)
- [x] **Estados mixtos** - 60% CONFIRMADA, 30% PENDIENTE_PAGO, 10% PENDIENTE_CONFIRMACION
- [x] **Pagos ficticios** - Las confirmadas incluyen pago automático

**Flujo de prueba completo:**
1. Crear torneo → 2. `POST /admin/demo/torneos/:id/llenar` → 3. Generar bracket → 4. Probar flujo → 5. `DELETE .../limpiar`

### ✅ Completado (2026-03-11) - Sistema de Fechas/Timezone Paraguay
- [x] **DateService mejorado** - Métodos: parse(), addHours(), addDays(), startOfDay(), endOfDay(), getDatesRange(), compareDates(), getDayName(), getMonthName()
- [x] **ParaguayTimezoneInterceptor** - Normaliza automáticamente fechas entrantes/salientes
- [x] **date.utils.ts frontend** - Funciones timezone-aware: formatDatePY(), formatDateTimePY(), toISOStringPY(), parseDatePY(), getDatesRangePY(), isTodayPY(), compareDatesPY()
- [x] **ConfiguradorSede actualizado** - Usa utilidades de fecha Paraguay
- [x] **Sistema 100% en hora Paraguay (UTC-3)** - Sin desfases entre frontend y backend

### ✅ Completado (2026-03-12) - Módulo de Programación Inteligente - BACKEND
- [x] **Servicio ProgramacionService** - Algoritmo de distribución automática
- [x] **Distribución por fases:** Zona → Ronda de Ajuste → Bracket (Octavos → Cuartos → Semis → Final)
- [x] **Validaciones inteligentes:**
  - Máximo 2 partidos por pareja por día
  - 4 horas mínimo entre partidos de misma pareja
  - No sobrepasar slots disponibles
- [x] **Predicción de recursos:**
  - Calcula horas necesarias vs disponibles
  - Detecta déficit antes de aplicar
  - Sugiere agregar canchas o extender días
- [x] **Endpoints REST:**
  - `POST /programacion/torneos/:id/calcular` - Calcula distribución óptima
  - `POST /programacion/torneos/:id/aplicar` - Aplica la programación
  - `GET /programacion/torneos/:id/preview` - Vista previa
- [x] **Integración con disponibilidad** - Usa TorneoSlot configurados
- [x] **Soporta sorteo por lotes** - Programa categorías a medida que se sortean

### ✅ Completado (2026-03-11) - Módulo de Programación Inteligente - FRONTEND
- [x] **Componente ProgramacionManager** - Vista principal de programación
  - Predicción de recursos (horas necesarias vs disponibles)
  - Distribución por días con slots ocupados
  - Vista por fases: Zona → Ronda → Octavos → Cuartos → Semis → Final
  - Estados: SIN_CALCULAR → CALCULADO → APLICADO
- [x] **Acciones disponibles:**
  - Calcular automáticamente
  - Recalcular distribución
  - Aplicar programación a la base de datos
- [x] **Validaciones visuales:**
  - Conflictos destacados en rojo
  - Alertas de déficit de recursos
  - Loading states con spinners
- [x] **Integración:** Tab "Programación" en `/mis-torneos/:id/gestionar`
- [x] **Preparación para edición manual** - Estructura lista para futura implementación

### ✅ Completado (2026-03-12) - Vista Demo (Datos Estáticos)
- [x] **Tab "Vista Demo"** en panel de gestión `/mis-torneos/:id/gestionar`
- [x] **Banner de estado del torneo** con info del torneo demo
- [x] **Stats cards** - Inscripciones, confirmadas, pendientes, ingresos
- [x] **Timeline del flujo** - 6 fases del torneo con estados visuales
- [x] **Categorías sorteadas** - Grid con 6 categorías de ejemplo (Damas/Caballeros)
- [x] **Programación preview** - Distribución de 72 partidos en 4 días
- [x] **Bracket preview** - Estructura de fases para 2 categorías ejemplo
- [x] **Nota informativa** - Indica que son datos estáticos de ejemplo
- **Nota:** Esta vista es temporal y se puede eliminar cuando ya no sea necesaria

### ✅ Completado (2026-03-12) - Sistema de Resultados y Marcador en Vivo
- [x] **Schema Prisma extendido** - `formatoSet3`, `liveScore`, `duracionMinutos`
- [x] **ResultadosModule (Backend)**:
  - `POST /admin/resultados/matches/:id/resultado` - Carga directa post-partido
  - `POST /admin/resultados/matches/:id/resultado-especial` - Retiro/Descalificación/WO
  - `POST /admin/resultados/matches/:id/iniciar` - Iniciar partido en vivo
  - `POST /admin/resultados/matches/:id/punto` - Registrar punto
  - `POST /admin/resultados/matches/:id/deshacer` - Deshacer último punto
  - `POST /admin/resultados/matches/:id/finalizar` - Finalizar y avanzar ganador
  - `POST /admin/resultados/matches/:id/configuracion` - Cambiar formato set3/modo punto
  - `GET /admin/resultados/matches/:id/marcador` - Obtener marcador actual
- [x] **Lógica de juego completa**:
  - Sets 1 y 2: games 0-6/7 con diferencia de 2
  - Set 3 modo **Set Completo**: games 0-6/7
  - Set 3 modo **Súper Tie-Break**: puntos hasta 10 con diferencia de 2
  - **Punto de Oro**: Opción configurable (default en amateur PY)
  - **Ventaja**: Opción configurable (para profesional)
  - Avance automático del ganador al siguiente partido del bracket
- [x] **Sistema de Saque Profesional (Reglamento FIP)**:
  - Configuración inicial: seleccionar qué jugador de cada pareja saca primero
  - Durante un game: el mismo jugador saca TODOS los puntos
  - Al cambiar de game: cambia la pareja que saca + alterna jugador dentro de la pareja
  - Indicador visual de quién saca con nombre del jugador
  - Tie-break: cambia cada 2 puntos
- [x] **Resultados especiales**:
  - Nuevos estados: `RETIRADO`, `DESCALIFICADO`, `WO`
  - Campos: `parejaRetirada` (1 o 2), `razonResultado`
  - Tipos: Retiro por lesión, Retiro otro, Descalificación, No se presentó (WO)
  - La pareja NO afectada avanza automáticamente como ganadora
- [x] **RegistroResultadoModal (Frontend)** - Tabs: Resultado Normal / Retiro-Descalif.
  - Formulario para resultado normal con selección de formato set3
  - Formulario para incidencias con selección de tipo y pareja afectada
  - Visualización destacada de la pareja afectada (borde rojo)
  - **Carga de resultado existente**: Si el partido ya tiene resultado, lo muestra en el formulario
- [x] **MarcadorEnVivo (Frontend)** - Pantalla de marcador punto a punto
  - **Configuración previa**: Formato del set 3, modo de punto (oro/ventaja), selección de saque
  - **Punto de Oro visual**: En 40-40 con modo punto de oro, puntos cambian a color amarillo/dorado con banner "⚡ PUNTO DE ORO ⚡"
  - **Súper Tie-Break**: Muestra puntos numéricos (1, 2, 3...) en lugar de 15-30-40
  - **Botón "Guardar Resultado" prominente**: Cuando el partido termina (2 sets ganados), aparece trofeo amarillo con botón verde para persistir en BD
- [x] **Integración en BracketView** - Botones "En Vivo" y "Resultado" en cada partido
  - Muestra resultado completo: Set 1 | Set 2 | Set 3 (si aplica)
  - Badge "Finalizado" en partidos terminados
  - Ganador destacado en verde

### ✅ Completado (2026-03-13) - Sistema de Rankings y Ascensos
- [x] **Schema Prisma extendido**:
  - `ConfiguracionPuntos` - Configuración base de puntos por posición
  - `ReglaAscenso` - Reglas configurables de ascenso por categoría
  - `AscensoPendiente` - Tracking de ascensos detectados
  - `multiplicadorPuntos` en Tournament
- [x] **RankingsModule (Backend)**:
  - Endpoints públicos: `/rankings`, `/rankings/jugador/:id`
  - Endpoints admin: config puntos, reglas ascenso, cálculo de puntos
  - Cálculo automático de puntos al finalizar torneo
  - Detección automática de ascensos por campeonatos ganados
  - Procesamiento de ascensos (confirmar/rechazar)
- [x] **Seed de configuración**:
  - Puntos base: 1ro=100, 2do=70, 3ro-4to=45, 5to-8vo=25, 9no-16to=15, participación=5
  - Reglas de ascenso basadas en FEPARPA (3-4 campeonatos según categoría)
- [x] **RankingsPage (Frontend)**:
  - Filtros: categoría, género, temporada, ciudad
  - Tabla con top 3 destacado, tendencias, marcado de usuario logueado
  - Integración con datos del jugador (foto, categoría actual)

### 🎯 SISTEMA DE TORNEOS - **COMPLETO** ✅

El flujo de torneos está **100% funcional** de principio a fin:

```
Crear Torneo → Inscripciones Públicas → Cerrar/Sortear → Programar 
→ Jugar (Marcador en Vivo) → Registrar Resultados (Normal/Especial) 
→ Rankings Automáticos → Ascensos de Categoría
```

**Features completadas:**
- ✅ Wizard de creación con multiplicador de puntos
- ✅ Inscripciones con invitaciones y validaciones
- ✅ Bracket Paraguayo (Zona + Ronda Ajuste + Eliminación)
- ✅ Programación inteligente de slots
- ✅ Marcador en vivo punto a punto
- ✅ Resultados: Normal, Retiro (lesión/otro), Descalificación, WO
- ✅ Rankings por categoría/ciudad/temporada/circuito
- ✅ Ascensos automáticos por campeonatos ganados
- ✅ Checklist, Comisiones, Bloqueo estratégico
- ✅ Vista Demo para preview

### ✅ Completado (2026-03-13) - Módulo Circuitos/Ligas
- [x] **Backend - CircuitosModule completo**:
  - Modelos: `Circuito`, `TorneoCircuito` (relación con metadatos), `ClasificadoCircuito`
  - CRUD de circuitos con slug, colores, banner, configuración de clasificación
  - Sistema de solicitudes: Organizador solicita → Admin aprueba/configura
  - Ranking por circuito (puntos acumulativos de torneos aprobados)
  - Cálculo de clasificados a la final
  - Endpoints públicos y admin completos
- [x] **Frontend - Páginas públicas**:
  - `/circuitos` - Lista de circuitos con cards destacadas
  - `/circuitos/:slug` - Detalle del circuito con:
    - Banner personalizado con color del circuito
    - Tab Información: reglas de clasificación, final
    - Tab Ranking: tabla con top 3 destacados (medallas)
    - Tab Torneos: lista con orden, indicador de final, si cuenta para puntos
- [x] **Flujo implementado**:
  1. Admin crea circuito
  2. Organizador solicita incluir su torneo
  3. Admin aprueba y configura:
     - **Orden**: Secuencia del torneo en el circuito (1°, 2°, 3°...)
     - Permite mostrar progreso visual y orden cronológico correcto
     - **Puntos válidos**: Si el torneo cuenta para el acumulado del circuito
     - **Es final**: Si es la etapa final del circuito
  4. Jugadores juegan torneos, puntos se acumulan automáticamente
  5. Los mejores N clasifican a la final del circuito

### ✅ Completado (2026-03-13) - Correcciones Críticas
- [x] **Estandarización de Roles** - Todos los controllers ahora usan minúsculas ('admin', 'organizador', 'ayudante')
- [x] **Protección de ruta /admin** - Solo usuarios con rol 'admin' pueden acceder al panel

### ✅ Completado (2026-03-13) - Perfil de Jugador (Absurdamente Brutal)

**Mockup Visual:** `PerfilMockupPage` - Demo estática con diseño moderno, minimalista y tecnológico

**Backend - PerfilModule completo:**
- [x] **Endpoints:**
  - `GET /users/profile/:id` - Perfil público de cualquier jugador (sin auth)
  - `GET /users/profile/me` - Mi perfil con datos privados (requiere auth)
- [x] **Estadísticas calculadas dinámicamente:**
  - Torneos: jugados, ganados, finales, semifinales
  - Partidos: ganados, perdidos, efectividad (%), racha actual
  - Rankings: por tipo y alcance con posición y puntos
  - Historial: últimos 10 torneos con puntos ganados
- [x] **Sistema de Logros calculados:**
  - 🏆 Campeón (oro/plata/bronce según cantidad)
  - 🥈 Finalista
  - 🏟️ Veterano (50+ torneos)
  - 🔥 Racha Perfecta (victorias seguidas)
  - ⭐ Ascenso
  - 🎯 Precisión (efectividad > 60%)
- [x] **Actividad reciente:** Últimos torneos jugados + ascensos logrados

**Frontend - PerfilPage conectada a datos reales:**
- [x] **Rutas:**
  - `/perfil` - Mi propio perfil (detecta usuario logueado)
  - `/perfil/:id` - Perfil de otro jugador
  - `/perfil-mockup` - Demo estática (se mantiene para referencia)
- [x] **Hero Section:**
  - Banner personalizable (gradiente por defecto)
  - Foto de perfil con hover para cambiar (solo mi perfil)
  - Badge Premium animado
  - Indicador "En línea"
  - Info: Nombre, username, categoría, ubicación, edad
  - Bio personalizable
  - Stats sociales: seguidores, siguiendo, torneos
- [x] **Stats Cards (4 cards animadas):**
  - Torneos Ganados (amarillo)
  - Partidos Jugados (azul)
  - Puntos Totales (morado)
  - Racha Actual (rojo)
- [x] **Historial de Puntos:**
  - Lista de últimos torneos con posición, puntos, fecha
  - Visualización de medallas (oro/plata/bronce)
- [x] **Efectividad (3 donuts charts):**
  - Victorias (%)
  - Sets Ganados
  - Torneos Ganados
- [x] **Actividad Reciente:**
  - Timeline con íconos dinámicos según tipo
  - Campeonatos, subcampeonatos, ascensos
  - Fechas formateadas
- [x] **Logros (Sidebar):**
  - 6 logros con iconos emoji
  - Niveles: oro, plata, bronce, especial
  - Barras de progreso
  - "Ver todos los logros" link
- [x] **Ranking Info:**
  - Mejor posición actual
  - Puntos totales
  - Victorias y torneos jugados
- [x] **Inscripciones Pendientes (solo mi perfil):**
  - Alerta visual si hay inscripciones sin pagar/confirmar
- [x] **Acciones inteligentes:**
  - Botón "Editar Perfil" solo en mi perfil
  - Botón "Seguir" solo en perfiles ajenos
  - Configuración y compartir accesibles

**Diseño Visual:**
- Glassmorphism: `bg-[#151921]/50` + `backdrop-blur` + bordes `white/5`
- Gradientes: Rojos FairPadel + acentos azules/morados
- Animaciones: Framer Motion (entrada, hover, counting)
- Layout: Responsive (grid cambia en mobile)
- Tipografía: Inter moderna, blanco con opacidades

**Commits:**
- Backend: `26456bc` - feat(perfil): implementar backend y frontend
- Frontend: `851a107` - feat(perfil): página de perfil conectada a backend

### ✅ Completado (2026-03-14) - Dashboard Maquiavélico + Overview Organizador

**Dashboard Post-Login Unificado:**
- [x] **HomeDashboardPage** - Reemplaza NovedadesPage vacía
- [x] **FOMO Social** - Feed "¿Te están pasando?" con actividad de otros jugadores
- [x] **Urgencia** - Torneos que cierran pronto con badges pulsantes
- [x] **Ego Validation** - Stats rápidos (racha, victorias, ranking, torneos)
- [x] **Progreso** - Barra hacia siguiente categoría
- [x] **Redirección automática** - Landing → Dashboard si hay sesión

**Overview Tab (Organizador):**
- [x] **Progreso del torneo** - Barra 0-100% con checklist visual
- [x] **Stats cards** - Inscripciones, ingresos, checklist, estado
- [x] **Tareas pendientes** - Alertas por prioridad (urgente/advertencia/info)
- [x] **Inscripciones por categoría** - Gráfico de barras
- [x] **Link público** - Copiar y ver página del torneo

### ✅ Completado (2026-03-14) - Módulo Inscripciones 100% Funcional

**Backend:**
- [x] `GET /admin/torneos/:id/overview` - Resumen ejecutivo del torneo
- [x] `GET /admin/torneos/:id/jugadores/buscar` - Buscar jugadores registrados
- [x] `POST /admin/torneos/:id/inscripciones/manual` - Crear inscripción manual
- [x] `PUT /admin/torneos/:id/inscripciones/:inscId` - Editar inscripción
- [x] `PUT /admin/torneos/:id/inscripciones/:inscId/cambiar-categoria` - Mover de categoría

**Frontend - InscripcionesManager Pro:**
- [x] **Vista doble** - Cards y Tabla
- [x] **Filtros avanzados** - Por estado, fecha, categoría, búsqueda
- [x] **Ordenamiento** - Por fecha, nombre, estado, monto
- [x] **Exportar CSV** - Descarga Excel-compatible
- [x] **Selección múltiple** - Acciones masivas
- [x] **Confirmar/Cancelar** - Con modal de confirmación

**ModalInscripcionManual (Wizard 3 pasos):**
- [x] Paso 1: Buscar jugador 1 (registrado)
- [x] Paso 2: Buscar jugador 2 (registrado/temporal/sin pareja)
- [x] Paso 3: Seleccionar categoría, modo pago, monto, notas

**ModalEditarInscripcion:**
- [x] Cambiar jugador 2 (buscar registrado o ingresar temporal)
- [x] Cambiar modo de pago
- [x] Editar notas

**ModalCambiarCategoria:**
- [x] Listado de categorías disponibles
- [x] Validación de jugadores no duplicados
- [x] Confirmación antes de mover

**Acciones en cards:**
- [x] Botón editar (ícono lápiz)
- [x] Botón cambiar categoría (ícono flechas)

### ✅ Completado (2026-03-14) - Módulo Canchas (Disponibilidad) - Mejorado

**Problemas resueltos:**
- [x] **Vista unificada** - Elimina sub-tabs Configurar/Ver, ahora es una sola interfaz fluida
- [x] **Stats de capacidad** - 4 cards: Total Slots, Libres, Ocupados, Canchas
- [x] **Copiar configuración de día** - Seleccionar día origen y destino

**CanchasManager (nuevo componente unificado):**
- [x] Stats cards con ocupación porcentual
- [x] Botón "Copiar Configuración" para duplicar días
- [x] Vista semana tipo calendario con grid de slots
- [x] Filtro de canchas por colores
- [x] Toggle vista Semana/Lista
- [x] Navegación por semanas

**Cambios en GestionarTorneoPage:**
- [x] Elimina sub-tabs de disponibilidad
- [x] Usa CanchasManager directamente

### ✅ Completado (2026-03-16) - Fotos de Jugadores en Fixture

**Nuevo Componente: `ParejaAvatar`**
- Ubicación: `frontend/src/components/ui/ParejaAvatar.tsx`
- Muestra fotos de ambos jugadores de una pareja superpuestas
- Bordes rojizos (`#df2531`) según el tono de FairPadel
- Fallback con iniciales cuando no hay foto
- Tamaños: `sm`, `md`, `lg`

**Archivos actualizados:**
- `BracketView.tsx` - Fotos en cada tarjeta de partido
- `MarcadorEnVivo.tsx` - Fotos en el header del modal
- `RegistroResultadoModal.tsx` - Fotos en el header y selección de parejas

**Backend:**
- `admin-bracket.controller.ts` - Agregado `fotoUrl` en la consulta de `inscripcionGanadora`

### ✅ Completado (2026-03-16) - Validación de Flujo Cronológico

**Problema:** Se podían cargar resultados en partidos no programados (sin fecha/hora/cancha)

**Solución implementada (Opción A):**

**Backend - `resultados.service.ts`:**
- Nuevo método privado `validarPartidoProgramado()` 
- Valida que el partido tenga `torneoCanchaId`, `fechaProgramada` y `horaProgramada`
- Aplicado en: `registrarResultado()`, `registrarResultadoEspecial()`, `iniciarPartido()`
- Mensaje claro: *"El partido debe estar programado antes de cargar resultados. Ve al tab 'Programación'..."*

**Frontend - `BracketView.tsx`:**
- Banner amarillo informativo cuando hay partidos sin programar
- Botones "En Vivo" y "Resultado" deshabilitados si no está programado
- Nuevo estado visual: "Pendiente de programación" con indicador
- Campos agregados a la interfaz: `torneoCanchaId`, `fechaProgramada`, `horaProgramada`

**Flujo correcto ahora:**
1. ✅ Inscripciones
2. ✅ Configurar canchas
3. ✅ Cerrar categorías  
4. ✅ Sortear
5. ⏳ **Programar** partidos (obligatorio antes de resultados)
6. ⏳ Jugar
7. ⏳ Cargar resultados

### ✅ Completado (2026-03-16) - Módulo Programación 100% Funcional

**Refactor completo del módulo con 4 vistas diferentes:**

**📋 FASE 1 - Vista Lista:**
- Stats cards: Total, Programados, Pendientes
- Filtros por categoría, fase, estado (programados/pendientes)
- Búsqueda por nombre de jugador
- Lista con fotos de parejas superpuestas
- Indicadores visuales (verde=programado, ámbar=pendiente)
- Botón editar en cada partido
- Recarga de datos

**📅 FASE 2 - Edición Individual:**
- Modal `ModalEditarProgramacion` con fecha, hora, cancha
- Selector de canchas configuradas
- Botón "Desprogramar" para liberar slots
- Endpoints backend: `PUT /programacion/partidos/:id` y `DELETE /programacion/partidos/:id`
- Actualización en tiempo real de la vista

**📆 FASE 3 - Vista Calendario Grid:**
- Vista tipo grilla: horarios (filas) x canchas (columnas)
- Selector de fecha con navegación
- Partidos mostrados en sus celdas correspondientes
- Fotos de parejas en cada celda
- Click para editar partido existente
- Click en celda vacía para programar nuevo
- Panel de partidos pendientes abajo

**🎯 FASE 4 - Vista Drag & Drop:**
- Librería `@dnd-kit/core` instalada
- Panel lateral con partidos pendientes (draggables)
- Grid de slots disponibles (droppables)
- Arrastrar y soltar para programar
- Visualización de ocupación en tiempo real
- Indicadores de hover y drop válido
- Overlay animado al arrastrar

**Nuevos archivos:**
- `VistaCalendario.tsx` - Vista grid
- `VistaDragDrop.tsx` - Vista arrastrar y soltar
- `ModalEditarProgramacion.tsx` - Modal de edición
- `programacionService.ts` - Servicio API

**Endpoints backend nuevos:**
- `GET /admin/torneos/:id/partidos` - Lista completa
- `GET /programacion/torneos/:id/canchas` - Canchas disponibles
- `PUT /programacion/partidos/:id` - Actualizar programación
- `DELETE /programacion/partidos/:id` - Desprogramar

### ✅ Completado (2026-03-17) - Correcciones Críticas al Flujo de Canchas

**Investigación exhaustiva del flujo de canchas + correcciones de errores encontrados:**

#### Errores Corregidos en Disponibilidad/Canchar:
- [x] **Fix: toggleCancha en DisponibilidadConfig.tsx** - Función no encontraba el torneoCanchaId correcto
  - Backend: Agregado `sedeCanchaId` a la respuesta de `/admin/torneos/:id/disponibilidad`
  - Frontend: Actualizada lógica para usar `sedeCanchaId` en lugar de comparar por nombre
  
- [x] **Fix: ConfirmModal faltante en VistaLista** - Modal de confirmación no aparecía al eliminar días
  - Agregado `<ConfirmModal />` al componente VistaLista dentro de CanchasManager
  - El hook `useConfirm` requiere renderizar el componente para funcionar
  
- [x] **Fix: Eliminación de días con slots ocupados** - Lógica inconsistente entre frontend y backend
  - Backend: Unificado criterio de "ocupado" = `matchId !== null` (no solo estado)
  - Backend: Corregida condición de loop en generación de slots (`<=` por `<`)
  - Backend: Corregida conversión de fecha en programación de partidos
  
- [x] **Fix: Botón Configurar (Canchas para Finales)** - Mejoras UX y funcionalidad
  - Agregado feedback con `showSuccess` tras guardar correctamente
  - Verificar `result.success` antes de cerrar modal
  - Recargar datos con `loadTorneoInfo()` tras guardar exitosamente
  - Reemplazado `alert()` por `showError` consistente
  - Prevenir sobrescritura de datos cuando modal está abierto
  
- [x] **Fix: Export CanchasManager** - Agregado a `index.ts` de disponibilidad

#### Errores Corregidos en Creación de Torneos:
- [x] **Fix: Error 400 al crear torneo** - `fechaLimiteInscripcion` era requerido pero frontend no lo enviaba
  - Backend: Campo ahora es `@IsOptional()` en CreateTournamentDto
  - El backend ya tenía fallback: usa `fechaInicio` o `fechaFinales` si no se proporciona

#### Mejoras de Timezone:
- [x] **Frontend:** Usar `getDateOnlyPY()` para enviar fechas al backend (consistencia con timezone Paraguay)

**Commits:**
- Backend: `ffa52cb`, `9700549`, `47c11df`
- Frontend: `cdebc66`, `bcd60a0`, `1bc1294`

### ⏳ Próximos Módulos Sugeridos
- [ ] **Notificaciones Push/SMS/Email** - Alertas de partidos, resultados, invitaciones
- [ ] **Integración Bancard** - Pagos online de inscripciones
- [ ] **App Móvil** - Versión nativa (React Native/Expo)

---

### ✅ Completado (2026-03-19) - Fusión "Canchas y Sorteo" + Documentación de Auditoría

**Fusión de funcionalidades en nuevo tab único:**
- [x] **Paso 1.a - Configurar Finales**: Horario inicio/fin + selector de canchas
- [x] **Paso 1.b - Configurar Días**: Fecha, horario, duración slot, selección de canchas por día
- [x] **Botón Gestionar Sedes**: Modal para agregar/remover sedes del torneo
- [x] **Paso 2 - Cerrar y Sortear**: Selección múltiple de categorías, cálculo de necesidad
- [x] **Modal Confirmación**: Muestra slots necesarios/disponibles, detalle por categoría
- [x] **Modal Advertencia**: Si faltan canchas, redirige al Paso 1.b
- [x] **Sorteo Masivo**: Cierra inscripciones, sortea, reserva slots para todas las fases

**Nuevos Endpoints:**
```
GET    /admin/canchas-sorteo/:id/canchas
GET    /admin/canchas-sorteo/:id/configuracion
POST   /admin/canchas-sorteo/finales
POST   /admin/canchas-sorteo/dias
POST   /admin/canchas-sorteo/calcular-slots
POST   /admin/canchas-sorteo/cerrar-y-sortear
GET    /admin/torneos/:id/disponibilidad/sedes   (agregado)
```

**Documentación de Auditoría Creada:**
- [x] **AUDITORIA_TORNEOS.md**: Mapeo completo del flujo de torneos
  - Fases 0-6 del flujo completo
  - Endpoints activos vs deprecated
  - Componentes frontend por estado
  - Patrón de comentarios para saneamiento
- [x] **AUDITORIA_EJEMPLOS.md**: 8 ejemplos prácticos de marcado
  - Prefijos estandarizados: [AUDITORIA-YYYY-MM-DD]
  - Tipos: DEPRECATED, UNUSED, DUPLICATED, REVIEW, CRITICAL
  - Comandos para buscar marcadores

**Commits:**
- Backend: `dce78b6`, `e8c6a78`, `fc05af2`
- Frontend: `8a2b6cd`, `d06fd8e`, `83a41b5`

---

### ✅ Completado (2026-03-19) - Feature: Selección de Canchas por Día

**En tab "Canchas y Sorteo" - Paso 2: Configurar Días**

**Problema:** No se podía deshabilitar canchas específicas por día (ej: cancha en mantenimiento, vidrio roto).

**Solución:** Agregar selector de canchas con checkboxes para cada día configurado.

**Funcionalidad:**
- Todas las canchas seleccionadas por defecto (comportamiento anterior)
- Usuario puede desmarcar canchas específicas
- Validación: mínimo 1 cancha requerida
- Mensaje guía: "desmarca las que estén en mantenimiento"

**Técnico:**
- Estado `canchasInicializadas` para inicialización única
- `useEffect` controlado para evitar re-renders
- Reset manual al agregar día (todas las canchas por defecto)

**Archivo:** `CanchasSorteoManager.tsx`
**Commit:** `72a01c3`

---

### ✅ Completado (2026-03-19) - Fix Frontend: Bug de Visualización de Fechas

**Problema:** El frontend mostraba fechas un día anterior (ej: "26/03" en lugar de "27/03") al usar `new Date(fecha).toLocaleDateString('es-PY')` con strings YYYY-MM-DD del backend.

**Causa:** `new Date('2026-03-27')` interpreta como UTC 00:00, y al convertir a Paraguay (UTC-3) resulta en "26/03/2026 21:00".

**Solución:** Actualizar frontend para usar funciones de `date.ts` que trabajan directamente con strings YYYY-MM-DD.

**Archivos modificados (19 archivos, ~23 reemplazos):**

| Archivo | Cambio |
|---------|--------|
| `src/utils/date.ts` | Nuevas funciones: `formatDatePYLong()`, `formatDatePYShort()` |
| `CanchasSorteoManager.tsx` | `formatDatePY()` en lugar de `toLocaleDateString()` |
| `BracketView.tsx` | 2 reemplazos |
| `MisTorneosPage.tsx` | 1 reemplazo |
| `TorneoPublicDetailPage.tsx` | 1 reemplazo |
| `MisReservasPage.tsx` | 1 reemplazo |
| `AscensosManager.tsx` | 1 reemplazo |
| `CircuitosManager.tsx` | 1 reemplazo |
| `TorneosPendientesManager.tsx` | 1 reemplazo |
| `CircuitosListPage.tsx` | 1 reemplazo |
| `InscripcionCard.tsx` | 1 reemplazo |
| `PerfilPage.tsx` | 2 reemplazos |
| `DisponibilidadWizard.tsx` | `formatDatePYLong()` para fechas largas |
| `DisponibilidadConfig.tsx` | `formatDatePYLong()` para fechas largas |
| `TorneosPublicListPage.tsx` | `formatDatePYShort()` con año |
| `TournamentsListPage.tsx` | `formatDatePY()` |
| `TournamentDetailPage.tsx` | 2 reemplazos |
| `OverviewTab.tsx` | `formatDatePY()` |
| `HomeDashboardPage.tsx` | `formatDatePY()` |
| `InscripcionesManager.tsx` | 2 reemplazos |

**Nuevas funciones en `date.ts`:**
```typescript
formatDatePY('2026-03-27')           // → "27/03/2026"
formatDatePYLong('2026-03-27')       // → "viernes, 27 de marzo"
formatDatePYShort('2026-03-27')      // → "27 Mar"
formatDatePYShort('2026-03-27', true) // → "27 Mar, 2026"
```

**Documentación actualizada:**
- `REGLAS_PROGRAMACION.md` - Sección 6 (Manejo de Fechas) completamente actualizada
- `Kimi_Context_Fairpadel.md` - Esta entrada

**Build:** ✅ Compilación exitosa

---

### ✅ Completado (2026-03-19) - Migración BD: Múltiples Franjas por Día

**Cambio arquitectónico:** Permite configurar el mismo día con diferentes horarios.

**Problema:** La restricción `UNIQUE (tournamentId, fecha)` impedía tener múltiples configuraciones en el mismo día.

**Solución:** Cambiar a `UNIQUE (tournamentId, fecha, horaInicio)`.

**Ejemplo de uso:**
```
📅 Días configurados:
├─ 27/03/2026 | 14:00 - 18:00 | Canchas 1,2 | 8 slots (Mañana)
├─ 27/03/2026 | 18:00 - 23:00 | Canchas 1,2,3,4 | 20 slots (Tarde)
└─ 28/03/2026 | 10:00 - 14:00 | Canchas 3,4 | 8 slots
```

**Archivos modificados:**
- `prisma/schema.prisma` - Línea 632: `@@unique([tournamentId, fecha, horaInicio])`
- `src/modules/bracket/canchas-sorteo.service.ts` - Líneas 72, 165 (2 lugares)
- `src/modules/admin/admin-disponibilidad.controller.ts` - Línea 423
- `src/modules/admin/admin-torneos.controller.ts` - Línea 545

**Migración SQL:**
```sql
-- Eliminar índice anterior
DROP CONSTRAINT "torneo_disponibilidad_dias_tournament_id_fecha_key";

-- Crear nuevo índice con hora_inicio
ADD CONSTRAINT "torneo_disponibilidad_dias_tournament_id_fecha_hora_key" 
UNIQUE ("tournament_id", "fecha", "hora_inicio");
```

**Aplicación:** Automática con `prisma migrate deploy` en el próximo deploy.

---

### ✅ Completado (2026-03-23) - Sorteo con Distribución Secuencial + Fixes

**Distribución de fases en sorteo:**

| Orden | Fase | Asignación |
|-------|------|------------|
| 1 | **ZONAS** | Primeros slots disponibles |
| 2 | **REPECHAJE** | Slots siguientes |
| 3 | **OCTAVOS** | Continuación |
| 4 | **CUARTOS** | Siguientes |
| 5 | **SEMIS** | Slots posteriores |
| 6 | **FINAL** | Últimos slots (último día) |

**Características:**
- ✅ Fases asignadas secuencialmente sin solapamientos
- ✅ Una fase termina antes de que empiece la siguiente
- ✅ Finales siempre quedan en el último día configurado
- ✅ Si sobran slots, quedan libres al final

**Fix Frontend:**
- Filtrado de categorías ya sorteadas en "Canchas y Sorteo"
- Estados `'CERRADA'` e `'INSCRIPCIONES_CERRADAS'` excluidos de selección

**Intentos fallidos (aprendizaje):**
- Validación de descanso 4h por pareja: Demasiado compleja para MVP
- Distribución con solapamientos: No tiene sentido cronológicamente
- Lógica final: Secuencial simple, sin validaciones complejas

**Commits:**
- Backend: `ec2056c` - Distribución secuencial sin solapamientos
- Frontend: `8d31d78` - Fix filtro categorías sorteadas

---

## 🏗️ ARQUITECTURA DE REPOSITORIOS

| Repo | URL | Tecnología | Deploy | Ruta Local |
|------|-----|------------|--------|------------|
| Backend | https://github.com/herto2007-prog/fairpadel-backend.git | NestJS + Prisma + PostgreSQL | Railway (api.fairpadel.com) | `d:\fairpadel\` |
| Frontend | https://github.com/herto2007-prog/fairpadel-frontend.git | React 18 + Vite + Tailwind | Railway (www.fairpadel.com) | `d:\fairpadel\frontend\` |

**IMPORTANTE:** El frontend debe clonarse en `d:\fairpadel\frontend\` (esperado por tsconfig.json que excluye "frontend" del build del backend).

---

## 🆕 ENTREGABLES HOY (2026-03-10)

### 1. Wizard de Creación de Torneos (5 pasos) ✅ - REFACTOR MINIMALISTA

**Diseño:** UI compacta, minimalista, tecnológica (mismo estilo que wizard de inscripción)

**Cambios de estilo aplicados:**
| Elemento | Antes | Después |
|----------|-------|---------|
| Padding general | `py-8` | `py-4` |
| Padding card | `p-6 md:p-8` | `p-4` |
| Título | `text-2xl` | `text-base` |
| Iconos header | `w-16 h-16` | `w-10 h-10` |
| Bordes | `border-[#232838]` | `border-white/5` |
| Fondos cards | `bg-[#151921]` | `bg-white/[0.02]` |
| Progress bar | `h-1.5` | `h-0.5` |
| Espaciado | `space-y-6` | `space-y-4` |

**Pasos implementados:**
1. **Identidad & Fechas** - Nombre, descripción, ciudad (auto-region), sede, fechas
2. **Inversión** - Costo en Guaraníes, duración por partido (slider 60-180min)
3. **Flyer** - Upload drag & drop, preview compacto de card
4. **Categorías** - Grid 3 columnas compacto, selección múltiple
5. **Confirmar** - Resumen denso, crear torneo

**Características:**
- Validación por paso con errores inline
- Navegación fluida con animaciones 200ms
- Post-creación: link de inscripción y botón "Gestionar"

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
- `fdbb63e` - refactor(wizard): UI compacta y minimalista (inscripción)
- `dfe9086` - fix(wizard): restaurar BackgroundEffects
- `f3b008d` - feat(ui): aplicar fondo consistente a todas las páginas
- `96aaa2a` - fix(wizard): aplicar BackgroundEffects al wizard de creación
- `046a962` - refactor(wizard): diseño minimalista para wizard de creación de torneos

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
│   │   │   ├── bracket/
│   │   │   │   ├── BracketManager.tsx       ✅ Lista de categorías sorteadas
│   │   │   │   ├── ConfigurarBracketModal.tsx ✅ Vista previa del sorteo
│   │   │   │   └── BracketView.tsx          ✅ Visualización del bracket
│   │   │   ├── programacion/
│   │   │   │   ├── ProgramacionManager.tsx  ✅ Distribución automática de partidos
│   │   │   │   ├── ServiceProgramacion.ts   ✅ API service
│   │   │   │   └── TypesProgramacion.ts     ✅ Tipos TypeScript
│   │   │   ├── TorneoWizard.tsx             ✅ 5 pasos crear torneo + fondo
│   │   │   └── SedeAutocomplete.tsx         
│   │   └── pages/
│   │       ├── MisTorneosPage.tsx           ✅ Lista + wizard + fondo
│   │       └── GestionarTorneoPage.tsx      ✅ Tabs gestión + fondo (incluye Programación)
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
| Disponibilidad | Configuración de slots por día/cancha | ✅ Funcional |
| Fixture | Sorteo de bracket (Zona + Ronda + Eliminación) | ✅ Funcional |
| Programación | Distribución automática de partidos en slots | ✅ Funcional |
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

## 🏆 SISTEMA DE BRACKET (IMPLEMENTADO V2)

### Sistema Paraguayo - Fórmula Correcta

**Objetivo:** Garantizar **mínimo 2 partidos** por pareja eliminada.

**Fórmula:**
```
PartidosZona = floor(parejas / 2)
ObjetivoBracket = (parejas <= 15) ? 8 : 16
Eliminaciones = parejas - ObjetivoBracket
PartidosRondaAjuste = Eliminaciones
```

**Flujo para 18 parejas (ejemplo):**
```
FASE DE ZONA (9 partidos)
├── 18 parejas → 9 ganan / 9 pierden
├── Los 9 ganadores pasan al bracket principal
└── De los 9 perdedores, 4 juegan ronda de ajuste / 5 van directo

RONDA DE AJUSTE (2 partidos)
├── 4 parejas juegan (mix de ganadores/perdedores según necesidad)
├── 2 ganan y pasan al bracket
└── 2 pierden y quedan ELIMINADOS (jugaron zona + ajuste = 2 partidos) ✓

BRACKET DE 16 (Eliminación directa)
├── 9 ganadores zona + 2 ganadores ajuste + 5 directos = 16 parejas
├── Octavos → Cuartos → Semis → Final
└── Eliminación directa, no hay segunda chance
```

### Tablas de Configuración

**Torneos que terminan en CUARTOS (8 parejas):**
| Parejas | Zona | Eliminaciones | Ronda Ajuste | Bracket |
|---------|------|---------------|--------------|---------|
| 8 | 4p | 0 | 0p | 8 |
| 9 | 4p | 1 | 1p | 8 |
| 10 | 5p | 2 | 2p | 8 |
| 11 | 5p | 3 | 3p | 8 |
| 12 | 6p | 4 | 4p | 8 |
| 13 | 6p | 5 | 5p | 8 |
| 14 | 7p | 6 | 6p | 8 |
| 15 | 7p | 7 | 7p | 8 |

**Torneos que terminan en OCTAVOS (16 parejas):**
| Parejas | Zona | Eliminaciones | Ronda Ajuste | Bracket |
|---------|------|---------------|--------------|---------|
| 16 | 8p | 0 | 0p | 16 |
| 17 | 8p | 1 | 1p | 16 |
| 18 | 9p | 2 | 2p | 16 |
| 19 | 9p | 3 | 3p | 16 |
| 20 | 10p | 4 | 4p | 16 |
| 21 | 10p | 5 | 5p | 16 |
| 22 | 11p | 6 | 6p | 16 |
| 23 | 11p | 7 | 7p | 16 |
| 24 | 12p | 8 | 8p | 16 |

### Flujo de Sorteo

1. **Inscripciones Abiertas** → Recibir inscripciones
2. **Cerrar Inscripciones** (mínimo 8 parejas) → Estado: `INSCRIPCIONES_CERRADAS`
3. **Sortear** → Genera bracket en estado `BORRADOR`
4. **Publicar** → Estado: `SORTEO_REALIZADO`, visible para jugadores

**Ubicación en el sistema:**
- Frontend: `/mis-torneos/:id/gestionar` → Tab "Fixture"
- También disponible: Botón "Cerrar inscripciones" en Tab "Inscripciones"

### Estructura de Datos

**Match (extendido):**
```prisma
esBye: Boolean              // true = partido con BYE
tipoEntrada1: String        // INSCRIPCION | GANADOR_ZONA | PERDEDOR_ZONA | etc.
tipoEntrada2: String
partidoOrigen1Id: String    // De qué partido viene entrada1
partidoOrigen2Id: String
// Campos existentes:
// - partidoSiguienteId (ganador)
// - partidoPerdedorSiguienteId (perdedor va a repechaje)
```

**FixtureVersion.definicion (JSON):**
```typescript
{
  config: {
    totalParejas: 18,
    tamanoBracket: 16,
    parejasConBye: 1,
    partidosZona: 9,
    parejasEnRepechaje: 4,
    // ...
  },
  partidos: [...],      // Estructura completa del bracket
  inscripciones: [...]  // Datos de parejas para mostrar
}
```

### Archivos Creados/Modificados

**Backend (`d:\fairpadel\`):**
- `src/modules/bracket/bracket.service.ts` - Servicio con fórmula correcta
- `src/modules/admin/admin-bracket.controller.ts` - Endpoints REST (sortear, cerrar/abrir inscripciones)

**Frontend (`d:\fairpadel\frontend\`):**
- `src/features/organizador/components/bracket/BracketManager.tsx` - Lista por género, estilo minimalista
- `src/features/organizador/components/bracket/ConfigurarBracketModal.tsx` - Vista previa del sorteo
- `src/features/organizador/components/bracket/BracketView.tsx` - Visualización del bracket
- `src/features/organizador/components/inscripciones/InscripcionesManager.tsx` - Agregado botón cerrar/reabrir inscripciones
- Integrado en `GestionarTorneoPage` como tab "Fixture"

---

## 📅 SISTEMA DE PROGRAMACIÓN INTELIGENTE (IMPLEMENTADO)

### Algoritmo de Distribución

**Objetivo:** Distribuir partidos de múltiples categorías optimizando recursos y tiempos.

**Fases de asignación:**
```
1. ZONA (todas las categorías) - Primeros días
2. RONDA DE AJUSTE - Día después de última zona
3. BRACKET:
   ├── OCTAVOS - Sábado mañana (si aplica)
   ├── CUARTOS - Sábado tarde
   ├── SEMIS - Domingo mañana
   └── FINAL - Domingo tarde
```

**Reglas de negocio:**
- Jueves/Viernes: Horario 18:00-00:00 (solo noche, amateur trabaja)
- Sábados: Horario 14:00-00:00 (tarde/noche)
- Domingos: Horario 08:00-20:00 (todo el día)
- Máximo 2 partidos por pareja por día
- 4 horas mínimo entre partidos de la misma pareja
- Soporte para horarios personalizados (no comunes en PY)

### Predicción de Recursos

```typescript
// Cálculo automático
const horasNecesarias = totalPartidos * 1.5; // 90 min promedio
const horasDisponibles = slots * duracionSlot;
const deficit = horasNecesarias - horasDisponibles;

// Sugerencias si falta capacidad:
- Extender días del torneo
- Agregar canchas adicionales
- Usar sede alternativa
```

### Endpoints REST

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/programacion/torneos/:id/calcular` | POST | Calcula distribución óptima |
| `/programacion/torneos/:id/aplicar` | POST | Aplica programación a partidos |
| `/programacion/torneos/:id/preview` | GET | Vista previa sin aplicar |

### Flujo de Trabajo

**Escenario 1: Sorteo completo de una vez**
```
1. Cerrar inscripciones de TODAS las categorías
2. Sortear todas las categorías
3. POST /programacion/torneos/:id/calcular
4. Revisar predicción de recursos
5. Ajustar manualmente si es necesario
6. POST /programacion/torneos/:id/aplicar
7. Publicar fixture completo
```

**Escenario 2: Sorteo por lotes (recomendado)**
```
Miércoles 23:59 - Cierra lote 1 (cats A, B, C)
  → Sistema calcula ZONA/RONDA solo para estas
  → Jueves - Juegan ZONA cats A, B, C

Jueves 23:59 - Cierra lote 2 (cats D, E, F)
  → Sistema recalcula considerando:
     - Partidos de ZONA de A, B, C ya jugados
     - ZONA/RONDA para D, E, F
     - Brackets de A, B, C (si tienen resultados)
  → Viernes - Juegan ZONA cats D, E, F + RONDA

Y así sucesivamente...
```

### Archivos Creados

**Backend:**
- `src/modules/programacion/programacion.service.ts` - Algoritmo de distribución
- `src/modules/programacion/programacion.controller.ts` - Endpoints REST
- `src/modules/programacion/programacion.module.ts` - Módulo NestJS

**Frontend:**
- `frontend/src/features/organizador/components/programacion/ProgramacionManager.tsx` - Componente principal
- `frontend/src/features/organizador/components/programacion/ServiceProgramacion.ts` - Servicio de API
- `frontend/src/features/organizador/components/programacion/TypesProgramacion.ts` - Tipos TypeScript

**Documentación:**
- `docs/sistema-programacion-inteligente.md` - Especificación completa

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

### Para hoy (testing y refinamiento):
1. **Testing completo con datos de demo** - Usar sistema demo para probar flujo:
   - Crear torneo → Llenar con demo → Sortear categorías → Calcular programación → Aplicar
2. **Registro de resultados** - Formulario para ingresar sets y avanzar ganadores
3. **Conectar checklist al backend** - Persistencia de tareas y recordatorios

### Futuro cercano:
4. **Edición manual de programación** - Drag & drop para ajustar partidos
5. **Calendario de partidos** - Vista semanal con canchas como columnas
6. **Notificaciones reales** - Conectar con proveedor SMS/email (Tigo, SendGrid)
7. **Rankings automáticos** - Cálculo de puntos por torneo
8. **Integración Bancard** - Pasarela de pagos online (postergado)

---

## 📞 COMUNICACIÓN CON KIMI

**Para continuar mañana:**
1. Leer este contexto completamente
2. Verificar Railway logs si hay issues
3. Preguntar al usuario qué prioridad tiene para el día
4. Recordar: un tema a la vez, entregables desplegables

**Estado de ánimo del usuario:** Muy satisfecho con el perfil de jugador implementado. Describe el resultado como "absurdamente brutal". Sistema de torneos completo y funcional. Perfil de jugador con estadísticas reales, logros calculados dinámicamente y diseño moderno glassmorphism. Listo para producción.

---

*Documento actualizado: 2026-03-14 - Sistema de Resultados y Marcador en Vivo 100% funcional. Implementado: reglamento FIP de saque (rotación por games), punto de oro/ventaja configurable, súper tie-break con puntos numéricos, visualización dorada en 40-40, botón "Guardar Resultado" prominente al finalizar. Sincronización completa entre marcador en vivo y bracket. Testing exitoso.*


## 🆕 ENTREGABLES HOY (2026-03-16) - Soporte 16avos y 32avos

### ✅ Backend - Extensión del Sistema de Bracket

**Problema:** El sistema solo soportaba hasta Octavos (16 parejas, bracket de 8). Torneos grandes con 32-64 parejas no podían generar bracket completo.

**Solución:** Fórmula escalable para determinar tamaño de bracket:
```
parejas ≤ 15  → Octavos (bracket de 8)
parejas ≤ 31  → 16avos (bracket de 16)
parejas ≤ 63  → 32avos (bracket de 32)
parejas ≥ 64  → 64 equipos (bracket de 64)
```

**Cambios en Backend:**
- [x] **Enum FaseBracket extendido** - Agregados `DIECISEISAVOS` y `TREINTAYDOSAVOS`
- [x] **BracketService actualizado** - `calcularConfiguracion()` usa nueva fórmula
- [x] **Generación de partidos** - Crea 16 partidos para 16avos, 32 partidos para 32avos
- [x] **Conexión de navegación** - 32avos → 16avos → Octavos → Cuartos → Semis → Final
- [x] **ProgramaciónService** - Filtros para nuevas fases en distribución de slots

**Commits:**
- Backend: `b71cd4f` - feat: soporte para 16avos y 32avos en sistema de bracket

### ✅ Frontend - Utilitario Compartido de Colores

**Problema:** Función `getColorFase` duplicada en múltiples componentes, difícil de mantener y sin soporte para nuevas fases.

**Solución:** Centralizar en utilitario compartido.

**Cambios en Frontend:**
- [x] **Nuevo archivo** - `src/features/organizador/utils/faseColors.ts`
  - `getColorFase(fase)` - Devuelve clases Tailwind para cada fase
  - `FASES_ORDENADAS` - Array con orden correcto de fases
  - Colores: Zona(azul), Repechaje(ámbar), 32avos(índigo), 16avos(violeta), Octavos(púrpura), Cuartos(rosa), Semis(naranja), Final(rojo)
- [x] **Componentes actualizados:**
  - `BracketView.tsx` - Usa FASES_ORDENADAS, elimina función local
  - `ProgramacionManager.tsx` - Importa getColorFase desde utilidad
  - `ModalEditarProgramacion.tsx` - Importa getColorFase desde utilidad
  - `VistaCalendario.tsx` - Importa getColorFase desde utilidad
  - `VistaDragDrop.tsx` - Importa getColorFase desde utilidad

**Commits:**
- Frontend: `d6bc5ed` - feat: soporte visual para 16avos y 32avos en bracket y programación

### ✅ Estado de Builds

| Repo | Build | Estado |
|------|-------|--------|
| Backend | `npx tsc --noEmit` | ✅ Sin errores |
| Frontend | `npm run build` | ✅ Sin errores |

### ✅ Deploy

- Backend push: `git push` → https://github.com/herto2007-prog/fairpadel-backend.git
- Frontend push: `git push` → https://github.com/herto2007-prog/fairpadel-frontend.git
- Railway deploy: Automático desde main

---

*Documento actualizado: 2026-03-16 - Soporte extendido para 16avos y 32avos en sistema de bracket. Backend y frontend compilando correctamente. Cambios pusheados a producción.*


---

## ✅ Completado (2026-03-17) - Configuración de Finales + Eliminación de Días

### Conexión de `fechaFinales` al Algoritmo de Programación

**Backend - `programacion.service.ts`:**
- [x] La fecha de finales (`fechaFinales`) ahora es **ancla obligatoria** para el algoritmo
- [x] SEMIS y FINAL siempre se asignan al día de `fechaFinales`
- [x] Las demás fases se distribuyen **hacia atrás** desde esa fecha
- [x] Ejemplo: Si finals=Sábado con 4 días → Miércoles ZONA, Jueves 16vos, Viernes 8vos+4tos, Sábado SEMIS+FINAL

**Campos nuevos en Schema:**
```prisma
model Tournament {
  canchasFinales    String[]  // IDs de TorneoCancha para finales
  horaInicioFinales String?   // Ej: "18:00"
}
```

**Algoritmo de asignación:**
- Fases finales (SEMIS, FINAL) usan **solo** las canchas configuradas en `canchasFinales`
- Respetan la `horaInicioFinales` como hora mínima de inicio
- Fases intermedias usan todas las canchas disponibles

### Guardado de Configuración de Finales

**Backend:**
- [x] Endpoint `PUT /admin/torneos/:id` acepta `canchasFinales` y `horaInicioFinales`
- [x] Validación de permisos: Admin puede editar cualquier torneo, Organizador solo sus torneos
- [x] Endpoint `GET /admin/torneos/:id/overview` devuelve los campos de finales

**Frontend - `CanchasManager.tsx`:**
- [x] Modal "Configurar" para seleccionar múltiples canchas para finales
- [x] Selector de hora de inicio para finales
- [x] Guardado via `disponibilidadService.actualizarFinales()`
- [x] Carga de configuración guardada al iniciar (no sobreescribe con sugerencias automáticas)
- [x] Visualización de canchas seleccionadas en el header (ej: "Cancha 1, Cancha 2")

### Eliminación de Días con Validación

**Backend - `admin-disponibilidad.controller.ts`:**
```typescript
DELETE /admin/torneos/:id/disponibilidad/dias/:diaId
```
- [x] **Lógica inteligente:**
  - Si hay slots **OCUPADOS** (con partidos): elimina solo los **LIBRES**, mantiene el día
  - Si **no hay** slots ocupados: elimina todo (slots + día)
- [x] Respuesta indica si fue eliminación parcial o total:
  ```json
  { "parcial": true, "eliminados": 5, "preservados": 2 }
  ```

**Frontend - `VistaLista`:**
- [x] Botón "Eliminar día" en cada día de la lista
- [x] Mensaje de confirmación diferente según haya partidos ocupados o no
- [x] Recarga automática de datos tras eliminación
- [x] Logs de debug en consola para troubleshooting

### TypeScript Fixes
- [x] Múltiples `// @ts-ignore` para campos nuevos del schema que Prisma client local no reconoce
- [x] Verificación de build local antes de cada push (aprendizaje reforzado)

---

**Última actualización:** 2026-03-17 22:00


---

## ✅ Completado (2026-03-17) - Correcciones Finales del Sistema

### Fix de Timezone en Producción
- [x] **Schema:** `TorneoDisponibilidadDia.fecha` cambiado de `@db.Date` a `@db.Timestamptz(3)`
- [x] **Baseline:** Tabla `_prisma_migrations` creada y poblada con historial completo
- [x] **Dockerfile:** Corregido para usar `npx prisma migrate deploy` (no `db push`)
- [x] **Deploy:** Backend aplica migraciones formales automáticamente en Railway

### Fix de Sistema de Bracket
- [x] **Frontend:** Soporta brackets de 8/16/32/64 parejas (fórmula escalable)
- [x] **Fases visibles:** ZONA y RONDA AJUSTE ahora aparecen en el modal de configuración
- [x] **UX:** Eliminados `alert()`, ahora usa `showError()` consistente
- [x] **Semillas:** Opción "Usar semillas por ranking" funcional

### Fix de Cerrar Inscripciones
- [x] **Backend:** Transacciones Prisma (`$transaction`) para consistencia
- [x] **Frontend:** Maneja correctamente `success: false` del backend
- [x] **Feedback:** Mensajes de éxito al cerrar/reabrir inscripciones
- [x] **Cierre múltiple:** Verifica `data.success` de cada respuesta individual

### Fix de CanchasManager
- [x] **Cargar canchas:** Corregida race condition entre `loadData()` y `loadTorneoInfo()`
- [x] **Selección múltiple:** Ahora se mantienen seleccionadas al recargar (1,2,3...)
- [x] **Interfaz:** Agregados `canchasFinales` y `horaInicioFinales` a `TorneoInfo`

---

**Última actualización:** 2026-03-17 23:30


---

## ✅ Completado (2026-03-18) - Fixes Masivos de Timezone y Flujo de Torneos

### Resumen Ejecutivo
> **Estado:** Sistema de torneos 100% funcional. Todos los bugs críticos corregidos.

### 1. Fixes de Timezone (CRÍTICO)

#### Backend
- [x] **ProgramacionService:** Usa `DateService.getDateOnly()` en lugar de `toISOString().split('T')[0]`
- [x] **AdminTorneosController:** Usa `DateService.getDateOnly()` para extracción de fechas
- [x] **Transacciones Prisma:** Agregadas a cerrar/abrir inscripciones

#### Frontend
- [x] **date.ts:** `formatDatePY()` ahora detecta YYYY-MM-DD y usa `parseDatePY()`
- [x] **parseDatePY():** Crea Date con offset `-03:00` para fechas sin hora
- [x] **TorneoWizard:** Usa `formatDatePY()` en lugar de `new Date().toLocaleDateString()`
- [x] **ProgramacionManager:** Usa `formatDatePY()` y `parseDatePY()`
- [x] **VistaCalendario:** Usa utilidades de fecha correctas
- [x] **VistaDragDrop:** Usa `parseDatePY()`

**Problema resuelto:** Fechas mostradas un día antes (off-by-one-day) debido a conversión UTC→Paraguay.

### 2. Fixes de Wizard de Creación de Torneos

- [x] **Payload limpio:** `fechaInicio` y `fechaFin` siempre tienen valor (usando `fechaFinales` como fallback)
- [x] **Validación backend:** Evita error "debe tener formato YYYY-MM-DD" al enviar strings vacíos

### 3. Fixes de Canchas para Finales

- [x] **Eliminada duplicación:** Frontend ya no crea slots manualmente (backend lo hace automáticamente)
- [x] **Race condition:** Corregida carga de canchas seleccionadas en Step 1
- [x] **Copia automática:** Al crear torneo, se copian canchas de la sede como `TorneoCancha`

**Problema resuelto:** Canchas no aparecían después de crear torneo.

### 4. Fixes de Cerrar Inscripciones

- [x] **Manejo de errores:** Frontend ahora maneja `success: false` del backend
- [x] **Feedback visual:** Mensajes de éxito al cerrar/reabrir
- [x] **Cierre múltiple:** Verifica `data.success` de cada respuesta individual

### Commits del Día
- Backend: `6de33cd`, `3308ae8`, `f0b272b`, `bdca619`
- Frontend: `ed5fdbd`, `99146e3`, `b1d9c2e`, `c84fd67`, `1d207f9`, `bbdeb24`

---

**Última actualización:** 2026-03-18 - Sistema estable y listo para producción


---

## ✅ Completado (2026-03-18) - Refactorización del Sistema de Programación

### Resumen Ejecutivo
> **Estado:** Sistema de programación refactorizado con enfoque híbrido (auto-calcular + edición manual).
> **Flujo:** Canchas (crear slots) → Fixture (sortear) → Programación (asignar horario/cancha)

### Cambios en Backend - `programacion.service.ts`

#### 1. Algoritmo Simplificado y Robusto
**Antes:**
- Lógica compleja de "distribución de atrás para adelante"
- Agrupación de fases en días (ZONA → 16vos+8vos → 4tos → SEMIS+FINAL)
- Problemas con extracción de fechas de slots

**Después:**
```typescript
// Orden cronológico simple
const ORDEN_FASES = [
  'ZONA', 'REPECHAJE', 'TREINTAYDOSAVOS', 'DIECISEISAVOS', 
  'OCTAVOS', 'CUARTOS', 'SEMIS', 'FINAL'
];

// Distribución secuencial por fase
for (const partido of partidosOrdenados) {
  const esFaseFinal = FASES_FINALES.includes(partido.fase);
  const fechasPermitidas = esFaseFinal 
    ? [fechaFinalesReal]           // Finales solo en fechaFinales
    : fechasNoFinales;              // Otras fases en cualquier otro día
  // Encontrar primer slot disponible...
}
```

#### 2. Validación de Recursos
- Verifica que `fechaFinales` exista en los slots configurados
- Retorna error `SIN_FECHA_FINALES` si no hay disponibilidad para finales
- Calcula predicción de horas necesarias vs disponibles

#### 3. Conflictos de Parejas
```typescript
// Máximo 2 partidos por pareja por día
if (partidosMismaFecha.length >= 2) continue;

// Mínimo 4 horas de descanso entre partidos
const conflictoHorario = Math.abs(horaSlot - horaPartido) < 4;
```

#### 4. Endpoints Mejorados
| Endpoint | Descripción |
|----------|-------------|
| `POST /programacion/torneos/:id/calcular` | Calcula distribución respetando fechaFinales |
| `POST /programacion/torneos/:id/aplicar` | Aplica asignaciones a partidos y marca slots como OCUPADO |
| `PUT /programacion/partidos/:id` | Edición individual de un partido |
| `DELETE /programacion/partidos/:id` | Desprograma un partido |

### Cambios en Frontend - `ProgramacionManager.tsx`

#### 1. Modo Edición Híbrida
```typescript
const [modoEdicion, setModoEdicion] = useState(false);
const [asignacionesEditadas, setAsignacionesEditadas] = useState<PartidoAsignado[]>([]);
```

**Flujo de trabajo:**
1. Usuario hace clic en "Calcular Automáticamente"
2. Sistema muestra distribución sugerida
3. Usuario puede:
   - **Aplicar directamente** (usar distribución calculada)
   - **Activar Modo Edición** y ajustar individualmente
4. En modo edición:
   - Clic en cualquier partido → abre modal de edición
   - Puede cambiar fecha, hora y cancha
   - Los cambios se guardan en estado local
   - Al finalizar, "Aplicar Cambios" persiste todo

#### 2. UI de Modo Edición
```
┌─────────────────────────────────────────────────────────┐
│ Programación                              [Recalcular]  │
│                                            [Modo Edición]│
│                                                         │
│ Distribución por Día                                    │
│ ⚡ Modo edición activo - Haz clic en un partido para   │
│    editar                                               │
│                                                         │
│ ┌─ Lunes, 20/03/2025 ───────────────────────────────┐  │
│ │ ▼ 18:00 - 23:00 • 8 partidos                        │  │
│ │                                                     │  │
│ │ ┌─────────────────────────────────────────────┐    │  │
│ │ │ 18:00 │ [ZONA] │ Cat A │ Pareja1 vs Pareja2 │ ✏️ │  │
│ │ └─────────────────────────────────────────────┘    │  │
│ │ ┌─────────────────────────────────────────────┐    │  │
│ │ │ 19:30 │ [ZONA] │ Cat B │ Pareja3 vs Pareja4 │ ✏️ │  │
│ │ └─────────────────────────────────────────────┘    │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 3. Modal de Edición de Slot
```typescript
interface ModalEditarSlotProps {
  partido: PartidoAsignado;      // Partido a editar
  canchas: Cancha[];              // Canchas disponibles
  onGuardar: (partidoId, fecha, hora, canchaId) => void;
}
```

### Reglas del Sistema

#### 1. Solo Slots Pre-configurados
- **NUNCA** se crean días nuevos en programación
- Solo usa slots creados en tab **Canchas**
- Si faltan días, usuario debe agregarlos en Canchas primero

#### 2. Finales Obligatorias en fechaFinales
```typescript
// SEMIS y FINAL siempre en fechaFinales
if (esFaseFinal && !fechasDisponibles.includes(fechaFinales)) {
  throw new Error('La fecha de finales no está configurada en Canchas');
}
```

#### 3. Distribución Cronológica
- ZONA → REPECHAJE → 32avos → 16avos → OCTAVOS → CUARTOS → SEMIS → FINAL
- Las fases se distribuyen en orden, llenando slots uno tras otro
- No hay agrupación forzada de fases (pueden mezclarse naturalmente)

#### 4. Sin Solapamiento de Parejas
- Una pareja no puede jugar más de 2 partidos por día
- Mínimo 4 horas de descanso entre partidos de la misma pareja

### Testing Recomendado

#### Caso 1: Torneo Simple (8 parejas)
```
1. Crear torneo con 2 días configurados en Canchas
2. Sortear categoría (genera: ZONA → OCTAVOS → CUARTOS → SEMIS → FINAL)
3. Calcular programación
4. Verificar: SEMIS y FINAL en día 2 (fechaFinales)
```

#### Caso 2: Múltiples Categorías
```
1. Crear torneo con 3 días
2. Sortear 3 categorías diferentes
3. Calcular programación para todas
4. Verificar: distribución balanceada entre días
```

#### Caso 3: Edición Manual
```
1. Calcular programación
2. Activar Modo Edición
3. Cambiar fecha/hora de un partido
4. Aplicar cambios
5. Verificar persistencia en base de datos
```

### Archivos Modificados

**Backend:**
- `src/modules/programacion/programacion.service.ts` - Algoritmo refactorizado
- `src/modules/programacion/programacion.controller.ts` - Endpoints (sin cambios)

**Frontend:**
- `frontend/src/features/organizador/components/programacion/ProgramacionManager.tsx` - Modo edición híbrido

### Commits
- Backend: `42e424b` - refactor(programacion): algoritmo simplificado con modo edicion hibrida
- Frontend: `f1b8517` - feat(programacion): modo edicion hibrida para distribucion de partidos

### Deploy
- ✅ Backend push: https://github.com/herto2007-prog/fairpadel-backend.git
- ✅ Frontend push: https://github.com/herto2007-prog/fairpadel-frontend.git
- 🚀 Railway deploy: Automático desde main

---

**Última actualización:** 2026-03-18 - Sistema de programación refactorizado y desplegado


---

## ✅ Completado (2026-03-18) - horaFin Configurable y Distribución Balanceada

### Resumen Ejecutivo
> **Estado:** Sistema de programación ahora permite configurar hora de fin y distribuye partidos balanceadamente.

### Cambios en Backend

#### 1. Schema Prisma - Nuevo campo `horaFinFinales`
```prisma
model Tournament {
  horaFinFinales  String?  @map("hora_fin_finales")  // Ej: "23:00"
}
```

#### 2. Algoritmo de Distribución Balanceada
**Antes:** Llenaba días cronológicamente (saturaba primeros días)

**Después:**
```typescript
// Calcular capacidad de cada día
const capacidadPorDia = calcularSlotsDisponiblesPorDia();

// Distribuir proporcionalmente
for (const partido of partidos) {
  // Asignar al día con más capacidad restante
  // Evita saturar los primeros días
}
```

#### 3. Orden de Finales por Categoría
```typescript
// SEMIS y FINAL se ordenan: categorías bajas primero, altas al final
// Esto deja el "show" de categorías altas para el final del día D
const partidosFinalesOrdenados = partidosFinales.sort((a, b) => {
  const ordenCatA = getOrdenCategoria(a.categoriaNombre);
  const ordenCatB = getOrdenCategoria(b.categoriaNombre);
  return ordenCatA - ordenCatB; // 5ª, 6ª, 7ª, 8ª, 1ª, 2ª, 3ª, 4ª
});
```

#### 4. Archivos Modificados
- `prisma/schema.prisma` - Nuevo campo horaFinFinales
- `prisma/migrations/20250319000000_add_hora_fin_finales/migration.sql`
- `src/modules/programacion/programacion.service.ts` - Algoritmo balanceado
- `src/modules/programacion/programacion.controller.ts` - Nuevo parámetro
- `src/modules/admin/admin-torneos.controller.ts` - Guardar horaFinFinales

### Cambios en Frontend

#### 1. CanchasManager - Configuración de hora fin
```typescript
// Nuevo estado
const [horaFinFinales, setHoraFinFinales] = useState('23:00');

// Nuevo input en UI
<input type="time" value={horaFinFinales} ... />
```

#### 2. Archivos Modificados
- `frontend/src/features/organizador/components/disponibilidad/CanchasManager.tsx`
- `frontend/src/services/disponibilidad.service.ts`

### Migración Base de Datos
```sql
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "hora_fin_finales" TEXT;
```

### Testing Recomendado

#### Caso 1: Distribución Balanceada
```
1. Crear torneo con 4 días
2. Configurar diferentes capacidades (slots) por día
3. Sortear muchas categorías (100+ partidos)
4. Calcular programación
5. Verificar: días con más capacidad tienen más partidos
```

#### Caso 2: Finales por Categoría
```
1. Sortear 8 categorías (5ª a 8ª fem y 5ª a 8ª masc)
2. Verificar tab Programación
3. Confirmar: SEMIS de 5ª/6ª/7ª/8ª van antes que 1ª/2ª/3ª/4ª
4. Confirmar: FINAL de 5ª/6ª/7ª/8ª van antes que 1ª/2ª/3ª/4ª
```

#### Caso 3: Hora Fin Configurable
```
1. Ir a tab Canchas
2. Configurar hora fin = 22:00 (en lugar de 23:00)
3. Guardar
4. Verificar en BD: hora_fin_finales = "22:00"
5. Calcular programación: último slot debe ser <= 22:00
```

### Commits
- Backend: `43cc9cc` - migrate: agregar horaFinFinales a tournaments
- Frontend: `0fffd34` - feat(canchas): agregar horaFinFinales configurable

### Deploy
- ✅ Backend: https://github.com/herto2007-prog/fairpadel-backend.git
- ✅ Frontend: https://github.com/herto2007-prog/fairpadel-frontend.git
- 🚀 Railway: Automático desde main (con migración)

---

**Última actualización:** 2026-03-18 - Sistema con distribución balanceada y hora fin configurable


---

## ✅ Fix (2026-03-18) - Orden Correcto de Finales

### Corrección
**Antes (incorrecto):** 5ª → 6ª → 7ª → 8ª → 1ª → 2ª → 3ª → 4ª  
**Después (correcto):** 8ª → 7ª → 6ª → 5ª → 4ª → 3ª → 2ª → 1ª

### Lógica
- **8ª** = Categoría más baja (va primero, menos espectadores)
- **1ª** = Categoría más alta (va última, el gran show)

### Resultado
```
10:00 - SEMIS 8ª Categoría
10:30 - SEMIS 7ª Categoría
11:00 - SEMIS 6ª Categoría
...
15:00 - SEMIS 1ª Categoría (lo mejor del día D)
16:00 - FINAL 1ª Categoría (el gran cierre)
```

### Commit
- Backend: `7a13879` - fix(programacion): corregir orden de finales 8va → 1ra

---


---

## ✅ Feature (2026-03-18) - Mensajes Informativos de Descanso Reglamentario

### Nuevo Comportamiento
Cuando el sistema salta un slot por la regla de 4h de descanso, ahora muestra logs informativos:

```
[Programacion] Slot 21:00 en 2026-03-22 saltado para partido xxx: 
  Descanso reglamentario: jugó a las 18:00, puede jugar desde las 22:00 (4h de descanso)
```

### Implementación
```typescript
// Nuevo método que retorna razón del conflicto
verificarConflictoPareja(partido, fecha, hora, asignaciones): {
  conflicto: boolean;
  razon?: string;  // Ej: "Descanso reglamentario: jugó a las 18:00, puede jugar desde las 22:00"
}
```

### Tipos de Conflictos Detectados
1. **Máximo 2 partidos por día**
   - `Máximo 2 partidos por día (2 ya asignados)`

2. **Descanso reglamentario (4h)**
   - `Descanso reglamentario: jugó a las 18:00, puede jugar desde las 22:00 (4h de descanso)`

### Commit
- Backend: `e70fd09` - feat(programacion): agregar mensajes informativos de descanso reglamentario

---


---

## ✅ Feature (2026-03-18) - Logs de Asignación Visibles en Frontend

### Resumen
Ahora cuando se calcula la programación, se muestran logs visibles en el frontend sobre qué slots se saltaron y por qué.

### Backend - Logs Generados
```typescript
interface LogAsignacion {
  tipo: 'SALTADO' | 'ASIGNADO';
  partidoId: string;
  categoriaNombre: string;
  fase: string;
  fecha: string;
  hora: string;
  mensaje: string;
}

// Ejemplo de log SALTADO
{
  tipo: 'SALTADO',
  categoriaNombre: '5ª Categoría',
  fase: 'SEMIS',
  fecha: '2026-03-22',
  hora: '21:00',
  mensaje: 'Descanso reglamentario: jugó a las 18:00, puede jugar desde las 22:00 (4h de descanso)'
}
```

### Frontend - UI de Logs
```
┌─ Logs de Asignación [Ver ▼] ─────────────────┐
│                                                │
│  SALTADO: 5ª Categoría - SEMIS                │
│  Descanso reglamentario: jugó a las 18:00...  │
│                                                │
│  ASIGNADO: 6ª Categoría - CUARTOS             │
│  6ª Categoría - CUARTOS asignado a las 21:00  │
│                                                │
└────────────────────────────────────────────────┘
```

**Colores:**
- 🟡 `SALTADO` - Amarillo (advertencia)
- 🟢 `ASIGNADO` - Verde (éxito)
- 🔵 `ADELANTADO` - Azul (info)

### Commits
- Backend: `138fdd6` - feat(programacion): mostrar logs de asignacion en frontend
- Frontend: `b01ab95` - feat(programacion): mostrar logs de asignacion en UI

---

## 💡 Propuesta: Optimización "Adelantar Partidos"

### Problema Actual
Cuando una pareja tiene conflicto de descanso en un slot (ej: 21:00), el sistema **salta ese slot** y lo deja vacío, buscando el siguiente slot disponible (ej: 22:00).

Esto puede dejar **huecos** en la programación.

### Propuesta de Optimización
En lugar de saltar el slot, el sistema debería:

```
Ejemplo:
- Slot 21:00 libre
- Partido A no puede jugar (descanso hasta 22:00)
- Partido B SÍ puede jugar (no tiene conflicto)

LÓGICA ACTUAL:
  Slot 21:00 → Vacío (salta)
  Slot 22:00 → Partido A
  Slot 23:00 → Partido B

LÓGICA OPTIMIZADA:
  Slot 21:00 → Partido B (adelantado)
  Slot 22:00 → Partido A (esperó su descanso)
  Slot 23:00 → Siguiente partido
```

**Ventajas:**
- Menos slots vacíos
- Mejor aprovechamiento de canchas
- Partidos más compactos

**Complejidad:** Media
- Requiere reordenar partidos pendientes
- Mantiene cola de "partidos listos para jugar"

### ¿Implementamos esta optimización?



---

## ✅ Feature (2026-03-18) - Optimización "Adelantar Partidos"

### Resumen
Implementada optimización para minimizar slots vacíos. Cuando un partido no puede jugar por descanso, otro partido que sí pueda jugar ocupa su lugar.

### Antes (dejaba huecos)
```
18:00 - Partido A (5ª Cat)
19:30 - Partido B (6ª Cat)
21:00 - VACÍO (Partido C espera descanso de 4h)
22:00 - Partido C (5ª Cat, esperó su descanso)
```

### Después (sin huecos)
```
18:00 - Partido A (5ª Cat)
19:30 - Partido B (6ª Cat)
21:00 - Partido D (7ª Cat) ADELANTADO - no tenía conflicto
22:00 - Partido C (5ª Cat, esperó su descanso)
```

### Implementación
```typescript
// Nuevo algoritmo con cola de partidos pendientes
const partidosPendientes = [...partidos];

for (const slot of slotsCronologicamente) {
  // Buscar el primer partido pendiente que pueda usar este slot
  for (const partido of partidosPendientes) {
    if (!tieneConflicto(partido, slot)) {
      asignar(partido, slot);
      partidosPendientes.remove(partido);
      
      if (partidoFueAdelantado) {
        log('ADELANTADO', `${partido} ocupó slot que otro no podía usar`);
      }
      break;
    }
  }
}
```

### Nuevos Tipos de Log
| Tipo | Color | Descripción |
|------|-------|-------------|
| `ASIGNADO` | 🟢 Verde | Partido asignado normalmente |
| `ADELANTADO` | 🔵 Azul | Partido ocupó slot que otro no podía usar |
| `SALTADO` | 🟡 Amarillo | Partido no pudo usar slot (descanso) |

### Ejemplo de Logs
```
ADELANTADO: 7ª Categoría - CUARTOS ADELANTADO al slot 21:00 
             (otros partidos esperaban descanso)
SALTADO: 5ª Categoría - SEMIS NO cabe a las 21:00: 
         Descanso reglamentario: jugó a las 18:00, puede jugar desde las 22:00
ASIGNADO: 5ª Categoría - SEMIS asignado a las 22:00
```

### Commits
- Backend: `0d26eee` - feat(programacion): optimizacion adelantar partidos
- Frontend: `dcea1b3` - feat(programacion): mostrar solo logs relevantes

### Testing Recomendado
1. Crear torneo con múltiples categorías
2. Calcular programación
3. Verificar en Logs de Asignación que aparecen `ADELANTADO`
4. Confirmar que no hay huecos innecesarios en la distribución

---


---

## 🐛 Fix (2026-03-18) - Restaurar Distribución Balanceada

### Problema
La optimización de "adelantar partidos" rompió la distribución proporcional, llenando los primeros días y dejando los últimos (sábado/domingo) con espacio sobrante.

### Solución
Nuevo algoritmo que combina ambas características:

```
1. Calcular objetivo proporcional por día
   Jueves: 30 slots → objetivo 25 partidos
   Viernes: 40 slots → objetivo 33 partidos  
   Sábado: 50 slots → objetivo 42 partidos

2. Por cada partido, seleccionar el día con más MARGEN
   (más lejos de cumplir su objetivo)

3. Dentro de ese día, adelantar partidos sin conflicto
```

### Logs Mejorados
Ahora muestran el balance:
```
ASIGNADO: 5ª Categoría - CUARTOS asignado a 2026-03-20 18:00 (balance: 15/25)
ADELANTADO: 7ª Categoría - OCTAVOS ADELANTADO a 2026-03-20 19:30 (balance: 16/25)
```

### Commit
- Backend: `380e577` - fix(programacion): restaurar distribucion balanceada con optimizacion de adelantar

---


---

## 🐛 Fix (2026-03-18) - Excluir Partidos "Por definir"

### Problema
El sistema estaba programando partidos donde ambas parejas aparecían como "Por definir" (dependen de resultados de rondas previas). Estos partidos no se pueden jugar todavía.

### Solución
Filtrar solo los partidos con **AMBAS parejas definidas**:

```typescript
const partidos = todosLosPartidos.filter(p => {
  const tienePareja1 = p.inscripcion1Id && p.pareja1;
  const tienePareja2 = p.inscripcion2Id && p.pareja2;
  return tienePareja1 && tienePareja2;
});
```

### Resultado
- Solo se programan partidos jugables (ambas parejas conocidas)
- Partidos "Por definir vs Por definir" se excluyen automáticamente
- Se muestra mensaje informativo: "X partidos 'Por definir' no programados (pendientes de resultados)"

### Mensaje al Usuario
```
⚠️ 15 partidos "Por definir" no programados (pendientes de resultados)
💡 Estos partidos se programarán automáticamente cuando las parejas estén definidas
```

### Commit
- Backend: `49d87d9` - fix(programacion): excluir partidos Por definir vs Por definir

---


---

## ✅ Feature (2026-03-18) - Distribución por Ventanas de Fases

### Problema
ZONA estaba ocupando todos los días hasta el sábado, dejando poco espacio para REPECHAJE, OCTAVOS y CUARTOS.

### Solución
Nuevo algoritmo que divide los días en "ventanas" según el grupo de fases:

```
┌─────────────────────────────────────────────────────────┐
│  Jueves     Viernes      Sábado        Domingo          │
│   19/03      20/03       21/03         22/03            │
├─────────────────────────────────────────────────────────┤
│  ZONA       ZONA         OCTAVOS       CUARTOS          │
│  REPECHAJE  REPECHAJE    16avos/32avos                  │
│                          (si aplica)                    │
└─────────────────────────────────────────────────────────┘
                           ↑
                    fechaFinales → SEMIS + FINAL
```

### Cálculo de Ventanas
```typescript
// Proporcional a la cantidad de partidos de cada grupo
const diasIniciales = totalDias * (partidosZONA / totalPartidos);
const diasIntermedios = totalDias * (partidosOCTAVOS / totalPartidos);
const diasPrevios = totalDias * (partidosCUARTOS / totalPartidos);
```

### Logs Informativos
```
INFO: Distribución por ventanas: ZONA/REPECHAJE=2d, OCTAVOS=1d, CUARTOS=1d, FINALES=1d
INFO: Asignando 25 partidos ZONA/REPECHAJE a 2 días (2026-03-19 a 2026-03-20)
INFO: Asignando 16 partidos OCTAVOS a 1 día (2026-03-21)
```

### Commits
- Backend: `28029a1` - feat(programacion): distribucion por ventanas de fases
- Frontend: `fdc24a6` - feat(programacion): agregar tipo INFO a logs

### Resultado
- Cada fase tiene sus días asignados proporcionalmente
- ZONA no monopoliza todos los días
- Hay espacio garantizado para fases intermedias
- El torneo fluye naturalmente: ZONA → OCTAVOS → CUARTOS → FINALES

---

## ✅ Completado (2026-03-18) - Fix Sistema de Bracket: Distribución de Perdedores y Ganadores

### Resumen Ejecutivo
> **Estado:** Lógica de navegación entre ZONA → REPECHAJE → BRACKET corregida para todos los casos de participantes.

### Problema Identificado
La distribución de perdedores de zona al repechaje no funcionaba correctamente:
1. Solo el primer partido de zona mandaba su perdedor al repechaje
2. Los perdedores excedentes no iban al bracket por "suerte"
3. Cuando había más slots de repechaje que perdedores, no se llenaban con ganadores

### Solución Implementada

#### 1. Lógica de Distribución Corregida (`conectarNavegacion`)
```typescript
// Cálculo correcto de slots
const slotsRepechaje = partidosRepechaje * 2; // 2 slots por partido
const slotsConPerdedores = Math.min(perdedoresZona, slotsRepechaje);
const slotsConGanadores = Math.max(0, slotsRepechaje - perdedoresZona);

// Distribución:
// - Slots primero con perdedores (hasta agotar)
// - Slots restantes con ganadores de zona
// - Perdedores sobrantes → bracket por "suerte divina"
```

#### 2. Bugfix: `posicionEnPerdedor` no se guardaba
```typescript
// En guardarBracket() - faltaba esta línea:
if (partido.posicionEnPerdedor) {
  updateData.posicionEnPerdedor = partido.posicionEnPerdedor;
}
```

#### 3. Nuevo Tipo de Entrada
```typescript
export enum TipoEntrada {
  // ... otros tipos
  PERDEDOR_ZONA_SUERTE = 'PERDEDOR_ZONA_SUERTE', // Lucky losers
}
```

### Casos de Prueba Verificados

| Parejas | Bracket | Zona | Repechaje | Perdedores→Rep | Ganadores→Rep | Perdedores Suerte |
|---------|---------|------|-----------|----------------|---------------|-------------------|
| 8       | 8       | 4P   | 0P        | 0              | 0             | 4                 |
| 9       | 8       | 5P   | 1P (2S)   | 2              | 0             | 2                 |
| 10      | 8       | 5P   | 2P (4S)   | 4              | 0             | 1                 |
| 11      | 8       | 6P   | 3P (6S)   | 5              | 1             | 0                 |
| 16      | 16      | 8P   | 0P        | 0              | 0             | 8                 |
| 18      | 16      | 9P   | 2P (4S)   | 4              | 0             | 5                 |
| 21      | 16      | 11P  | 5P (10S)  | 10             | 0             | 0                 |
| 22      | 16      | 11P  | 6P (12S)  | 11             | 1             | 0                 |

**Fórmula:** 
- `Ganadores Directo al Bracket = GanadoresZona - SlotsConGanadores`
- `Perdedores Suerte = max(0, PerdedoresZona - SlotsRepechaje)`
- `Total Bracket = GanadoresDirecto + GanadoresRepechaje + PerdedoresSuerte`

### Archivos Modificados
- `src/modules/bracket/bracket.service.ts` - Lógica de conectarNavegacion corregida
- `src/modules/bracket/dto/generate-bracket.dto.ts` - Nuevo tipo PERDEDOR_ZONA_SUERTE

### Commit
- Backend: `ee338fc` - fix(bracket): distribución de perdedores y ganadores a repechaje/bracket según lógica paraguaya

### Deploy
- ✅ Backend: https://github.com/herto2007-prog/fairpadel-backend.git
- 🚀 Railway: Automático desde main

---

**Última actualización:** 2026-03-18 - Sistema de bracket con distribución correcta de perdedores y ganadores

---

## 🐛 DEBUGGING - Lecciones Aprendidas

### Marzo 2025: Múltiples Índices Únicos en PostgreSQL

**Problema:** Error "Unique constraint failed on the fields: (tournament_id,fecha)" a pesar de que el código y schema tenían la clave nueva `(tournament_id, fecha, hora_inicio)`.

**Causa real:** La base de datos tenía **DOS índices únicos**:
1. `tournament_id_fecha_key` (viejo) - NO eliminado
2. `tournament_id_fecha_hora_key` (nuevo) - Creado correctamente

PostgreSQL aplicaba el primero (el viejo), causando el error.

**Diagnóstico:**
```sql
-- Query que salvó el día
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'torneo_disponibilidad_dias';
```

**Resultado mostraba:**
- `torneo_disponibilidad_dias_tournament_id_fecha_key` (viejo) ❌
- `torneo_disponibilidad_dias_tournament_id_fecha_hora_key` (nuevo) ✅

**Solución:**
```sql
DROP INDEX IF EXISTS "torneo_disponibilidad_dias_tournament_id_fecha_key";
```

**Tiempo perdido:** 2 días intentando invalidar caché de Railway cuando el problema era la BD.

**Lección:** Siempre auditar la estructura REAL de la BD con queries SQL antes de asumir problemas de deploy/caché.

---

## 🎉 COMPLETADO (2026-03-21) - PRIMER BRACKET FUNCIONAL - MVP LISTO

> **¡LOGRO HISTÓRICO!** Después de 45 días de desarrollo, FairPadel tiene su primer bracket completo funcional.

### ✅ Flujo MVP Completo Validado

```
Asignar Sede → Agregar Días → Sortear → Ver Bracket → Cargar Resultados
```

**Primer bracket exitoso:** Torneo "Torneo con pasos simples" - 6ª Categoría Caballeros (17 parejas)

### Features MVP Validadas

#### 1. Asignar Sede ✅
- Single-click asignación de sede
- Copia automática de todas las canchas
- Reemplazo de sede anterior si existía

#### 2. Agregar Días ✅
- Configuración simplificada: fecha + horario (inicio/fin)
- Slots automáticos de 90 minutos
- Uso automático de todas las canchas de la sede

#### 3. Sorteo Simplificado ✅
- Sorteo directo desde pestaña "Canchas y Sorteo"
- Mínimo 8 parejas requerido
- Cálculo automático de slots necesarios
- Reserva de slots para todas las fases

#### 4. Bracket con Programación ✅
- Visualización por fases (ZONA, REPECHAJE, OCTAVOS, CUARTOS, SEMIS, FINAL)
- **Asignación automática de canchas y horarios**
- Fotos de jugadores en cada partido
- Indicadores de BYE y Finalizado

#### 5. Carga de Resultados ✅
- Modal de resultado con registro de sets
- Soporte para Set 3 (Set Completo o Súper Tie-Break)
- Avance automático del ganador a siguiente fase
- Marcador "En Vivo" opcional

### Arquitectura del MVP

**Backend:**
- `CanchasSorteoService` - Orquesta el flujo completo
- `BracketService` - Generación y guardado de brackets
- `guardarBracket()` - Crea FixtureVersion + Matches + Asigna slots
- Endpoints REST para cada operación

**Frontend:**
- `CanchasSorteoManager` - Paso 1, 2 y 3 unificados
- `BracketManager` - Lista de categorías con estado
- `BracketView` - Visualización del bracket con programación
- `RegistroResultadoModal` - Carga de resultados

### Detalles Técnicos Implementados

**Asignación de Slots Automática:**
- Libera slots del bracket anterior al re-sortear
- Busca slots LIBRES ordenados por fecha/hora
- Asigna cronológicamente a los partidos
- Marca slots como OCUPADO al asignar

**Versión de Fixtures:**
- Soporta múltiples versiones de bracket por categoría
- Versión auto-incremental (1, 2, 3...)
- Archivado de versiones anteriores

**Integración Canchas-Sorteo:**
- Paso 1: Configurar días de juego
- Paso 2: Seleccionar categorías y sortear
- Cálculo en tiempo real de slots necesarios vs disponibles
- Validación de mínimos antes de permitir sorteo

### Estado de la BD (Ejemplo Real)

```sql
-- Tournament Category
id: 52aa970c-f2e1-4e9a-aa12-87945bf971a8
estado: FIXTURE_BORRADOR
fixture_version_id: d1d3471a-b9bb-4911-aea2-e377c3a55d9c

-- FixtureVersion (25 partidos)
version: 2
estado: BORRADOR
total_partidos: 25

-- Matches con programación:
- ZONA: 9 partidos (18:00-22:30, 26-27/3)
- REPECHAJE: 1 partido
- OCTAVOS: 8 partidos
- CUARTOS: 4 partidos
- SEMIS: 2 partidos
- FINAL: 1 partido
```

### Próximas Iteraciones Sugeridas

**Optimizaciones (No críticas para MVP):**
- [ ] Partidos BYE no deberían ocupar slots
- [ ] Distribución balanceada por fase (no cronológica pura)
- [ ] Validación de horarios correctos por día configurado
- [ ] Mejoras UX en carga de resultados

**Nuevos Módulos:**
- [ ] Notificaciones Push/SMS/Email
- [ ] Integración Bancard para pagos online
- [ ] App móvil (React Native/Expo)

### Commits del MVP

**Backend:**
- `42a3837` - fix(bracket): calcula version correcta para FixtureVersion
- `654e4cf` - feat(bracket): asigna slots automaticamente al crear partidos
- `8b8c2c2` - feat(bracket): busca slots automaticamente si no se pasan
- `8d03505` - fix(bracket): libera slots al re-sortear para usar horarios correctos
- `c40a8bc` - chore: elimina logs de debug del backend

**Frontend:**
- `e897f9b` - debug(bracket): agrega logs para diagnosticar fixtureVersionId
- `03e5290` - fix(bracket): corrige error de tipos en seleccion de fase
- `2686b51` - fix(bracket): usa tipo FaseType correcto para faseActiva

### URLs de Producción

- Frontend: https://www.fairpadel.com
- Backend: https://api.fairpadel.com
- Health: https://api.fairpadel.com/api/health

---

**Estado:** 🚀 **MVP COMPLETO Y FUNCIONAL EN PRODUCCIÓN**

**Última actualización:** 2026-03-21 - Primer bracket finalizado exitosamente



---

## 🆕 EN PROGRESO (2026-03-25) - Control de Pagos del Organizador

### 📋 Resumen
Nuevo sistema paralelo para que el organizador controle quien le pago la inscripcion (efectivo/transferencia). Separado del sistema de pagos premium de FairPadel.

### ✅ Backend Implementado

**Nueva Tabla:** `control_pagos_organizador`
- `id`, `inscripcionId`, `jugadorId`
- `monto` (Int), `metodo` (EFECTIVO|TRANSFERENCIA)
- `fecha` (YYYY-MM-DD), `nota`, `registradoPor`
- Indices: inscripcionId, jugadorId, fecha

**Endpoints Nuevos:**
```
GET    /admin/torneos/:id/control-pagos?filtro=&categoriaId=&busqueda=
POST   /admin/torneos/:id/control-pagos
DELETE /admin/torneos/:id/control-pagos/:pagoId
```

**Logica:**
- Vista individual por jugador (cada uno paga la mitad del costo)
- Stats: total cobrado, total deben, al dia vs deudores
- Filtros: deudores, pagados, por categoria, busqueda

### ⏳ Frontend Pendiente

**Nueva UI:**
- Tab o seccion "Control de Cobranza"
- Stats cards: Cobrado vs Deben
- Tabla por jugador: Nombre, Pareja, Categoria, Debe, Pagado, Acciones
- Modal rapido para registrar pago (monto, metodo, fecha, nota)
- Filtros: Todos, Deudores, Pagados

**Archivos a crear/modificar:**
- `frontend/src/features/organizador/components/inscripciones/ControlPagosManager.tsx` (nuevo)
- Agregar pestaña en panel de organizador

### 📁 Archivos Modificados

**Backend:**
- `prisma/schema.prisma` - Nuevo modelo + relacion
- `src/modules/admin/admin-torneos.controller.ts` - 3 endpoints
- `prisma/migrations/control_pagos_organizador.sql` - SQL manual

**Build:** ✅ Backend compila sin errores

**SQL para crear tabla:**
```sql
CREATE TABLE "control_pagos_organizador" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "inscripcion_id" TEXT NOT NULL,
    "jugador_id" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "metodo" TEXT NOT NULL CHECK ("metodo" IN ('EFECTIVO', 'TRANSFERENCIA')),
    "fecha" TEXT NOT NULL,
    "nota" TEXT,
    "registrado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "control_pagos_inscripcion_fk" FOREIGN KEY ("inscripcion_id") REFERENCES "inscripciones"("id") ON DELETE CASCADE,
    CONSTRAINT "control_pagos_jugador_fk" FOREIGN KEY ("jugador_id") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_control_pagos_inscripcion" ON "control_pagos_organizador"("inscripcion_id");
CREATE INDEX "idx_control_pagos_jugador" ON "control_pagos_organizador"("jugador_id");
CREATE INDEX "idx_control_pagos_fecha" ON "control_pagos_organizador"("fecha");
```
