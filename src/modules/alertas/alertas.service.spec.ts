import { AlertasService } from './alertas.service';

/**
 * Tests de la lógica de alertas "torneos en mi ciudad":
 * match de ciudad case-insensitive, exclusión del organizador,
 * anti-duplicado por (usuario, enlace) y validación al crear.
 */

const torneoBase = (overrides: any = {}) => ({
  id: 't1',
  nombre: 'Copa Test',
  ciudad: 'Asunción',
  slug: 'copa-test-abc',
  estado: 'PUBLICADO',
  organizadorId: 'org1',
  ...overrides,
});

const buildPrisma = ({
  torneo = torneoBase(),
  alertas = [] as any[],
  notificacionExistente = null as any,
} = {}) => ({
  tournament: { findUnique: jest.fn().mockResolvedValue(torneo) },
  alertaPersonalizada: {
    findMany: jest.fn().mockResolvedValue(alertas),
    upsert: jest.fn().mockResolvedValue({ id: 'a1' }),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  notificacion: {
    findFirst: jest.fn().mockResolvedValue(notificacionExistente),
    create: jest.fn().mockResolvedValue({ id: 'n1' }),
  },
});

const buildEmail = () =>
  ({ sendNuevoTorneoCiudad: jest.fn().mockResolvedValue(undefined) }) as any;

const buildConfig = () =>
  ({ get: jest.fn().mockReturnValue('https://www.fairpadel.com') }) as any;

const buildPush = () =>
  ({ enviarAUsuario: jest.fn().mockResolvedValue(undefined), notificar: jest.fn().mockResolvedValue(undefined) }) as any;

const buildSvc = (prisma: any, email: any = buildEmail()) =>
  new AlertasService(prisma, email, buildConfig(), buildPush());

describe('AlertasService.notificarNuevoTorneo', () => {
  it('avisa al suscrito de la misma ciudad (case-insensitive), crea in-app y envía email', async () => {
    const prisma = buildPrisma({
      // ciudad sin tilde/minúsculas + usuario con email
      alertas: [{ userId: 'u1', config: { ciudad: 'asuncion' }, user: { email: 'u1@test.com', nombre: 'Ana' } }],
      torneo: torneoBase({ ciudad: 'Asunción' }),
    });
    const email = buildEmail();
    const svc = buildSvc(prisma, email);

    const res = await svc.notificarNuevoTorneo('t1');

    expect(res).toEqual({ avisados: 1 });
    expect(prisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          tipo: 'TORNEO',
          enlace: '/t/copa-test-abc',
        }),
      }),
    );
    expect(email.sendNuevoTorneoCiudad).toHaveBeenCalledWith(
      'u1@test.com',
      'Ana',
      'Copa Test',
      'Asunción',
      'https://www.fairpadel.com/t/copa-test-abc',
    );
  });

  it('no avisa al organizador del torneo', async () => {
    const prisma = buildPrisma({
      alertas: [{ userId: 'org1', config: { ciudad: 'Asunción' } }],
    });
    const svc = buildSvc(prisma);

    const res = await svc.notificarNuevoTorneo('t1');

    expect(res).toEqual({ avisados: 0 });
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('no avisa a suscritos de otra ciudad', async () => {
    const prisma = buildPrisma({
      alertas: [{ userId: 'u1', config: { ciudad: 'Encarnación' } }],
    });
    const svc = buildSvc(prisma);

    const res = await svc.notificarNuevoTorneo('t1');

    expect(res).toEqual({ avisados: 0 });
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('deduplica: si ya existe una notificación con ese enlace, omite', async () => {
    const prisma = buildPrisma({
      alertas: [{ userId: 'u1', config: { ciudad: 'Asunción' } }],
      notificacionExistente: { id: 'ya-existe' },
    });
    const svc = buildSvc(prisma);

    const res = await svc.notificarNuevoTorneo('t1');

    expect(res).toEqual({ avisados: 0 });
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('no hace nada si el torneo no está PUBLICADO', async () => {
    const prisma = buildPrisma({ torneo: torneoBase({ estado: 'BORRADOR' }) });
    const svc = buildSvc(prisma);

    const res = await svc.notificarNuevoTorneo('t1');

    expect(res).toEqual({ avisados: 0 });
    expect(prisma.alertaPersonalizada.findMany).not.toHaveBeenCalled();
  });
});

describe('AlertasService.crearOActualizar', () => {
  it('rechaza una alerta de ciudad sin ciudad', async () => {
    const prisma = buildPrisma();
    const svc = buildSvc(prisma);

    await expect(
      svc.crearOActualizar('u1', { tipo: 'TORNEO_EN_MI_CIUDAD' } as any),
    ).rejects.toThrow();
    expect(prisma.alertaPersonalizada.upsert).not.toHaveBeenCalled();
  });

  it('upserta la alerta de ciudad con la ciudad recortada', async () => {
    const prisma = buildPrisma();
    const svc = buildSvc(prisma);

    await svc.crearOActualizar('u1', {
      tipo: 'TORNEO_EN_MI_CIUDAD',
      ciudad: '  Asunción  ',
    } as any);

    expect(prisma.alertaPersonalizada.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_tipo: { userId: 'u1', tipo: 'TORNEO_EN_MI_CIUDAD' } },
        create: expect.objectContaining({ config: { ciudad: 'Asunción' } }),
        update: expect.objectContaining({ config: { ciudad: 'Asunción' } }),
      }),
    );
  });
});
