import type {
  SlotDisponible,
  PartidoAsignado,
  DistribucionDia,
  PartidoProgramar,
  Conflicto,
} from './programacion.service';

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

