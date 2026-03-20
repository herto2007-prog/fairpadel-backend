# AUDITORÍA DE FLUJO DE TORNEOS - FairPadel

> **Documento de auditoría técnica**  
> **Fecha:** 2026-03-19  
> **Versión:** 1.0  
> **Propósito:** Mapear el flujo completo de torneos para saneamiento de código  

---

## 🏷️ PATRÓN DE COMENTARIOS PARA AUDITORÍAS

Cuando encuentres código que necesite revisión, usa este patrón estándar:

```typescript
// [AUDITORIA-YYYY-MM-DD] TIPO: Descripción breve
// RAZÓN: Explicación de por qué se marca
// ACCIÓN: Verificar / Eliminar / Refactorizar / Mantener
// REF: Referencia a este documento (sección, endpoint, etc.)

// Ejemplo:
// [AUDITORIA-2026-03-19] DEPRECATED: Endpoint no usado en flujo actual
// RAZÓN: Reemplazado por nuevo flujo en Canchas y Sorteo
// ACCIÓN: Verificar si otras partes lo usan antes de eliminar
// REF: Sección 3.2 - Paso 1.b (nuevo flujo)
```

### Tipos de marcado:

| Tipo | Uso | Ejemplo |
|------|-----|---------|
| `DEPRECATED` | Código reemplazado por nuevo flujo | Endpoint viejo de canchas |
| `UNUSED` | Código que no se ejecuta en el flujo normal | Función de test abandonada |
| `DUPLICATED` | Código repetido en otro lugar | Lógica de cálculo en 2 services |
| `REVIEW` | Necesita revisión de lógica | Cálculo de slots complejo |
| `CRITICAL` | No tocar - parte del flujo activo | Generación de bracket |

---

## 📋 FLUJO COMPLETO DE UN TORNEO

### FASE 0: PRE-REQUISITOS DEL SISTEMA

Antes de crear un torneo, deben existir:

#### Entidades requeridas en BD:
1. **Categorías** (`Category`) - Cargadas por admin
2. **Modalidades** (`ModalidadConfig`) - Cargadas por admin
3. **Sedes** (`Sede`) - Creadas por admin
4. **Canchas** (`SedeCancha`) - Asociadas a sedes

#### Endpoints de configuración (ADMIN):
```
GET    /admin/categories          - Listar categorías
POST   /admin/categories          - Crear categoría
GET    /admin/modalidades         - Listar modalidades
POST   /admin/modalidades         - Crear modalidad
GET    /admin/sedes               - Listar sedes
POST   /admin/sedes               - Crear sede
POST   /admin/sedes/:id/canchas   - Crear cancha en sede
```

---

### FASE 1: CREACIÓN DEL TORNEO

#### 1.1 Wizard de Creación (Organizador)
**Componente Frontend:** `frontend/src/features/tournaments/pages/TournamentWizardPage.tsx`

**Pasos del wizard:**
1. **Info General**: Nombre, descripción, país, ciudad, sede
2. **Fechas**: Inicio, fin, límite inscripción, fecha finales (Día D)
3. **Categorías**: Selección múltiple de categorías disponibles
4. **Modalidades**: Selección de modalidad (Americana, Zona-Fase, etc.)
5. **Preview**: Vista previa y confirmación

#### 1.2 Endpoints utilizados en creación:
```
POST   /tournaments               - Crear torneo (datos básicos)
POST   /tournaments/:id/categories - Asignar categorías
POST   /tournaments/:id/modalidades - Asignar modalidades
```

#### 1.3 Tablas afectadas:
- `tournaments` - Datos del torneo
- `tournament_categories` - Relación torneo-categorías
- `tournament_modalidades` - Relación torneo-modalidades

---

### FASE 2: CONFIGURACIÓN DE CANCHAS Y ESPACIOS

#### 2.1 Nuevo Flujo: Tab "Canchas y Sorteo" (ACTIVO)
**Componente Frontend:** `frontend/src/features/organizador/components/canchas-sorteo/CanchasSorteoManager.tsx`

**Estado:** ✅ EN USO (reemplaza tabs anteriores)

**Paso 1.a - Configurar Finales:**
- Horario inicio/fin de finales
- Selección de canchas para finales

