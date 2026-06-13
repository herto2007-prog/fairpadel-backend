import type {
  SlotDisponible,
  PartidoAsignado,
  DistribucionDia,
  PartidoProgramar,
  Conflicto,
  LogAsignacion,
} from './programacion.service';
import type { DescansoCalculatorService, SlotInfo } from './descanso-calculator.service';

// Utilidades PURAS de programación, extraídas verbatim de programacion.service.
// Sin dependencias inyectadas ni acceso a BD: parseo/formato de horas,
// agrupación por fecha, día de la semana y validación de conflictos de
// saturación. El servicio orquesta BD y delega aquí estos cálculos.

export function parseHora(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h + m / 60;
  }

export function formatHora(decimal: number): string {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

export function calcularHoraFin(horaInicio: string): string {
    const [h, m] = horaInicio.split(':').map(Number);
    const totalMinutos = h * 60 + m + 70; // 90 min = 1.5h
    const horaFin = Math.floor(totalMinutos / 60);
    const minutosFin = totalMinutos % 60;
    return `${horaFin.toString().padStart(2, '0')}:${minutosFin.toString().padStart(2, '0')}`;
  }

export function getDiaSemana(fecha: string): string {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const date = new Date(fecha + 'T12:00:00-03:00'); // Mediodía Paraguay
    return dias[date.getDay()];
  }

export function agruparSlotsPorFecha(slots: SlotDisponible[]): Record<string, SlotDisponible[]> {
    const agrupado: Record<string, SlotDisponible[]> = {};
    for (const slot of slots) {
      if (!agrupado[slot.fecha]) {
        agrupado[slot.fecha] = [];
      }
      agrupado[slot.fecha].push(slot);
    }
    // Ordenar slots dentro de cada fecha por hora
    for (const fecha of Object.keys(agrupado)) {
      agrupado[fecha].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }
    return agrupado;
  }

export function agruparAsignacionesPorFecha(asignaciones: PartidoAsignado[]): Record<string, PartidoAsignado[]> {
    const agrupado: Record<string, PartidoAsignado[]> = {};
    for (const a of asignaciones) {
      if (!agrupado[a.fecha]) {
        agrupado[a.fecha] = [];
      }
      agrupado[a.fecha].push(a);
    }
    return agrupado;
  }

export function validarConflictos(
    distribucion: DistribucionDia[],
    partidosOriginales?: PartidoProgramar[],
  ): Conflicto[] {
    const conflictos: Conflicto[] = [];
    const totalAsignados = distribucion.reduce((sum, d) => sum + d.partidos.length, 0);
    const totalEsperados = partidosOriginales?.length || 0;

    // Verificar si faltan partidos por asignar
    if (totalEsperados > 0 && totalAsignados < totalEsperados) {
      conflictos.push({
        tipo: 'SIN_DISPONIBILIDAD',
        severidad: 'BLOQUEANTE',
        partidoId: '',
        mensaje: `Solo se pudieron asignar ${totalAsignados} de ${totalEsperados} partidos`,
        sugerencia: 'Agrega más días o extiende los horarios en el tab Canchas',
        accion: 'AGREGAR_DIAS',
      });
    }

    // Revisar días saturados
    for (const dia of distribucion) {
      const porcentajeOcupado = (dia.slotsAsignados / dia.slotsDisponibles) * 100;
      
      if (porcentajeOcupado >= 100) {
        conflictos.push({
          tipo: 'ADVERTENCIA',
          severidad: 'ADVERTENCIA',
          partidoId: '',
          mensaje: `El día ${dia.fecha} está completamente saturado (${dia.slotsAsignados}/${dia.slotsDisponibles} slots)`,
          sugerencia: 'Considera agregar otro día de disponibilidad',
          accion: 'AGREGAR_DIAS',
        });
      } else if (porcentajeOcupado >= 90) {
        conflictos.push({
          tipo: 'ADVERTENCIA',
          severidad: 'ADVERTENCIA',
          partidoId: '',
          mensaje: `El día ${dia.fecha} está casi saturado (${Math.round(porcentajeOcupado)}%)`,
          sugerencia: 'El día tiene poco margen para retrasos o cambios',
          accion: 'ACEPTAR_RIESGO',
        });
      }
    }

    return conflictos;
  }


export function construirDistribucion(
    asignaciones: PartidoAsignado[],
    slotsPorFecha: Record<string, SlotDisponible[]>,
    fechasOrdenadas: string[],
  ): DistribucionDia[] {
    const asignacionesPorFecha = agruparAsignacionesPorFecha(asignaciones);
    const distribucion: DistribucionDia[] = [];

    for (const fecha of fechasOrdenadas) {
      const partidosDelDia = asignacionesPorFecha[fecha];
      if (!partidosDelDia?.length) continue;

      const diaSlots = slotsPorFecha[fecha] || [];
      const horasInicio = diaSlots.map(s => s.horaInicio).sort();
      const horasFin = diaSlots.map(s => s.horaFin).sort();

      distribucion.push({
        fecha,
        diaSemana: getDiaSemana(fecha),
        horarioInicio: horasInicio[0] || '18:00',
        horarioFin: horasFin[horasFin.length - 1] || '23:00',
        slotsDisponibles: diaSlots.length,
        slotsAsignados: partidosDelDia.length,
        partidos: partidosDelDia.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
      });
    }

    return distribucion;
  }

export function verificarConflictoPareja(
    descansoCalculator: DescansoCalculatorService,
    partido: PartidoProgramar,
    fecha: string,
    horaInicio: string,
    asignacionesExistentes: PartidoAsignado[],
  ): { conflicto: boolean; razon?: string } {
    const parejaIds = [partido.inscripcion1Id, partido.inscripcion2Id].filter(Boolean);
    const slotPropuesto: SlotInfo = { fecha, horaInicio, horaFin: horaInicio };

    for (const parejaId of parejaIds) {
      if (!parejaId) continue;

      // Partidos de esta pareja en la misma fecha (para validar máximo 2)
      const partidosMismaFecha = asignacionesExistentes.filter(a => 
        a.fecha === fecha && (a.pareja1?.includes(parejaId) || a.pareja2?.includes(parejaId))
      );

      // Máximo 2 partidos por día por pareja
      if (partidosMismaFecha.length >= 2) {
        return {
          conflicto: true,
          razon: `Máximo 2 partidos por día (${partidosMismaFecha.length} ya asignados)`,
        };
      }

      // Verificar 2h de descanso usando el servicio centralizado (todos los partidos de la pareja)
      const todosLosPartidos = asignacionesExistentes.filter(a => 
        a.pareja1?.includes(parejaId) || a.pareja2?.includes(parejaId)
      );

      for (const p of todosLosPartidos) {
        const slotAnterior: SlotInfo = { 
          fecha: p.fecha, 
          horaInicio: p.horaInicio, 
          horaFin: p.horaFin 
        };
        
        const validacion = descansoCalculator.validarSlotConDescanso(
          slotPropuesto,
          slotAnterior,
          120 // 2 horas de descanso
        );
        
        if (!validacion.valido) {
          const horaMinima = descansoCalculator.calcularHoraMinimaDescanso(
            p.fecha,
            p.horaFin,
            120
          );
          return {
            conflicto: true,
            razon: `Descanso reglamentario: jugó a las ${p.horaInicio}, puede jugar desde las ${horaMinima.hora} (2h de descanso)`,
          };
        }
      }
    }

    return { conflicto: false };
  }

export function tieneConflictoPareja(
    descansoCalculator: DescansoCalculatorService,
    parejaIds: (string | undefined)[],
    fecha: string,
    horaInicio: string,
    asignacionesExistentes: PartidoAsignado[],
  ): boolean {
    const resultado = verificarConflictoPareja(
      descansoCalculator,
      { 
        id: '', 
        fase: '', 
        orden: 0, 
        categoriaId: '', 
        categoriaNombre: '',
        inscripcion1Id: parejaIds[0],
        inscripcion2Id: parejaIds[1],
      } as PartidoProgramar,
      fecha,
      horaInicio,
      asignacionesExistentes,
    );
    return resultado.conflicto;
  }

export function encontrarSlotOptimo(
    descansoCalculator: DescansoCalculatorService,
    partido: PartidoProgramar,
    fechasPermitidas: string[],
    slotsPorFecha: Record<string, SlotDisponible[]>,
    slotsAsignados: Set<string>,
    asignacionesExistentes: PartidoAsignado[],
    canchasPermitidas?: string[],
    horaMinima?: string,
    horaMaxima?: string,
    logs?: LogAsignacion[],
  ): PartidoAsignado | null {
    // Recopilar info de parejas para este partido
    const parejaIds = [partido.inscripcion1Id, partido.inscripcion2Id].filter(Boolean);

    for (const fecha of fechasPermitidas) {
      let slotsDelDia = slotsPorFecha[fecha] || [];

      // Filtrar por canchas permitidas (para finales)
      if (canchasPermitidas?.length) {
        slotsDelDia = slotsDelDia.filter(s => canchasPermitidas.includes(s.torneoCanchaId));
      }

      // Filtrar por hora mínima (para finales)
      if (horaMinima) {
        slotsDelDia = slotsDelDia.filter(s => s.horaInicio >= horaMinima);
      }

      // Filtrar por hora máxima (para finales)
      if (horaMaxima) {
        slotsDelDia = slotsDelDia.filter(s => s.horaInicio <= horaMaxima);
      }

      for (const slot of slotsDelDia) {
        const slotKey = `${fecha}-${slot.torneoCanchaId}-${slot.horaInicio}`;

        // Verificar si el slot ya está asignado
        if (slotsAsignados.has(slotKey)) continue;

        // Verificar conflictos de pareja con mensaje informativo
        const verificacion = verificarConflictoPareja(descansoCalculator,
          partido,
          fecha,
          slot.horaInicio,
          asignacionesExistentes,
        );

        if (verificacion.conflicto) {
          // Log informativo sobre por qué se saltó este slot
          console.log(
            `[Programacion] Slot ${slot.horaInicio} en ${fecha} saltado para partido ${partido.id}: ${verificacion.razon}`
          );
          
          // Agregar al array de logs para el frontend
          if (logs) {
            logs.push({
              tipo: 'SALTADO',
              partidoId: partido.id,
              categoriaNombre: partido.categoriaNombre,
              fase: partido.fase,
              fecha,
              hora: slot.horaInicio,
              mensaje: verificacion.razon || 'Conflicto de horario',
            });
          }
          
          continue;
        }

        // Slot válido encontrado - agregar log
        if (logs) {
          logs.push({
            tipo: 'ASIGNADO',
            partidoId: partido.id,
            categoriaNombre: partido.categoriaNombre,
            fase: partido.fase,
            fecha,
            hora: slot.horaInicio,
            mensaje: `${partido.categoriaNombre} - ${partido.fase} asignado a las ${slot.horaInicio} en ${fecha}`,
          });
        }

        return {
          partidoId: partido.id,
          fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          torneoCanchaId: slot.torneoCanchaId,
          sedeNombre: slot.sedeNombre,
          canchaNombre: slot.canchaNombre,
          fase: partido.fase,
          categoriaNombre: partido.categoriaNombre,
          pareja1: partido.pareja1 ? 
            `${partido.pareja1.jugador1.nombre}/${partido.pareja1.jugador2?.nombre || '?'}` : 
            undefined,
          pareja2: partido.pareja2 ? 
            `${partido.pareja2.jugador1.nombre}/${partido.pareja2.jugador2?.nombre || '?'}` : 
            undefined,
        };
      }
    }

    return null;
  }

export function asignarPartidosBalanceado(
    descansoCalculator: DescansoCalculatorService,
    partidos: PartidoProgramar[],
    fechas: string[],
    slotsPorFecha: Record<string, SlotDisponible[]>,
    slotsAsignados: Set<string>,
    asignaciones: PartidoAsignado[],
    logs?: LogAsignacion[],
  ): void {
    // DISTRIBUCIÓN BALANCEADA + OPTIMIZACIÓN DE ADELANTAR
    // 
    // 1. Calcular cuántos partidos debería tener cada día proporcionalmente
    // 2. Por cada partido, encontrar el día con más "espacio proporcional disponible"
    // 3. Dentro de ese día, usar la lógica de adelantar para minimizar huecos
    
    // PASO 1: Calcular capacidad y objetivo de cada día
    const capacidadPorDia = new Map<string, number>();
    const asignadosPorDia = new Map<string, number>();
    let capacidadTotal = 0;
    
    for (const fecha of fechas) {
      const slots = slotsPorFecha[fecha] || [];
      const capacidad = slots.length;
      capacidadPorDia.set(fecha, capacidad);
      asignadosPorDia.set(fecha, 0);
      capacidadTotal += capacidad;
    }
    
    if (capacidadTotal === 0) return;
    
    // Calcular objetivo de partidos por día (proporcional)
    const objetivoPorDia = new Map<string, number>();
    for (const fecha of fechas) {
      const capacidad = capacidadPorDia.get(fecha) || 0;
      const proporcion = capacidad / capacidadTotal;
      objetivoPorDia.set(fecha, Math.round(partidos.length * proporcion));
    }
    
    // Ajustar por redondeo
    let totalObjetivo = 0;
    for (const cantidad of objetivoPorDia.values()) {
      totalObjetivo += cantidad;
    }
    if (totalObjetivo !== partidos.length && fechas.length > 0) {
      const ultimaFecha = fechas[fechas.length - 1];
      objetivoPorDia.set(ultimaFecha, (objetivoPorDia.get(ultimaFecha) || 0) + (partidos.length - totalObjetivo));
    }
    
    // PASO 2: Asignar partidos manteniendo el balance
    const partidosPendientes = [...partidos];
    
    while (partidosPendientes.length > 0) {
      // Encontrar el día con más "margen proporcional" (más lejos de su objetivo)
      let mejorFecha: string | null = null;
      let mejorMargen = -Infinity;
      
      for (const fecha of fechas) {
        const asignados = asignadosPorDia.get(fecha) || 0;
        const objetivo = objetivoPorDia.get(fecha) || 0;
        const margen = objetivo - asignados; // Cuántos más puede recibir
        
        // Solo considerar días que aún necesitan partidos y tienen slots libres
        const slotsLibres = (slotsPorFecha[fecha] || []).filter(s => {
          const key = `${fecha}-${s.torneoCanchaId}-${s.horaInicio}`;
          return !slotsAsignados.has(key);
        }).length;
        
        if (margen > mejorMargen && slotsLibres > 0) {
          mejorMargen = margen;
          mejorFecha = fecha;
        }
      }
      
      if (!mejorFecha) break; // No hay más días disponibles
      
      // Intentar asignar un partido al día seleccionado
      const slotsDelDia = slotsPorFecha[mejorFecha] || [];
      let partidoAsignado = false;
      
      for (const slot of slotsDelDia) {
        const slotKey = `${mejorFecha}-${slot.torneoCanchaId}-${slot.horaInicio}`;
        if (slotsAsignados.has(slotKey)) continue;
        
        // Buscar el primer partido pendiente que pueda usar este slot
        for (let i = 0; i < partidosPendientes.length; i++) {
          const partido = partidosPendientes[i];
          
          const verificacion = verificarConflictoPareja(descansoCalculator,
            partido,
            mejorFecha,
            slot.horaInicio,
            asignaciones,
          );
          
          if (!verificacion.conflicto) {
            // Asignar partido
            const asignacion: PartidoAsignado = {
              partidoId: partido.id,
              fecha: mejorFecha,
              horaInicio: slot.horaInicio,
              horaFin: slot.horaFin,
              torneoCanchaId: slot.torneoCanchaId,
              sedeNombre: slot.sedeNombre,
              canchaNombre: slot.canchaNombre,
              fase: partido.fase,
              categoriaNombre: partido.categoriaNombre,
              pareja1: partido.pareja1 ? 
                `${partido.pareja1.jugador1.nombre}/${partido.pareja1.jugador2?.nombre || '?'}` : 
                undefined,
              pareja2: partido.pareja2 ? 
                `${partido.pareja2.jugador1.nombre}/${partido.pareja2.jugador2?.nombre || '?'}` : 
                undefined,
            };
            
            asignaciones.push(asignacion);
            slotsAsignados.add(slotKey);
            asignadosPorDia.set(mejorFecha, (asignadosPorDia.get(mejorFecha) || 0) + 1);
            
            if (logs) {
              logs.push({
                tipo: i > 0 ? 'ADELANTADO' : 'ASIGNADO',
                partidoId: partido.id,
                categoriaNombre: partido.categoriaNombre,
                fase: partido.fase,
                fecha: mejorFecha,
                hora: slot.horaInicio,
                mensaje: i > 0 
                  ? `${partido.categoriaNombre} - ${partido.fase} ADELANTADO a ${mejorFecha} ${slot.horaInicio} (balance: ${asignadosPorDia.get(mejorFecha)}/${objetivoPorDia.get(mejorFecha)})`
                  : `${partido.categoriaNombre} - ${partido.fase} asignado a ${mejorFecha} ${slot.horaInicio} (balance: ${asignadosPorDia.get(mejorFecha)}/${objetivoPorDia.get(mejorFecha)})`,
              });
            }
            
            partidosPendientes.splice(i, 1);
            partidoAsignado = true;
            break;
          }
        }
        
        if (partidoAsignado) break;
      }
      
      // Si no se pudo asignar a este día, marcarlo como lleno para esta iteración
      if (!partidoAsignado) {
        asignadosPorDia.set(mejorFecha, 999999); // Forzar a buscar otro día
      }
    }
    
    // Si quedaron partidos sin asignar (no cabían en los días disponibles)
    if (partidosPendientes.length > 0 && logs) {
      for (const partido of partidosPendientes) {
        logs.push({
          tipo: 'SALTADO',
          partidoId: partido.id,
          categoriaNombre: partido.categoriaNombre,
          fase: partido.fase,
          fecha: '',
          hora: '',
          mensaje: `⚠️ ${partido.categoriaNombre} - ${partido.fase} NO SE PUDO ASIGNAR (sin slots disponibles)`,
        });
      }
    }
  }
