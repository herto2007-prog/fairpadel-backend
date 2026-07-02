import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MisRankingsService } from './mis-rankings.service';

/**
 * Rankings del organizador (autoservicio): crear con nombre validado,
 * propiedad estricta (nadie toca rankings ajenos ni suma torneos de otros),
 * y recálculo al sumar/quitar torneos.
 */
describe('MisRankingsService', () => {
  const YO = 'org-1';
  const OTRO = 'org-2';
  const CIRCUITO = { id: 'circ-1', nombre: 'Mi Circuito', organizadorId: YO, estado: 'ACTIVO' };

  function build(overrides: Record<string, any> = {}) {
    const prisma: any = {
      circuito: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve(where.id === 'circ-1' || where.nombre || where.slug ? null : null),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: any) => Promise.resolve({ id: 'nuevo', ...data })),
        update: jest.fn(({ data }: any) => Promise.resolve({ ...CIRCUITO, ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      tournament: { findUnique: jest.fn() },
      torneoCircuito: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      ranking: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({}) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ nombre: 'Org', apellido: 'Uno', ciudad: 'CDE' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notificacion: { create: jest.fn().mockResolvedValue({}) },
      ...overrides,
    };
    const rankingsService: any = {
      recalcularCircuito: jest.fn().mockResolvedValue({ success: true, data: { categorias: 1 } }),
    };
    const service = new MisRankingsService(prisma, rankingsService);
    return { service, prisma, rankingsService };
  }

  describe('validarNombre', () => {
    it('rechaza nombres cortos y duplicados', async () => {
      const { service, prisma } = build();
      expect((await service.validarNombre('ab')).disponible).toBe(false);
      prisma.circuito.findUnique.mockResolvedValueOnce({ id: 'x' });
      expect((await service.validarNombre('Circuito Verano')).disponible).toBe(false);
    });

    it('acepta nombre libre y propone slug legible', async () => {
      const { service, prisma } = build();
      prisma.circuito.findUnique.mockResolvedValue(null);
      const r = await service.validarNombre('Circuito Verano CDE');
      expect(r).toEqual({ disponible: true, slug: 'circuito-verano-cde' });
    });
  });

  describe('crear', () => {
    it('crea el circuito con dueño y avisa a los admins', async () => {
      const { service, prisma } = build();
      prisma.circuito.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      const r = await service.crear(YO, { nombre: 'Circuito Verano' } as any);

      expect(r.success).toBe(true);
      expect(prisma.circuito.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizadorId: YO, nombre: 'Circuito Verano' }),
        }),
      );
      expect(prisma.notificacion.create).toHaveBeenCalled();
    });
  });

  describe('propiedad', () => {
    it('no deja tocar un ranking ajeno', async () => {
      const { service, prisma } = build();
      prisma.circuito.findUnique.mockResolvedValue({ ...CIRCUITO, organizadorId: OTRO });
      await expect(service.editar(YO, 'circ-1', {} as any)).rejects.toThrow(ForbiddenException);
      await expect(service.sumarTorneo(YO, 'circ-1', 't-1')).rejects.toThrow(ForbiddenException);
    });

    it('no deja sumar un torneo de OTRO organizador', async () => {
      const { service, prisma } = build();
      prisma.circuito.findUnique.mockResolvedValue(CIRCUITO);
      prisma.tournament.findUnique.mockResolvedValue({ id: 't-1', nombre: 'T', organizadorId: OTRO });
      await expect(service.sumarTorneo(YO, 'circ-1', 't-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('sumar/quitar torneos', () => {
    it('suma un torneo mío APROBADO y recalcula al toque', async () => {
      const { service, prisma, rankingsService } = build();
      prisma.circuito.findUnique.mockResolvedValue(CIRCUITO);
      prisma.tournament.findUnique.mockResolvedValue({ id: 't-1', nombre: 'Open Enero', organizadorId: YO });

      const r = await service.sumarTorneo(YO, 'circ-1', 't-1');

      expect(r.success).toBe(true);
      expect(prisma.torneoCircuito.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ estado: 'APROBADO', multiplicador: 1, solicitadoPorId: YO }),
        }),
      );
      expect(rankingsService.recalcularCircuito).toHaveBeenCalledWith('circ-1');
    });

    it('no suma a un ranking cerrado (FINALIZADO)', async () => {
      const { service, prisma } = build();
      prisma.circuito.findUnique.mockResolvedValue({ ...CIRCUITO, estado: 'FINALIZADO' });
      await expect(service.sumarTorneo(YO, 'circ-1', 't-1')).rejects.toThrow(BadRequestException);
    });

    it('quitar un torneo recalcula la tabla del circuito', async () => {
      const { service, prisma, rankingsService } = build();
      prisma.circuito.findUnique.mockResolvedValue(CIRCUITO);
      prisma.torneoCircuito.findUnique.mockResolvedValue({ id: 'tc-1' });

      const r = await service.quitarTorneo(YO, 'circ-1', 't-1');

      expect(r.success).toBe(true);
      expect(prisma.torneoCircuito.delete).toHaveBeenCalledWith({ where: { id: 'tc-1' } });
      expect(rankingsService.recalcularCircuito).toHaveBeenCalledWith('circ-1');
    });
  });

  describe('borrar', () => {
    it('bloquea borrar si tiene torneos (hay que cerrar temporada)', async () => {
      const { service, prisma } = build();
      prisma.circuito.findUnique.mockResolvedValue(CIRCUITO);
      prisma.torneoCircuito.count.mockResolvedValue(2);
      await expect(service.borrar(YO, 'circ-1')).rejects.toThrow(BadRequestException);
    });

    it('borra si está vacío (incluye sus filas de tabla)', async () => {
      const { service, prisma } = build();
      prisma.circuito.findUnique.mockResolvedValue(CIRCUITO);
      const r = await service.borrar(YO, 'circ-1');
      expect(r.success).toBe(true);
      expect(prisma.ranking.deleteMany).toHaveBeenCalledWith({
        where: { tipoRanking: 'LIGA', alcance: 'circ-1' },
      });
      expect(prisma.circuito.delete).toHaveBeenCalled();
    });

    it('ranking inexistente → NotFound', async () => {
      const { service, prisma } = build();
      prisma.circuito.findUnique.mockResolvedValue(null);
      await expect(service.borrar(YO, 'nope')).rejects.toThrow(NotFoundException);
    });
  });
});
