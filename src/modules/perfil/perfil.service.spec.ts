import { BadRequestException } from '@nestjs/common';
import { PerfilService } from './perfil.service';

/**
 * Tests de completarDatosCompetidor (Fase registro, corte 2 / just-in-time).
 * Verifica que documento/categoría/género se setean SOLO si faltan (aditivo),
 * que valida documento duplicado y que calcula bien datosCompletos.
 */
const buildService = (opts: {
  current: any;
  byDocumento?: any;
  category?: any;
  updated: any;
}) => {
  const prisma: any = {
    user: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id) return Promise.resolve(opts.current);
        if (where.documento) return Promise.resolve(opts.byDocumento ?? null);
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue(opts.updated),
    },
    category: { findFirst: jest.fn().mockResolvedValue(opts.category ?? null) },
  };
  return { service: new PerfilService(prisma, {} as any), prisma };
};

describe('PerfilService.completarDatosCompetidor', () => {
  it('setea documento/categoría/género cuando faltan y marca datosCompletos', async () => {
    const { service, prisma } = buildService({
      current: { id: 'u1', documento: null, genero: null, categoriaActualId: null },
      category: { id: 'cat1', nombre: 'Cuarta' },
      updated: {
        id: 'u1', nombre: 'Ana', apellido: 'G', documento: '123', genero: 'MASCULINO',
        ciudad: 'Asunción', telefono: null, fechaNacimiento: null,
        categoriaActualId: 'cat1', categoriaActual: { id: 'cat1', nombre: 'Cuarta' },
      },
    });

    const res = await service.completarDatosCompetidor('u1', {
      documento: '123', genero: 'MASCULINO' as any, categoria: 'Cuarta', ciudad: 'Asunción',
    });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ documento: '123', genero: 'MASCULINO', categoriaActualId: 'cat1', ciudad: 'Asunción' });
    expect(res.datosCompletos).toBe(true);
  });

  it('NO pisa documento/categoría/género ya existentes', async () => {
    const { service, prisma } = buildService({
      current: { id: 'u1', documento: '999', genero: 'MASCULINO', categoriaActualId: 'catX' },
      updated: { id: 'u1', documento: '999', genero: 'MASCULINO', categoriaActualId: 'catX', categoriaActual: { id: 'catX', nombre: 'Quinta' } },
    });

    await service.completarDatosCompetidor('u1', {
      documento: '123', genero: 'FEMENINO' as any, categoria: 'Cuarta',
    });

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.documento).toBeUndefined();
    expect(data.genero).toBeUndefined();
    expect(data.categoriaActualId).toBeUndefined();
    expect(prisma.category.findFirst).not.toHaveBeenCalled();
  });

  it('rechaza si el documento ya pertenece a otro usuario', async () => {
    const { service } = buildService({
      current: { id: 'u1', documento: null, genero: null, categoriaActualId: null },
      byDocumento: { id: 'otro-user' },
      updated: {},
    });

    await expect(
      service.completarDatosCompetidor('u1', { documento: '123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
