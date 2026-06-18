import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminTorneosController } from './admin-torneos.controller';

/**
 * Tests del endpoint seguro PUT /admin/torneos/:id/categorias (sincronizarCategorias).
 * Lo crítico: agregar categorías es libre, pero quitar SOLO se permite si la categoría
 * no tiene cuadro sorteado ni inscripciones (si no, va a `bloqueadas` y NO se borra).
 */
describe('AdminTorneosController.sincronizarCategorias', () => {
  const build = (opts: {
    torneo?: any;
    puede?: boolean;
    actuales?: any[];
    inscCount?: number;
  }) => {
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue(
          opts.torneo === undefined ? { id: 't1' } : opts.torneo,
        ),
      },
      tournamentCategory: {
        findMany: jest.fn().mockResolvedValue(opts.actuales ?? []),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      inscripcion: {
        count: jest.fn().mockResolvedValue(opts.inscCount ?? 0),
      },
    };
    const tournamentsService = {
      puedeGestionarTorneo: jest.fn().mockResolvedValue(opts.puede ?? true),
    };
    const controller = new AdminTorneosController(
      prisma as any,
      {} as any, // dateService
      {} as any, // comisionService
      {} as any, // rankingsService
      tournamentsService as any,
      {} as any, // alertasService
      {} as any, // emailService
    );
    const req = { user: { userId: 'u1', roles: ['organizador'] } };
    return { controller, prisma, tournamentsService, req };
  };

  it('agrega las nuevas y quita las seguras (sin cuadro ni inscriptos)', async () => {
    const { controller, prisma } = build({
      actuales: [
        { id: 'tc-a', categoryId: 'cat-a', fixtureVersionId: null, category: { nombre: 'A' } },
      ],
      inscCount: 0,
    });

    // Deseadas: cat-b (nueva). cat-a sale (no está en deseadas) y es segura → se borra.
    const res = await controller.sincronizarCategorias(
      't1',
      { categoriaIds: ['cat-b'] },
      { user: { userId: 'u1', roles: ['organizador'] } },
    );

    expect(prisma.tournamentCategory.create).toHaveBeenCalledWith({
      data: { tournamentId: 't1', categoryId: 'cat-b' },
    });
    expect(prisma.tournamentCategory.delete).toHaveBeenCalledWith({ where: { id: 'tc-a' } });
    expect(res.agregadas).toEqual(['cat-b']);
    expect(res.quitadas).toEqual(['cat-a']);
    expect(res.bloqueadas).toEqual([]);
  });

  it('NO quita una categoría con cuadro sorteado (la bloquea)', async () => {
    const { controller, prisma } = build({
      actuales: [
        { id: 'tc-a', categoryId: 'cat-a', fixtureVersionId: 'fx-1', category: { nombre: 'A' } },
      ],
    });

    const res = await controller.sincronizarCategorias(
      't1',
      { categoriaIds: [] }, // pide quitar todo
      { user: { userId: 'u1', roles: ['organizador'] } },
    );

    expect(prisma.tournamentCategory.delete).not.toHaveBeenCalled();
    expect(res.quitadas).toEqual([]);
    expect(res.bloqueadas).toEqual([
      { categoryId: 'cat-a', nombre: 'A', motivo: 'ya tiene cuadro sorteado' },
    ]);
  });

  it('NO quita una categoría con inscripciones (la bloquea)', async () => {
    const { controller, prisma } = build({
      actuales: [
        { id: 'tc-a', categoryId: 'cat-a', fixtureVersionId: null, category: { nombre: 'A' } },
      ],
      inscCount: 3,
    });

    const res = await controller.sincronizarCategorias(
      't1',
      { categoriaIds: [] },
      { user: { userId: 'u1', roles: ['organizador'] } },
    );

    expect(prisma.tournamentCategory.delete).not.toHaveBeenCalled();
    expect(res.quitadas).toEqual([]);
    expect(res.bloqueadas).toEqual([
      { categoryId: 'cat-a', nombre: 'A', motivo: 'tiene 3 inscripción(es)' },
    ]);
  });

  it('404 si el torneo no existe', async () => {
    const { controller } = build({ torneo: null });

    await expect(
      controller.sincronizarCategorias('t1', { categoriaIds: [] }, { user: { userId: 'u1', roles: ['organizador'] } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza si el usuario no puede gestionar el torneo', async () => {
    const { controller, prisma } = build({ puede: false });

    await expect(
      controller.sincronizarCategorias('t1', { categoriaIds: [] }, { user: { userId: 'u1', roles: ['organizador'] } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tournamentCategory.create).not.toHaveBeenCalled();
  });
});