**Paso 1.b - Configurar Días de Juego:**
- Agregar días con fecha
- Horario inicio/fin
- Duración de slot (60/90/120 min)
- Selección de canchas por día
- Botón "Gestionar Sedes"

**Paso 2 - Cerrar y Sortear:**
- Selección de categorías (mínimo 8 parejas)
- Cálculo de necesidad de slots
- Modal confirmación/advertencia
- Ejecución de sorteo

#### Endpoints del nuevo flujo:
```
GET    /admin/canchas-sorteo/:tournamentId/canchas          - Listar canchas
GET    /admin/canchas-sorteo/:tournamentId/configuracion    - Config actual
POST   /admin/canchas-sorteo/finales                        - Guardar finales
POST   /admin/canchas-sorteo/dias                           - Agregar día
POST   /admin/canchas-sorteo/calcular-slots                 - Calcular necesidad
POST   /admin/canchas-sorteo/cerrar-y-sortear               - Cerrar + sortear

GET    /admin/torneos/:id/disponibilidad/sedes              - Listar sedes
POST   /admin/torneos/:id/disponibilidad/sedes              - Agregar sede
DELETE /admin/torneos/:id/disponibilidad/sedes/:sedeId      - Remover sede
```

#### Tablas afectadas (nuevo flujo):
- `tournaments` - `horaInicioFinales`, `horaFinFinales`, `canchasFinales`
- `torneo_disponibilidad_dias` - Días configurados
- `torneo_slots` - Slots generados
- `torneo_canchas` - Canchas asignadas al torneo
- `torneo_sedes` - Sedes asignadas al torneo

---

#### 2.2 Flujo Antiguo: Tabs Separados (DEPRECATED)

##### Tab "Canchas" (ANTIGUO - NO USAR)
**Componente:** `frontend/src/features/organizador/components/disponibilidad/CanchasManager.tsx`

```
// [AUDITORIA-2026-03-19] DEPRECATED: Componente reemplazado
// RAZÓN: Nuevo flujo unificado en Canchas y Sorteo
// ACCIÓN: Verificar si se usa en algún lugar antes de eliminar
// REF: FASE 2.1 - Nuevo flujo activo
```

**Endpoints antiguos:**
```
GET    /admin/torneos/:id/disponibilidad          - Obtener disponibilidad
POST   /admin/torneos/:id/disponibilidad          - Configurar día (antiguo)
POST   /admin/torneos/:id/disponibilidad/finales  - Configurar finales (antiguo)
DELETE /admin/torneos/:id/disponibilidad/dias/:diaId - Eliminar día
```

##### Tab "Programación" (ANTIGUO - NO USAR)
**Componente:** `frontend/src/features/organizador/components/programacion/ProgramacionManager.tsx`

```
// [AUDITORIA-2026-03-19] DEPRECATED: Componente reemplazado
// RAZÓN: Programación ahora se hace automáticamente al sortear
// ACCIÓN: Revisar si tiene funciones útiles para reutilizar
// REF: FASE 3 - Sorteo masivo
```

---

### FASE 3: INSCRIPCIONES

#### 3.1 Apertura de Inscripciones
**Componente:** `frontend/src/features/organizador/components/inscripciones/InscripcionesManager.tsx`

**Endpoints:**
```
POST   /admin/tournament-categories/:id/abrir    - Abrir inscripción categoría
POST   /admin/tournament-categories/:id/cerrar   - Cerrar inscripción categoría
```

#### 3.2 Inscripción de Jugadores
**Componente Público:** `frontend/src/features/inscripciones/pages/InscripcionWizardPage.tsx`

**Flujo:**
1. Buscar torneo
2. Seleccionar categoría
3. Formulario pareja (jugador 1 + jugador 2)
4. Pago (si aplica)
5. Confirmación

**Endpoints:**
```
POST   /inscripciones                         - Crear inscripción
POST   /inscripciones/:id/confirmar          - Confirmar inscripción
POST   /inscripciones/:id/cancelar           - Cancelar inscripción
```

#### Tablas afectadas:
- `inscripciones` - Datos de inscripción
- `tournament_categories` - Estado de inscripción

---

### FASE 4: SORTEO Y GENERACIÓN DE BRACKET

#### 4.1 Sorteo Masivo (Nuevo Flujo)
**Componente:** `CanchasSorteoManager` - Paso 2

