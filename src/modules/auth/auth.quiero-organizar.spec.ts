import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * activarRolOrganizador — la "puerta abierta" del organizador (Parte D de
 * publicar-instantáneo). El control de calidad vive en la publicación
 * (aprobación del 1er torneo), así que acá solo importa: agregar el rol,
 * ser idempotente y avisar a los admins.
 */
describe('AuthService.activarRolOrganizador', () => {
  const ROL_ORGANIZADOR = { id: 'rol-org', nombre: 'organizador' };

  function build(prismaOverrides: Record<string, any>) {
    const prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      role: { findUnique: jest.fn().mockResolvedValue(ROL_ORGANIZADOR) },
      userRole: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      notificacion: { create: jest.fn().mockResolvedValue({}) },
      ...prismaOverrides,
    };
    const service = new AuthService(
      prisma as any,
      {} as any, // jwt
      {} as any, // config
      {} as any, // email
      {} as any, // whatsapp
      {} as any, // notificaciones
      {} as any, // comision
    );
    return { service, prisma };
  }

  const jugador = (roles: string[]) => ({
    id: 'user-1',
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan@test.com',
    roles: roles.map((nombre) => ({ role: { nombre } })),
  });

  it('agrega el rol organizador y avisa a los admins', async () => {
    const { service, prisma } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue(jugador(['jugador'])),
        findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]),
      },
    });

    const r = await service.activarRolOrganizador('user-1');

    expect(r).toEqual({ success: true, yaEra: false, roles: ['jugador', 'organizador'] });
    expect(prisma.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'rol-org' }],
      skipDuplicates: true,
    });
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(2);
  });

  it('es idempotente: si ya es organizador no duplica ni re-notifica', async () => {
    const { service, prisma } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue(jugador(['jugador', 'organizador'])),
        findMany: jest.fn(),
      },
    });

    const r = await service.activarRolOrganizador('user-1');

    expect(r).toEqual({ success: true, yaEra: true, roles: ['jugador', 'organizador'] });
    expect(prisma.userRole.createMany).not.toHaveBeenCalled();
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('si el aviso a admins falla, la activación igual vale', async () => {
    const { service, prisma } = build({
      user: {
        findUnique: jest.fn().mockResolvedValue(jugador(['jugador'])),
        findMany: jest.fn().mockRejectedValue(new Error('db caída')),
      },
    });

    const r = await service.activarRolOrganizador('user-1');

    expect(r.success).toBe(true);
    expect(prisma.userRole.createMany).toHaveBeenCalled();
  });

  it('usuario inexistente → NotFoundException', async () => {
    const { service } = build({
      user: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn() },
    });

    await expect(service.activarRolOrganizador('nope')).rejects.toThrow(NotFoundException);
  });
});
