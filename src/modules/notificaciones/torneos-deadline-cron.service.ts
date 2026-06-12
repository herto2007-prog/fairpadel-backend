import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { EmailService } from '../../email/email.service';

/**
 * Avisa al organizador cuando se acerca el cierre de inscripciones de su
 * torneo (fechaLimiteInscr): un aviso cuando cierra MAÑANA y otro cuando
 * cierra HOY. Corre cada hora; el anti-duplicado usa el enlace de la
 * notificación in-app como clave (torneo + ventana), así que cada aviso
 * se envía una sola vez aunque el cron corra 24 veces ese día.
 */
@Injectable()
export class TorneosDeadlineCronService {
  private readonly logger = new Logger(TorneosDeadlineCronService.name);

  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async avisarDeadlinesInscripcion() {
    try {
      const resumen = await this.procesarDeadlines();
      if (resumen.enviadas > 0) {
        this.logger.log(
          `Deadlines de inscripción: ${resumen.enviadas} aviso(s) enviado(s), ${resumen.omitidas} ya avisado(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Error procesando deadlines de inscripción:', error);
    }
  }

  /**
   * Separado del @Cron para poder testearlo y dispararlo a mano.
   */
  async procesarDeadlines(): Promise<{ enviadas: number; omitidas: number }> {
    const ahora = this.dateService.now();
    const hoy = this.dateService.getDateOnly(ahora);
    const manana = this.dateService.getDateOnly(this.dateService.addDays(ahora, 1));

    const torneos = await this.prisma.tournament.findMany({
      where: {
        estado: 'PUBLICADO',
        fechaLimiteInscr: { in: [hoy, manana] },
      },
      include: {
        organizador: { select: { id: true, email: true, nombre: true } },
      },
    });

    let enviadas = 0;
    let omitidas = 0;

    for (const torneo of torneos) {
      const cuando = torneo.fechaLimiteInscr === hoy ? 'hoy' : 'mañana';
      // Clave de deduplicación: una notificación por torneo y ventana.
      const enlace = `/mis-torneos/${torneo.id}/gestionar?deadline=${cuando === 'hoy' ? 'HOY' : 'MANANA'}`;

      const yaAvisado = await this.prisma.notificacion.findFirst({
        where: { userId: torneo.organizadorId, enlace },
        select: { id: true },
      });
      if (yaAvisado) {
        omitidas++;
        continue;
      }

      // Conteos para que el aviso sea accionable
      const [confirmadas, pendientes, categoriasAbiertas] = await Promise.all([
        this.prisma.inscripcion.count({
          where: { tournamentId: torneo.id, estado: 'CONFIRMADA' },
        }),
        this.prisma.inscripcion.count({
          where: {
            tournamentId: torneo.id,
            estado: { in: ['PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO_PRESENCIAL'] },
          },
        }),
        this.prisma.tournamentCategory.count({
          where: { tournamentId: torneo.id, estado: 'INSCRIPCIONES_ABIERTAS' },
        }),
      ]);

      const titulo = `Las inscripciones de "${torneo.nombre}" cierran ${cuando}`;
      const contenido =
        `El ${torneo.fechaLimiteInscr} es la fecha límite de inscripción. ` +
        `Tenés ${confirmadas} inscripción(es) confirmada(s), ${pendientes} pendiente(s) ` +
        `y ${categoriasAbiertas} categoría(s) abierta(s). ` +
        `Revisá pendientes y prepará el cierre de categorías.`;

      await this.prisma.notificacion.create({
        data: {
          userId: torneo.organizadorId,
          tipo: 'TORNEO',
          titulo,
          contenido,
          enlace,
        },
      });

      // Email best-effort: si falla, el aviso in-app ya quedó creado.
      if (torneo.organizador?.email) {
        try {
          await this.emailService.sendDeadlineInscripciones(
            torneo.organizador.email,
            torneo.organizador.nombre || 'Organizador',
            torneo.nombre,
            cuando,
            torneo.fechaLimiteInscr,
            confirmadas,
            pendientes,
            categoriasAbiertas,
          );
        } catch (error) {
          this.logger.error(`Email de deadline falló para torneo ${torneo.id}:`, error);
        }
      }

      enviadas++;
    }

    return { enviadas, omitidas };
  }
}
