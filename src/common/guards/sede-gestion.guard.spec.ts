import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SedeGestionGuard } from './sede-gestion.guard';

/**
 * Tests del guard compartido de gestión por sede (cierra el IDOR en
 * sedes y alquileres: solo dueño/encargado de ESA sede, o admin).
 */
const SEDE = { duenoId: 'dueno-1', encargadoId: 'encargado-2' };

const ctx = (user: any, params: any = {}, body: any = {}) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user, params, body }),
    }),
  }) as any;

const buildPrisma = ({
  sede = SEDE as any,
  cancha = null as any,
  reserva = null as any,
  disponibilidad = null as any,
  bloqueo = null as any,
} = {}) => ({
  sede: { findUnique: jest.fn().mockResolvedValue(sede) },
  sedeCancha: { findUnique: jest.fn().mockResolvedValue(cancha) },
  reservaCancha: { findUnique: jest.fn().mockResolvedValue(reserva) },
  alquilerDisponibilidad: { findUnique: jest.fn().mockResolvedValue(disponibilidad) },
  alquilerBloqueo: { findUnique: jest.fn().mockResolvedValue(bloqueo) },
});

describe('SedeGestionGuard - autorización', () => {
  it('permite a un admin global sin tocar la base', async () => {
    const prisma = buildPrisma();
    const guard = new SedeGestionGuard(prisma as any);

    await expect(
      guard.canActivate(ctx({ userId: 'x', roles: ['admin'] }, { sedeId: 's1' })),
    ).resolves.toBe(true);
    expect(prisma.sede.findUnique).not.toHaveBeenCalled();
  });

  it('permite al dueño de la sede', async () => {
    const guard = new SedeGestionGuard(buildPrisma() as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: ['dueño'] }, { sedeId: 's1' })),
    ).resolves.toBe(true);
  });

  it('permite al encargado de la sede', async () => {
    const guard = new SedeGestionGuard(buildPrisma() as any);
    await expect(
      guard.canActivate(ctx({ userId: 'encargado-2', roles: ['encargado'] }, { sedeId: 's1' })),
    ).resolves.toBe(true);
  });

  it('rechaza a un organizador/encargado ajeno (IDOR)', async () => {
    const guard = new SedeGestionGuard(buildPrisma() as any);
    await expect(
      guard.canActivate(ctx({ userId: 'intruso-9', roles: ['organizador', 'encargado'] }, { sedeId: 's1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza sin usuario autenticado', async () => {
    const guard = new SedeGestionGuard(buildPrisma() as any);
    await expect(guard.canActivate(ctx(undefined, { sedeId: 's1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza si la sede no tiene dueño ni encargado (fail-closed)', async () => {
    const guard = new SedeGestionGuard(
      buildPrisma({ sede: { duenoId: null, encargadoId: null } }) as any,
    );
    await expect(
      guard.canActivate(ctx({ userId: 'alguien', roles: ['organizador'] }, { sedeId: 's1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404 si la sede no existe', async () => {
    const guard = new SedeGestionGuard(buildPrisma({ sede: null }) as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: [] }, { sedeId: 'no-existe' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SedeGestionGuard - resolución de la sede', () => {
  it('resuelve por params.canchaId', async () => {
    const prisma = buildPrisma({ cancha: { sedeId: 's1' } });
    const guard = new SedeGestionGuard(prisma as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: [] }, { canchaId: 'c1' })),
    ).resolves.toBe(true);
    expect(prisma.sedeCancha.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' } }),
    );
  });

  it('resuelve por params.reservaId (reserva -> cancha -> sede)', async () => {
    const prisma = buildPrisma({ reserva: { sedeCancha: { sedeId: 's1' } } });
    const guard = new SedeGestionGuard(prisma as any);
    await expect(
      guard.canActivate(ctx({ userId: 'encargado-2', roles: [] }, { reservaId: 'r1' })),
    ).resolves.toBe(true);
  });

  it('resuelve por params.disponibilidadId', async () => {
    const prisma = buildPrisma({ disponibilidad: { sedeCancha: { sedeId: 's1' } } });
    const guard = new SedeGestionGuard(prisma as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: [] }, { disponibilidadId: 'd1' })),
    ).resolves.toBe(true);
  });

  it('resuelve por params.bloqueoId', async () => {
    const prisma = buildPrisma({ bloqueo: { sedeId: 's1' } });
    const guard = new SedeGestionGuard(prisma as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: [] }, { bloqueoId: 'b1' })),
    ).resolves.toBe(true);
  });

  it('resuelve por body.sedeId', async () => {
    const guard = new SedeGestionGuard(buildPrisma() as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: [] }, {}, { sedeId: 's1' })),
    ).resolves.toBe(true);
  });

  it('resuelve por body.sedeCanchaId', async () => {
    const prisma = buildPrisma({ cancha: { sedeId: 's1' } });
    const guard = new SedeGestionGuard(prisma as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: [] }, {}, { sedeCanchaId: 'c1' })),
    ).resolves.toBe(true);
  });

  it('niega si no puede resolver la sede (fail-closed)', async () => {
    const guard = new SedeGestionGuard(buildPrisma() as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: [] }, {}, {})),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404 si la reserva referenciada no existe', async () => {
    const guard = new SedeGestionGuard(buildPrisma({ reserva: null }) as any);
    await expect(
      guard.canActivate(ctx({ userId: 'dueno-1', roles: [] }, { reservaId: 'no-existe' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
