# EJEMPLOS DE APLICACIÓN DE PATRÓN DE AUDITORÍA

> Guía práctica para marcar código durante el saneamiento

---

## Ejemplo 1: Endpoint Deprecated en Controller

**Archivo:** `src/modules/admin/admin-disponibilidad.controller.ts`

```typescript
/**
 * POST /admin/torneos/:id/disponibilidad/finales
 * Configura finales - VERSIÓN ANTIGUA
 * 
 * [AUDITORIA-2026-03-19] DEPRECATED: Reemplazado por nuevo endpoint
 * RAZÓN: El flujo unificado en Canchas y Sorteo usa /admin/canchas-sorteo/finales
 * ACCIÓN: Eliminar después de confirmar que frontend no lo usa
 * REF: AUDITORIA_TORNEOS.md - FASE 2.2
 * NOTA: Mantener hasta que todas las llamadas migren al nuevo endpoint
 */
@Post('finales')
async configurarFinalesOld(@Param('id') tournamentId: string, @Body() dto: any) {
  // ... código ...
}
```

---

## Ejemplo 2: Componente Deprecated en Frontend

**Archivo:** `frontend/src/features/organizador/components/disponibilidad/CanchasManager.tsx`

```typescript
/**
 * [AUDITORIA-2026-03-19] DEPRECATED: Componente reemplazado
 * RAZÓN: El nuevo flujo "Canchas y Sorteo" unifica configuración + sorteo
 * ACCIÓN: Verificar si se importa en algún lugar antes de eliminar
 * REF: AUDITORIA_TORNEOS.md - FASE 2.2
 * REEMPLAZO: CanchasSorteoManager.tsx
 */
export function CanchasManager({ tournamentId }: CanchasManagerProps) {
  // ... código completo del componente ...
}
```

---

## Ejemplo 3: Servicio Duplicado

**Archivo:** `src/modules/disponibilidad/disponibilidad.service.ts`

```typescript
/**
 * Genera slots para un día específico
 * 
 * [AUDITORIA-2026-03-19] DUPLICATED: Lógica similar en canchas-sorteo.service.ts
 * RAZÓN: La misma funcionalidad existe en el nuevo servicio
 * ACCIÓN: Consolidar - usar solo canchas-sorteo.service.ts
 * REF: AUDITORIA_TORNEOS.md - FASE 2.1
 * DIFERENCIAS: Este usa disponibilidad_cancha, el nuevo usa torneo_cancha
 */
async generarSlotsParaDia(diaId: string, canchasIds: string[]) {
  // ... código ...
}
```

---

## Ejemplo 4: Función Critical (NO TOCAR)

**Archivo:** `src/modules/bracket/bracket.service.ts`

```typescript
/**
 * Calcula la estructura del bracket basado en cantidad de parejas
 * 
 * [AUDITORIA-2026-03-19] CRITICAL: Función core del sistema
 * RAZÓN: Usada tanto en flujo antiguo como nuevo
 * ACCIÓN: MANTENER - Refactorizar con cuidado si es necesario
 * REF: AUDITORIA_TORNEOS.md - FASE 4.1 (sorteo masivo)
 * USADO POR: canchas-sorteo.service.ts (línea 200 aprox)
 */
calcularSlotsNecesarios(parejas: number): CalculoBracket {
  // ... código crítico ...
}
```

---

## Ejemplo 5: Tabla en Prisma Schema

**Archivo:** `prisma/schema.prisma`

```prisma
// [AUDITORIA-2026-03-19] REVIEW: Verificar si se usa
// RAZÓN: Tabla creada para flujo antiguo de disponibilidad
// ACCIÓN: Verificar si hay registros activos antes de eliminar
// REF: AUDITORIA_TORNEOS.md - FASE 2.2
// ALTERNATIVA: Usar torneo_disponibilidad_dias en su lugar
model DisponibilidadCancha {
  id          String   @id @default(uuid())
  // ... campos ...
  
  @@map("disponibilidad_cancha")
}
```

---

## Ejemplo 6: Ruta en Frontend que redirige a componente deprecated

**Archivo:** `frontend/src/router/index.tsx`

```typescript
{
  // [AUDITORIA-2026-03-19] DEPRECATED: Ruta a componente viejo
  // RAZÓN: El nuevo flujo está en la pestaña "Canchas y Sorteo"
  // ACCIÓN: Redirigir a nueva ruta o eliminar
  // REF: AUDITORIA_TORNEOS.md - FASE 2
  path: 'torneos/:id/canchas-old',
  element: <CanchasManager /> // Componente deprecated
}
```

---

## Ejemplo 7: Variable/Estado no usado

**Archivo:** `frontend/src/features/organizador/pages/GestionarTorneoPage.tsx`

```typescript
export function GestionarTorneoPage() {
  // ... otros estados ...
  
  // [AUDITORIA-2026-03-19] UNUSED: Estado ya no se usa
  // RAZÓN: El tab activo se maneja diferente ahora
  // ACCIÓN: Eliminar después de verificar que no rompe nada
  // REF: AUDITORIA_TORNEOS.md - FASE 2
  const [activeTabOld, setActiveTabOld] = useState('info');
  
  // ... resto del componente ...
}
```

---

## Ejemplo 8: Import no usado

**Archivo:** `frontend/src/features/organizador/components/canchas-sorteo/CanchasSorteoManager.tsx`

```typescript
import { 
  ChevronDown, 
  ChevronUp, 
  Trophy, 
  Calendar, 
  CheckCircle2, 
  // [AUDITORIA-2026-03-19] UNUSED: Icono no se usa
  // RAZÓN: Se reemplazó por otro icono
  // ACCIÓN: Eliminar import
  // AlertCircle, 
  MapPin, 
  Plus, 
  X,
  Calculator, 
  Shuffle, 
  AlertTriangle, 
  Info
} from 'lucide-react';
```

---

## Resumen de Prefijos

| Prefijo | Cuándo usar | Ejemplo |
|---------|-------------|---------|
| `[AUDITORIA-YYYY-MM-DD]` | Siempre al inicio | `[AUDITORIA-2026-03-19]` |
| `DEPRECATED:` | Código reemplazado | `DEPRECATED: Usar nuevo endpoint` |
| `UNUSED:` | Código muerto | `UNUSED: Variable no referenciada` |
| `DUPLICATED:` | Código repetido | `DUPLICATED: Función en otro service` |
| `REVIEW:` | Necesita análisis | `REVIEW: Lógica compleja` |
| `CRITICAL:` | No tocar | `CRITICAL: Función core` |

---

## Comando para buscar marcadores de auditoría

```bash
# Buscar todos los comentarios de auditoría
grep -r "\[AUDITORIA-" src/ frontend/src/ --include="*.ts" --include="*.tsx"

# Contar por tipo
grep -r "DEPRECATED:" src/ frontend/src/ --include="*.ts" --include="*.tsx" | wc -l
grep -r "UNUSED:" src/ frontend/src/ --include="*.ts" --include="*.tsx" | wc -l

# Buscar en archivos prisma
grep -r "\[AUDITORIA-" prisma/ --include="*.prisma"
```

---

**Nota:** Una vez que se apruebe la eliminación, buscar por `[AUDITORIA-` y eliminar el código marcado.