**Endpoint:**
```
POST   /admin/canchas-sorteo/cerrar-y-sortear
```

**Proceso Backend:**
1. Valida slots disponibles
2. Cierra inscripciones de categorías seleccionadas
3. Sortea parejas en zonas (aleatorio)
4. Reserva slots para TODAS las fases:
   - Zona → Repechaje → Octavos → Cuartos → Semis → Final
5. Genera `FixtureVersion` para cada categoría
6. Crea `Match` para cada partido

#### 4.2 Sorteo Individual (ANTIGUO)
```
// [AUDITORIA-2026-03-19] DEPRECATED: Reemplazado por sorteo masivo
// RAZÓN: Nuevo flujo unificado permite sortear múltiples categorías
// ACCIÓN: Verificar si se usa en algún edge case
// REF: FASE 4.1 - Sorteo masivo
```

**Endpoints antiguos:**
```
POST   /bracket/generate              - Generar bracket individual
POST   /bracket/:categoryId/sortear   - Sortear categoría individual
```

#### Tablas afectadas:
- `fixture_versions` - Versión del bracket
- `matches` - Partidos individuales
- `torneo_slots` - Slots marcados como RESERVADO/OCUPADO
- `tournament_categories` - Estado cambia a "CERRADA"

---

### FASE 5: DESARROLLO DEL TORNEO

#### 5.1 Gestión de Partidos
**Componente:** Tab "Fixture" (a modificar)

**Endpoints necesarios:**
```
GET    /tournaments/:id/fixture          - Ver fixture completo
GET    /matches/:id                      - Detalle de partido
POST   /matches/:id/resultado            - Cargar resultado
POST   /matches/:id/reprogramar          - Mover a otro slot
```

#### 5.2 Avance Automático
Cuando se carga un resultado:
1. Se actualiza el partido
2. El ganador avanza al siguiente slot (ya reservado)
3. Si es zona, el perdedor puede ir a repechaje

---

### FASE 6: FINALIZACIÓN

#### 6.1 Cierre de Torneo
```
POST   /admin/tournaments/:id/finalizar
```

#### 6.2 Premiación y Estadísticas
```
GET    /tournaments/:id/resultados       - Resultados finales
GET    /tournaments/:id/estadisticas     - Estadísticas del torneo
```

---

## 🔍 MAPEO DE ENDPOINTS POR ESTADO

### ✅ ENDPOINTS ACTIVOS (USAR)

| Endpoint | Método | Uso | Componente |
|----------|--------|-----|------------|
| `/tournaments` | POST | Crear torneo | TournamentWizard |
| `/tournaments/:id/categories` | POST | Asignar categorías | TournamentWizard |
| `/admin/canchas-sorteo/finales` | POST | Configurar finales | CanchasSorteoManager |
| `/admin/canchas-sorteo/dias` | POST | Agregar día | CanchasSorteoManager |
| `/admin/canchas-sorteo/calcular-slots` | POST | Calcular necesidad | CanchasSorteoManager |
| `/admin/canchas-sorteo/cerrar-y-sortear` | POST | Sortear | CanchasSorteoManager |
| `/admin/torneos/:id/disponibilidad/sedes` | GET/POST/DELETE | Gestionar sedes | ModalSedes |
| `/inscripciones` | POST | Inscribir pareja | InscripcionWizard |

### ⚠️ ENDPOINTS DEPRECATED (NO USAR - REVISAR)

| Endpoint | Método | Reemplazado por | Acción |
|----------|--------|-----------------|--------|
| `/admin/torneos/:id/disponibilidad` | POST/GET | `/admin/canchas-sorteo/*` | Verificar uso |
| `/admin/torneos/:id/disponibilidad/finales` | POST | `/admin/canchas-sorteo/finales` | Verificar uso |
| `/bracket/generate` | POST | `/admin/canchas-sorteo/cerrar-y-sortear` | Verificar uso |
| `/bracket/:id/sortear` | POST | `/admin/canchas-sorteo/cerrar-y-sortear` | Verificar uso |

---

## 📁 ESTRUCTURA DE ARCHIVOS POR ESTADO

### ✅ ARCHIVOS ACTIVOS (MANTENER)

