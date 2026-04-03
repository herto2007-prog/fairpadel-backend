import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { CreateCircuitoDto, UpdateCircuitoDto } from './dto/create-circuito.dto';
import { AsignarTorneoDirectoDto, SolicitarInclusionDto, ProcesarSolicitudDto, ConfigurarTorneoCircuitoDto } from './dto/torneo-circuito.dto';
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
        // fechaInicio es opcional - los circuitos se manejan por temporada manualmente
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
        // FIX: fechaAprobacion es String YYYY-MM-DD
        fechaAprobacion: new Date().toISOString().split('T')[0],
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
  // ADMIN - ASIGNACIÓN DIRECTA DE TORNEOS
  // ═══════════════════════════════════════════════════════════

  async getTorneosDisponibles(circuitoId: string) {
    // Obtener IDs de torneos ya asignados a este circuito
    const asignados = await this.prisma.torneoCircuito.findMany({
      where: { circuitoId },
      select: { torneoId: true },
    });
    const asignadosIds = asignados.map(a => a.torneoId);

    // Obtener torneos disponibles (no asignados a este circuito, estado PUBLICADO o EN_CURSO)
    const torneos = await this.prisma.tournament.findMany({
      where: {
        id: { notIn: asignadosIds },
        estado: { in: ['PUBLICADO', 'EN_CURSO', 'FINALIZADO'] },
      },
      select: {
        id: true,
        nombre: true,
        fechaInicio: true,
        fechaFin: true,
        ciudad: true,
        flyerUrl: true,
        estado: true,
        organizador: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
      orderBy: { fechaInicio: 'desc' },
    });

    return { success: true, data: torneos };
  }

  async asignarTorneoDirecto(adminId: string, dto: AsignarTorneoDirectoDto) {
    // Verificar que el circuito existe
    const circuito = await this.prisma.circuito.findUnique({
      where: { id: dto.circuitoId },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: dto.torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Calcular el siguiente orden si no se especifica
    let orden = dto.orden ?? 0;
    if (orden === 0) {
      const ultimo = await this.prisma.torneoCircuito.findFirst({
        where: { circuitoId: dto.circuitoId },
        orderBy: { orden: 'desc' },
      });
      orden = (ultimo?.orden ?? 0) + 1;
    }

    // Usar UPSERT para evitar errores de duplicados y ser más robusto
    const asignacion = await this.prisma.torneoCircuito.upsert({
      where: {
        circuitoId_torneoId: {
          circuitoId: dto.circuitoId,
          torneoId: dto.torneoId,
        },
      },
      update: {
        // Si ya existe, actualizar a APROBADO
        estado: 'APROBADO',
        orden: orden,
        puntosValidos: dto.puntosValidos ?? true,
        aprobadoPorId: adminId,
        fechaAprobacion: new Date().toISOString().split('T')[0],
      },
      create: {
        circuitoId: dto.circuitoId,
        torneoId: dto.torneoId,
        orden: Number(orden),
        puntosValidos: Boolean(dto.puntosValidos ?? true),
        estado: 'APROBADO',
        solicitadoPorId: adminId,
        aprobadoPorId: adminId,
        fechaAprobacion: new Date().toISOString().split('T')[0],
        notas: dto.notas || undefined,
      },
      include: {
        circuito: { select: { id: true, nombre: true } },
        torneo: {
          select: {
            id: true,
            nombre: true,
            fechaInicio: true,
            ciudad: true,
            flyerUrl: true,
          },
        },
      },
    });

    const esNuevo = asignacion.createdAt.getTime() === asignacion.updatedAt.getTime();

    return {
      success: true,
      message: esNuevo 
        ? 'Torneo asignado al circuito correctamente'
        : 'Torneo actualizado en el circuito',
      data: asignacion,
    };
  }

  async eliminarTorneoDeCircuito(circuitoId: string, torneoId: string) {
    // Verificar que existe la relación
    const relacion = await this.prisma.torneoCircuito.findUnique({
      where: {
        circuitoId_torneoId: {
          circuitoId,
          torneoId,
        },
      },
    });

    if (!relacion) {
      throw new NotFoundException('El torneo no está asignado a este circuito');
    }

    await this.prisma.torneoCircuito.delete({
      where: {
        circuitoId_torneoId: {
          circuitoId,
          torneoId,
        },
      },
    });

    return {
      success: true,
      message: 'Torneo eliminado del circuito',
    };
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

  // Calcular clasificados por categoría - lista simple
  async calcularClasificados(circuitoId: string, categoryId: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id: circuitoId },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    if (!circuito.tieneFinal) {
      throw new BadRequestException('Este circuito no tiene final');
    }

    // Obtener ranking de la categoría específica
    const ranking = await this.getRankingCircuito(circuitoId, categoryId);
    const mejores = ranking.data.slice(0, circuito.torneosParaClasificar);

    // Crear/actualizar lista de clasificados
    const clasificados = [];
    for (const item of mejores) {
      const clasificado = await this.prisma.clasificadoCircuito.upsert({
        where: {
          circuitoId_jugadorId_categoryId: {
            circuitoId,
            jugadorId: item.jugadorId,
            categoryId,
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
          categoryId,
          puntosAcumulados: item.puntosAcumulados,
          torneosJugados: item.torneosJugados,
          posicionClasificacion: item.posicion,
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

  // Marcar asistencia (true = confirma, false = no viene)
  async marcarAsistencia(id: string, asistencia: boolean) {
    const clasificado = await this.prisma.clasificadoCircuito.update({
      where: { id },
      data: { asistenciaConfirmada: asistencia },
    });

    return { success: true, data: clasificado };
  }

  // Obtener lista de clasificados con info de contacto
  async getClasificados(circuitoId: string, categoryId?: string) {
    const where: any = { circuitoId };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const clasificados = await this.prisma.clasificadoCircuito.findMany({
      where,
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
            telefono: true,
            email: true,
            categoriaActual: { select: { nombre: true } },
          },
        },
        category: {
          select: { id: true, nombre: true, tipo: true },
        },
      },
      orderBy: [{ categoryId: 'asc' }, { posicionClasificacion: 'asc' }],
    });

    return { success: true, data: clasificados };
  }

  async asignarTorneoFinal(circuitoId: string, torneoId: string) {
    // Verificar que el torneo existe y pertenece al circuito
    const torneoCircuito = await this.prisma.torneoCircuito.findFirst({
      where: {
        circuitoId,
        torneoId,
      },
    });

    if (!torneoCircuito) {
      throw new BadRequestException('El torneo no está asignado a este circuito');
    }

    const circuito = await this.prisma.circuito.update({
      where: { id: circuitoId },
      data: { torneoFinalId: torneoId },
      include: {
        torneoFinal: {
          select: {
            id: true,
            nombre: true,
            fechaInicio: true,
            ciudad: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Torneo final asignado correctamente',
      data: circuito,
    };
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
