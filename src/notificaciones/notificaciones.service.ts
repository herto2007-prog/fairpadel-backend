import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { TipoNotificacion } from '@prisma/client';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // CORE DISPATCHER
  // ═══════════════════════════════════════════════════════

  /**
   * Dispatcher central de notificaciones.
   * 1. Siempre crea notificacion in-app (campanita)
   * 2. Verifica preferencias del usuario para email/SMS
   * 3. SMS solo si esPremium + preferencia habilitada
   */
  async notificar(params: {
    userId: string;
    tipo: TipoNotificacion;
    titulo: string;
    contenido: string;
    enlace?: string;
    emailTemplate?: () => Promise<{ success: boolean }>;
    smsTexto?: string;
  }) {
    const { userId, tipo, titulo, contenido, enlace, emailTemplate, smsTexto } =
      params;

    // 1. Siempre crear notificacion in-app
    const notificacion = await this.prisma.notificacion.create({
      data: { userId, tipo, titulo, contenido, enlace },
    });

    // 2. Cargar usuario + preferencia
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!usuario) return notificacion;

    const preferencia =
      await this.prisma.preferenciaNotificacion.findUnique({
        where: {
          userId_tipoNotificacion: { userId, tipoNotificacion: tipo },
        },
      });

    const emailEnabled = preferencia?.recibirEmail ?? true;
    const smsEnabled = preferencia?.recibirSms ?? true;

    // 3. Enviar email
    let emailEnviado = false;
    if (emailEnabled) {
      try {
        if (emailTemplate) {
          const result = await emailTemplate();
          emailEnviado = result.success;
        } else {
          const result = await this.emailService.enviarNotificacion(
            usuario.email,
            usuario.nombre,
            contenido,
          );
          emailEnviado = result.success;
        }
      } catch (e) {
        this.logger.error(`Email fallo para ${userId}: ${e.message}`);
      }
    }

    // 4. Enviar SMS (SOLO premium + habilitado + texto proporcionado)
    let smsEnviado = false;
    if (usuario.esPremium && smsEnabled && smsTexto && usuario.telefono) {
      try {
        const result = await this.smsService.enviarNotificacion(
          usuario.telefono,
          smsTexto,
        );
        smsEnviado = result.success;
      } catch (e) {
        this.logger.error(`SMS fallo para ${userId}: ${e.message}`);
      }
    }

    // 5. Actualizar estado de envio
    if (emailEnviado || smsEnviado) {
      await this.prisma.notificacion.update({
        where: { id: notificacion.id },
        data: { emailEnviado, smsEnviado },
      });
    }

    return notificacion;
  }

  /**
   * Backward-compatible wrapper.
   */
  async crearNotificacion(
    userId: string,
    tipo: string,
    contenido: string,
    enviarEmail = false,
    enviarSms = false,
  ) {
    return this.notificar({
      userId,
      tipo: tipo as TipoNotificacion,
      titulo: contenido.substring(0, 100),
      contenido,
      smsTexto: enviarSms ? contenido.substring(0, 149) : undefined,
    });
  }

  // ═══════════════════════════════════════════════════════
  // HELPERS ESPECIALIZADOS
  // ═══════════════════════════════════════════════════════

  async notificarInscripcionConfirmada(
    userId: string,
    torneoNombre: string,
    categoriaNombre: string,
    companeroNombre: string,
    fechas: string,
  ) {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!usuario) return;

    return this.notificar({
      userId,
      tipo: 'INSCRIPCION',
      titulo: 'Inscripcion confirmada',
      contenido: `Tu inscripcion al torneo "${torneoNombre}" (${categoriaNombre}) fue confirmada. Companero/a: ${companeroNombre}`,
      enlace: '/inscripciones',
      emailTemplate: () =>
        this.emailService.enviarInscripcionConfirmada(
          usuario.email,
          usuario.nombre,
          { torneoNombre, categoria: categoriaNombre, companero: companeroNombre, fechas },
        ),
    });
  }

  async notificarFixturePublicado(
    userId: string,
    data: {
      torneoNombre: string;
      tournamentId: string;
      oponentes: string;
      fecha: string;
      hora: string;
      cancha: string;
      sede: string;
    },
  ) {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!usuario) return;

    const fixtureUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tournaments/${data.tournamentId}/fixture`;

    return this.notificar({
      userId,
      tipo: 'PARTIDO',
      titulo: 'Fixture publicado',
      contenido: `Fixture listo! vs ${data.oponentes} - ${data.fecha} ${data.hora} en ${data.cancha} (${data.sede})`,
      enlace: `/tournaments/${data.tournamentId}/fixture`,
      emailTemplate: () =>
        this.emailService.enviarFixturePublicado(usuario.email, usuario.nombre, { ...data, fixtureUrl }),
      smsTexto: `Fixture listo! vs ${data.oponentes} - ${data.fecha} ${data.hora}, ${data.cancha} (${data.sede})`,
    });
  }

  async notificarSiguientePartidoListo(
    userId: string,
    data: {
      torneoNombre: string;
      tournamentId: string;
      ronda: string;
      oponentes: string;
      fecha: string;
      hora: string;
      cancha: string;
      sede: string;
    },
  ) {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!usuario) return;

    const fixtureUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tournaments/${data.tournamentId}/fixture`;

    return this.notificar({
      userId,
      tipo: 'PARTIDO',
      titulo: `Proximo partido: ${data.ronda}`,
      contenido: `${data.ronda}: vs ${data.oponentes} - ${data.fecha} ${data.hora} en ${data.cancha} (${data.sede})`,
      enlace: `/tournaments/${data.tournamentId}/fixture`,
      emailTemplate: () =>
        this.emailService.enviarSiguientePartido(usuario.email, usuario.nombre, { ...data, fixtureUrl }),
      smsTexto: `${data.ronda}: vs ${data.oponentes} - ${data.fecha} ${data.hora}, ${data.cancha} (${data.sede})`,
    });
  }

  async notificarResultadoGanador(
    userId: string,
    data: {
      torneoNombre: string;
      tournamentId: string;
      ronda: string;
      resultado: string;
      siguienteRonda?: string;
    },
  ) {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!usuario) return;

    const msg = data.siguienteRonda
      ? `Ganaste en ${data.torneoNombre}! Avanzas a ${data.siguienteRonda}`
      : `Ganaste en ${data.torneoNombre}! (${data.ronda})`;

    return this.notificar({
      userId,
      tipo: 'PARTIDO',
      titulo: 'Victoria!',
      contenido: `${msg}. Resultado: ${data.resultado}`,
      enlace: `/tournaments/${data.tournamentId}/fixture`,
      emailTemplate: () =>
        this.emailService.enviarResultadoPartido(usuario.email, usuario.nombre, data),
      smsTexto: msg,
    });
  }

  async notificarAscensoCategoria(
    userId: string,
    categoriaAnterior: string,
    categoriaNueva: string,
  ) {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!usuario) return;

    return this.notificar({
      userId,
      tipo: 'RANKING',
      titulo: 'Ascenso de categoria!',
      contenido: `Felicidades! Has ascendido de ${categoriaAnterior} a ${categoriaNueva}`,
      enlace: '/profile',
      emailTemplate: () =>
        this.emailService.enviarAscensoCategoria(usuario.email, usuario.nombre, { categoriaAnterior, categoriaNueva }),
      smsTexto: `Felicidades! Ascendiste de ${categoriaAnterior} a ${categoriaNueva}`,
    });
  }

  async notificarInscripcionRegistrada(
    userId: string,
    data: {
      torneoNombre: string;
      categoria: string;
      companero: string;
      monto: string;
      metodoPago: string;
      estado: string;
    },
  ) {
    const usuario = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!usuario) return;

    return this.notificar({
      userId,
      tipo: 'INSCRIPCION',
      titulo: 'Inscripcion registrada',
      contenido: `Tu inscripcion al torneo "${data.torneoNombre}" (${data.categoria}) fue registrada. Companero/a: ${data.companero}`,
      enlace: '/inscripciones',
      emailTemplate: () =>
        this.emailService.enviarInscripcionRegistrada(usuario.email, usuario.nombre, data),
    });
  }

  async notificarPagoConfirmado(
    userId: string,
    data: {
      torneoNombre: string;
      categoria: string;
      monto: string;
      tournamentId: string;
    },
  ) {
    const usuario = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!usuario) return;

    return this.notificar({
      userId,
      tipo: 'PAGO',
      titulo: 'Pago confirmado',
      contenido: `Tu pago de ${data.monto} para "${data.torneoNombre}" (${data.categoria}) fue confirmado`,
      enlace: `/tournaments/${data.tournamentId}`,
      emailTemplate: () =>
        this.emailService.enviarPagoConfirmado(usuario.email, usuario.nombre, data),
    });
  }

  async notificarInscripcionRechazada(
    userId: string,
    data: {
      torneoNombre: string;
      categoria: string;
      motivo: string;
    },
  ) {
    const usuario = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!usuario) return;

    return this.notificar({
      userId,
      tipo: 'INSCRIPCION',
      titulo: 'Inscripcion rechazada',
      contenido: `Tu inscripcion al torneo "${data.torneoNombre}" (${data.categoria}) fue rechazada. Motivo: ${data.motivo}`,
      enlace: '/inscripciones',
      emailTemplate: () =>
        this.emailService.enviarInscripcionRechazada(usuario.email, usuario.nombre, data),
    });
  }

  async notificarTorneoCancelado(
    userId: string,
    data: {
      torneoNombre: string;
      motivo?: string;
    },
  ) {
    const usuario = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!usuario) return;

    return this.notificar({
      userId,
      tipo: 'TORNEO',
      titulo: 'Torneo cancelado',
      contenido: `El torneo "${data.torneoNombre}" ha sido cancelado${data.motivo ? `. Motivo: ${data.motivo}` : ''}`,
      enlace: '/tournaments',
      emailTemplate: () =>
        this.emailService.enviarTorneoCancelado(usuario.email, usuario.nombre, data),
    });
  }

  // ═══════════════════════════════════════════════════════
  // CRUD NOTIFICACIONES
  // ═══════════════════════════════════════════════════════

  async obtenerNotificaciones(userId: string, leida?: boolean) {
    const where: any = { userId };
    if (leida !== undefined) where.leida = leida;
    return this.prisma.notificacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async contarNoLeidas(userId: string) {
    const count = await this.prisma.notificacion.count({
      where: { userId, leida: false },
    });
    return { count };
  }

  async marcarComoLeida(id: string, userId: string) {
    const notificacion = await this.prisma.notificacion.findUnique({ where: { id } });
    if (!notificacion) throw new NotFoundException('Notificacion no encontrada');
    if (notificacion.userId !== userId) throw new ForbiddenException('No tienes permiso');
    return this.prisma.notificacion.update({ where: { id }, data: { leida: true } });
  }

  async marcarTodasComoLeidas(userId: string) {
    await this.prisma.notificacion.updateMany({
      where: { userId, leida: false },
      data: { leida: true },
    });
    return { message: 'Todas las notificaciones marcadas como leidas' };
  }

  // ═══════════════════════════════════════════════════════
  // PREFERENCIAS
  // ═══════════════════════════════════════════════════════

  async obtenerPreferencias(userId: string) {
    const existing = await this.prisma.preferenciaNotificacion.findMany({
      where: { userId },
    });

    const allTypes: TipoNotificacion[] = [
      'SISTEMA', 'TORNEO', 'INSCRIPCION', 'PARTIDO',
      'RANKING', 'SOCIAL', 'PAGO', 'MENSAJE',
    ];

    return allTypes.map((tipo) => {
      const pref = existing.find((p) => p.tipoNotificacion === tipo);
      return {
        tipoNotificacion: tipo,
        recibirEmail: pref?.recibirEmail ?? true,
        recibirSms: pref?.recibirSms ?? true,
      };
    });
  }

  async actualizarPreferencia(
    userId: string,
    dto: { tipoNotificacion: string; recibirEmail?: boolean; recibirSms?: boolean },
  ) {
    return this.prisma.preferenciaNotificacion.upsert({
      where: {
        userId_tipoNotificacion: {
          userId,
          tipoNotificacion: dto.tipoNotificacion as TipoNotificacion,
        },
      },
      update: {
        ...(dto.recibirEmail !== undefined ? { recibirEmail: dto.recibirEmail } : {}),
        ...(dto.recibirSms !== undefined ? { recibirSms: dto.recibirSms } : {}),
      },
      create: {
        userId,
        tipoNotificacion: dto.tipoNotificacion as TipoNotificacion,
        recibirEmail: dto.recibirEmail ?? true,
        recibirSms: dto.recibirSms ?? true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════
  // RESUMEN SEMANAL (CRON — PREMIUM)
  // ═══════════════════════════════════════════════════════

  @Cron('0 7 * * 1') // Every Monday at 7:00 AM
  async enviarResumenesSemanales() {
    this.logger.log('Iniciando envío de resúmenes semanales premium...');

    try {
      const premiumUsers = await this.prisma.user.findMany({
        where: { esPremium: true, estado: 'ACTIVO' },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          ciudad: true,
        },
      });

      this.logger.log(`Usuarios premium activos: ${premiumUsers.length}`);

      let enviados = 0;
      for (const user of premiumUsers) {
        try {
          const datos = await this.calcularDatosSemana(user.id);

          // Only send if there's activity or data worth reporting
          if (datos.partidosJugados > 0 || datos.ranking > 0 || datos.logrosNuevos > 0) {
            await this.emailService.enviarResumenSemanal(
              user.email,
              user.nombre,
              datos,
            );
            enviados++;
          }
        } catch (e) {
          this.logger.error(`Error resumen semanal para ${user.email}: ${e.message}`);
        }
      }

      this.logger.log(`Resúmenes semanales enviados: ${enviados}/${premiumUsers.length}`);
    } catch (e) {
      this.logger.error(`Error en cron resumen semanal: ${e.message}`);
    }
  }

  private async calcularDatosSemana(userId: string) {
    const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Matches de la última semana where user participated
    const matchesSemana = await this.prisma.match.findMany({
      where: {
        estado: 'FINALIZADO',
        createdAt: { gte: haceUnaSemana },
        OR: [
          { pareja1: { OR: [{ jugador1Id: userId }, { jugador2Id: userId }] } },
          { pareja2: { OR: [{ jugador1Id: userId }, { jugador2Id: userId }] } },
        ],
      },
      include: {
        parejaGanadora: { select: { jugador1Id: true, jugador2Id: true } },
      },
    });

    const victorias = matchesSemana.filter(
      (m) =>
        m.parejaGanadora &&
        (m.parejaGanadora.jugador1Id === userId ||
          m.parejaGanadora.jugador2Id === userId),
    ).length;

    // Current ranking
    const ranking = await this.prisma.ranking.findFirst({
      where: { jugadorId: userId, tipoRanking: 'GLOBAL' },
      select: { posicion: true, posicionAnterior: true, rachaActual: true },
    });

    // Logros desbloqueados esta semana
    const logrosNuevos = await this.prisma.usuarioLogro.count({
      where: {
        userId,
        fechaDesbloqueo: { gte: haceUnaSemana },
      },
    });

    return {
      partidosJugados: matchesSemana.length,
      victorias,
      ranking: ranking?.posicion || 0,
      posicionAnterior: ranking?.posicionAnterior || 0,
      rachaActual: ranking?.rachaActual || 0,
      logrosNuevos,
    };
  }
}
