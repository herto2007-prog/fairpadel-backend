import {
  mapInscripcionAuditoria,
  filtrarInscripcionesAuditoria,
  mapPartidoAuditoria,
  filtrarPartidosAuditoria,
  mapSlotAuditoria,
  calcularStatsSlots,
} from './admin-auditoria.mappers';

/**
 * Spec de CARACTERIZACIÓN (red de seguridad del refactor de admin-auditoria).
 * Fija con golden values la forma EXACTA que producen los transformadores puros
 * extraídos verbatim del controller. Cubre los caminos de fallback
 * ('Por definir', 'N/A', '(Pendiente)', slot libre/ocupado) para que cualquier
 * cambio futuro se ponga rojo.
 */
describe('admin-auditoria mappers (caracterización)', () => {
  describe('mapInscripcionAuditoria', () => {
    it('inscripción completa con pago y partido programado', () => {
      const insc = {
        id: 'i1',
        estado: 'CONFIRMADA',
        modoPago: 'COMPLETO',
        notas: 'nota',
        createdAt: '2026-06-01',
        estadoClasificacion: 'CLASIFICADO',
        rondaClasificacion: 2,
        jugador1Id: 'u1',
        jugador2Id: 'u2',
        jugador2Documento: 'D2',
        jugador1: { id: 'u1', nombre: 'Ana', apellido: 'García', telefono: '0991', documento: 'D1', categoriaActual: { nombre: '4ta' } },
        jugador2: { id: 'u2', nombre: 'Beto', apellido: 'López', telefono: '0992', documento: 'D2', categoriaActual: { nombre: '5ta' } },
        category: { id: 'c1', nombre: 'Cuarta', tipo: 'MASCULINO' },
        pagos: [{ id: 'p1', estado: 'PAGADO', monto: 100, metodoPago: 'EFECTIVO', fechaPago: '2026-06-02' }],
        partidosComoP1: [
          { ronda: 'ZONA', fechaProgramada: '2026-07-01', horaProgramada: '08:00', torneoCancha: { sedeCancha: { nombre: 'C1', sede: { nombre: 'Sede1' } } } },
        ],
        partidosComoP2: [],
      };

      expect(mapInscripcionAuditoria(insc)).toEqual({
        id: 'i1',
        estado: 'CONFIRMADA',
        modoPago: 'COMPLETO',
        notas: 'nota',
        createdAt: '2026-06-01',
        estadoClasificacion: 'CLASIFICADO',
        rondaClasificacion: 2,
        pareja: {
          jugador1: 'Ana García',
          jugador1Categoria: '4ta',
          jugador2: 'Beto López',
          jugador2Categoria: '5ta',
          telefonoJ1: '0991',
          telefonoJ2: '0992',
          completa: true,
          jugador1Id: 'u1',
          jugador2Id: 'u2',
          jugador2Documento: 'D2',
          j1: { id: 'u1', nombre: 'Ana', apellido: 'García', telefono: '0991', documento: 'D1' },
          j2: { id: 'u2', nombre: 'Beto', apellido: 'López', telefono: '0992', documento: 'D2' },
        },
        categoria: { id: 'c1', nombre: 'Cuarta', genero: 'MASCULINO' },
        pagos: [{ id: 'p1', estado: 'PAGADO', monto: 100, metodo: 'EFECTIVO', fecha: '2026-06-02' }],
        programacion: [{ fase: 'ZONA', fecha: '2026-07-01', hora: '08:00', cancha: 'C1', sede: 'Sede1' }],
        tieneSlotAsignado: true,
      });
    });

    it('inscripción sin pareja ni partidos -> N/A, (Pendiente), sin slot', () => {
      const insc = {
        id: 'i2',
        estado: 'PENDIENTE_PAGO',
        modoPago: 'INDIVIDUAL',
        notas: null,
        createdAt: '2026-06-01',
        estadoClasificacion: null,
        rondaClasificacion: null,
        jugador1Id: 'u1',
        jugador2Id: null,
        jugador2Documento: 'DPEND',
        jugador1: { id: 'u1', nombre: 'Ana', apellido: 'García', telefono: '0991', documento: 'D1', categoriaActual: null },
        jugador2: null,
        category: { id: 'c1', nombre: 'Cuarta', tipo: 'FEMENINO' },
        pagos: [],
        partidosComoP1: [],
        partidosComoP2: [],
      };

      const out = mapInscripcionAuditoria(insc);
      expect(out.pareja).toEqual({
        jugador1: 'Ana García',
        jugador1Categoria: 'N/A',
        jugador2: '(Pendiente)',
        jugador2Categoria: 'N/A',
        telefonoJ1: '0991',
        telefonoJ2: undefined,
        completa: false,
        jugador1Id: 'u1',
        jugador2Id: null,
        jugador2Documento: 'DPEND',
        j1: { id: 'u1', nombre: 'Ana', apellido: 'García', telefono: '0991', documento: 'D1' },
        j2: null,
      });
      expect(out.tieneSlotAsignado).toBe(false);
      expect(out.programacion).toEqual([]);
    });
  });

  describe('filtrarInscripcionesAuditoria', () => {
    const base = [
      { pareja: { jugador1: 'Ana García', jugador2: 'Beto López' }, categoria: { nombre: 'Cuarta' }, tieneSlotAsignado: true },
      { pareja: { jugador1: 'Carlos Pérez', jugador2: '(Pendiente)' }, categoria: { nombre: 'Quinta' }, tieneSlotAsignado: false },
    ];

    it('busqueda filtra por nombre de jugador', () => {
      expect(filtrarInscripcionesAuditoria([...base], { busqueda: 'ana' })).toHaveLength(1);
    });
    it('busqueda filtra por categoria', () => {
      expect(filtrarInscripcionesAuditoria([...base], { busqueda: 'quinta' })).toHaveLength(1);
    });
    it('sinSlot deja solo los sin slot', () => {
      const out = filtrarInscripcionesAuditoria([...base], { sinSlot: true });
      expect(out).toHaveLength(1);
      expect(out[0].tieneSlotAsignado).toBe(false);
    });
    it('sin filtros devuelve todo', () => {
      expect(filtrarInscripcionesAuditoria([...base], {})).toHaveLength(2);
    });
  });

  describe('mapPartidoAuditoria', () => {
    it('partido finalizado con ganador y 2 sets', () => {
      const p = {
        id: 'm1',
        ronda: 'CUARTOS',
        numeroRonda: 3,
        estado: 'FINALIZADO',
        category: { id: 'c1', nombre: 'Cuarta', tipo: 'MASCULINO' },
        inscripcion1: { jugador1: { nombre: 'Ana', apellido: 'García' }, jugador2: { nombre: 'Beto', apellido: 'López' } },
        inscripcion2: { jugador1: { nombre: 'Carlos', apellido: 'Pérez' }, jugador2: { nombre: 'Dina', apellido: 'Ruiz' } },
        inscripcionGanadora: { jugador1: { nombre: 'Ana', apellido: 'García' }, jugador2: { nombre: 'Beto', apellido: 'López' } },
        torneoCancha: { sedeCancha: { nombre: 'C1', sede: { nombre: 'Sede1' } } },
        torneoCanchaId: 'tc1',
        fechaProgramada: '2026-07-01',
        horaProgramada: '08:00',
        set1Pareja1: 6, set1Pareja2: 3,
        set2Pareja1: 6, set2Pareja2: 4,
        set3Pareja1: null, set3Pareja2: null,
        esBye: false,
        tipoEntrada1: 'DIRECTO',
        tipoEntrada2: 'DIRECTO',
        createdAt: '2026-06-01',
      };

      expect(mapPartidoAuditoria(p)).toEqual({
        id: 'm1',
        fase: 'CUARTOS',
        numeroRonda: 3,
        estado: 'FINALIZADO',
        categoria: { id: 'c1', nombre: 'Cuarta', genero: 'MASCULINO' },
        pareja1: 'Ana García / Beto López',
        pareja2: 'Carlos Pérez / Dina Ruiz',
        parejaGanadora: 'Ana García / Beto López',
        programacion: { fecha: '2026-07-01', hora: '08:00', cancha: 'C1', sede: 'Sede1' },
        estaProgramado: true,
        resultado: { set1: '6-3', set2: '6-4', set3: null, ganador: 'Ana García / Beto López' },
        esBye: false,
        tipoEntrada1: 'DIRECTO',
        tipoEntrada2: 'DIRECTO',
        createdAt: '2026-06-01',
      });
    });

    it('partido sin parejas/cancha/resultado -> Por definir, null', () => {
      const p = {
        id: 'm2',
        ronda: 'ZONA',
        numeroRonda: 1,
        estado: 'PROGRAMADO',
        category: { id: 'c1', nombre: 'Cuarta', tipo: 'MASCULINO' },
        inscripcion1: null,
        inscripcion2: null,
        inscripcionGanadora: null,
        torneoCancha: null,
        torneoCanchaId: null,
        fechaProgramada: null,
        horaProgramada: null,
        set1Pareja1: null,
        esBye: false,
        tipoEntrada1: null,
        tipoEntrada2: null,
        createdAt: '2026-06-01',
      };

      const out = mapPartidoAuditoria(p);
      expect(out.pareja1).toBe('Por definir');
      expect(out.pareja2).toBe('Por definir');
      expect(out.parejaGanadora).toBeNull();
      expect(out.programacion).toBeNull();
      expect(out.estaProgramado).toBe(false);
      expect(out.resultado).toBeNull();
    });
  });

  describe('filtrarPartidosAuditoria', () => {
    const base = [
      { pareja1: 'Ana García / Beto López', pareja2: 'Carlos Pérez / Dina Ruiz' },
      { pareja1: 'Por definir', pareja2: 'Por definir' },
    ];
    it('busqueda filtra por nombre', () => {
      expect(filtrarPartidosAuditoria([...base], { busqueda: 'carlos' })).toHaveLength(1);
    });
    it('sin busqueda devuelve todo', () => {
      expect(filtrarPartidosAuditoria([...base], {})).toHaveLength(2);
    });
  });

  describe('mapSlotAuditoria', () => {
    it('slot ocupado con cancha y match', () => {
      const slot = {
        id: 's1',
        horaInicio: '08:00',
        horaFin: '09:00',
        estado: 'OCUPADO',
        fase: 'ZONA',
        torneoCancha: { id: 'tc1', sedeCancha: { nombre: 'C1', sede: { nombre: 'Sede1' } } },
        match: {
          id: 'm1',
          ronda: 'ZONA',
          category: { nombre: 'Cuarta' },
          inscripcion1: { jugador1: { nombre: 'Ana', apellido: 'García' }, jugador2: { nombre: 'Beto', apellido: 'López' } },
          inscripcion2: { jugador1: { nombre: 'Carlos', apellido: 'Pérez' }, jugador2: { nombre: 'Dina', apellido: 'Ruiz' } },
        },
      };

      expect(mapSlotAuditoria(slot)).toEqual({
        id: 's1',
        horaInicio: '08:00',
        horaFin: '09:00',
        estado: 'OCUPADO',
        fase: 'ZONA',
        cancha: { id: 'tc1', nombre: 'C1', sede: 'Sede1' },
        ocupadoPor: {
          partidoId: 'm1',
          fase: 'ZONA',
          categoria: 'Cuarta',
          pareja1: 'Ana García / Beto López',
          pareja2: 'Carlos Pérez / Dina Ruiz',
        },
      });
    });

    it('slot libre sin cancha ni match -> null', () => {
      const slot = {
        id: 's2',
        horaInicio: '09:00',
        horaFin: '10:00',
        estado: 'LIBRE',
        fase: null,
        torneoCancha: null,
        match: null,
      };
      const out = mapSlotAuditoria(slot);
      expect(out.cancha).toBeNull();
      expect(out.ocupadoPor).toBeNull();
    });
  });

  describe('calcularStatsSlots', () => {
    it('cuenta ocupados/libres y porcentaje redondeado', () => {
      const data = [
        { slots: [{ estado: 'OCUPADO' }, { estado: 'LIBRE' }] },
        { slots: [{ estado: 'OCUPADO' }] },
      ];
      expect(calcularStatsSlots(data)).toEqual({
        total: 3,
        ocupados: 2,
        libres: 1,
        porcentajeOcupacion: 67,
      });
    });
    it('sin slots -> porcentaje 0', () => {
      expect(calcularStatsSlots([])).toEqual({
        total: 0,
        ocupados: 0,
        libres: 0,
        porcentajeOcupacion: 0,
      });
    });
  });
});
