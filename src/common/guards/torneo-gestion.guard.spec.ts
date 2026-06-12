import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TorneoGestionGuard } from './torneo-gestion.guard';

/**
 * Tests del guard compartido de gestión por torneo (cierra el IDOR en
 * canchas-sorteo y programación).
 */
const TORNEO = { organizadorId: 'owner-1', coorganizadores: [{ userId: 'co-2' }] };

const ctx = (user: any, params: any = {}, body: any = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user, params, body }),
    }),
  }) as any;

const buildPrisma = ({
  torneo = TORNEO as any,
  match = null as any,
  dia = null as any,
  categoria = null as any,
  fixture = null as any,
} = {}) => ({
  tournament: { findUnique: jest.fn().mockResolvedValue(torneo) },
  match: { findUnique: jest.fn().mockResolvedValue(match) },
  torneoDisponibilidadDia: { findUnique: jest.fn().mockResolvedValue(dia) },
  tournamentCategory: { findUnique: jest.fn().mockResolvedValue(categoria) },
  fixtureVersion: { findUnique: jest.fn().mockResolvedValue(fixture) },
});

describe('TorneoGestionGuard - autorización', () => {
  it('permite a un admin global sin tocar la base', async () => {
    const prisma = buildPrisma();
    const guard = new TorneoGestionGuard(prisma as any);

    await expect(
      guard.canActivate(ctx({ userId: 'x', roles: ['admin'] }, { tournamentId: 't1' })),
    ).resolves.toBe(true);
    expect(prisma.tournament.findUnique).not.toHaveBeenCalled();
  });

  it('permite al dueño del torneo', async () => {
    const guard = new TorneoGestionGuard(buildPrisma() as any);
    await expect(
      guard.canActivate(ctx({ userId: 'owner-1', roles: ['organizador'] }, { tournamentId: 't1' })),
    ).resolves.toBe(true);
  });

  it('permite a un coorganizador', async () => {
    const guard = new TorneoGestionGuard(buildPrisma() as any);
    await expect(
      guard.canActivate(ctx({ userId: 'co-2', roles: ['organizador'] }, { tournamentId: 't1' })),
    ).resolves.toBe(true);
  });

  it('rechaza a un organizador ajeno (IDOR)', async () => {
    const guard = new TorneoGestionGuard(buildPrisma() as any);
    await expect(
      guard.canActivate(ctx({ userId: 'intruso-9', roles: ['organizador'] }, { tournamentId: 't1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza sin usuario autenticado', async () => {
    const guard = new TorneoGestionGuard(buildPrisma() as any);
    await expect(guard.canActivate(ctx(undefined, { tournamentId: 't1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('404 si el torneo no existe', async () => {
    const guard = new TorneoGestionGuard(buildPrisma({ torneo: null }) as any);
    await expect(
      guard.canActivate(ctx({ userId: 'owner-1', roles: ['organizador'] }, { tournamentId: 'nope' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('TorneoGestionGuard - resolución del torneo', () => {
  const user = { userId: 'owner-1', roles: ['organizador'] };

  it('desde params.id (rutas torneos/:id/...)', async () => {
    const prisma = buildPrisma();
    const guard = new TorneoGestionGuard(prisma as any);
    await expect(guard.canActivate(ctx(user, { id: 't1' }))).resolves.toBe(true);
    expect(prisma.tournament.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' } }),
    );
  });

  it('desde body.tournamentId (DTOs de sorteo)', async () => {
    const guard = new TorneoGestionGuard(buildPrisma() as any);
    await expect(guard.canActivate(ctx(user, {}, { tournamentId: 't1' }))).resolves.toBe(true);
  });

  it('desde params.partidoId via lookup del partido', async () => {
    const prisma = buildPrisma({ match: { tournamentId: 't1' } });
    const guard = new TorneoGestionGuard(prisma as any);
    await expect(guard.canActivate(ctx(user, { partidoId: 'm1' }))).resolves.toBe(true);
    expect(prisma.match.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' } }),
    );
  });

  it('desde params.diaId via lookup del día', async () => {
    const prisma = buildPrisma({ dia: { tournamentId: 't1' } });
    const guard = new TorneoGestionGuard(prisma as any);
    await expect(guard.canActivate(ctx(user, { diaId: 'd1' }))).resolves.toBe(true);
  });

  it('desde params.tournamentCategoryId via lookup de la categoría', async () => {
    const prisma = buildPrisma({ categoria: { tournamentId: 't1' } });
    const guard = new TorneoGestionGuard(prisma as any);
    await expect(guard.canActivate(ctx(user, { tournamentCategoryId: 'tc1' }))).resolves.toBe(true);
    expect(prisma.tournamentCategory.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tc1' } }),
    );
  });

  it('desde params.fixtureVersionId via lookup del fixture', async () => {
    const prisma = buildPrisma({ fixture: { tournamentId: 't1' } });
    const guard = new TorneoGestionGuard(prisma as any);
    await expect(guard.canActivate(ctx(user, { fixtureVersionId: 'fv1' }))).resolves.toBe(true);
  });

  it('404 si la categoría referenciada no existe', async () => {
    const guard = new TorneoGestionGuard(buildPrisma({ categoria: null }) as any);
    await expect(
      guard.canActivate(ctx(user, { tournamentCategoryId: 'nope' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fail-closed: niega si no puede resolver el torneo', async () => {
    const guard = new TorneoGestionGuard(buildPrisma() as any);
    await expect(guard.canActivate(ctx(user, {}, {}))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404 si el partido referenciado no existe', async () => {
    const guard = new TorneoGestionGuard(buildPrisma({ match: null }) as any);
    await expect(guard.canActivate(ctx(user, { matchId: 'nope' }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
