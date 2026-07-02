import { PartidoSlotsService } from './partido-slots.service';

/**
 * Regresión del bug histórico de intercambiarSlots: TorneoSlot.matchId es
 * @unique, así que el swap DEBE liberar un slot (matchId: null) antes de
 * reasignar. Con el orden viejo (asignar directo) la unicidad explotaba y el
 * endpoint devolvía 500 SIEMPRE. Este spec fija la secuencia correcta.
 */
describe('PartidoSlotsService.intercambiarSlots', () => {
  const M1 = 'match-1';
  const M2 = 'match-2';
  const SLOT1 = {
    id: 'slot-1', horaInicio: '18:00', torneoCanchaId: 'c1',
    disponibilidad: { fecha: '2026-07-08' },
  };
  const SLOT2 = {
    id: 'slot-2', horaInicio: '19:30', torneoCanchaId: 'c2',
    disponibilidad: { fecha: '2026-07-08' },
  };

  function build() {
    const slotUpdates: { id: string; matchId: string | null }[] = [];
    const tx = {
      torneoSlot: {
        update: jest.fn(({ where, data }: any) => {
          slotUpdates.push({ id: where.id, matchId: data.matchId });
          return Promise.resolve({});
        }),
      },
      match: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      match: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve({ id: where.id })),
      },
      torneoSlot: {
        findFirst: jest.fn(({ where }: any) =>
          Promise.resolve(where.matchId === M1 ? SLOT1 : SLOT2),
        ),
      },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    const service = new PartidoSlotsService(prisma as any);
    return { service, prisma, tx, slotUpdates };
  }

  it('libera un slot ANTES de reasignar (matchId es @unique)', async () => {
    const { service, slotUpdates } = build();

    const r = await service.intercambiarSlots('t1', M1, M2);

    expect(r.success).toBe(true);
    expect(slotUpdates).toEqual([
      { id: 'slot-1', matchId: null }, // liberar primero
      { id: 'slot-2', matchId: M1 },
      { id: 'slot-1', matchId: M2 },
    ]);
    // En NINGÚN momento un matchId queda asignado a dos slots a la vez:
    // slot-1 se vacía antes de que slot-2 reciba a M1, y slot-1 recibe a M2
    // recién después de que slot-2 dejó de tenerlo.
  });

  it('cruza fecha/hora/cancha de los partidos', async () => {
    const { service, tx } = build();

    await service.intercambiarSlots('t1', M1, M2);

    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: M1 },
      data: { fechaProgramada: '2026-07-08', horaProgramada: '19:30', torneoCanchaId: 'c2' },
    });
    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: M2 },
      data: { fechaProgramada: '2026-07-08', horaProgramada: '18:00', torneoCanchaId: 'c1' },
    });
  });

  it('rechaza si alguno no tiene slot asignado', async () => {
    const { service, prisma } = build();
    (prisma.torneoSlot.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(service.intercambiarSlots('t1', M1, M2)).rejects.toThrow(
      'Ambos partidos deben tener slots asignados',
    );
  });
});
