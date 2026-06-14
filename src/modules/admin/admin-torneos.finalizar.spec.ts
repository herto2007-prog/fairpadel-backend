import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminTorneosController } from './admin-torneos.controller';

/**
 * Tests del endpoint "Marcar terminado" (finalizarTorneo).
 * Se mockean las dependencias: validamos el flujo (estado, comisión, aviso),
 * no la base de datos.
 */
describe('AdminTorneosController.finalizarTorneo', () => {
  const build = (opts: {
    torneo?: any;
    puede?: boolean;
    comision?: { jugaronCount: number; tarifa: number; monto: number };
  }) => {
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue(
          opts.torneo === undefined
            ? { id: 't1', nombre: 'Copa Test', estado: 'PUBLICADO', organizadorId: 'org1' }
            : opts.torneo,
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      torneoComision: { upsert: jest.fn().mockResolvedValue({}) },
      notificacion: { create: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue({ email: 'org@test.com', nombre: 'Org' }) },
      fairpadelConfig: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const comisionService = {
      calcularComisionReal: jest
        .fn()
        .mockResolvedValue(opts.comision ?? { jugaronCount: 6, tarifa: 10000, monto: 60000 }),
    };
    const tournamentsService = {
      puedeGestionarTorneo: jest.fn().mockResolvedValue(opts.puede ?? true),
    };
    const emailService = {
      sendComisionPorCobrar: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new AdminTorneosController(
      prisma as any,
      {} as any, // dateService
      comisionService as any,
      {} as any, // rankingsService
      tournamentsService as any,
      {} as any, // alertasService
      emailService as any,
    );
    const req = { user: { userId: 'u1', roles: ['organizador'] } };
    return { controller, prisma, comisionService, tournamentsService, emailService, req };
  };

  it('finaliza un torneo PUBLICADO: marca FINALIZADO, fija comisión POR_COBRAR y avisa (in-app + email)', async () => {
    const { controller, prisma, emailService, req } = build({});

    const res = await controller.finalizarTorneo('t1', req);

    expect(prisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { estado: 'FINALIZADO' },
    });
    expect(prisma.torneoComision.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId: 't1' },
        update: { montoEstimado: 60000, estado: 'POR_COBRAR' },
      }),
    );
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
    expect(emailService.sendComisionPorCobrar).toHaveBeenCalledTimes(1);
    expect(res.comision.monto).toBe(60000);
  });

  it('si la comisión es 0 (americano), marca terminado pero NO crea cuenta ni avisa', async () => {
    const { controller, prisma, emailService } = build({
      comision: { jugaronCount: 0, tarifa: 0, monto: 0 },
    });

    await controller.finalizarTorneo('t1', { user: { userId: 'u1', roles: ['organizador'] } });

    expect(prisma.tournament.update).toHaveBeenCalled();
    expect(prisma.torneoComision.upsert).not.toHaveBeenCalled();
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
    expect(emailService.sendComisionPorCobrar).not.toHaveBeenCalled();
  });

  it('rechaza finalizar un torneo que no está publicado ni en curso', async () => {
    const { controller, prisma } = build({
      torneo: { id: 't1', nombre: 'X', estado: 'BORRADOR', organizadorId: 'org1' },
    });

    await expect(
      controller.finalizarTorneo('t1', { user: { userId: 'u1', roles: ['organizador'] } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('rechaza si el usuario no puede gestionar el torneo', async () => {
    const { controller, prisma } = build({ puede: false });

    await expect(
      controller.finalizarTorneo('t1', { user: { userId: 'u1', roles: ['organizador'] } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });

  it('404 si el torneo no existe', async () => {
    const { controller } = build({ torneo: null });

    await expect(
      controller.finalizarTorneo('t1', { user: { userId: 'u1', roles: ['organizador'] } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
