import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MatchTournamentGuard } from './match-tournament.guard';

/**
 * Tests del guard de autorización por torneo en los endpoints de resultados.
 * Cierra el IDOR donde cualquier organizador podía tocar torneos ajenos.
 */
const ctx = (user: any, matchId?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { matchId } }),
    }),
  }) as any;

const buildPrisma = (tournament: any) => ({
  match: { findUnique: jest.fn().mockResolvedValue(tournament ? { tournament } : null) },
});

describe('MatchTournamentGuard', () => {
  it('permite a un admin global sin tocar la base', async () => {
    const prisma = buildPrisma(null);
    const guard = new MatchTournamentGuard(prisma as any);

    await expect(
      guard.canActivate(ctx({ userId: 'x', roles: ['admin'] }, 'm1')),
    ).resolves.toBe(true);
    expect(prisma.match.findUnique).not.toHaveBeenCalled();
  });

  it('permite al organizador dueño del torneo', async () => {
    const prisma = buildPrisma({ organizadorId: 'owner-1', coorganizadores: [] });
    const guard = new MatchTournamentGuard(prisma as any);

    await expect(
      guard.canActivate(ctx({ userId: 'owner-1', roles: ['organizador'] }, 'm1')),
    ).resolves.toBe(true);
  });

  it('permite a un coorganizador del torneo', async () => {
    const prisma = buildPrisma({
      organizadorId: 'owner-1',
      coorganizadores: [{ userId: 'co-2' }],
    });
    const guard = new MatchTournamentGuard(prisma as any);

    await expect(
      guard.canActivate(ctx({ userId: 'co-2', roles: ['organizador'] }, 'm1')),
    ).resolves.toBe(true);
  });

  it('rechaza a un organizador ajeno al torneo (IDOR)', async () => {
    const prisma = buildPrisma({ organizadorId: 'owner-1', coorganizadores: [{ userId: 'co-2' }] });
    const guard = new MatchTournamentGuard(prisma as any);

    await expect(
      guard.canActivate(ctx({ userId: 'intruso-9', roles: ['organizador'] }, 'm1')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza si no hay usuario autenticado', async () => {
    const guard = new MatchTournamentGuard(buildPrisma(null) as any);

    await expect(guard.canActivate(ctx(undefined, 'm1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lanza 404 si el partido no existe', async () => {
    const guard = new MatchTournamentGuard(buildPrisma(null) as any);

    await expect(
      guard.canActivate(ctx({ userId: 'owner-1', roles: ['organizador'] }, 'inexistente')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('acepta el id como user.id además de user.userId', async () => {
    const prisma = buildPrisma({ organizadorId: 'owner-1', coorganizadores: [] });
    const guard = new MatchTournamentGuard(prisma as any);

    await expect(
      guard.canActivate(ctx({ id: 'owner-1', roles: ['organizador'] }, 'm1')),
    ).resolves.toBe(true);
  });
});
