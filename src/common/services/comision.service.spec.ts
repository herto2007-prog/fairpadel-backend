import { ComisionService } from './comision.service';

/**
 * Tests de la fórmula de comisión.
 * Prisma se mockea: validamos la lógica/aritmética, no la base de datos.
 */
describe('ComisionService', () => {
  const buildPrisma = (overrides: any = {}) => ({
    fairpadelConfig: { findUnique: jest.fn().mockResolvedValue({ valor: '5000' }) },
    inscripcion: { count: jest.fn().mockResolvedValue(0) },
    torneoComision: { update: jest.fn().mockResolvedValue({}) },
    ...overrides,
  });

  it('montoEstimado = inscripcionesConfirmadas * 2 jugadores * comisiónPorJugador', async () => {
    const prisma = buildPrisma({
      inscripcion: { count: jest.fn().mockResolvedValue(8) },
    });
    const service = new ComisionService(prisma as any);

    await service.recalcularComision('torneo-1');

    expect(prisma.torneoComision.update).toHaveBeenCalledWith({
      where: { tournamentId: 'torneo-1' },
      data: { montoEstimado: 8 * 2 * 5000 }, // 80.000
    });
  });

  it('solo cuenta inscripciones CONFIRMADAS del torneo', async () => {
    const count = jest.fn().mockResolvedValue(3);
    const prisma = buildPrisma({ inscripcion: { count } });
    const service = new ComisionService(prisma as any);

    await service.recalcularComision('torneo-1');

    expect(count).toHaveBeenCalledWith({
      where: { tournamentId: 'torneo-1', estado: 'CONFIRMADA' },
    });
  });

  it('con 0 inscripciones, montoEstimado = 0', async () => {
    const prisma = buildPrisma({
      inscripcion: { count: jest.fn().mockResolvedValue(0) },
    });
    const service = new ComisionService(prisma as any);

    await service.recalcularComision('torneo-1');

    expect(prisma.torneoComision.update).toHaveBeenCalledWith({
      where: { tournamentId: 'torneo-1' },
      data: { montoEstimado: 0 },
    });
  });

  it('si la comisión no está configurada, no actualiza nada', async () => {
    const prisma = buildPrisma({
      fairpadelConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const service = new ComisionService(prisma as any);

    await service.recalcularComision('torneo-1');

    expect(prisma.inscripcion.count).not.toHaveBeenCalled();
    expect(prisma.torneoComision.update).not.toHaveBeenCalled();
  });

  it('si la comisión configurada es "0", no actualiza nada', async () => {
    const prisma = buildPrisma({
      fairpadelConfig: { findUnique: jest.fn().mockResolvedValue({ valor: '0' }) },
    });
    const service = new ComisionService(prisma as any);

    await service.recalcularComision('torneo-1');

    expect(prisma.torneoComision.update).not.toHaveBeenCalled();
  });
});

describe('ComisionService.calcularComisionReal', () => {
  // pareja(a, b) = una inscripción con jugador1Id=a, jugador2Id=b (b opcional/null).
  const pareja = (j1: string | null, j2: string | null = null) => ({
    jugador1Id: j1,
    jugador2Id: j2,
  });

  const build = (opts: {
    formato?: string;
    tarifa?: string | null;
    partidos?: Array<{ inscripcion1: any; inscripcion2: any }>;
  }) => {
    const matchFindMany = jest.fn().mockResolvedValue(opts.partidos ?? []);
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue(
          opts.formato === undefined ? { formato: 'normal' } : { formato: opts.formato },
        ),
      },
      fairpadelConfig: {
        findUnique: jest.fn().mockResolvedValue(
          opts.tarifa === null ? null : { valor: opts.tarifa ?? '10000' },
        ),
      },
      match: { findMany: matchFindMany },
    };
    return { prisma, matchFindMany };
  };

  it('monto = jugadores distintos que jugaron × tarifa', async () => {
    const { prisma } = build({
      partidos: [
        { inscripcion1: pareja('A', 'B'), inscripcion2: pareja('C', 'D') },
      ],
    });
    const service = new ComisionService(prisma as any);

    const res = await service.calcularComisionReal('t1');

    expect(res.jugaronCount).toBe(4); // A,B,C,D
    expect(res.tarifa).toBe(10000);
    expect(res.monto).toBe(40000);
  });

  it('cuenta cada jugador UNA vez aunque juegue varios partidos', async () => {
    const { prisma } = build({
      partidos: [
        { inscripcion1: pareja('A', 'B'), inscripcion2: pareja('C', 'D') },
        // A y B siguen avanzando: aparecen de nuevo
        { inscripcion1: pareja('A', 'B'), inscripcion2: pareja('E', 'F') },
      ],
    });
    const service = new ComisionService(prisma as any);

    const res = await service.calcularComisionReal('t1');

    expect(res.jugaronCount).toBe(6); // A,B,C,D,E,F (A,B no se duplican)
    expect(res.monto).toBe(60000);
  });

  it('una pareja con un solo jugador (jugador2Id null) cuenta 1', async () => {
    const { prisma } = build({
      partidos: [{ inscripcion1: pareja('A', null), inscripcion2: pareja('B', null) }],
    });
    const service = new ComisionService(prisma as any);

    const res = await service.calcularComisionReal('t1');

    expect(res.jugaronCount).toBe(2);
  });

  it('solo pide partidos con juego real (FINALIZADO/RETIRADO/DESCALIFICADO), excluye WO', async () => {
    const { prisma, matchFindMany } = build({ partidos: [] });
    const service = new ComisionService(prisma as any);

    await service.calcularComisionReal('t1');

    expect(matchFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tournamentId: 't1',
          estado: { in: ['FINALIZADO', 'RETIRADO', 'DESCALIFICADO'] },
        }),
      }),
    );
  });

  it('americano nunca genera comisión y ni siquiera consulta partidos', async () => {
    const { prisma, matchFindMany } = build({ formato: 'americano' });
    const service = new ComisionService(prisma as any);

    const res = await service.calcularComisionReal('t1');

    expect(res.monto).toBe(0);
    expect(res.jugaronCount).toBe(0);
    expect(matchFindMany).not.toHaveBeenCalled();
  });

  it('si la tarifa no está configurada, monto 0 y no consulta partidos', async () => {
    const { prisma, matchFindMany } = build({ tarifa: null });
    const service = new ComisionService(prisma as any);

    const res = await service.calcularComisionReal('t1');

    expect(res.monto).toBe(0);
    expect(matchFindMany).not.toHaveBeenCalled();
  });

  it('sin partidos jugados, monto 0', async () => {
    const { prisma } = build({ partidos: [] });
    const service = new ComisionService(prisma as any);

    const res = await service.calcularComisionReal('t1');

    expect(res.jugaronCount).toBe(0);
    expect(res.monto).toBe(0);
  });
});
