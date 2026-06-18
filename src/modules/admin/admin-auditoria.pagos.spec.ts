import { NotFoundException } from '@nestjs/common';
import { AdminAuditoriaController } from './admin-auditoria.controller';

/**
 * Tests del god-panel Frente C: pagos de inscripción + comisión del torneo.
 */
describe('AdminAuditoriaController — Frente C (pagos y plata)', () => {
  const buildPrisma = (overrides: any = {}) => ({
    inscripcion: { findUnique: jest.fn().mockResolvedValue('insc' in overrides ? overrides.insc : { id: 'i1' }) },
    pago: {
      findUnique: jest.fn().mockResolvedValue('pago' in overrides ? overrides.pago : { id: 'p1' }),
      create: jest.fn().mockResolvedValue({ id: 'pNew' }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    tournament: { findUnique: jest.fn().mockResolvedValue('torneo' in overrides ? overrides.torneo : { id: 't1' }) },
    torneoComision: {
      findUnique: jest.fn().mockResolvedValue('comision' in overrides ? overrides.comision : null),
      upsert: jest.fn().mockResolvedValue({ id: 'co1' }),
    },
  });
  const ctrl = (prisma: any) => new AdminAuditoriaController(prisma as any);

  describe('agregarPago', () => {
    it('crea el pago con comisión 0 y estado por defecto PENDIENTE', async () => {
      const prisma = buildPrisma();
      await ctrl(prisma).agregarPago('i1', { monto: 50000, metodoPago: 'EFECTIVO' as any });
      expect(prisma.pago.create).toHaveBeenCalledWith({
        data: { inscripcionId: 'i1', monto: 50000, comision: 0, metodoPago: 'EFECTIVO', estado: 'PENDIENTE', fechaPago: null },
      });
    });
    it('404 si la inscripción no existe', async () => {
      const prisma = buildPrisma({ insc: null });
      await expect(ctrl(prisma).agregarPago('i1', { monto: 1, metodoPago: 'EFECTIVO' as any })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('editarPago', () => {
    it('marca el pago como confirmado', async () => {
      const prisma = buildPrisma();
      await ctrl(prisma).editarPago('p1', { estado: 'CONFIRMADO' as any });
      expect(prisma.pago.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { estado: 'CONFIRMADO' } });
    });
    it('404 si el pago no existe', async () => {
      const prisma = buildPrisma({ pago: null });
      await expect(ctrl(prisma).editarPago('p1', { monto: 1 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('eliminarPago', () => {
    it('elimina el pago', async () => {
      const prisma = buildPrisma();
      await ctrl(prisma).eliminarPago('p1');
      expect(prisma.pago.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
    it('404 si el pago no existe', async () => {
      const prisma = buildPrisma({ pago: null });
      await expect(ctrl(prisma).eliminarPago('p1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('ajustarComision', () => {
    it('hace upsert con los campos provistos', async () => {
      const prisma = buildPrisma();
      await ctrl(prisma).ajustarComision('t1', { montoEstimado: 60000, estado: 'PAGADO' });
      expect(prisma.torneoComision.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tournamentId: 't1' },
          update: { montoEstimado: 60000, estado: 'PAGADO' },
        }),
      );
    });
    it('404 si el torneo no existe', async () => {
      const prisma = buildPrisma({ torneo: null });
      await expect(ctrl(prisma).ajustarComision('t1', { montoEstimado: 1 })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getComision', () => {
    it('devuelve defaults si no hay comisión', async () => {
      const prisma = buildPrisma();
      const res = await ctrl(prisma).getComision('t1');
      expect(res.comision).toEqual({ tournamentId: 't1', montoEstimado: 0, montoPagado: 0, estado: 'PENDIENTE', bloqueoActivo: false });
    });
  });
});
