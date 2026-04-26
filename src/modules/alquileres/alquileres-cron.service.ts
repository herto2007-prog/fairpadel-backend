import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificacionesWhatsAppService } from '../notificaciones/notificaciones-whatsapp.service';

/**
 * Servicio para enviar recordatorios de reservas por WhatsApp
 * Se ejecuta cada hora para detectar reservas próximas (24h y 4h antes)
 */
@Injectable()
export class AlquileresCronService {
  private readonly logger = new Logger(AlquileresCronService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesWhatsApp: NotificacionesWhatsAppService,
  ) {}

  /**
   * Ejecuta cada hora para enviar recordatorios de reservas
   */
  @Cron(CronExpression.EVERY_HOUR)
  async enviarRecordatoriosReservas() {
    this.logger.log('Iniciando envío de recordatorios de reservas...');

    try {
      await this.enviarRecordatorios24h();
      await this.enviarRecordatorios4h();
      this.logger.log('Envío de recordatorios completado');
    } catch (error) {
      this.logger.error('Error enviando recordatorios:', error);
    }
  }

  /**
   * Busca reservas confirmadas que ocurran entre 23h y 24h desde ahora
   * y envía recordatorio 24h
   */
  private async enviarRecordatorios24h() {
    const ahora = new Date();
    const en23h = new Date(ahora.getTime() + 23 * 60 * 60 * 1000);
    const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    // Formatear fechas para buscar en Prisma (YYYY-MM-DD)
    const fechaInicio = en23h.toISOString().split('T')[0];
    const fechaFin = en24h.toISOString().split('T')[0];

    const reservas = await this.prisma.reservaCancha.findMany({
      where: {
        estado: 'CONFIRMADA',
        fecha: {
          gte: fechaInicio,
          lte: fechaFin,
        },
        userId: { not: null }, // Solo reservas con usuario registrado
      },
      include: {
        user: {
          select: {
            id: true,
            telefono: true,
            consentWhatsappStatus: true,
          },
        },
      },
    });

    let enviados = 0;
    for (const reserva of reservas) {
      try {
        // Construir datetime de la reserva en hora de Paraguay (UTC-3)
        const reservaDate = new Date(`${reserva.fecha}T${reserva.horaInicio}-03:00`);

        // Verificar que cae en la ventana de 23h-24h
        if (reservaDate >= en23h && reservaDate <= en24h) {
          await this.notificacionesWhatsApp.notificarRecordatorio24h(reserva.id);
          enviados++;
        }
      } catch (error) {
        this.logger.error(`Error enviando recordatorio 24h para reserva ${reserva.id}:`, error);
      }
    }

    this.logger.log(`Recordatorios 24h: ${enviados}/${reservas.length} enviados`);
  }

  /**
   * Busca reservas confirmadas que ocurran entre 3h y 4h desde ahora
   * y envía recordatorio 4h
   */
  private async enviarRecordatorios4h() {
    const ahora = new Date();
    const en3h = new Date(ahora.getTime() + 3 * 60 * 60 * 1000);
    const en4h = new Date(ahora.getTime() + 4 * 60 * 60 * 1000);

    const fechaInicio = en3h.toISOString().split('T')[0];
    const fechaFin = en4h.toISOString().split('T')[0];

    const reservas = await this.prisma.reservaCancha.findMany({
      where: {
        estado: 'CONFIRMADA',
        fecha: {
          gte: fechaInicio,
          lte: fechaFin,
        },
        userId: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            telefono: true,
            consentWhatsappStatus: true,
          },
        },
      },
    });

    let enviados = 0;
    for (const reserva of reservas) {
      try {
        const reservaDate = new Date(`${reserva.fecha}T${reserva.horaInicio}-03:00`);

        if (reservaDate >= en3h && reservaDate <= en4h) {
          await this.notificacionesWhatsApp.notificarRecordatorio4h(reserva.id);
          enviados++;
        }
      } catch (error) {
        this.logger.error(`Error enviando recordatorio 4h para reserva ${reserva.id}:`, error);
      }
    }

    this.logger.log(`Recordatorios 4h: ${enviados}/${reservas.length} enviados`);
  }
}
