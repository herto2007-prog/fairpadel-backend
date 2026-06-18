import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminAuditoriaController } from './admin-auditoria.controller';

/**
 * Tests del god-panel Frente B: mover categoría, corregir pareja, editar jugador.
 */
describe('AdminAuditoriaController — Frente B (inscriptos y parejas)', () => {
  // OJO: usar 'in' (no ??) para respetar overrides explícitos en null.
  const buildPrisma = (overrides: any = {}) => ({
    inscripcion: {
      findUnique: jest.fn().mockResolvedValue(
        'insc' in overrides ? overrides.insc : { id: 'i1', tournamentId: 't1', categoryId: 'c1' },
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    match: { count: jest.fn().mockResolvedValue('enCuadro' in overrides ? overrides.enCuadro : 0) },
    tournamentCategory: { findFirst: jest.fn().mockResolvedValue('tc' in overrides ? overrides.tc : { id: 'tc2' }) },
    user: {
      findUnique: jest.fn().mockResolvedValue('user' in overrides ? overrides.user : { id: 'u1', documento: 'D2' }),
      update: jest.fn().mockResolvedValue({}),
    },
  });
  const ctrl = (prisma: any) => new AdminAuditoriaController(prisma as any);

  describe('moverCategoria', () => {
    it('mueve si no está en el cuadro y la categoría es del torneo', async () => {
      const prisma = buildPrisma();
      const res = await ctrl(prisma).moverCategoria('i1', { categoryId: 'c2' });
      expect(prisma.inscripcion.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { categoryId: 'c2' } });
      expect(res.success).toBe(true);
    });

    it('bloquea si la pareja está en el cuadro', async () => {
      const prisma = buildPrisma({ enCuadro: 2 });
      await expect(ctrl(prisma).moverCategoria('i1', { categoryId: 'c2' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.inscripcion.update).not.toHaveBeenCalled();
    });

    it('bloquea si la categoría no es del torneo', async () => {
      const prisma = buildPrisma({ tc: null });
      await expect(ctrl(prisma).moverCategoria('i1', { categoryId: 'cX' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.inscripcion.update).not.toHaveBeenCalled();
    });

    it('404 si la inscripción no existe', async () => {
      const prisma = buildPrisma({ insc: null });
      await expect(ctrl(prisma).moverCategoria('i1', { categoryId: 'c2' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('traduce el choque de unicidad (P2002) a mensaje claro', async () => {
      const prisma = buildPrisma();
      prisma.inscripcion.update.mockRejectedValueOnce({ code: 'P2002' });
      await expect(ctrl(prisma).moverCategoria('i1', { categoryId: 'c2' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('corregirPareja', () => {
    it('completa el jugador 2 y deriva su documento', async () => {
      const prisma = buildPrisma({ insc: { id: 'i1' }, user: { id: 'u2', documento: 'DOC2' } });
      await ctrl(prisma).corregirPareja('i1', { jugador2Id: 'u2' });
      expect(prisma.inscripcion.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { jugador2Id: 'u2', jugador2Documento: 'DOC2' },
      });
    });

    it('permite dejar la pareja pendiente (jugador2Id null)', async () => {
      const prisma = buildPrisma({ insc: { id: 'i1' } });
      await ctrl(prisma).corregirPareja('i1', { jugador2Id: null });
      expect(prisma.inscripcion.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { jugador2Id: null } });
    });

    it('bloquea si el jugador no existe', async () => {
      const prisma = buildPrisma({ insc: { id: 'i1' }, user: null });
      await expect(ctrl(prisma).corregirPareja('i1', { jugador1Id: 'noexiste' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('editarJugador', () => {
    it('actualiza los campos provistos', async () => {
      const prisma = buildPrisma({ user: { id: 'u1' } });
      await ctrl(prisma).editarJugador('u1', { nombre: 'Juan', telefono: '0981' });
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { nombre: 'Juan', telefono: '0981' } });
    });

    it('traduce documento duplicado (P2002)', async () => {
      const prisma = buildPrisma({ user: { id: 'u1' } });
      prisma.user.update.mockRejectedValueOnce({ code: 'P2002' });
      await expect(ctrl(prisma).editarJugador('u1', { documento: 'X' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404 si el jugador no existe', async () => {
      const prisma = buildPrisma({ user: null });
      await expect(ctrl(prisma).editarJugador('u1', { nombre: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
