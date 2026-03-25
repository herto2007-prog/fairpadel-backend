# 🛠️ SOLUCIÓN COMPLETA - IMPLEMENTACIÓN PARA FAIRPADEL

## 📋 RESUMEN DE CAMBIOS NECESARIOS

Esta guía proporciona el código específico que tu programador necesita implementar para solucionar el problema de scheduling cronológico.

---

## 🔧 PASO 1: MODIFICAR BASE DE DATOS (Prisma Schema)

### Archivo: `prisma/schema.prisma`

```prisma
// Agregar campo fasesPermitidas a TorneoDisponibilidadDia
model TorneoDisponibilidadDia {
  id           String   @id @default(uuid())
  tournamentId String
  fecha        String   // YYYY-MM-DD
  horaInicio   String   // HH:mm
  horaFin      String   // HH:mm
  minutosSlot  Int      @default(90)
  fasesPermitidas String? // ← NUEVO: ZONA,REPECHAJE,OCTAVOS,CUARTOS,SEMIS,FINAL
  
  tournament   Tournament @relation(fields: [tournamentId], references: [id])
  slots        TorneoSlot[]
  
  @@unique([tournamentId, fecha, horaInicio])
}

// Opcional: Agregar campo fase a TorneoSlot para tracking
model TorneoSlot {
  id                String   @id @default(uuid())
  disponibilidadId  String
  torneoCanchaId    String
  horaInicio        String
  horaFin           String
  estado            String   // LIBRE, RESERVADO, OCUPADO
  faseAsignada      String?  // ← NUEVO: Para tracking de qué fase ocupó el slot
  matchId           String?
  
  disponibilidad    TorneoDisponibilidadDia @relation(fields: [disponibilidadId], references: [id], onDelete: Cascade)
  torneoCancha      TorneoCancha @relation(fields: [torneoCanchaId], references: [id])
  match             Match? @relation(fields: [matchId], references: [id])
  
  @@unique([disponibilidadId, torneoCanchaId, horaInicio])
}
```

**Comando para migrar:**
```bash
npx prisma migrate dev --name add_fases_permitidas
```

---

## 🔧 PASO 2: MODIFICAR DTOs

### Archivo: `src/modules/bracket/dto/canchas-sorteo.dto.ts`

```typescript
/**
 * DTO para configurar días de juego (Paso 1.b) - ACTUALIZADO
 */
export class ConfigurarDiaJuegoDto {
  @IsString()
  tournamentId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD (ej: 2026-03-27)',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.length > 10) {
      return value.substring(0, 10);
    }
    return value;
  })
  fecha: string;

  @IsString()
  horaInicio: string; // "18:00"

  @IsString()
  horaFin: string; // "23:00"

  @IsNumber()
  @Min(30)
  @Max(180)
  minutosSlot: number = 90;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  canchasIds: string[];

  // ← NUEVO: Fases que pueden jugarse en este día
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  fasesPermitidas?: string[]; // ['ZONA', 'REPECHAJE']
}
```

---

## 🔧 PASO 3: MODIFICAR SERVICIO PRINCIPAL

### Archivo: `src/modules/bracket/canchas-sorteo.service.ts`

#### 3.1 Agregar método helper para obtener fases por día

```typescript
/**
 * Determina qué fases pueden jugarse en un día según su fecha
 * Esto es configurable según la lógica de negocio
 */
private obtenerFasesParaDia(fecha: string): FaseBracket[] {
  // Convertir fecha a día de la semana (0=Domingo, 4=Jueves, 5=Viernes, 6=Sábado)
  const date = new Date(fecha + 'T00:00:00');
  const diaSemana = date.getDay();
  
  // Lógica: Jueves(4)=Zona/Repechaje, Viernes(5)=Zona/Repechaje, 
  //         Sábado(6)=Octavos/Cuartos, Domingo(0)=Semis/Final
  switch (diaSemana) {
    case 4: // Jueves
      return [FaseBracket.ZONA, FaseBracket.REPECHAJE];
    case 5: // Viernes
      return [FaseBracket.ZONA, FaseBracket.REPECHAJE];
    case 6: // Sábado
      return [FaseBracket.OCTAVOS, FaseBracket.CUARTOS];
    case 0: // Domingo
      return [FaseBracket.SEMIS, FaseBracket.FINAL];
    default:
      return [FaseBracket.ZONA]; // Por defecto, cualquier día permite ZONA
  }
}
```

