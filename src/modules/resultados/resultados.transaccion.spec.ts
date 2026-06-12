import { ResultadosService } from './resultados.service';

/**
 * Tests del avance transaccional (Fase 4-C).
 * Verifica que finalizarYAvanzar:
 *  - hace el update del partido y la escritura de casilleros en la MISMA transacción,
 *  - ejecuta los efectos best-effort (programación, clasificación) SOLO tras el commit,
 *  - si una escritura falla dentro de la transacción, revierte y NO corre efectos.
 */
const buildService = ({ slotUpdateRejects = false } = {}) => {
  const txMatch = {
    update: jest.fn().mockImplementation(({ where }) => {
      if (slotUpdateRejects && where.id !== 'm1') {
        return Promise.reject(new Error('fallo al escribir casillero'));
      }
      return Promise.resolve({ id: where.id });
    }),
    findUnique: jest.fn().mockResolvedValue({ ronda: 'REPECHAJE' }),
  };
  const tx = { match: txMatch };
  const prisma = {
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
  const programacionService = {
    programarPartidoAutomatico: jest.fn().mockResolvedValue({ success: true }),
  };
  const clasificacionService = {
    recalcularEstados: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ResultadosService(
    prisma as any,
    {} as any, // dateService
    programacionService as any,
    clasificacionService as any,
  ) as any;
  return { service, prisma, txMatch, programacionService, clasificacionService };
};

const matchCompleto = {
  id: 'm1',
  tournamentId: 't1',
  categoryId: 'c1',
  partidoSiguienteId: 'next',
  posicionEnSiguiente: 1,
  partidoPerdedorSiguienteId: 'loser',
  posicionEnPerdedor: 2,
  inscripcion1Id: 'A',
  inscripcion2Id: 'B',
};

describe('ResultadosService.finalizarYAvanzar', () => {
  it('escribe partido + casilleros en la misma transacción y luego corre los efectos', async () => {
    const { service, prisma, txMatch, programacionService, clasificacionService } = buildService();

    await service.finalizarYAvanzar('m1', { estado: 'FINALIZADO' }, matchCompleto, 'A');

    // Una sola transacción
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // 3 updates por el tx: el partido, el casillero del ganador y el del perdedor
    const idsActualizados = txMatch.update.mock.calls.map((c) => c[0].where.id);
    expect(idsActualizados).toEqual(['m1', 'next', 'loser']);

    // Efectos best-effort después del commit
    expect(programacionService.programarPartidoAutomatico).toHaveBeenCalledWith('t1', 'next');
    expect(programacionService.programarPartidoAutomatico).toHaveBeenCalledWith('t1', 'loser');
    expect(clasificacionService.recalcularEstados).toHaveBeenCalledWith('t1', 'c1');
  });

  it('si falla la escritura de un casillero, revierte y NO ejecuta efectos', async () => {
    const { service, programacionService, clasificacionService } = buildService({ slotUpdateRejects: true });

    await expect(
      service.finalizarYAvanzar('m1', { estado: 'FINALIZADO' }, matchCompleto, 'A'),
    ).rejects.toThrow('fallo al escribir casillero');

    // Como la transacción falló, los efectos best-effort no deben correr
    expect(programacionService.programarPartidoAutomatico).not.toHaveBeenCalled();
    expect(clasificacionService.recalcularEstados).not.toHaveBeenCalled();
  });

  it('sin matchCompleto, solo actualiza el partido (sin avance ni efectos)', async () => {
    const { service, txMatch, programacionService, clasificacionService } = buildService();

    await service.finalizarYAvanzar('m1', { estado: 'FINALIZADO' }, null, 'A');

    expect(txMatch.update).toHaveBeenCalledTimes(1);
    expect(txMatch.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm1' } }));
    expect(programacionService.programarPartidoAutomatico).not.toHaveBeenCalled();
    expect(clasificacionService.recalcularEstados).not.toHaveBeenCalled();
  });
});
