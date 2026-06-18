import { NotFoundException } from '@nestjs/common';
import { AdminAuditoriaController } from './admin-auditoria.controller';

/**
 * Tests del god-panel Frente D: forzar estado de torneo / categoría.
 */
describe('AdminAuditoriaController — Frente D (estados)', () => {
  const buildPrisma = (overrides: any = {}) => ({
    tournament: {
      findUnique: jest.fn().mockResolvedValue('torneo' in overrides ? overrides.torneo : { id: 't1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    tournamentCategory: {
      findUnique: jest.fn().mockResolvedValue('cat' in overrides ? overrides.cat : { id: 'tc1' }),
      update: jest.fn().mockResolvedValue({}),
    },
  });
  const ctrl = (prisma: any) => new AdminAuditoriaController(prisma as any);

  describe('forzarEstadoTorneo', () => {
    it('fuerza el estado del torneo', async () => {
      const prisma = buildPrisma();
      const res = await ctrl(prisma).forzarEstadoTorneo('t1', { estado: 'EN_CURSO' as any });
      expect(prisma.tournament.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { estado: 'EN_CURSO' } });
      expect(res.success).toBe(true);
    });
    it('404 si el torneo no existe', async () => {
      const prisma = buildPrisma({ torneo: null });
      await expect(ctrl(prisma).forzarEstadoTorneo('t1', { estado: 'EN_CURSO' as any })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tournament.update).not.toHaveBeenCalled();
    });
  });

  describe('forzarEstadoCategoria', () => {
    it('fuerza el estado de la categoría (ej. des-finalizar)', async () => {
      const prisma = buildPrisma();
      await ctrl(prisma).forzarEstadoCategoria('tc1', { estado: 'INSCRIPCIONES_ABIERTAS' as any });
      expect(prisma.tournamentCategory.update).toHaveBeenCalledWith({ where: { id: 'tc1' }, data: { estado: 'INSCRIPCIONES_ABIERTAS' } });
    });
    it('404 si la categoría no existe', async () => {
      const prisma = buildPrisma({ cat: null });
      await expect(ctrl(prisma).forzarEstadoCategoria('tc1', { estado: 'EN_CURSO' as any })).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.tournamentCategory.update).not.toHaveBeenCalled();
    });
  });
});