```
frontend/src/features/organizador/components/canchas-sorteo/
├── CanchasSorteoManager.tsx      # Componente principal (NUEVO FLUJO)

canchas-sorteo.service.ts          # Servicio backend (NUEVO FLUJO)
canchas-sorteo.controller.ts       # Controller backend (NUEVO FLUJO)
```

### ⚠️ ARCHIVOS DEPRECATED (REVISAR)

```
// [AUDITORIA-2026-03-19] DEPRECATED: Revisar para eliminación
frontend/src/features/organizador/components/disponibilidad/
├── CanchasManager.tsx             # Tab Canchas antiguo
├── DisponibilidadConfig.tsx       # Configuración antigua
├── DisponibilidadWizard.tsx       # Wizard antiguo

// [AUDITORIA-2026-03-19] DEPRECATED: Revisar para eliminación
frontend/src/features/organizador/components/programacion/
├── ProgramacionManager.tsx        # Tab Programación antiguo
├── VistaDragDrop.tsx              # Vista antigua
```

---

## 🗄️ MODELO DE DATOS - TABLAS CRÍTICAS

### Tablas del Nuevo Flujo (MANTENER)

```sql
-- Torneo
CREATE TABLE tournaments (
  id UUID PRIMARY KEY,
  -- ... campos básicos ...
  hora_inicio_finales VARCHAR(5),
  hora_fin_finales VARCHAR(5),
  canchas_finales TEXT[], -- Array de TorneoCancha IDs
  -- ...
);

-- Disponibilidad por día
CREATE TABLE torneo_disponibilidad_dias (
  id UUID PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id),
  fecha TIMESTAMP WITH TIME ZONE,
  hora_inicio VARCHAR(5),
  hora_fin VARCHAR(5),
  minutos_slot INTEGER DEFAULT 90
);

-- Slots individuales (la grilla)
CREATE TABLE torneo_slots (
  id UUID PRIMARY KEY,
  disponibilidad_id UUID REFERENCES torneo_disponibilidad_dias(id),
  torneo_cancha_id UUID REFERENCES torneo_canchas(id),
  hora_inicio VARCHAR(5),
  hora_fin VARCHAR(5),
  estado VARCHAR(20) DEFAULT 'LIBRE', -- LIBRE, RESERVADO, OCUPADO
  match_id UUID REFERENCES matches(id)
);
```

### Tablas del Flujo Antiguo (REVISAR)

```sql
-- [AUDITORIA-2026-03-19] REVIEW: Verificar si estas tablas se usan
-- Posiblemente se puedan consolidar con las nuevas

-- Tablas legacy a revisar:
-- - disponibilidad_cancha (¿siguen en uso?)
-- - horario_disponibilidad (¿siguen en uso?)
```

---

## ✅ CHECKLIST PARA PRUEBA DE FLUJO

Antes de considerar el flujo como "funcional 100%", verificar:

### Creación:
- [ ] Crear torneo con wizard
- [ ] Asignar múltiples categorías
- [ ] Asignar modalidad

### Configuración:
- [ ] Paso 1.a: Configurar finales con canchas
- [ ] Paso 1.b: Agregar múltiples días con diferentes canchas
- [ ] Gestionar Sedes: Agregar/remover sedes

### Inscripciones:
- [ ] Inscribir múltiples parejas en diferentes categorías
- [ ] Confirmar inscripciones

### Sorteo:
- [ ] Seleccionar categorías para sortear
- [ ] Ver modal de cálculo (slots necesarios)
- [ ] Ejecutar sorteo masivo
- [ ] Verificar que se generaron los brackets

### Desarrollo:
- [ ] Ver fixture con partidos
- [ ] Cargar resultados
- [ ] Verificar avance automático de ganadores

---

## 📝 NOTAS PARA SANEAMIENTO

### Cuando se apruebe la limpieza:

1. **Backend:** Eliminar controllers deprecated
2. **Frontend:** Eliminar componentes deprecated
3. **BD:** Revisar si hay tablas sin uso
4. **Tests:** Actualizar tests para usar nuevos endpoints

### Código a mantener por compatibilidad temporal:

- Servicios de bracket antiguos (hasta migrar todo)
- Endpoints de consulta de fixture (lectura)
- Vista de fixture existente (adaptar a nuevo flujo)

---

**Fin del documento de auditoría**
**Próxima revisión:** Después de pruebas del flujo completo
