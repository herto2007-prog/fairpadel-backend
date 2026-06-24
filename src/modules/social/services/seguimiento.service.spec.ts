import { SeguimientoService } from './seguimiento.service';

/**
 * Tests de eliminarSeguidor ("quitar de mis seguidores"): borra el seguimiento
 * correcto (seguidorId del otro, seguidoId = yo) y no hace nada si no me sigue.
 */

const buildPrisma = ({ seguimiento = null as any } = {}) => ({
  seguimiento: {
    findUnique: jest.fn().mockResolvedValue(seguimiento),
    delete: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(3),
  },
});

const buildPush = () =>
  ({ enviarAUsuario: jest.fn(), notificar: jest.fn() }) as any;

const buildSvc = (prisma: any) => new SeguimientoService(prisma as any, buildPush());

describe('SeguimientoService.eliminarSeguidor', () => {
  it('elimina el seguimiento correcto (seguidorId del otro, seguidoId = yo)', async () => {
    const prisma = buildPrisma({ seguimiento: { id: 's1' } });
    const svc = buildSvc(prisma);

    const res = await svc.eliminarSeguidor('yo', 'otro');

    expect(prisma.seguimiento.delete).toHaveBeenCalledWith({
      where: { seguidorId_seguidoId: { seguidorId: 'otro', seguidoId: 'yo' } },
    });
    expect(res).toEqual({
      success: true,
      message: 'Seguidor eliminado',
      data: { seguidoresCount: 3 },
    });
  });

  it('no borra nada si ese usuario no me sigue', async () => {
    const prisma = buildPrisma({ seguimiento: null });
    const svc = buildSvc(prisma);

    const res = await svc.eliminarSeguidor('yo', 'otro');

    expect(prisma.seguimiento.delete).not.toHaveBeenCalled();
    expect(res.success).toBe(false);
  });
});
