import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { CreateCircuitoDto, UpdateCircuitoDto } from './dto/create-circuito.dto';
import { SolicitarInclusionDto, ProcesarSolicitudDto, ConfigurarTorneoCircuitoDto } from './dto/torneo-circuito.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CircuitosService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CIRCUITOS - CRUD
  // ═══════════════════════════════════════════════════════════

  async findAll() {
    const circuitos = await this.prisma.circuito.findMany({
      where: { estado: { not: 'INACTIVO' } },
      orderBy: [{ destacado: 'desc' }, { orden: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { 
            torneos: { where: { estado: 'APROBADO' } },
            clasificados: true,
          },
        },
      },
    });
    return { success: true, data: circuitos };
  }

  async findOne(id: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id },
      include: {
        torneos: {
          where: { estado: 'APROBADO' },
          include: {
            torneo: {
              select: {
                id: true,
                nombre: true,
                slug: true,
                fechaInicio: true,
                fechaFin: true,
                ciudad: true,
                flyerUrl: true,
                estado: true,
                organizador: {
                  select: { id: true, nombre: true, apellido: true },
                },
              },
            },
          },
          orderBy: { orden: 'asc' },
        },
        torneoFinal: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            fechaInicio: true,
            flyerUrl: true,
          },
        },
      },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    return { success: true, data: circuito };
  }

  async findBySlug(slug: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { slug },
      include: {
        torneos: {
          where: { estado: 'APROBADO' },
          include: {
            torneo: {
              select: {
                id: true,
                nombre: true,
                slug: true,
                fechaInicio: true,
                fechaFin: true,
                ciudad: true,
                flyerUrl: true,
                estado: true,
                multiplicadorPuntos: true,
                organizador: {
                  select: { id: true, nombre: true, apellido: true },
                },
              },
            },
          },
          orderBy: { orden: 'asc' },
        },
        torneoFinal: true,
        clasificados: {
          where: { estado: { in: ['CLASIFICADO', 'CONFIRMADO'] } },
          include: {
            jugador: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                fotoUrl: true,
                categoriaActual: { select: { nombre: true } },
              },
            },
          },
          orderBy: { posicionClasificacion: 'asc' },
          take: 20,
        },
      },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    return { success: true, data: circuito };
  }

  async create(dto: CreateCircuitoDto) {
    const slug = this.generarSlug(dto.nombre);

    // Verificar que el slug no exista
    const existente = await this.prisma.circuito.findUnique({
      where: { slug },
    });

    if (existente) {
      throw new BadRequestException('Ya existe un circuito con ese nombre');
    }

    const circuito = await this.prisma.circuito.create({
      data: {
        ...dto,
        slug,
        temporada: dto.temporada || new Date().getFullYear().toString(),
      },
    });

    return { success: true, data: circuito };
  }

  async update(id: string, dto: UpdateCircuitoDto) {
    const data: any = { ...dto };
    if (dto.estado) {
      data.estado = dto.estado;
    }
    
    const circuito = await this.prisma.circuito.update({
      where: { id },
      data,
    });

    return { success: true, data: circuito };
  }

  async remove(id: string) {
    // Soft delete - cambiar estado a INACTIVO
    await this.prisma.circuito.update({
      where: { id },
      data: { estado: 'INACTIVO' },
    });

    return { success: true, message: 'Circuito eliminado' };
  }

  // ═══════════════════════════════════════════════════════════
  // GESTIÓN DE TORNEOS EN CIRCUITO
  // ═══════════════════════════════════════════════════════════

  async solicitarInclusion(torneoId: string, userId: string, dto: SolicitarInclusionDto) {
    // Verificar que el circuito existe
    const circuito = await this.prisma.circuito.findUnique({
      where: { id: dto.circuitoId },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    // Verificar que el torneo existe y pertenece al usuario
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== userId) {
      throw new BadRequestException('No tienes permiso para este torneo');
    }

    // Verificar que no exista ya una solicitud
    const existente = await this.prisma.torneoCircuito.findUnique({
      where: {
        circuitoId_torneoId: {
          circuitoId: dto.circuitoId,
          torneoId,
        },
      },
    });

    if (existente) {
      throw new BadRequestException('Ya existe una solicitud para este torneo en el circuito');
    }

    const solicitud = await this.prisma.torneoCircuito.create({
      data: {
        circuitoId: dto.circuitoId,
        torneoId,
        orden: dto.orden || 0,
        estado: 'PENDIENTE',
        solicitadoPorId: userId,
        notas: dto.notas,
      },
      include: {
        circuito: { select: { nombre: true } },
        torneo: { select: { nombre: true } },
      },
    });

    return { 
      success: true, 
      message: 'Solicitud enviada. Esperando aprobación del administrador.',
      data: solicitud,
    };
  }

  async getSolicitudesPendientes() {
    const solicitudes = await this.prisma.torneoCircuito.findMany({
      where: { estado: 'PENDIENTE' },
      include: {
        circuito: { select: { id: true, nombre: true } },
        torneo: {
          select: {
            id: true,
            nombre: true,
            fechaInicio: true,
            ciudad: true,
            organizador: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        solicitadoPor: { select: { id: true, nombre: true, apellido: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: solicitudes };
  }

  async procesarSolicitud(id: string, adminId: string, dto: ProcesarSolicitudDto) {
    const solicitud = await this.prisma.torneoCircuito.update({
      where: { id },
      data: {
        estado: dto.estado,
        puntosValidos: dto.estado === 'APROBADO' ? (dto.puntosValidos ?? true) : false,
        orden: dto.orden,
        aprobadoPorId: adminId,
        fechaAprobacion: this.dateService.now(),
        notas: dto.notas,
      },
      include: {
        circuito: { select: { nombre: true } },
        torneo: { select: { nombre: true } },
      },
    });

    return {
      success: true,
      message: dto.estado === 'APROBADO' ? 'Solicitud aprobada' : 'Solicitud rechazada',
      data: solicitud,
    };
  }

  async configurarTorneoCircuito(id: string, dto: ConfigurarTorneoCircuitoDto) {
    const config = await this.prisma.torneoCircuito.update({
      where: { id },
      data: {
        puntosValidos: dto.puntosValidos,
        orden: dto.orden,
        esFinal: dto.esFinal,
        notas: dto.notas,
      },
    });

    return { success: true, data: config };
  }

  async getTorneosDeCircuito(circuitoId: string) {
    const torneos = await this.prisma.torneoCircuito.findMany({
      where: { 
        circuitoId,
        estado: 'APROBADO',
      },
      include: {
        torneo: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            fechaInicio: true,
            fechaFin: true,
            ciudad: true,
            estado: true,
            flyerUrl: true,
          },
        },
      },
      orderBy: { orden: 'asc' },
    });

    return { success: true, data: torneos };
  }

  // ═══════════════════════════════════════════════════════════
  // RANKING DEL CIRCUITO
  // ═══════════════════════════════════════════════════════════

  async getRankingCircuito(circuitoId: string, categoriaId?: string) {
    // Obtener torneos aprobados del circuito
    const torneoCircuitos = await this.prisma.torneoCircuito.findMany({
      where: {
        circuitoId,
        estado: 'APROBADO',
        puntosValidos: true,
      },
      select: { torneoId: true },
    });

    const torneoIds = torneoCircuitos.map(tc => tc.torneoId);

    if (torneoIds.length === 0) {
      return { success: true, data: [], message: 'No hay torneos válidos en el circuito' };
    }

    // Obtener historial de puntos de esos torneos
    const where: any = {
      tournamentId: { in: torneoIds },
    };

    if (categoriaId) {
      where.categoryId = categoriaId;
    }

    const puntosPorJugador = await this.prisma.historialPuntos.groupBy({
      by: ['jugadorId'],
      where,
      _sum: { puntosGanados: true },
      _count: { tournamentId: true },
    });

    // Ordenar por puntos
    const ordenados = puntosPorJugador
      .sort((a, b) => (b._sum.puntosGanados || 0) - (a._sum.puntosGanados || 0))
      .map((p, index) => ({
        posicion: index + 1,
        jugadorId: p.jugadorId,
        puntosAcumulados: p._sum.puntosGanados || 0,
        torneosJugados: p._count.tournamentId,
      }));

    // Obtener datos de jugadores
    const jugadorIds = ordenados.map(o => o.jugadorId);
    const jugadores = await this.prisma.user.findMany({
      where: { id: { in: jugadorIds } },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        fotoUrl: true,
        categoriaActual: { select: { nombre: true } },
      },
    });

    const jugadoresMap = new Map(jugadores.map(j => [j.id, j]));

    const ranking = ordenados.map(o => ({
      ...o,
      jugador: jugadoresMap.get(o.jugadorId),
    }));

    return { success: true, data: ranking };
  }

  // ═══════════════════════════════════════════════════════════
  // CLASIFICADOS A LA FINAL
  // ═══════════════════════════════════════════════════════════

  async calcularClasificados(circuitoId: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id: circuitoId },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    if (!circuito.tieneFinal) {
      throw new BadRequestException('Este circuito no tiene final');
    }

    // Obtener ranking actual
    const ranking = await this.getRankingCircuito(circuitoId);
    const mejores = ranking.data.slice(0, circuito.torneosParaClasificar);

    // Crear/actualizar clasificados
    const clasificados = [];
    for (const item of mejores) {
      const clasificado = await this.prisma.clasificadoCircuito.upsert({
        where: {
          circuitoId_jugadorId: {
            circuitoId,
            jugadorId: item.jugadorId,
          },
        },
        update: {
          puntosAcumulados: item.puntosAcumulados,
          torneosJugados: item.torneosJugados,
          posicionClasificacion: item.posicion,
        },
        create: {
          circuitoId,
          jugadorId: item.jugadorId,
          puntosAcumulados: item.puntosAcumulados,
          torneosJugados: item.torneosJugados,
          posicionClasificacion: item.posicion,
          estado: 'CLASIFICADO',
        },
      });
      clasificados.push(clasificado);
    }

    return {
      success: true,
      message: `${clasificados.length} jugadores clasificados`,
      data: clasificados,
    };
  }

  async confirmarClasificacion(circuitoId: string, jugadorId: string) {
    const clasificado = await this.prisma.clasificadoCircuito.update({
      where: {
        circuitoId_jugadorId: {
          circuitoId,
          jugadorId,
        },
      },
      data: {
        estado: 'CONFIRMADO',
        confirmadoEn: this.dateService.now(),
      },
    });

    return { success: true, data: clasificado };
  }

  // ═══════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════

  private generarSlug(nombre: string): string {
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 60) + '-' + uuidv4().substring(0, 8);
  }
}
