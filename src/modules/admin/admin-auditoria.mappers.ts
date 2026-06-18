/**
 * Transformadores puros del controller de auditoría de torneos.
 *
 * Extraídos VERBATIM desde admin-auditoria.controller.ts (corte 1 del refactor
 * de deuda técnica). Cada función recibe filas ya cargadas de Prisma y arma la
 * forma de respuesta; no tocan la base de datos. Cubiertos por
 * admin-auditoria.mappers.spec.ts (caracterización con golden values).
 */

/**
 * Mapea una inscripción (con sus relaciones) a la forma de auditoría.
 */
export function mapInscripcionAuditoria(insc: any) {
  const partidos = [...insc.partidosComoP1, ...insc.partidosComoP2];

  return {
    id: insc.id,
    estado: insc.estado,
    modoPago: insc.modoPago,
    notas: insc.notas,
    createdAt: insc.createdAt,
    estadoClasificacion: insc.estadoClasificacion,
    rondaClasificacion: insc.rondaClasificacion,
    pareja: {
      jugador1: insc.jugador1
        ? `${insc.jugador1.nombre} ${insc.jugador1.apellido}`
        : 'N/A',
      jugador1Categoria: insc.jugador1?.categoriaActual?.nombre || 'N/A',
      jugador2: insc.jugador2
        ? `${insc.jugador2.nombre} ${insc.jugador2.apellido}`
        : '(Pendiente)',
      jugador2Categoria: insc.jugador2?.categoriaActual?.nombre || 'N/A',
      telefonoJ1: insc.jugador1?.telefono,
      telefonoJ2: insc.jugador2?.telefono,
      completa: !!insc.jugador2,
      // IDs + datos editables (god-panel: corregir pareja / editar jugador)
      jugador1Id: insc.jugador1Id,
      jugador2Id: insc.jugador2Id || null,
      jugador2Documento: insc.jugador2Documento,
      j1: insc.jugador1
        ? { id: insc.jugador1.id, nombre: insc.jugador1.nombre, apellido: insc.jugador1.apellido, telefono: insc.jugador1.telefono, documento: insc.jugador1.documento }
        : null,
      j2: insc.jugador2
        ? { id: insc.jugador2.id, nombre: insc.jugador2.nombre, apellido: insc.jugador2.apellido, telefono: insc.jugador2.telefono, documento: insc.jugador2.documento }
        : null,
    },
    categoria: {
      id: insc.category.id,
      nombre: insc.category.nombre,
      genero: insc.category.tipo,
    },
    pagos: insc.pagos.map((p) => ({
      id: p.id,
      estado: p.estado,
      monto: p.monto,
      metodo: p.metodoPago,
      fecha: p.fechaPago,
    })),
    programacion: partidos.map((p) => ({
      fase: p.ronda,
      fecha: p.fechaProgramada,
      hora: p.horaProgramada,
      cancha: p.torneoCancha?.sedeCancha?.nombre,
      sede: p.torneoCancha?.sedeCancha?.sede?.nombre,
    })),
    tieneSlotAsignado: partidos.length > 0,
  };
}

/**
 * Aplica los filtros en memoria de inscripciones (búsqueda por nombre, sin slot).
 */
export function filtrarInscripcionesAuditoria(
  resultado: any[],
  filtros: { busqueda?: string; sinSlot?: boolean },
): any[] {
  // Filtro de búsqueda por nombre
  if (filtros.busqueda) {
    const busqueda = filtros.busqueda.toLowerCase();
    resultado = resultado.filter(
      (r) =>
        r.pareja.jugador1.toLowerCase().includes(busqueda) ||
        r.pareja.jugador2.toLowerCase().includes(busqueda) ||
        r.categoria.nombre.toLowerCase().includes(busqueda),
    );
  }

  // Filtro de sin slot
  if (filtros.sinSlot) {
    resultado = resultado.filter((r) => !r.tieneSlotAsignado);
  }

  return resultado;
}

/**
 * Mapea un partido (con sus relaciones) a la forma de auditoría.
 */
