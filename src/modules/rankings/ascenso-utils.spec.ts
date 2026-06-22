import {
  restarMeses,
  detectarCandidatosAscenso,
  ResultadoTorneo,
  ReglaAscensoInput,
} from './ascenso-utils';

describe('restarMeses', () => {
  it('resta meses dentro del mismo año', () => {
    expect(restarMeses('2026-06-22', 3)).toBe('2026-03-22');
  });
  it('cruza el límite de año', () => {
    expect(restarMeses('2026-02-10', 12)).toBe('2025-02-10');
  });
  it('cruza enero hacia el año anterior', () => {
    expect(restarMeses('2026-01-15', 2)).toBe('2025-11-15');
  });
});

describe('detectarCandidatosAscenso', () => {
  const reglaCab8a7: ReglaAscensoInput = {
    id: 'r1',
    categoriaOrigenId: 'cab8',
    categoriaDestinoId: 'cab7',
    campeonatosRequeridos: 2,
    mesesVentana: 12,
    finalistaCalifica: false,
  };
  const hoy = '2026-06-22';

  it('NO marca candidato con menos campeonatos de los requeridos', () => {
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
    ];
    expect(detectarCandidatosAscenso([reglaCab8a7], resultados, hoy)).toEqual([]);
  });

  it('marca candidato al alcanzar los campeonatos requeridos', () => {
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't2', fecha: '2026-06-01', posicion: 'CAMPEON' },
    ];
    const out = detectarCandidatosAscenso([reglaCab8a7], resultados, hoy);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      reglaId: 'r1',
      jugadorId: 'j1',
      categoriaOrigenId: 'cab8',
      categoriaDestinoId: 'cab7',
    });
    expect(out[0].torneosGanados.sort()).toEqual(['t1', 't2']);
  });

  it('detecta el campeón de un torneo INDEPENDIENTE (sin circuito) igual que cualquiera', () => {
    // Es justo el caso que antes quedaba afuera: estos torneos no tienen entrada
    // en historial_puntos, pero el resultado real existe.
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'jX', categoryId: 'cab8', tournamentId: 'indep1', fecha: '2026-03-10', posicion: 'CAMPEON' },
      { jugadorId: 'jX', categoryId: 'cab8', tournamentId: 'indep2', fecha: '2026-04-10', posicion: 'CAMPEON' },
    ];
    const out = detectarCandidatosAscenso([reglaCab8a7], resultados, hoy);
    expect(out).toHaveLength(1);
    expect(out[0].jugadorId).toBe('jX');
  });

  it('ignora campeonatos fuera de la ventana temporal', () => {
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't1', fecha: '2024-01-01', posicion: 'CAMPEON' }, // viejo
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't2', fecha: '2026-06-01', posicion: 'CAMPEON' },
    ];
    expect(detectarCandidatosAscenso([reglaCab8a7], resultados, hoy)).toEqual([]);
  });

  it('ignora campeonatos de OTRA categoría', () => {
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'j1', categoryId: 'cab7', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
      { jugadorId: 'j1', categoryId: 'cab7', tournamentId: 't2', fecha: '2026-06-01', posicion: 'CAMPEON' },
    ];
    expect(detectarCandidatosAscenso([reglaCab8a7], resultados, hoy)).toEqual([]);
  });

  it('NO cuenta dos veces el mismo torneo', () => {
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
    ];
    expect(detectarCandidatosAscenso([reglaCab8a7], resultados, hoy)).toEqual([]);
  });

  it('NO cuenta finalista si la regla no lo permite', () => {
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't2', fecha: '2026-06-01', posicion: 'FINALISTA' },
    ];
    expect(detectarCandidatosAscenso([reglaCab8a7], resultados, hoy)).toEqual([]);
  });

  it('SÍ cuenta finalista cuando la regla lo permite', () => {
    const reglaConFinalista: ReglaAscensoInput = { ...reglaCab8a7, finalistaCalifica: true };
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't2', fecha: '2026-06-01', posicion: 'FINALISTA' },
    ];
    const out = detectarCandidatosAscenso([reglaConFinalista], resultados, hoy);
    expect(out).toHaveLength(1);
    expect(out[0].torneosGanados.sort()).toEqual(['t1', 't2']);
  });

  it('separa candidatos por jugador', () => {
    const resultados: ResultadoTorneo[] = [
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
      { jugadorId: 'j1', categoryId: 'cab8', tournamentId: 't2', fecha: '2026-06-01', posicion: 'CAMPEON' },
      { jugadorId: 'j2', categoryId: 'cab8', tournamentId: 't1', fecha: '2026-05-01', posicion: 'CAMPEON' },
    ];
    const out = detectarCandidatosAscenso([reglaCab8a7], resultados, hoy);
    expect(out.map((c) => c.jugadorId).sort()).toEqual(['j1']);
  });
});