#### 3.2 Modificar `configurarDiaJuego` para guardar fases permitidas

```typescript
/**
 * PASO 1.b: Configurar días de juego - ACTUALIZADO
 */
async configurarDiaJuego(dto: ConfigurarDiaJuegoDto) {
  const torneo = await this.prisma.tournament.findUnique({
    where: { id: dto.tournamentId },
  });

  if (!torneo) {
    throw new NotFoundException('Torneo no encontrado');
  }

  // Determinar fases permitidas automáticamente si no se especifican
  const fasesPermitidas = dto.fasesPermitidas || 
    this.obtenerFasesParaDia(dto.fecha).join(',');

  const disponibilidad = await this.prisma.torneoDisponibilidadDia.upsert({
    where: {
      tournamentId_fecha_horaInicio: {
        tournamentId: dto.tournamentId,
        fecha: dto.fecha,
        horaInicio: dto.horaInicio,
      },
    },
    update: {
      horaFin: dto.horaFin,
      minutosSlot: dto.minutosSlot,
      fasesPermitidas, // ← NUEVO
    },
    create: {
      tournamentId: dto.tournamentId,
      fecha: dto.fecha,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      minutosSlot: dto.minutosSlot,
      fasesPermitidas, // ← NUEVO
    },
  });

  // Generar slots para cada cancha
  const slotsGenerados = await this.generarSlotsParaDia(
    disponibilidad.id,
    dto.canchasIds,
    dto.horaInicio,
    dto.horaFin,
    dto.minutosSlot,
  );

  return {
    success: true,
    message: `Día configurado con ${slotsGenerados} slots`,
    data: {
      disponibilidadId: disponibilidad.id,
      fecha: dto.fecha,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      minutosSlot: dto.minutosSlot,
      fasesPermitidas, // ← NUEVO: Devolver en respuesta
      slotsGenerados,
      canchas: dto.canchasIds.length,
    },
  };
}
```

#### 3.3 Modificar `cerrarInscripcionesYsortear` - **EL CAMBIO MÁS IMPORTANTE**

