# Plan de Limpieza: Descanso V2 (Post-Migración)

## ⚠️ Advertencia

Este plan elimina el código legacy de descanso. Ejecutar **SOLO** cuando:
- El nuevo algoritmo lleva 2-4 semanas estable en producción
- No se han reportado bugs relacionados
- El equipo está confiado en el nuevo comportamiento

**Fecha sugerida de ejecución:** [2-4 semanas después de activación completa]

---

## Checklist Pre-Limpieza

- [ ] Nuevo algoritmo activo en producción por 2+ semanas
- [ ] 0 incidentes relacionados a descansos
- [ ] Feedback positivo de organizadores
- [ ] Backup del código actual (git tag)

---

## Cambios a Realizar

### 1. Eliminar Feature Flags

**Archivo:** `src/config/features.ts`
- Eliminar `DESCANSO_CALCULATOR_V2`
- Eliminar `DESCANSO_CALCULATOR_V2_TORNEO_ID`
- Eliminar función `isDescansoV2Enabled()`

**Resultado:** El archivo puede eliminarse si no hay otros flags.

---

### 2. Simplificar CanchasSorteoService

**Archivo:** `src/modules/bracket/canchas-sorteo.service.ts`

#### 2.1 Eliminar método legacy
```typescript
// ELIMINAR este método completo:
private calcularHoraMinimaConDescanso(
  tournamentId: string,
  ultimoPartidoFecha: string,
  ultimoPartidoHoraFin: string,
  faseOrigen?: string,
  faseDestino?: string,
): { hora: string; cambioDia: boolean; fechaDestino?: string }
```

#### 2.2 Eliminar helper sumarHoras (si no se usa en otro lugar)
```typescript
// ELIMINAR:
private sumarHoras(hora: string, horasASumar: number): string
```

#### 2.3 Eliminar import de features
```typescript
// CAMBIAR:
import { isDescansoV2Enabled, FEATURES } from '../../config/features';

// A:
// (eliminar import completo si no se usa para otros features)
```

#### 2.4 Simplificar lógica de descanso
```typescript
// REEMPLAZAR la lógica compleja actual por:

if (idxFaseActual > 0) {
  for (let j = idxFaseActual - 1; j >= 0; j--) {
    const faseAnterior = ordenFases[j];
    const key = `${partido.categoriaId}-${dia.fecha}-${faseAnterior}`;
    if (ultimaHoraFinPorCategoriaFase[key]) {
      // Usar DescansoCalculatorService directamente
      const descansoMinutos = this.descansoCalculator.getDescansoEntreFases(
        faseAnterior,
        partido.fase,
      );
      const resultado = this.descansoCalculator.calcularHoraMinimaDescanso(
        dia.fecha,
        ultimaHoraFinPorCategoriaFase[key],
        descansoMinutos,
      );
      
      horaMinimaInicio = resultado.hora;
      faseAnteriorMismoDia = true;
      
      // Si cambió de día, el slot se buscará en el siguiente día
      if (resultado.fecha !== dia.fecha) {
        console.log(`[Descanso] Fase ${partido.fase} pasa al día ${resultado.fecha}`);
      }
      
      console.log(`[SorteoDebug] [Descanso] Cat ${catNombre} | Fase ${partido.fase} >= ${horaMinimaInicio}`);
      break;
    }
  }
}
```

#### 2.5 Eliminar logs de comparación
```typescript
// ELIMINAR bloque:
if (process.env.NODE_ENV === 'development') {
  const legacyHora = this.sumarHoras(...);
  const nuevaHora = resultadoDescanso.hora;
  if (legacyHora !== nuevaHora) {
    console.log(`[DescansoCompare] ...`);
  }
}
```

#### 2.6 Eliminar endpoint de test y features status
```typescript
// ELIMINAR métodos:
- testDescansoCalculator()
- getFeaturesStatus()
```

---

### 3. Actualizar CanchasSorteoController

**Archivo:** `src/modules/bracket/canchas-sorteo.controller.ts`

#### 3.1 Eliminar endpoints de test
```typescript
// ELIMINAR:
@Post('test-descanso')
async testDescanso(...)

@Get('features')
async getFeaturesStatus(...)
```

#### 3.2 Eliminar import de Query si no se usa
```typescript
// CAMBIAR:
import { Controller, Post, Body, Get, Delete, Param, UseGuards, Query } from '@nestjs/common';

// A:
import { Controller, Post, Body, Get, Delete, Param, UseGuards } from '@nestjs/common';
```

---

### 4. Actualizar Variables de Entorno

**Archivo:** `.env.example`

```bash
# ELIMINAR estas líneas:
# Feature Flags
FEATURE_DESCANSO_V2=false
FEATURE_DESCANSO_V2_TORNEO_ID=
```

**Archivo:** `.env` (en producción)
```bash
# ELIMINAR:
FEATURE_DESCANSO_V2=true
FEATURE_DESCANSO_V2_TORNEO_ID=
```

---

### 5. Actualizar Documentación

**Archivo:** `docs/GUIA_ACTIVACION_DESCANSO_V2.md`
- Marcar como "DEPRECATED - Migración completada"
- Referenciar al nuevo documento de arquitectura

**Crear nuevo archivo:** `docs/ARQUITECTURA_DESCANSO.md`
- Explicar cómo funciona el algoritmo actual
- Cómo configurar descansos por torneo (futuro)
- Cómo extender para nuevas fases

---

## Resultado Final

### Estructura de archivos esperada:

```
src/
├── config/
│   └── features.ts (eliminado si no hay otros flags)
├── modules/
│   ├── bracket/
│   │   ├── canchas-sorteo.service.ts (simplificado)
│   │   └── canchas-sorteo.controller.ts (sin endpoints de test)
│   └── programacion/
│       ├── descanso-calculator.service.ts ✅ (mantener)
│       └── descanso-calculator.service.spec.ts ✅ (mantener)
```

### Código simplificado en canchas-sorteo.service.ts:

```typescript
// ANTES (con feature flag):
const resultadoDescanso = this.calcularHoraMinimaConDescanso(
  tournamentId,
  dia.fecha,
  ultimaHoraFinPorCategoriaFase[key],
  faseAnterior,
  partido.fase,
);
horaMinimaInicio = resultadoDescanso.hora;

// DESPUÉS (limpio):
const descansoMinutos = this.descansoCalculator.getDescansoEntreFases(
  faseAnterior,
  partido.fase,
);
const resultado = this.descansoCalculator.calcularHoraMinimaDescanso(
  dia.fecha,
  ultimaHoraFinPorCategoriaFase[key],
  descansoMinutos,
);
horaMinimaInicio = resultado.hora;
```

---

## Rollback de la Limpieza

Si después de la limpieza surge un problema, el rollback es:

```bash
# Revertir el commit de limpieza
git revert <commit-de-limpieza>

# O restaurar desde tag
git checkout -b rollback-limpieza <tag-pre-limpieza>
```

---

## Aprobación

**Responsable de aprobación:** _________________

**Fecha de ejecución:** _________________

**Tag de backup:** _________________

---

## Notas Post-Ejecución

- [ ] Verificar que todos los sorteos funcionan correctamente
- [ ] Verificar que los descansos se calculan bien
- [ ] Monitorear por 48h después de la limpieza
- [ ] Actualizar runbooks/documentación del equipo
