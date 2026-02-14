import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { ParejasService } from '../parejas/parejas.service';

@Injectable()
export class InscripcionesService {
  constructor(
    private prisma: PrismaService,
    private parejasService: ParejasService,
  ) {}

  async create(createInscripcionDto: CreateInscripcionDto, userId: string) {
    const {
      tournamentId,
      categoryId,
      modalidad,
      jugador2Documento,
      metodoPago,
    } = createInscripcionDto;

    // Verificar que el torneo existe y acepta inscripciones
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: true,
        modalidades: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (!['PUBLICADO', 'EN_CURSO'].includes(tournament.estado)) {
      throw new BadRequestException('El torneo no acepta inscripciones');
    }

    // fechaLimiteInscr es informativa (para notificaciones), no bloquea inscripciones.
    // El control real lo hace inscripcionAbierta por categoría.

    // Verificar que la categoría existe en el torneo y tiene inscripciones abiertas
    const categoriaRelacion = tournament.categorias.find(
      (c) => c.categoryId === categoryId,
    );
    if (!categoriaRelacion) {
      throw new BadRequestException('Categoría no disponible en este torneo');
    }
    if (!categoriaRelacion.inscripcionAbierta) {
      throw new BadRequestException(
        'Las inscripciones están cerradas para esta categoría',
      );
    }

    // Verificar que la modalidad existe en el torneo
    const modalidadExiste = tournament.modalidades.some(
      (m) => m.modalidad === modalidad,
    );
    if (!modalidadExiste) {
      throw new BadRequestException('Modalidad no disponible en este torneo');
    }

    // Obtener información del usuario actual (jugador 1)
    const jugador1 = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Buscar o crear pareja
    const pareja = await this.parejasService.create(
      { jugador2Documento },
      userId,
    );

    // Validar compatibilidad de género según modalidad
    const jugador2 = await this.prisma.user.findUnique({
      where: { documento: jugador2Documento },
    });

    if (jugador2) {
      if (modalidad === 'TRADICIONAL') {
        if (jugador1.genero !== jugador2.genero) {
          throw new BadRequestException(
            'En modalidad Tradicional, ambos jugadores deben ser del mismo género',
          );
        }
      }

      if (modalidad === 'MIXTO') {
        if (jugador1.genero === jugador2.genero) {
          throw new BadRequestException(
            'En modalidad Mixto, los jugadores deben ser de géneros diferentes',
          );
        }
      }

      // Modalidad SUMA no tiene restricción de género
    }

    // Verificar que la pareja no esté ya inscrita
    const inscripcionExistente = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId,
        parejaId: pareja.id,
      },
    });

    if (inscripcionExistente) {
      throw new BadRequestException('Esta pareja ya está inscrita en el torneo');
    }

    // Crear inscripción
    const inscripcion = await this.prisma.inscripcion.create({
      data: {
        tournamentId,
        parejaId: pareja.id,
        categoryId,
        modalidad,
        estado:
          tournament.costoInscripcion.toNumber() === 0
            ? 'CONFIRMADA'
            : metodoPago === 'EFECTIVO'
            ? 'PENDIENTE_PAGO_PRESENCIAL'
            : 'PENDIENTE_PAGO',
      },
      include: {
        pareja: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        tournament: true,
        category: true,
      },
    });

    // Si el torneo es gratuito, marcar como confirmada
    if (tournament.costoInscripcion.toNumber() === 0) {
      return inscripcion;
    }

    // Obtener porcentaje de comisión desde configuración del sistema
    const configComision = await this.prisma.configuracionSistema.findUnique({
      where: { clave: 'COMISION_INSCRIPCION' },
    });
    const porcentajeComision = configComision
      ? parseFloat(configComision.valor) / 100
      : 0.05; // Fallback 5% si no existe config

    // Crear registro de pago pendiente
    const monto = tournament.costoInscripcion.toNumber();
    const comision = monto * porcentajeComision;

    await this.prisma.pago.create({
      data: {
        inscripcionId: inscripcion.id,
        metodoPago: metodoPago as any,
        monto,
        comision,
        estado: 'PENDIENTE',
      },
    });

    return inscripcion;
  }

  async findOne(id: string) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      include: {
        pareja: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        tournament: true,
        category: true,
        pago: true,
        comprobantes: true,
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    return inscripcion;
  }

  async findByUser(userId: string) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        pareja: {
          OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        },
      },
      include: {
        pareja: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        tournament: true,
        category: true,
        pago: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return inscripciones;
  }

  async findByTournament(tournamentId: string, estado?: string) {
    const where: any = { tournamentId };
    if (estado) {
      where.estado = estado;
    }

    const inscripciones = await this.prisma.inscripcion.findMany({
      where,
      include: {
        pareja: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        category: true,
        pago: true,
        comprobantes: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return inscripciones;
  }

  async cancelar(id: string, userId: string) {
    const inscripcion = await this.findOne(id);

    // Verificar que el usuario es parte de la pareja
    if (
      inscripcion.pareja.jugador1Id !== userId &&
      inscripcion.pareja.jugador2Id !== userId
    ) {
      throw new ForbiddenException('No tienes permiso para cancelar esta inscripción');
    }

    // Solo se puede cancelar si está pendiente
    if (!['PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO_PRESENCIAL'].includes(inscripcion.estado)) {
      throw new BadRequestException('No se puede cancelar esta inscripción');
    }

    return this.prisma.inscripcion.update({
      where: { id },
      data: { estado: 'CANCELADA' },
    });
  }

  async subirComprobante(inscripcionId: string, comprobanteUrl: string) {
    const inscripcion = await this.findOne(inscripcionId);

    if (inscripcion.estado !== 'PENDIENTE_PAGO') {
      throw new BadRequestException('Esta inscripción no requiere comprobante');
    }

    // Crear comprobante
    await this.prisma.comprobantePago.create({
      data: {
        inscripcionId,
        url: comprobanteUrl,
        estado: 'PENDIENTE',
      },
    });

    // Actualizar estado de inscripción
    return this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: 'PENDIENTE_CONFIRMACION' },
    });
  }

  async confirmarPagoCompleto(inscripcionId: string) {
    const inscripcion = await this.findOne(inscripcionId);

    const estadosPermitidos = [
      'PENDIENTE_PAGO',
      'PENDIENTE_CONFIRMACION',
      'PENDIENTE_PAGO_PRESENCIAL',
    ];

    if (!estadosPermitidos.includes(inscripcion.estado)) {
      throw new BadRequestException(
        `No se puede confirmar una inscripción en estado ${inscripcion.estado}`,
      );
    }

    // Actualizar Pago record si existe
    if (inscripcion.pago) {
      await this.prisma.pago.update({
        where: { id: inscripcion.pago.id },
        data: {
          estado: 'CONFIRMADO',
          fechaPago: inscripcion.pago.fechaPago || new Date(),
          fechaConfirm: new Date(),
        },
      });
    }

    // Aprobar comprobantes pendientes
    await this.prisma.comprobantePago.updateMany({
      where: { inscripcionId, estado: 'PENDIENTE' },
      data: { estado: 'APROBADA' },
    });

    // Confirmar inscripción
    return this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: 'CONFIRMADA' },
      include: {
        pareja: {
          include: { jugador1: true, jugador2: true },
        },
        category: true,
        pago: true,
      },
    });
  }

  async rechazarPagoCompleto(inscripcionId: string, motivo?: string) {
    const inscripcion = await this.findOne(inscripcionId);

    const estadosPermitidos = [
      'PENDIENTE_PAGO',
      'PENDIENTE_CONFIRMACION',
      'PENDIENTE_PAGO_PRESENCIAL',
    ];

    if (!estadosPermitidos.includes(inscripcion.estado)) {
      throw new BadRequestException(
        `No se puede rechazar una inscripción en estado ${inscripcion.estado}`,
      );
    }

    // Actualizar Pago record
    if (inscripcion.pago) {
      await this.prisma.pago.update({
        where: { id: inscripcion.pago.id },
        data: { estado: 'RECHAZADO' },
      });
    }

    // Rechazar comprobantes pendientes
    await this.prisma.comprobantePago.updateMany({
      where: { inscripcionId, estado: 'PENDIENTE' },
      data: {
        estado: 'RECHAZADA',
        motivoRechazo: motivo || 'Rechazado por el organizador',
      },
    });

    // Rechazar inscripción
    return this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: 'RECHAZADA' },
      include: {
        pareja: {
          include: { jugador1: true, jugador2: true },
        },
        category: true,
        pago: true,
      },
    });
  }
}