```typescript
/**
 * PASO 2: Cerrar inscripciones y sortear múltiples categorías - ACTUALIZADO
 * PROCESA POR DÍA respetando las fases permitidas de cada día
 */
async cerrarInscripcionesYsortear(
  dto: CerrarInscripcionesSortearDto,
): Promise<SorteoMasivoResponse> {
  const { tournamentId, categoriasIds } = dto;

  // 1. Verificar que hay suficientes slots
  const calculo = await this.calcularSlotsNecesarios(tournamentId, categoriasIds);
  
  if (!calculo.valido) {
    throw new BadRequestException({
      success: false,
      message: calculo.mensaje,
      detalle: calculo,
    });
  }

  // 2. Obtener días configurados ordenados cronológicamente con sus fases permitidas
  const diasConfig = await this.prisma.torneoDisponibilidadDia.findMany({
    where: { tournamentId },
    include: {
      slots: {
        where: { estado: 'LIBRE' },
        orderBy: { horaInicio: 'asc' },
      },
    },
    orderBy: { fecha: 'asc' },
  });

  if (diasConfig.length === 0) {
    throw new BadRequestException('No hay días configurados para el torneo');
  }

  // 3. Preparar datos de categorías
  const categoriasData = [];
  const todasInscripciones = await this.prisma.inscripcion.findMany({
    where: {
      tournamentId,
      estado: 'CONFIRMADA',
    },
  });
  
  for (const categoriaInfo of calculo.detallePorCategoria) {
    const categoria = await this.prisma.tournamentCategory.findUnique({
      where: { id: categoriaInfo.categoriaId },
    });

    if (!categoria) continue;

    const inscripcionesCategoria = todasInscripciones.filter(
      i => i.categoryId === categoria.categoryId
    );

    categoriasData.push({
      categoria,
      inscripciones: inscripcionesCategoria,
      nombre: categoriaInfo.nombre,
      slotsNecesarios: categoriaInfo.slotsNecesarios,
      detallePorFase: categoriaInfo.partidosPorFase,
    });
  }

  // 4. PROCESAR POR DÍA (cronológicamente) - **CAMBIO CLAVE**
  const asignacionesPorCategoria = new Map<string, SlotReserva[]>();
  
  for (const dia of diasConfig) {
    // Obtener fases permitidas para este día
    const fasesPermitidas = dia.fasesPermitidas 
      ? dia.fasesPermitidas.split(',') as FaseBracket[]
      : this.obtenerFasesParaDia(dia.fecha);

    if (fasesPermitidas.length === 0 || dia.slots.length === 0) {
      continue; // Saltar día sin fases o sin slots
    }

    // Obtener todos los partidos de TODAS las categorías que correspondan a estas fases
    const partidosParaAsignar = [];
    
    for (const catData of categoriasData) {
      // Verificar si esta categoría tiene partidos de estas fases pendientes
      const partidosCategoria = await this.obtenerPartidosPendientesPorFases(
        catData.categoria.id,
        fasesPermitidas
      );
      
      if (partidosCategoria.length > 0) {
        partidosParaAsignar.push({
          categoriaId: catData.categoria.id,
          categoriaNombre: catData.nombre,
          partidos: partidosCategoria,
        });
      }
    }

    if (partidosParaAsignar.length === 0) {
      continue; // No hay partidos para este día
    }

    // Ordenar con Round-Robin entre categorías
    const partidosOrdenados = this.ordenarRoundRobinPorCategoria(partidosParaAsignar);

    // Asignar partidos a slots del día
    const slotsAsignados = await this.asignarPartidosASlotsDelDia(
      partidosOrdenados,
      dia,
      asignacionesPorCategoria,
    );
  }

  // 5. Generar brackets y guardar con las asignaciones
  const categoriasSorteadas = [];
  
  for (const catData of categoriasData) {
    const slotsCategoria = asignacionesPorCategoria.get(catData.categoria.id) || [];
    
    // Cerrar inscripciones
    await this.prisma.tournamentCategory.update({
      where: { id: catData.categoria.id },
      data: { estado: 'INSCRIPCIONES_CERRADAS' },
    });

    // Generar bracket
    const numParejas = catData.inscripciones.length;
    const config = this.bracketService.calcularConfiguracion(numParejas);
    const { partidos } = await this.bracketService.generarBracket({
      tournamentCategoryId: catData.categoria.id,
      totalParejas: numParejas,
    });

    // Ordenar inscripciones aleatoriamente
    const inscripcionesOrdenadas = [...catData.inscripciones]
      .sort(() => Math.random() - 0.5);

    // Guardar bracket con slots asignados
    const fixtureVersionId = await this.bracketService.guardarBracket(
      catData.categoria.id,
      config,
      partidos,
      inscripcionesOrdenadas,
      slotsCategoria,
    );

    categoriasSorteadas.push({
      categoriaId: catData.categoria.id,
      nombre: catData.nombre,
      fixtureVersionId,
      totalPartidos: catData.slotsNecesarios,
      slotsReservados: slotsCategoria.length,
    });
  }

  // 6. Generar distribución por día
  const distribucionPorDia = this.calcularDistribucionPorDia(asignacionesPorCategoria);

  return {
    success: true,
    message: `Se sortearon ${categoriasSorteadas.length} categorías`,
    categoriasSorteadas,
    slotsTotalesReservados: Array.from(asignacionesPorCategoria.values())
      .flat().length,
    distribucionPorDia,
  };
}
```

#### 3.4 Agregar métodos auxiliares nuevos

