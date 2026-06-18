import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminAuditoriaController } from './admin-auditoria.controller';

/**
 * Tests del god-panel: corregir las parejas de un partido (corregirParejas).
 * Lo crítico: NO permitir cambiar parejas si el partido ya tiene resultado
 * (para no corromper el cuadro), y que las inscripciones sean del mismo
 * torneo/categoría.
 */
describe('AdminAuditoriaController.corregirParejas', () => {
  const build = (opts: {
    partido?: any;
    inscripcion?: any;
  }) => {
    const prisma = {
      match: {
        findUnique: jest.fn().mockResolvedValue(
          opts.partido === undefined
            ? { id: 'm1', tournamentId: 't1', categoryId: 'c1', estado: 'PROGRAMADO', inscripcionGanadoraId: null, esBye: false }
            : opts.partido,
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      inscripcion: {
        findUnique: jest.fn().mockResolvedValue(
          opts.inscripcion === undefined
            ? { id: 'i1', tournamentId: 't1', categoryId: 'c1' }
            : opts.inscripcion,
        ),
      },
    };
    const controller = new AdminAuditoriaController(prisma as any);
    return { controller, prisma };
  };

  it('corrige las parejas válidas (mismo torneo/categoría, sin resultado)', async () => {
    const { controller, prisma } = build({});

    const res = await controller.corregirParejas('m1', { inscripcion1Id: 'i1', inscripcion2Id: 'i2' });

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { inscripcion1Id: 'i1', inscripcion2Id: 'i2' },
    });
    expect(res.success).toBe(true);
  });

  it('permite vaciar un lado (null)', async () => {
    const { controller, prisma } = build({});

    await controller.corregirParejas('m1', { inscripcion1Id: 'i1', inscripcion2Id: null });

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { inscripcion1Id: 'i1', inscripcion2Id: null },
    });
  });

  it('bloquea si el partido ya tiene resultado (FINALIZADO)', async () => {
    const { controller, prisma } = build({
      partido: { id: 'm1', tournamentId: 't1', categoryId: 'c1', estado: 'FINALIZADO', inscripcionGanadoraId: 'i1', esBye: false },
    });

    await expect(
      controller.corregirParejas('m1', { inscripcion1Id: 'i1', inscripcion2Id: 'i2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('bloquea la misma inscripción en ambos lados', async () => {
    const { controller, prisma } = build({});

    await expect(
      controller.corregirParejas('m1', { inscripcion1Id: 'i1', inscripcion2Id: 'i1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('bloquea una inscripción de otra categoría', async () => {
    const { controller, prisma } = build({
      inscripcion: { id: 'i1', tournamentId: 't1', categoryId: 'OTRA' },
    });

    await expect(
      controller.corregirParejas('m1', { inscripcion1Id: 'i1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it('404 si el partido no existe', async () => {
    const { controller } = build({ partido: null });

    await expect(
      controller.corregirParejas('m1', { inscripcion1Id: 'i1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
