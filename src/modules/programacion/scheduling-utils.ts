import type {
  SlotDisponible,
  PartidoAsignado,
  DistribucionDia,
  PartidoProgramar,
  Conflicto,
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
