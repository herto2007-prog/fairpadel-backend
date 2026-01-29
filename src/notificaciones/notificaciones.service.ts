import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

@Injectable()
export class NotificacionesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  async crearNotificacion(
    userId: string,
    tipo: string,
    contenido: string,
    enviarEmail = false,
    enviarSms = false,
  ) {
    // Crear notificación en bandeja
    const notificacion = await this.prisma.notificacion.create({
      data: {
        userId,
        tipo: tipo as any,
        contenido,
      },
    });

    // Obtener datos del usuario
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Enviar email si corresponde
    if (enviarEmail) {
      await this.emailService.enviarNotificacion(
        usuario.email,
        usuario.nombre,
        contenido,
      );
    }

    // Enviar SMS si corresponde (solo Premium)
    if (enviarSms && usuario.esPremium) {
      await this.smsService.enviarNotificacion(
        usuario.telefono,
        contenido,
      );
    }

    return notificacion;
  }

  async obtenerNotificaciones(userId: string, leida?: boolean) {
    const where: any = { userId };
    
    if (leida !== undefined) {
      where.leida = leida;
    }

    const notificaciones = await this.prisma.notificacion.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return notificaciones;
  }

  async contarNoLeidas(userId: string) {
    const count = await this.prisma.notificacion.count({
      where: {
        userId,
        leida: false,
      },
    });

    return { count };
  }

  async marcarComoLeida(id: string, userId: string) {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { id },
    });

    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada');
    }

    if (notificacion.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para marcar esta notificación');
    }

    return this.prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    });
  }

  async marcarTodasComoLeidas(userId: string) {
    await this.prisma.notificacion.updateMany({
      where: {
        userId,
        leida: false,
      },
      data: {
        leida: true,
      },
    });

    return { message: 'Todas las notificaciones marcadas como leídas' };
  }

  // Métodos helper para crear notificaciones específicas

  async notificarInscripcionConfirmada(userId: string, torneoNombre: string) {
    return this.crearNotificacion(
      userId,
      'INSCRIPCION',
      `Tu inscripción al torneo "${torneoNombre}" ha sido confirmada`,
      true,
      false,
    );
  }

  async notificarPagoConfirmado(userId: string, torneoNombre: string) {
    return this.crearNotificacion(
      userId,
      'PAGO',
      `Tu pago para el torneo "${torneoNombre}" fue confirmado exitosamente`,
      true,
      true,
    );
  }

  async notificarResultadoPartido(userId: string, resultado: string) {
    return this.crearNotificacion(
      userId,
      'PARTIDO',
      resultado,
      true,
      false,
    );
  }

  async notificarCambioRanking(userId: string, posicionNueva: number) {
    return this.crearNotificacion(
      userId,
      'RANKING',
      `Tu ranking ha cambiado. Ahora estás en la posición #${posicionNueva}`,
      true,
      false,
    );
  }

  async notificarNuevoSeguidor(userId: string, seguidorNombre: string) {
    return this.crearNotificacion(
      userId,
      'SOCIAL',
      `${seguidorNombre} comenzó a seguirte`,
      false,
      false,
    );
  }

  async notificarNuevoMensaje(userId: string, remitenteNombre: string) {
    return this.crearNotificacion(
      userId,
      'MENSAJE',
      `Nuevo mensaje de ${remitenteNombre}`,
      true,
      false,
    );
  }

  async recordatorioPartido(userId: string, detalles: string) {
    return this.crearNotificacion(
      userId,
      'PARTIDO',
      `Recordatorio: ${detalles}`,
      true,
      true, // SMS para recordatorios de partido
    );
  }
}