# PLAN MVP - Torneo de Pádel Funcional

> **Documento de planificación**  
> **Fecha:** 2026-03-20  
> **Estado:** PLANIFICACIÓN - No tocar código todavía  

---

## 🎯 OBJETIVO

Un flujo de torneo que funcione de punta a punta, SIN features avanzados.

**Criterio de éxito:** Un organizador puede crear un torneo, inscribir parejas, sortear y jugar hasta el final SIN errores.

---

## ✅ SCOPE MVP (Solo esto, nada más)

### 1. CREAR TORNEO
**Funciona hoy:** ✅
- Wizard de 5 pasos
- Fecha del torneo, fecha de finales
- Categorías básicas
- Costo de inscripción

**Congelar:**
- Configuración compleja de sedes
- Múltiples sedes por torneo

---

### 2. CONFIGURAR CANCHAS (SIMPLIFICADO)
**Estado actual:** ⚠️ Complejo, simplificar

**MVP - Paso único:**
```
Gestionar Sedes → Seleccionar sede principal → 
Automáticamente asignar TODAS sus canchas al torneo
```

**Eliminar:**
- ❌ Paso 1.a separado (finales/semifinales)
- ❌ Configuración de horarios por fase
- ❌ Slots especiales para finales

**Reemplazar con:**
- Un solo botón: "Asignar sede del torneo"
- Copia automática de todas las canchas de esa sede
- Las canchas quedan disponibles para TODO el torneo

---

### 3. CONFIGURAR DÍAS (SIMPLIFICADO)
**Estado actual:** ⚠️ Demasiado flexible

**MVP:**
- Organizador agrega días simples: fecha + hora inicio/fin
- SIN especificar qué canchas por día (usan todas)
- SIN duración de slot configurable (90 min fijo)
- Slots genéricos, NO marcados por fase

**Eliminar:**
- ❌ Selector de canchas por día
- ❌ Diferentes duraciones de slot
- ❌ Configuración automática de finales

---

### 4. INSCRIPCIONES
**Funciona hoy:** ✅
- Parejas se inscriben online
- Organizador confirma

**Mantener:**
- Flujo actual de inscripción

**Congelar mejoras:**
- ❌ Pagos online
- ❌ Notificaciones automáticas
- ❌ Validaciones complejas de categoría

---

### 5. SORTEO (CRÍTICO - NECESITA FIX)
**Estado actual:** ⚠️ Complejo, revisar

**MVP:**
- Botón único: "Cerrar inscripciones y sortear"
- Sorteo aleatorio simple (no por ranking)
- Generar zonas automáticamente
- Crear bracket básico

**Eliminar:**
- ❌ Cálculo de necesidad de slots
- ❌ Validación previa compleja
- ❌ Distribución por fases
- ❌ Reserva de slots para todas las fases

**Reemplazar con:**
- Validación simple: ¿hay suficientes parejas? (>7)
- Sorteo directo
- Verificación post-sorteo: ¿se generó el bracket?

---

### 6. FIXTURE Y RESULTADOS
**Estado actual:** ⚠️ Incompleto

**MVP:**
- Ver fixture con zonas y bracket
- Cargar resultado: ganador + sets
- Avance automático: ganador pasa a siguiente ronda
- Finaliza torneo

**Eliminar:**
- ❌ Programación de horarios en fixture
- ❌ Asignación de canchas a partidos específicos
- ❌ Drag & drop de partidos

---

## 🚫 FUNCIONALIDADES CONGELADAS (No tocar)

| Feature | Estado | Razón |
|---------|--------|-------|
| Config semifinales/finales separadas | ❌ Congelada | Complejidad innecesaria para MVP |
| Slots marcados por fase | ❌ Congelada | No crítico para jugar |
| Programación automática | ❌ Congelada | Se puede jugar sin esto |
| Múltiples sedes por torneo | ❌ Congelada | Simplificar a una sede |
| Cálculo de necesidad de slots | ❌ Congelada | Sorteo directo es suficiente |
| Distribución balanceada por fase | ❌ Congelada | Over-engineering |
| Notificaciones push/email | ❌ Congelada | Post-MVP |
| Pagos online (Bancard) | ❌ Congelada | Post-MVP |

---

## 🔧 FIXES CRÍTICOS NECESARIOS (Antes de MVP)

### Prioridad 1: Flujo básico funcione
1. **Asignar canchas simple**
   - Endpoint: POST /admin/torneos/:id/sedes (ya existe)
   - Copiar automáticamente todas las canchas de la sede
   - Sin configuración adicional

2. **Agregar días simplificado**
   - Fecha, hora inicio, hora fin
   - Usar todas las canchas del torneo
   - 90 min por slot (fijo)

3. **Sorteo simplificado**
   - Validar: mínimo 8 parejas por categoría
   - Sortear directamente (sin cálculo previo)
   - Generar bracket básico

### Prioridad 2: Resultados funcionen
4. **Cargar resultado**
   - POST /matches/:id/resultado
   - Marcar ganador
   - Avanzar ganador a siguiente ronda

5. **Ver fixture**
   - GET /tournaments/:id/fixture
   - Mostrar zonas y bracket

---

## 📊 CRONOGRAMA

### Semana 1: Simplificar Backend
- [ ] Endpoint asignar sede (copiar todas las canchas)
- [ ] Simplificar agregar día (sin selección de canchas)
- [ ] Simplificar sorteo (sin cálculo de slots)

### Semana 2: Simplificar Frontend
- [ ] UI asignar sede (un solo botón)
- [ ] UI agregar día simplificada
- [ ] UI sorteo simplificada

### Semana 3: Resultados
- [ ] Cargar resultados funcional
- [ ] Avance automático
- [ ] Ver fixture completo

### Semana 4: Validación
- [ ] Test end-to-end completo
- [ ] Corrección de bugs
- [ ] Documentación básica

---

## ✅ CRITERIOS DE ÉXITO MVP

- [ ] Organizador crea torneo en < 5 minutos
- [ ] 10 parejas se inscriben sin errores
- [ ] Sorteo genera bracket válido
- [ ] Se cargan resultados de 5 partidos sin errores
- [ ] Torneo finaliza y muestra ganador

---

## 🚀 POST-MVP (Después de validar MVP)

Una vez que el flujo básico funcione perfecto, agregamos:
1. Configuración de horarios por fase
2. Programación automática de partidos
3. Notificaciones
4. Estadísticas y ranking

---

## 📝 NOTAS

- **NO borrar código**, solo dejar de usar lo complejo
- **Marcar con comentarios** qué es MVP vs qué es feature avanzada
- **Testear cada paso** antes de seguir
- **Si algo rompe**, rollback inmediato al último estado estable

---

**Firma:** Usuario + Kimi  
**Fecha de inicio:** Pendiente confirmación  
**Fecha objetivo MVP:** 2 semanas