```typescript
/**
 * Obtiene partidos pendientes de una categoría para ciertas fases
 */
private async obtenerPartidosPendientesPorFases(
  categoriaId: string,
  fases: FaseBracket[],
): Promise<Array<{ fase: FaseBracket; orden: number; partidoId?: string }>> {
  // En el contexto del sorteo, los partidos aún no existen en la BD
  // Devolvemos la estructura planificada basada en el cálculo del bracket
  const categoria = await this.prisma.tournamentCategory.findUnique({
    where: { id: categoriaId },
    include: {
      inscripciones: {
        where: { estado: 'CONFIRMADA' },
      },
    },
  });

  if (!categoria) return [];

  const numParejas = categoria.inscripciones.length;
  const calculo = this.bracketService.calcularSlotsNecesarios(numParejas);
  
  const partidos = [];
  
  for (const faseInfo of calculo.detallePorFase) {
    const fase = faseInfo.fase as FaseBracket;
    if (fases.includes(fase)) {
      for (let i = 0; i < faseInfo.partidos; i++) {
        partidos.push({
          fase,
          orden: i + 1,
        });
      }
    }
  }
  
  return partidos;
}

/**
 * Ordena partidos con Round-Robin entre categorías
 * Ej: CatA(1), CatB(1), CatC(1), CatA(2), CatB(2), CatC(2)...
 */
private ordenarRoundRobinPorCategoria(
  partidosPorCategoria: Array<{
    categoriaId: string;
    categoriaNombre: string;
    partidos: Array<{ fase: FaseBracket; orden: number }>;
  }>,
): Array<{
  categoriaId: string;
  categoriaNombre: string;
  fase: FaseBracket;
  orden: number;
}> {
  const resultado = [];
  const indices = new Map<string, number>();

  let hayMas = true;
  while (hayMas) {
    hayMas = false;
    
    for (const catData of partidosPorCategoria) {
      const idx = indices.get(catData.categoriaId) || 0;
      
      if (idx < catData.partidos.length) {
        const partido = catData.partidos[idx];
        resultado.push({
          categoriaId: catData.categoriaId,
          categoriaNombre: catData.categoriaNombre,
          fase: partido.fase,
          orden: partido.orden,
        });
        
        indices.set(catData.categoriaId, idx + 1);
        hayMas = true;
      }
    }
  }

  return resultado;
}

/**
 * Asigna partidos a slots de un día específico
 */
private async asignarPartidosASlotsDelDia(
  partidos: Array<{
    categoriaId: string;
    categoriaNombre: string;
    fase: FaseBracket;
    orden: number;
  }>,
  dia: any,
  asignacionesPorCategoria: Map<string, SlotReserva[]>,
): Promise<number> {
  let slotsAsignados = 0;
  
  for (let i = 0; i < partidos.length && i < dia.slots.length; i++) {
    const partido = partidos[i];
    const slot = dia.slots[i];
    
    const slotReserva: SlotReserva = {
      fecha: dia.fecha,
      horaInicio: slot.horaInicio,
      horaFin: slot.horaFin,
      torneoCanchaId: slot.torneoCanchaId,
      categoriaId: partido.categoriaId,
      fase: partido.fase,
      ordenPartido: partido.orden,
    };

    // Agregar a las asignaciones de la categoría
    if (!asignacionesPorCategoria.has(partido.categoriaId)) {
      asignacionesPorCategoria.set(partido.categoriaId, []);
    }
    asignacionesPorCategoria.get(partido.categoriaId)!.push(slotReserva);

    // Marcar slot como reservado
    await this.prisma.torneoSlot.update({
      where: { id: slot.id },
      data: { 
        estado: 'RESERVADO',
        faseAsignada: partido.fase, // ← NUEVO: Tracking
      },
    });

    slotsAsignados++;
  }

  return slotsAsignados;
}

/**
 * Calcula la distribución de slots por día para la respuesta
 */
private calcularDistribucionPorDia(
  asignacionesPorCategoria: Map<string, SlotReserva[]>,
): Array<{
  fecha: string;
  slotsReservados: number;
  categorias: string[];
}> {
  const porDia = new Map<string, { slots: number; categorias: Set<string> }>();

  for (const [, slots] of asignacionesPorCategoria) {
    for (const slot of slots) {
      if (!porDia.has(slot.fecha)) {
        porDia.set(slot.fecha, { slots: 0, categorias: new Set() });
      }
      
      const dia = porDia.get(slot.fecha)!;
      dia.slots++;
      dia.categorias.add(slot.categoriaId);
    }
  }

  return Array.from(porDia.entries())
    .map(([fecha, info]) => ({
      fecha,
      slotsReservados: info.slots,
      categorias: Array.from(info.categorias),
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
```

