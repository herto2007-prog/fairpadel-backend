import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminAuditoriaController } from './admin-auditoria.controller';

/**
 * Tests del god-panel A2/A3: limpiar resultado EN CASCADA (limpiarResultado).
 * Lo crítico: al limpiar un partido cuyo ganador YA avanzó, también se limpia
 * el resultado de la ronda posterior y se vacía el casillero que llenó —
 * dejando el cuadro consistente (no corrompido).
 */
describe('AdminAuditoriaController.limpiarResultado', () => {
  const FINAL = {
    id: 'F', estado: 'FINALIZADO', inscripcionGanadoraId: 'gf',
    partidoSiguienteId: null, posicionEnSiguiente: null,
    partidoPerdedorSiguienteId: null, posicionEnPerdedor: null,
  };
  const SEMI = {
    id: 'M1', estado: 'FINALIZADO', inscripcionGanadoraId: 'g1',
    partidoSiguienteId: 'F', posicionEnSiguiente: 1,
    partidoPerdedorSiguienteId: null, posicionEnPerdedor: null,
  };

  const build = (matchesById: Record<string, any>) => {
    const findUnique = jest.fn(({ where: { id } }: any) =>
      Promise.resolve(matchesById[id] ? { ...matchesById[id] } : null),
    );
    const update = jest.fn(() => Promise.resolve({}));
    const prisma = {
      match: { findUnique, update },
      $transaction: (fn: any) => fn({ match: { findUnique, update } }),
    };
    const controller = new AdminAuditoriaController(prisma as any);
    return { controller, prisma, update };
  };

  it('limpia en cascada: semifinal jugada cuyo ganador ya jugó la final', async () => {
    const { controller, update } = build({ M1: SEMI, F: FINAL });

    const res = await controller.limpiarResultado('M1');

    expect(res.partidosAfectados).toBe(2);

    // La final quedó sin resultado
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'F' }, data: expect.objectContaining({ estado: 'PROGRAMADO' }) }),
    );
    // Se vació el casillero (posición 1) de la final que la semi había llenado
    expect(update).toHaveBeenCalledWith({
      where: { id: 'F' },
      data: { inscripcion1Id: null, tipoEntrada1: null },
    });
    // La propia semi quedó sin resultado
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'M1' }, data: expect.objectContaining({ estado: 'PROGRAMADO', inscripcionGanadoraId: null }) }),
    );
  });

  it('limpia un partido sin rondas posteriores (afecta solo 1)', async () => {
    const { controller, update } = build({ F: FINAL });

    const res = await controller.limpiarResultado('F');

    expect(res.partidosAfectados).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('rechaza limpiar un partido sin resultado', async () => {
    const { controller, update } = build({
      M1: { ...SEMI, estado: 'PROGRAMADO', inscripcionGanadoraId: null },
    });

    await expect(controller.limpiarResultado('M1')).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('404 si el partido no existe', async () => {
    const { controller } = build({});
    await expect(controller.limpiarResultado('X')).rejects.toBeInstanceOf(NotFoundException);
  });
});
