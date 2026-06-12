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
