import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
}
