import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { MensajeDto, SolicitudJugarDto } from './dto';

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  // ============ SEGUIMIENTOS ============

  async seguir(seguidorId: string, seguidoId: string) {
    if (seguidorId === seguidoId) {
      throw new BadRequestException('No puedes seguirte a ti mismo');
    }

    // Verificar que el usuario a seguir existe
    const usuarioASeguir = await this.prisma.user.findUnique({
      where: { id: seguidoId },
    });

    if (!usuarioASeguir) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar que no lo sigue ya
    const yaLoSigue = await this.prisma.seguimiento.findUnique({
      where: {
        seguidorId_seguidoId: {
          seguidorId,
          seguidoId,
        },
      },
    });

    if (yaLoSigue) {
      throw new BadRequestException('Ya sigues a este usuario');
    }

    const seguimiento = await this.prisma.seguimiento.create({
      data: {
        seguidorId,
        seguidoId,
      },
    });

    // Notificar al usuario seguido
    try {
      const seguidor = await this.prisma.user.findUnique({
        where: { id: seguidorId },
        select: { nombre: true, apellido: true },
      });
      if (seguidor) {
        await this.notificacionesService.notificar({
          userId: seguidoId,
          tipo: 'SOCIAL',
          titulo: 'Nuevo seguidor',
          contenido: `${seguidor.nombre} ${seguidor.apellido} comenzó a seguirte`,
          enlace: `/jugadores/${seguidorId}`,
        });
      }
    } catch (e) {
      this.logger.error(`Error notificando follow: ${e.message}`);
    }

    return { message: 'Ahora sigues a este usuario', seguimiento };
  }

  async dejarDeSeguir(seguidorId: string, seguidoId: string) {
    const seguimiento = await this.prisma.seguimiento.findUnique({
      where: {
        seguidorId_seguidoId: {
          seguidorId,
          seguidoId,
        },
      },
    });

    if (!seguimiento) {
      throw new NotFoundException('No sigues a este usuario');
    }

    await this.prisma.seguimiento.delete({
      where: {
        id: seguimiento.id,
      },
    });

    return { message: 'Dejaste de seguir a este usuario' };
  }

  async obtenerSeguidores(userId: string) {
    const seguidores = await this.prisma.seguimiento.findMany({
      where: { seguidoId: userId },
      include: {
        seguidor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            ciudad: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return seguidores.map((s) => s.seguidor);
  }

  async obtenerSiguiendo(userId: string) {
    const siguiendo = await this.prisma.seguimiento.findMany({
      where: { seguidorId: userId },
      include: {
        seguido: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            ciudad: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return siguiendo.map((s) => s.seguido);
  }

  async obtenerSugerencias(userId: string) {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Sugerencias basadas en ciudad y género
    const sugerencias = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        ciudad: usuario.ciudad,
        genero: usuario.genero,
        estado: 'ACTIVO',
      },
      take: 10,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        documento: true,
        genero: true,
        ciudad: true,
        fotoUrl: true,
      },
    });

    return sugerencias;
  }

  // ============ MENSAJERÍA ============

  async enviarMensaje(remitenteId: string, dto: MensajeDto) {
    const { destinatarioId, contenido } = dto;

    // Verificar que el remitente es Premium
    const remitente = await this.prisma.user.findUnique({
      where: { id: remitenteId },
    });

    if (!remitente.esPremium) {
      throw new ForbiddenException('Debes ser Premium para enviar mensajes');
    }

    // Verificar que el destinatario existe
    const destinatario = await this.prisma.user.findUnique({
      where: { id: destinatarioId },
    });

    if (!destinatario) {
      throw new NotFoundException('Destinatario no encontrado');
    }

    // Crear mensaje
    const mensaje = await this.prisma.mensajePrivado.create({
      data: {
        remitenteId,
        destinatarioId,
        contenido,
      },
      include: {
        remitente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
        destinatario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
    });

    // TODO: Enviar notificación al destinatario

    return mensaje;
  }

  async obtenerConversaciones(userId: string) {
    // Obtener todos los mensajes donde el usuario es remitente o destinatario
    const mensajes = await this.prisma.mensajePrivado.findMany({
      where: {
        OR: [
          { remitenteId: userId },
          { destinatarioId: userId },
        ],
      },
      include: {
        remitente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
        destinatario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Agrupar por conversación (con el otro usuario)
    const conversacionesMap = new Map();

    for (const mensaje of mensajes) {
      const otroUsuarioId = mensaje.remitenteId === userId
        ? mensaje.destinatarioId
        : mensaje.remitenteId;

      if (!conversacionesMap.has(otroUsuarioId)) {
        const otroUsuario = mensaje.remitenteId === userId
          ? mensaje.destinatario
          : mensaje.remitente;

        conversacionesMap.set(otroUsuarioId, {
          usuario: otroUsuario,
          ultimoMensaje: mensaje,
        });
      }
    }

    return Array.from(conversacionesMap.values());
  }

  async obtenerMensajes(userId: string, otroUserId: string) {
    const mensajes = await this.prisma.mensajePrivado.findMany({
      where: {
        OR: [
          { remitenteId: userId, destinatarioId: otroUserId },
          { remitenteId: otroUserId, destinatarioId: userId },
        ],
      },
      include: {
        remitente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
        destinatario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return mensajes;
  }

  async marcarComoLeido(mensajeId: string, userId: string) {
    const mensaje = await this.prisma.mensajePrivado.findUnique({
      where: { id: mensajeId },
    });

    if (!mensaje) {
      throw new NotFoundException('Mensaje no encontrado');
    }

    if (mensaje.destinatarioId !== userId) {
      throw new ForbiddenException('No puedes marcar este mensaje como leído');
    }

    return this.prisma.mensajePrivado.update({
      where: { id: mensajeId },
      data: { leido: true },
    });
  }

  // ============ SOLICITUDES JUGAR ============

  async enviarSolicitudJugar(emisorId: string, dto: SolicitudJugarDto) {
    const { receptorId, fechaPropuesta, hora, lugar, mensaje } = dto;

    // Verificar que el emisor es Premium
    const emisor = await this.prisma.user.findUnique({
      where: { id: emisorId },
    });

    if (!emisor.esPremium) {
      throw new ForbiddenException('Debes ser Premium para enviar solicitudes');
    }

    // Verificar que el receptor existe
    const receptor = await this.prisma.user.findUnique({
      where: { id: receptorId },
    });

    if (!receptor) {
      throw new NotFoundException('Receptor no encontrado');
    }

    const solicitud = await this.prisma.solicitudJugar.create({
      data: {
        emisorId,
        receptorId,
        fechaPropuesta: new Date(fechaPropuesta),
        hora,
        lugar,
        mensaje,
      },
      include: {
        emisor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
        receptor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
    });

    // TODO: Enviar notificación SMS al receptor (si es Premium)

    return solicitud;
  }

  async obtenerSolicitudesRecibidas(userId: string) {
    return this.prisma.solicitudJugar.findMany({
      where: {
        receptorId: userId,
        estado: 'PENDIENTE',
      },
      include: {
        emisor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async obtenerSolicitudesEnviadas(userId: string) {
    return this.prisma.solicitudJugar.findMany({
      where: { emisorId: userId },
      include: {
        receptor: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async aceptarSolicitud(solicitudId: string, userId: string) {
    const solicitud = await this.prisma.solicitudJugar.findUnique({
      where: { id: solicitudId },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (solicitud.receptorId !== userId) {
      throw new ForbiddenException('No puedes aceptar esta solicitud');
    }

    return this.prisma.solicitudJugar.update({
      where: { id: solicitudId },
      data: { estado: 'APROBADA' },
    });
  }

  async rechazarSolicitud(solicitudId: string, userId: string) {
    const solicitud = await this.prisma.solicitudJugar.findUnique({
      where: { id: solicitudId },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    if (solicitud.receptorId !== userId) {
      throw new ForbiddenException('No puedes rechazar esta solicitud');
    }

    return this.prisma.solicitudJugar.update({
      where: { id: solicitudId },
      data: { estado: 'RECHAZADA' },
    });
  }

  // ============ BLOQUEOS ============

  async bloquear(bloqueadorId: string, bloqueadoId: string) {
    if (bloqueadorId === bloqueadoId) {
      throw new BadRequestException('No puedes bloquearte a ti mismo');
    }

    const yaBloquedo = await this.prisma.bloqueo.findUnique({
      where: {
        bloqueadorId_bloqueadoId: {
          bloqueadorId,
          bloqueadoId,
        },
      },
    });

    if (yaBloquedo) {
      throw new BadRequestException('Ya has bloqueado a este usuario');
    }

    return this.prisma.bloqueo.create({
      data: {
        bloqueadorId,
        bloqueadoId,
      },
    });
  }

  async desbloquear(bloqueadorId: string, bloqueadoId: string) {
    const bloqueo = await this.prisma.bloqueo.findUnique({
      where: {
        bloqueadorId_bloqueadoId: {
          bloqueadorId,
          bloqueadoId,
        },
      },
    });

    if (!bloqueo) {
      throw new NotFoundException('No has bloqueado a este usuario');
    }

    await this.prisma.bloqueo.delete({
      where: { id: bloqueo.id },
    });

    return { message: 'Usuario desbloqueado' };
  }

  async obtenerBloqueados(userId: string) {
    const bloqueos = await this.prisma.bloqueo.findMany({
      where: { bloqueadorId: userId },
      include: {
        bloqueado: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
      },
    });

    return bloqueos.map((b) => b.bloqueado);
  }

  // ============ REPORTES ============

  async reportar(
    reportadorId: string,
    reportadoId: string,
    data: { motivo: string; descripcion?: string },
  ) {
    const reporte = await this.prisma.reporte.create({
      data: {
        reportadorId,
        reportadoId,
        motivo: data.motivo,
        descripcion: data.descripcion,
      },
    });

    // TODO: Notificar a admin

    return { message: 'Reporte enviado', reporte };
  }

  // ============ BÚSQUEDA ============

  async buscarJugadores(
    query?: string,
    ciudad?: string,
    genero?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const where: any = {
      estado: 'ACTIVO',
    };

    if (query && query.trim()) {
      where.OR = [
        { nombre: { contains: query, mode: 'insensitive' } },
        { apellido: { contains: query, mode: 'insensitive' } },
        { documento: { contains: query } },
      ];
    }

    if (ciudad) {
      where.ciudad = { equals: ciudad, mode: 'insensitive' };
    }

    if (genero) {
      where.genero = genero;
    }

    const skip = (page - 1) * limit;
    const take = Math.min(limit, 50);

    const [jugadores, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          genero: true,
          ciudad: true,
          fotoUrl: true,
          esPremium: true,
          categoriaActual: {
            select: { id: true, nombre: true, orden: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      jugadores,
      total,
      page,
      totalPages: Math.ceil(total / take),
    };
  }

  async obtenerCiudadesActivas(): Promise<string[]> {
    const result = await this.prisma.user.groupBy({
      by: ['ciudad'],
      where: {
        estado: 'ACTIVO',
        ciudad: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    return result
      .filter((r) => r.ciudad)
      .map((r) => r.ciudad as string);
  }
}