export function mapPartidoAuditoria(p: any) {
  const pareja1 = p.inscripcion1
    ? `${p.inscripcion1.jugador1?.nombre || ''} ${
        p.inscripcion1.jugador1?.apellido || ''
      } / ${p.inscripcion1.jugador2?.nombre || ''} ${
        p.inscripcion1.jugador2?.apellido || ''
      }`
    : 'Por definir';

  const pareja2 = p.inscripcion2
    ? `${p.inscripcion2.jugador1?.nombre || ''} ${
        p.inscripcion2.jugador1?.apellido || ''
      } / ${p.inscripcion2.jugador2?.nombre || ''} ${
        p.inscripcion2.jugador2?.apellido || ''
      }`
    : 'Por definir';

  const parejaGanadora = p.inscripcionGanadora
    ? `${p.inscripcionGanadora.jugador1?.nombre || ''} ${
        p.inscripcionGanadora.jugador1?.apellido || ''
      } / ${p.inscripcionGanadora.jugador2?.nombre || ''} ${
        p.inscripcionGanadora.jugador2?.apellido || ''
      }`
    : null;

  return {
    id: p.id,
    fase: p.ronda,
    numeroRonda: p.numeroRonda,
    estado: p.estado,
    categoria: {
      id: p.category.id,
      nombre: p.category.nombre,
      genero: p.category.tipo,
    },
    pareja1,
    pareja2,
    parejaGanadora,
    programacion: p.torneoCancha
      ? {
          fecha: p.fechaProgramada,
          hora: p.horaProgramada,
          cancha: p.torneoCancha.sedeCancha?.nombre,
          sede: p.torneoCancha.sedeCancha?.sede?.nombre,
        }
      : null,
    estaProgramado: !!p.torneoCanchaId,
    resultado: p.set1Pareja1 !== null
      ? {
          set1: `${p.set1Pareja1}-${p.set1Pareja2}`,
          set2: p.set2Pareja1 !== null ? `${p.set2Pareja1}-${p.set2Pareja2}` : null,
          set3: p.set3Pareja1 !== null ? `${p.set3Pareja1}-${p.set3Pareja2}` : null,
          ganador: parejaGanadora,
        }
      : null,
    esBye: p.esBye,
    tipoEntrada1: p.tipoEntrada1,
    tipoEntrada2: p.tipoEntrada2,
    createdAt: p.createdAt,
  };
}

/**
 * Aplica el filtro en memoria de partidos (búsqueda por nombre de pareja).
 */
export function filtrarPartidosAuditoria(
  resultado: any[],
  filtros: { busqueda?: string },
): any[] {
  // Filtro de búsqueda
  if (filtros.busqueda) {
    const busqueda = filtros.busqueda.toLowerCase();
    resultado = resultado.filter(
      (r) =>
        r.pareja1.toLowerCase().includes(busqueda) ||
        r.pareja2.toLowerCase().includes(busqueda),
    );
  }

  return resultado;
}

/**
 * Mapea un slot (con su match/cancha) a la forma de auditoría.
 */
export function mapSlotAuditoria(slot: any) {
  return {
    id: slot.id,
    horaInicio: slot.horaInicio,
    horaFin: slot.horaFin,
    estado: slot.estado,
    fase: slot.fase,
    cancha: slot.torneoCancha
      ? {
          id: slot.torneoCancha.id,
          nombre: slot.torneoCancha.sedeCancha?.nombre || 'Cancha',
          sede: slot.torneoCancha.sedeCancha?.sede?.nombre,
        }
      : null,
    ocupadoPor: slot.match
      ? {
          partidoId: slot.match.id,
          fase: slot.match.ronda,
          categoria: slot.match.category?.nombre,
          pareja1: slot.match.inscripcion1
            ? `${slot.match.inscripcion1.jugador1?.nombre || ''} ${
                slot.match.inscripcion1.jugador1?.apellido || ''
              } / ${slot.match.inscripcion1.jugador2?.nombre || ''} ${
                slot.match.inscripcion1.jugador2?.apellido || ''
              }`
            : 'Por definir',
          pareja2: slot.match.inscripcion2
            ? `${slot.match.inscripcion2.jugador1?.nombre || ''} ${
                slot.match.inscripcion2.jugador1?.apellido || ''
              } / ${slot.match.inscripcion2.jugador2?.nombre || ''} ${
                slot.match.inscripcion2.jugador2?.apellido || ''
              }`
            : 'Por definir',
        }
      : null,
  };
}

/**
 * Calcula las estadísticas de ocupación de slots a partir de los días ya armados.
 */
export function calcularStatsSlots(data: any[]) {
  const totalSlots = data.reduce((acc, dia) => acc + dia.slots.length, 0);
  const ocupados = data.reduce(
    (acc, dia) => acc + dia.slots.filter((s) => s.estado === 'OCUPADO').length,
    0,
  );
  const libres = totalSlots - ocupados;

  return {
    total: totalSlots,
    ocupados,
    libres,
    porcentajeOcupacion: totalSlots > 0 ? Math.round((ocupados / totalSlots) * 100) : 0,
  };
}
