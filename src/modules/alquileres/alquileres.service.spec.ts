import { ForbiddenException } from '@nestjs/common';
import { AlquileresService } from './alquileres.service';

/**
 * Tests del control de acceso de reservas (cierre del cluster IDOR).
 * Foco: confirmar/cancelar una reserva solo lo puede hacer su dueño.
 * Antes, el servicio recibía el userId pero NO lo verificaba, así que
 * cualquier usuario autenticado podía operar sobre reservas ajenas con
 * solo conocer el ID.
 */
describe('AlquileresService - propiedad de reservas (IDOR)', () => {
  const OWNER = 'user-dueño-de-la-reserva';
  const INTRUSO = 'user-intruso';

  const buildService = (reserva: any) => {
    const update = jest.fn().mockImplementation(({ data }) => ({ ...reserva, ...data }));
    const prisma = {
      reservaCancha: {
        findUnique: jest.fn().mockResolvedValue(reserva),
        update,
      },
    } as any;
    const notif = { notificarReservaConfirmada: jest.fn().mockResolvedValue(undefined) } as any;
    return { service: new AlquileresService(prisma, notif), update };
  };

  describe('cancelarReserva', () => {
    const reservaFutura = () => {
      // Fecha bien lejana para superar el mínimo de horas de cancelación
      const anioFuturo = new Date().getFullYear() + 1;
      return {
        id: 'r1',
        userId: OWNER,
        estado: 'CONFIRMADA',
        fecha: `${anioFuturo}-12-31`,
        horaInicio: '20:00',
        horaFin: '21:30',
        sedeCancha: { sede: { alquilerConfig: { cancelacionMinHoras: 4 } } },
      };
    };

    it('rechaza con 403 si la reserva NO es del usuario', async () => {
      const { service, update } = buildService(reservaFutura());
      await expect(
        service.cancelarReserva('r1', { motivo: 'x' } as any, INTRUSO),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
    });

    it('permite cancelar si la reserva es del usuario', async () => {
      const { service, update } = buildService(reservaFutura());
      await service.cancelarReserva('r1', { motivo: 'cambio de planes' } as any, OWNER);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r1' },
          data: expect.objectContaining({ estado: 'CANCELADA' }),
        }),
      );
    });
  });

  describe('confirmarReserva', () => {
    const reservaPendiente = () => ({
      id: 'r2',
      userId: OWNER,
      estado: 'PENDIENTE',
    });

    it('rechaza con 403 si la reserva NO es del usuario', async () => {
      const { service, update } = buildService(reservaPendiente());
      await expect(
        service.confirmarReserva('r2', { metodoPago: 'EFECTIVO' } as any, INTRUSO),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
    });

    it('permite confirmar si la reserva es del usuario', async () => {
      const { service, update } = buildService(reservaPendiente());
      await service.confirmarReserva('r2', { metodoPago: 'EFECTIVO' } as any, OWNER);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r2' },
          data: expect.objectContaining({ estado: 'CONFIRMADA' }),
        }),
      );
    });
  });
});
