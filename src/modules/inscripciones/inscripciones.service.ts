import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { UpdateInscripcionDto, ConfirmarInscripcionDto } from './dto/update-inscripcion.dto';
import { InscripcionEstado, TournamentStatus } from '@prisma/client';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { NotificacionesWhatsAppService } from '../notificaciones/notificaciones-whatsapp.service';
import { ComisionService } from '../../common/services/comision.service';
import { TournamentsService } from '../tournaments/tournaments.service';

@Injectable()
export class InscripcionesService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
    private notificacionesWhatsApp: NotificacionesWhatsAppService,
    private comisionService: ComisionService,
    private tournamentsService: TournamentsService,
  ) {}

  async create(dto: CreateInscripcionDto, jugador1Id: string) {
    // Validar torneo existe y está abierto para inscripciones
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
      include: {
        _count: {
          select: { inscripciones: true }
        }
      }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (tournament.estado !== TournamentStatus.PUBLICADO) {
      throw new BadRequestException('El torneo no está abierto para inscripciones');
    }

    // Nota: Ya no validamos fecha límite. Las inscripciones se cierran manualmente
    // cuando el organizador cierra las categorías o realiza el sorteo.

    // Validar categoría existe y pertenece al torneo
    const tournamentCategory = await this.prisma.tournamentCategory.findFirst({
      where: {
        tournamentId: dto.tournamentId,
        categoryId: dto.categoryId
      }
    });

    if (!tournamentCategory) {
      throw new BadRequestException('La categoría no está disponible para este torneo');
    }

    // Validar que jugador1 no esté ya inscrito en este torneo
    const existingInscripcion = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId: dto.tournamentId,
        OR: [
          { jugador1Id },
          { jugador2Id: jugador1Id }
        ]
      }
    });

    if (existingInscripcion) {
      throw new BadRequestException('Ya estás inscrito en este torneo');
    }

    // Buscar jugador2 si se proporcionó ID
    let jugador2Id = dto.jugador2Id;
    let jugador2Documento = dto.jugador2Documento;
    let jugador2Email = dto.jugador2Email;

    if (dto.jugador2Id) {
      const jugador2 = await this.prisma.user.findUnique({
        where: { id: dto.jugador2Id }
      });
      if (!jugador2) {
        throw new NotFoundException('Jugador 2 no encontrado');
      }
      jugador2Documento = jugador2.documento;
      jugador2Email = jugador2.email;
    }

    return this.prisma.inscripcion.create({
      data: {
        tournament: { connect: { id: dto.tournamentId } },
        category: { connect: { id: dto.categoryId } },
        jugador1: { connect: { id: jugador1Id } },
        ...(jugador2Id && { jugador2: { connect: { id: jugador2Id } } }),
        jugador2Documento,
        jugador2Email,
        modoPago: dto.modoPago || 'COMPLETO',
        estado: InscripcionEstado.PENDIENTE_CONFIRMACION,
      },
      include: {
        tournament: true,
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, documento: true }
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, documento: true }
        }
      }
    });
  }

  async findAll(filters: {
    tournamentId?: string;
    jugadorId?: string;
    estado?: InscripcionEstado;
  }) {
    const where: any = {};
    
    if (filters.tournamentId) {
      where.tournamentId = filters.tournamentId;
    }
    
    if (filters.jugadorId) {
      where.OR = [
        { jugador1Id: filters.jugadorId },
        { jugador2Id: filters.jugadorId }
      ];
    }
    
    if (filters.estado) {
      where.estado = filters.estado;
    }

    return this.prisma.inscripcion.findMany({
      where,
      include: {
        tournament: true,
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, documento: true }
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, documento: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findMyInscripciones(userId: string) {
    return this.findAll({ jugadorId: userId });
  }

  async findByTournament(tournamentId: string, organizadorId: string) {
    // Verificar que el usuario es el organizador del torneo
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId }
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const puede = await this.tournamentsService.puedeGestionarTorneo(tournamentId, organizadorId);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso para ver estas inscripciones');
    }

    return this.findAll({ tournamentId });
  }

  async findOne(id: string) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id },
      include: {
        tournament: true,
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, documento: true, email: true }
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, documento: true, email: true }
        }
      }
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    return inscripcion;
  }

  /**
   * Igual que findOne pero autorizado: solo pueden ver el detalle (con datos
   * personales) los jugadores de la inscripción o quien gestiona el torneo
   * (dueño, coorganizadores o admin).
   */
  async findOneAutorizado(id: string, userId: string) {
    const inscripcion = await this.findOne(id);

    const esJugador =
      inscripcion.jugador1Id === userId || inscripcion.jugador2Id === userId;
    if (esJugador) {
      return inscripcion;
    }

    const puede = await this.tournamentsService.puedeGestionarTorneo(
      inscripcion.tournamentId,
      userId,
    );
    if (!puede) {
      throw new ForbiddenException('No tienes permiso para ver esta inscripción');
    }

    return inscripcion;
  }

  async update(id: string, dto: UpdateInscripcionDto, userId: string) {
    const inscripcion = await this.findOne(id);
    
    // Solo jugador1 puede actualizar datos de la inscripción
    if (inscripcion.jugador1Id !== userId) {
      throw new ForbiddenException('No tienes permiso para editar esta inscripción');
    }

    // No permitir cambios si ya está confirmada o cancelada
    if (inscripcion.estado === InscripcionEstado.CONFIRMADA || 
        inscripcion.estado === InscripcionEstado.RECHAZADA || 
        inscripcion.estado === InscripcionEstado.CANCELADA) {
      throw new BadRequestException('No se puede modificar una inscripción en este estado');
    }

    return this.prisma.inscripcion.update({
      where: { id },
      data: dto,
      include: {
        tournament: true,
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, documento: true }
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, documento: true }
        }
      }
    });
  }

  async confirmar(id: string, dto: ConfirmarInscripcionDto, organizadorId: string) {
    const inscripcion = await this.findOne(id);

    // Verificar que el organizador puede gestionar el torneo (dueño/coorg/admin)
    const puede = await this.tournamentsService.puedeGestionarTorneo(inscripcion.tournamentId, organizadorId);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso para confirmar esta inscripción');
    }

    // Solo se puede confirmar si está pendiente
    if (inscripcion.estado !== InscripcionEstado.PENDIENTE_CONFIRMACION) {
      throw new BadRequestException('La inscripción no puede ser confirmada en su estado actual');
    }

    const inscripcionConfirmada = await this.prisma.inscripcion.update({
      where: { id },
      data: { 
        estado: dto.estado,
        ...(dto.motivo && { notas: dto.motivo })
      },
      include: {
        tournament: true,
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, documento: true, email: true }
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, documento: true, email: true }
        }
      }
    });

    // Notificar confirmación si el estado es CONFIRMADA
    if (dto.estado === InscripcionEstado.CONFIRMADA) {
      await this.notificacionesService.notificarInscripcionConfirmada(inscripcionConfirmada.id);
      
      // También notificar por WhatsApp (si el usuario tiene consentimiento)
      this.notificacionesWhatsApp.notificarInscripcionTorneo(inscripcionConfirmada.id).catch(() => {
        // Silenciar errores de WhatsApp
      });
    }

    await this.comisionService.recalcularComision(inscripcion.tournamentId);

    return inscripcionConfirmada;
  }

  async cancelar(id: string, userId: string, motivo?: string) {
    const inscripcion = await this.findOne(id);

    // Jugador1 o quien gestiona el torneo (dueño/coorg/admin) pueden cancelar
    const isJugador1 = inscripcion.jugador1Id === userId;
    const puedeGestionar = await this.tournamentsService.puedeGestionarTorneo(inscripcion.tournamentId, userId);

    if (!puedeGestionar && !isJugador1) {
      throw new ForbiddenException('No tienes permiso para cancelar esta inscripción');
    }

    if (inscripcion.estado === InscripcionEstado.CANCELADA) {
      throw new BadRequestException('La inscripción ya está cancelada');
    }

    return this.prisma.inscripcion.update({
      where: { id },
      data: { 
        estado: InscripcionEstado.CANCELADA,
        ...(motivo && { notas: motivo })
      },
      include: {
        tournament: true,
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, documento: true }
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, documento: true }
        }
      }
    });
  }

  async remove(id: string, userId: string) {
    const inscripcion = await this.findOne(id);

    // Solo jugador1 puede eliminar su inscripción
    if (inscripcion.jugador1Id !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar esta inscripción');
    }

    // No permitir borrar una inscripción confirmada: puede estar dentro de un
    // cuadro ya sorteado y borrarla dejaría partidos con casilleros en null
    // (las referencias del bracket son SetNull / las parejas en cascada).
    // Para retirarse, usar "cancelar".
    if (inscripcion.estado === InscripcionEstado.CONFIRMADA) {
      throw new BadRequestException(
        'No se puede eliminar una inscripción confirmada. Usá "cancelar" en su lugar.',
      );
    }

    return this.prisma.inscripcion.delete({
      where: { id }
    });
  }
}
