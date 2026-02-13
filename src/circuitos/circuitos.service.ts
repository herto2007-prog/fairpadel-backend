import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCircuitoDto, UpdateCircuitoDto } from './dto';

@Injectable()
export class CircuitosService {
  constructor(private prisma: PrismaService) {}

  // ============ CRUD ============

  async create(dto: CreateCircuitoDto) {
    // Verificar nombre único
    const existing = await this.prisma.circuito.findUnique({
      where: { nombre: dto.nombre },
    });
    if (existing) {
      throw new ConflictException(`Ya existe un circuito con el nombre "${dto.nombre}"`);
    }

    return this.prisma.circuito.create({
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        pais: dto.pais,
        region: dto.region,
        ciudad: dto.ciudad,
        temporada: dto.temporada,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin: new Date(dto.fechaFin),
        logoUrl: dto.logoUrl,
      },
      include: {
        _count: { select: { torneos: true } },
      },
    });
  }

  async findAll(filters?: { estado?: string; pais?: string }) {
    const where: any = {};
    if (filters?.estado) where.estado = filters.estado;
    if (filters?.pais) where.pais = filters.pais;

    return this.prisma.circuito.findMany({
      where,
      include: {
        _count: { select: { torneos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllActive() {
    return this.prisma.circuito.findMany({
      where: { estado: 'ACTIVO' },
      include: {
        _count: { select: { torneos: true } },
      },
      orderBy: { fechaInicio: 'desc' },
    });
  }

  async findOne(id: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id },
      include: {
        torneos: {
          include: {
            organizador: {
              select: { id: true, nombre: true, apellido: true },
            },
            categorias: {
              include: { category: true },
            },
            _count: { select: { inscripciones: true } },
          },
          orderBy: { fechaInicio: 'asc' },
        },
        _count: { select: { torneos: true } },
      },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    return circuito;
  }

  async update(id: string, dto: UpdateCircuitoDto) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    if (circuito.estado === 'FINALIZADO') {
      throw new BadRequestException('No se puede editar un circuito finalizado');
    }

    const data: any = { ...dto };
    if (dto.fechaInicio) data.fechaInicio = new Date(dto.fechaInicio);
    if (dto.fechaFin) data.fechaFin = new Date(dto.fechaFin);

    return this.prisma.circuito.update({
      where: { id },
      data,
      include: {
        _count: { select: { torneos: true } },
      },
    });
  }

  async remove(id: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id },
      include: { _count: { select: { torneos: true } } },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    if (circuito._count.torneos > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el circuito tiene ${circuito._count.torneos} torneo(s) asociado(s). Removelos primero.`,
      );
    }

    await this.prisma.circuito.delete({ where: { id } });
    return { message: 'Circuito eliminado' };
  }

  // ============ GESTIÓN DE TORNEOS ============

  async agregarTorneo(circuitoId: string, tournamentId: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id: circuitoId },
    });
    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }
    if (circuito.estado === 'FINALIZADO') {
      throw new BadRequestException('No se pueden agregar torneos a un circuito finalizado');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }
    if (tournament.circuitoId && tournament.circuitoId !== circuitoId) {
      throw new ConflictException('Este torneo ya pertenece a otro circuito');
    }
    if (tournament.circuitoId === circuitoId) {
      throw new ConflictException('Este torneo ya pertenece a este circuito');
    }

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { circuitoId },
    });

    return { message: `Torneo "${tournament.nombre}" agregado al circuito` };
  }

  async removerTorneo(circuitoId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }
    if (tournament.circuitoId !== circuitoId) {
      throw new BadRequestException('Este torneo no pertenece a este circuito');
    }

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { circuitoId: null },
    });

    return { message: `Torneo "${tournament.nombre}" removido del circuito` };
  }

  async getTorneosDisponibles() {
    return this.prisma.tournament.findMany({
      where: {
        circuitoId: null,
        estado: { in: ['PUBLICADO', 'EN_CURSO', 'FINALIZADO'] },
      },
      select: {
        id: true,
        nombre: true,
        pais: true,
        ciudad: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
      },
      orderBy: { fechaInicio: 'desc' },
    });
  }

  // ============ STANDINGS ============

  async getStandings(circuitoId: string, genero?: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id: circuitoId },
      include: { torneos: { select: { id: true } } },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    const tournamentIds = circuito.torneos.map((t) => t.id);

    if (tournamentIds.length === 0) {
      return [];
    }

    // Obtener todos los puntos de los torneos del circuito
    const whereHistorial: any = {
      tournamentId: { in: tournamentIds },
    };

    // Si se filtra por género, necesitamos los IDs de jugadores del género
    if (genero) {
      const jugadoresGenero = await this.prisma.user.findMany({
        where: { genero: genero as any },
        select: { id: true },
      });
      whereHistorial.jugadorId = {
        in: jugadoresGenero.map((j) => j.id),
      };
    }

    const historial = await this.prisma.historialPuntos.findMany({
      where: whereHistorial,
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            ciudad: true,
            genero: true,
          },
        },
      },
    });

    // Agregar puntos por jugador
    const standingsMap = new Map<
      string,
      {
        jugador: any;
        puntosTotales: number;
        torneosJugados: Set<string>;
      }
    >();

    for (const h of historial) {
      if (!standingsMap.has(h.jugadorId)) {
        standingsMap.set(h.jugadorId, {
          jugador: h.jugador,
          puntosTotales: 0,
          torneosJugados: new Set(),
        });
      }
      const entry = standingsMap.get(h.jugadorId)!;
      entry.puntosTotales += h.puntosGanados;
      entry.torneosJugados.add(h.tournamentId);
    }

    // Convertir a array, ordenar por puntos desc
    const standings = Array.from(standingsMap.values())
      .map((entry, _) => ({
        jugador: entry.jugador,
        puntosTotales: entry.puntosTotales,
        torneosJugados: entry.torneosJugados.size,
      }))
      .sort((a, b) => b.puntosTotales - a.puntosTotales)
      .map((entry, index) => ({
        posicion: index + 1,
        ...entry,
      }));

    return standings;
  }

  // ============ FINALIZAR CIRCUITO ============

  async finalizar(id: string) {
    const circuito = await this.prisma.circuito.findUnique({
      where: { id },
      include: {
        torneos: { select: { id: true, estado: true, nombre: true } },
      },
    });

    if (!circuito) {
      throw new NotFoundException('Circuito no encontrado');
    }

    if (circuito.estado === 'FINALIZADO') {
      throw new BadRequestException('El circuito ya está finalizado');
    }

    const torneosFinalizados = circuito.torneos.filter(
      (t) => t.estado === 'FINALIZADO',
    );

    if (torneosFinalizados.length === 0) {
      throw new BadRequestException(
        'El circuito no tiene torneos finalizados. No se puede generar el ranking.',
      );
    }

    // Calcular standings finales y persistir como rankings tipo LIGA
    const standingsMasc = await this.getStandings(id, 'MASCULINO');
    const standingsFem = await this.getStandings(id, 'FEMENINO');

    // Persistir rankings LIGA
    for (const standing of [...standingsMasc, ...standingsFem]) {
      await this.prisma.ranking.upsert({
        where: {
          jugadorId_tipoRanking_alcance: {
            jugadorId: standing.jugador.id,
            tipoRanking: 'LIGA',
            alcance: id,
          },
        },
        update: {
          puntosTotales: standing.puntosTotales,
          posicion: standing.posicion,
          torneosJugados: standing.torneosJugados,
          ultimaActualizacion: new Date(),
        },
        create: {
          jugadorId: standing.jugador.id,
          tipoRanking: 'LIGA',
          alcance: id,
          genero: standing.jugador.genero,
          puntosTotales: standing.puntosTotales,
          posicion: standing.posicion,
          torneosJugados: standing.torneosJugados,
          ultimaActualizacion: new Date(),
        },
      });
    }

    // Actualizar estado del circuito
    await this.prisma.circuito.update({
      where: { id },
      data: { estado: 'FINALIZADO' },
    });

    return {
      message: `Circuito "${circuito.nombre}" finalizado. Rankings generados para ${standingsMasc.length} jugadores (M) y ${standingsFem.length} jugadoras (F).`,
    };
  }
}