---

## 🔧 PASO 4: MODIFICAR `bracket.service.ts` - `guardarBracket`

El método `guardarBracket` ya recibe los slots correctamente asignados, pero necesitamos asegurarnos de que los use correctamente:

```typescript
async guardarBracket(
  tournamentCategoryId: string,
  config: BracketConfigResponse,
  partidos: MatchNode[],
  inscripciones: any[],
  slots?: { fecha: string; horaInicio: string; horaFin: string; torneoCanchaId: string; fase: string; ordenPartido: number }[],
): Promise<string> {
  // ... código existente hasta la creación de partidos ...

  // MVP: Asignar slot (cancha y horario) si está disponible y NO es BYE
  // Buscar slot por fase y orden del partido
  if (!partido.esBye && slots && slots.length > 0) {
    const slot = slots.find(s => 
      s.fase === partido.fase && 
      s.ordenPartido === partido.orden
    );
    
    if (slot) {
      createData.torneoCanchaId = slot.torneoCanchaId;
      createData.fechaProgramada = slot.fecha;
      createData.horaProgramada = slot.horaInicio;
      createData.horaFinEstimada = slot.horaFin;
      
      // ← NUEVO: Actualizar el slot en la BD para marcarlo como OCUPADO
      await this.prisma.torneoSlot.updateMany({
        where: {
          torneoCanchaId: slot.torneoCanchaId,
          disponibilidad: { fecha: slot.fecha },
          horaInicio: slot.horaInicio,
          estado: 'RESERVADO',
        },
        data: { 
          estado: 'OCUPADO',
          matchId: created.id,
        },
      });
    }
  }

  // ... resto del código ...
}
```

---

## 📊 RESUMEN DE CAMBIOS

| Archivo | Líneas Modificadas | Complejidad |
|---------|-------------------|-------------|
| `prisma/schema.prisma` | +2 campos | Baja |
| `canchas-sorteo.dto.ts` | +1 campo | Baja |
| `canchas-sorteo.service.ts` | ~150 líneas | **Alta** |
| `bracket.service.ts` | ~20 líneas | Media |

**Tiempo estimado de implementación:** 4-6 horas
**Tiempo estimado de testing:** 2-4 horas

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] 1. Modificar schema de Prisma y ejecutar migración
- [ ] 2. Actualizar DTO con fasesPermitidas
- [ ] 3. Implementar `obtenerFasesParaDia()`
- [ ] 4. Modificar `configurarDiaJuego()` para guardar fases
- [ ] 5. Refactorizar `cerrarInscripcionesYsortear()` para procesar por día
- [ ] 6. Implementar `ordenarRoundRobinPorCategoria()`
- [ ] 7. Implementar `asignarPartidosASlotsDelDia()`
- [ ] 8. Modificar `guardarBracket()` para marcar slots como OCUPADO
- [ ] 9. Probar con 1 categoría
- [ ] 10. Probar con 4 categorías
- [ ] 11. Probar con 16 categorías
- [ ] 12. Validar que las fases respeten los días configurados

---

## 🧪 TESTING RECOMENDADO

### Test 1: Una categoría, múltiples días
```typescript
// Configurar:
// - Jueves: Zona (10 partidos)
// - Viernes: Repechaje (5 partidos)
// - Sábado: Octavos (8 partidos)
// - Domingo: Semis/Final (3 partidos)

// Esperado:
// - Los 10 de ZONA van al Jueves
// - Los 5 de REPECHAJE van al Viernes
// - Los 8 de OCTAVOS van al Sábado
// - Los 3 de SEMIS/FINAL van al Domingo
```

### Test 2: Dos categorías, mismo día
```typescript
// Configurar:
// - Sábado: Octavos/Cuartos (20 slots)
// - Categoría A: 8 partidos de Octavos
// - Categoría B: 8 partidos de Octavos

// Esperado:
// - Slot 1: CatA-Octavo-1
// - Slot 2: CatB-Octavo-1
// - Slot 3: CatA-Octavo-2
// - Slot 4: CatB-Octavo-2
// (Round-robin alternando)
```

---

*Documento de implementación para Fairpadel*
