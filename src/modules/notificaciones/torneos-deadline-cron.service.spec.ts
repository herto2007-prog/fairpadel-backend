import { TorneosDeadlineCronService } from './torneos-deadline-cron.service';

/**
 * Tests de la lógica de avisos de deadline de inscripción:
 * ventanas hoy/mañana, anti-duplicado por enlace, email best-effort.
 */
const HOY = '2026-06-12';
const MANANA = '2026-06-13';

const buildDateService = () =>
  ({
    now: jest.fn().mockReturnValue(new Date('2026-06-12T12:00:00Z')),
    addDays: jest.fn().mockReturnValue(new Date('2026-06-13T12:00:00Z')),
    getDateOnly: jest
      .fn()
      .mockReturnValueOnce(HOY) // primera llamada: hoy
      .mockReturnValueOnce(MANANA), // segunda: mañana
  }) as any;

const torneoBase = (overrides: any = {}) => ({
  id: 't1',
  nombre: 'Copa Test',
  organizadorId: 'org1',
  fechaLimiteInscr: MANANA,
  organizador: { id: 'org1', email: 'org@test.com', nombre: 'Héctor' },
  ...overrides,
});

const buildPrisma = ({
  torneos = [] as any[],
  notificacionExistente = null as any,
} = {}) => ({
  tournament: { findMany: jest.fn().mockResolvedValue(torneos) },
  notificacion: {
    findFirst: jest.fn().mockResolvedValue(notificacionExistente),
    create: jest.fn().mockResolvedValue({ id: 'n1' }),
  },
  inscripcion: { count: jest.fn().mockResolvedValue(5) },
  tournamentCategory: { count: jest.fn().mockResolvedValue(3) },
});

const buildEmail = () => ({ sendDeadlineInscripciones: jest.fn().mockResolvedValue(undefined) }) as any;

describe('TorneosDeadlineCronService', () => {
  it('avisa "mañana" con enlace deduplicable y envía email', async () => {
    const prisma = buildPrisma({ torneos: [torneoBase()] });
    const email = buildEmail();
    const svc = new TorneosDeadlineCronService(prisma as any, buildDateService(), email);

    const resumen = await svc.procesarDeadlines();

    expect(resumen).toEqual({ enviadas: 1, omitidas: 0 });
    expect(prisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'org1',
          tipo: 'TORNEO',
          enlace: '/mis-torneos/t1/gestionar?deadline=MANANA',
        }),
      }),
    );
    expect(email.sendDeadlineInscripciones).toHaveBeenCalledWith(
      'org@test.com', 'Héctor', 'Copa Test', 'mañana', MANANA, 5, 5, 3,
    );
  });

  it('avisa "hoy" cuando la fecha límite es hoy', async () => {
    const prisma = buildPrisma({ torneos: [torneoBase({ fechaLimiteInscr: HOY })] });
    const svc = new TorneosDeadlineCronService(prisma as any, buildDateService(), buildEmail());

    await svc.procesarDeadlines();

    expect(prisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enlace: '/mis-torneos/t1/gestionar?deadline=HOY' }),
      }),
    );
  });

  it('no duplica: si ya existe la notificación de esa ventana, omite', async () => {
    const prisma = buildPrisma({
      torneos: [torneoBase()],
      notificacionExistente: { id: 'ya-existe' },
    });
    const email = buildEmail();
    const svc = new TorneosDeadlineCronService(prisma as any, buildDateService(), email);

    const resumen = await svc.procesarDeadlines();

    expect(resumen).toEqual({ enviadas: 0, omitidas: 1 });
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
    expect(email.sendDeadlineInscripciones).not.toHaveBeenCalled();
  });

  it('si el email falla, la notificación in-app igual queda creada', async () => {
    const prisma = buildPrisma({ torneos: [torneoBase()] });
    const email = buildEmail();
    email.sendDeadlineInscripciones.mockRejectedValue(new Error('Resend caído'));
    const svc = new TorneosDeadlineCronService(prisma as any, buildDateService(), email);

    const resumen = await svc.procesarDeadlines();

    expect(resumen.enviadas).toBe(1);
    expect(prisma.notificacion.create).toHaveBeenCalled();
  });

  it('organizador sin email: crea in-app y no intenta enviar email', async () => {
    const prisma = buildPrisma({
      torneos: [torneoBase({ organizador: { id: 'org1', email: null, nombre: 'X' } })],
    });
    const email = buildEmail();
    const svc = new TorneosDeadlineCronService(prisma as any, buildDateService(), email);

    const resumen = await svc.procesarDeadlines();

    expect(resumen.enviadas).toBe(1);
    expect(email.sendDeadlineInscripciones).not.toHaveBeenCalled();
  });

  it('sin torneos próximos al límite, no hace nada', async () => {
    const prisma = buildPrisma({ torneos: [] });
    const svc = new TorneosDeadlineCronService(prisma as any, buildDateService(), buildEmail());

    const resumen = await svc.procesarDeadlines();

    expect(resumen).toEqual({ enviadas: 0, omitidas: 0 });
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });
});
