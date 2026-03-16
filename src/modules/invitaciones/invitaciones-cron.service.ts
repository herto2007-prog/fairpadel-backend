import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { InscripcionEstado } from '@prisma/client';

/**
 * Servicio para procesar invitaciones expiradas automáticamente
 * Se ejecuta cada hora para anular inscripciones cuyas invitaciones vencieron
 */
@Injectable()
export class InvitacionesCronService {
  private readonly logger = new Logger(InvitacionesCronService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Ejecuta cada hora para procesar invitaciones expiradas
   */
  @Cron(CronExpression.EVERY_HOUR)
  async procesarInvitacionesExpiradas() {
    this.logger.log('Iniciando procesamiento de invitaciones expiradas...');

    const ahora = new Date();

    try {
      // 1. Buscar invitaciones pendientes que ya expiraron
      const invitacionesExpiradas = await this.prisma.invitacionJugador.findMany({
        where: {
          estado: 'PENDIENTE',
          expiraAt: {
            lt: ahora, // Menor que ahora = ya expiró
          },
        },
        include: {
          inscripcion: {
            include: {
              tournament: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
              jugador1: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Encontradas ${invitacionesExpiradas.length} invitaciones expiradas`);

      // 2. Procesar cada invitación expirada
      for (const invitacion of invitacionesExpiradas) {
        await this.procesarInvitacionExpirada(invitacion);
      }

      this.logger.log('Procesamiento de invitaciones expiradas completado');
    } catch (error) {
      this.logger.error('Error procesando invitaciones expiradas:', error);
    }
  }

  /**
   * Procesa una invitación expirada individual
   */
  private async procesarInvitacionExpirada(invitacion: any) {
    try {
      // Iniciar transacción
      await this.prisma.$transaction(async (tx) => {
        // 1. Marcar invitación como EXPIRADA
        await tx.invitacionJugador.update({
          where: { id: invitacion.id },
          data: { estado: 'EXPIRADA' },
        });

        // 2. Anular la inscripción
        await tx.inscripcion.update({
          where: { id: invitacion.inscripcionId },
          data: {
            estado: InscripcionEstado.CANCELADA,
            notas: JSON.stringify({
              motivoCancelacion: 'Invitación a jugador2 expirada (48h)',
              fechaCancelacion: new Date(),
              invitacionId: invitacion.id,
            }),
          },
        });

        // 3. Liberar slot si estaba reservado
        // (Opcional, depende de la lógica de negocio)
      });

      // 4. Notificar a jugador1 que la invitación expiró
      await this.notificarExpiracion(invitacion);

      this.logger.log(`Invitación ${invitacion.id} procesada - Inscripción anulada`);
    } catch (error) {
      this.logger.error(`Error procesando invitación ${invitacion.id}:`, error);
    }
  }

  /**
   * Notifica al jugador1 que la invitación a su pareja expiró
   */
  private async notificarExpiracion(invitacion: any) {
    try {
      await this.prisma.notificacion.create({
        data: {
          userId: invitacion.inscripcion.jugador1.id,
          tipo: 'INSCRIPCION',
          titulo: 'Invitación expirada',
          contenido: `La invitación a tu pareja para "${invitacion.inscripcion.tournament.nombre}" expiró después de 48 horas. La inscripción ha sido cancelada. Puedes inscribirte nuevamente con otra pareja.`,
          enlace: `/torneos/${invitacion.inscripcion.tournament.id}`,
        },
      });

      // También enviar email
      // await this.emailService.send... (si tienes servicio de email)
    } catch (error) {
      this.logger.error('Error enviando notificación de expiración:', error);
    }
  }
}
