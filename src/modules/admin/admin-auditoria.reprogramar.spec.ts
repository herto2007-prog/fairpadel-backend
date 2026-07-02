import { AdminAuditoriaController } from './admin-auditoria.controller';

/**
 * Coherencia god-panel ↔ grilla: reprogramar un partido desde Auditoría debe
 * LIBERAR su franja actual (si no, queda "ocupada" fantasma y el calendario
 * muestra al partido en el lugar viejo) y, si el destino coincide exacto con
 * una franja LIBRE, ocuparla. Destino a medida (sin franja) = enGrilla false.
 */
describe('AdminAuditoriaController.reprogramarPartido', () => {
  const PARTIDO = 'match-1';
  const SLOT_VIEJO = { id: 'slot-viejo' };
  const SLOT_DESTINO = { id: 'slot-destino' };

  function build(opts: { slotActual?: any; slotDestino?: any } = {}) {
    const tx = {
      torneoSlot: {
        findFirst: jest.fn(({ where }: any) =>
          Promise.resolve(where.matchId ? (opts.slotActual ?? null) : (opts.slotDestino ?? null)),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
      match: {
        update: jest.fn().mockResolvedValue({
          fechaProgramada: '2026-07-08',
          horaProgramada: '19:30',
          torneoCanchaId: 'cancha-2',
        }),
      },
    };
    const prisma = {
      match: { findUnique: jest.fn().mockResolvedValue({ id: PARTIDO }) },
      torneoCancha: { findUnique: jest.fn().mockResolvedValue({ id: 'cancha-2' }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const controller = new AdminAuditoriaController(prisma as any);
    return { controller, prisma, tx };
  }

  const dto = { fecha: '2026-07-08', hora: '19:30', torneoCanchaId: 'cancha-2' } as any;

  it('libera la franja vieja y ocupa la franja destino si coincide LIBRE', async () => {
    const { controller, tx } = build({ slotActual: SLOT_VIEJO, slotDestino: SLOT_DESTINO });

    const r = await controller.reprogramarPartido(PARTIDO, dto);

    expect(r.enGrilla).toBe(true);
    expect(tx.torneoSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-viejo' },
      data: { estado: 'LIBRE', matchId: null },
    });
    expect(tx.torneoSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-destino' },
      data: { estado: 'OCUPADO', matchId: PARTIDO },
    });
  });

  it('sin franja coincidente: libera la vieja y queda fuera de la grilla', async () => {
    const { controller, tx } = build({ slotActual: SLOT_VIEJO, slotDestino: null });

    const r = await controller.reprogramarPartido(PARTIDO, dto);

    expect(r.enGrilla).toBe(false);
    expect(tx.torneoSlot.update).toHaveBeenCalledTimes(1); // solo la liberación
    expect(tx.match.update).toHaveBeenCalled();
  });

  it('partido sin franja previa: no libera nada y ocupa destino si existe', async () => {
    const { controller, tx } = build({ slotActual: null, slotDestino: SLOT_DESTINO });

    const r = await controller.reprogramarPartido(PARTIDO, dto);

    expect(r.enGrilla).toBe(true);
    expect(tx.torneoSlot.update).toHaveBeenCalledTimes(1); // solo la ocupación
    expect(tx.torneoSlot.update).toHaveBeenCalledWith({
      where: { id: 'slot-destino' },
      data: { estado: 'OCUPADO', matchId: PARTIDO },
    });
  });
});
