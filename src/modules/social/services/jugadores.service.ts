import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

interface BuscarParams {
  q?: string;
  ciudad?: string;
  categoriaId?: string;
  page: number;
  limit: number;
}

@Injectable()
export class JugadoresService {
  private readonly logger = new Logger(JugadoresService.name);
  
  constructor(private prisma: PrismaService) {}

  /**
   * Buscar jugadores con filtros
   * Solo usuarios verificados y activos
   */
  async buscarJugadores(params: BuscarParams) {
    const { q, ciudad, categoriaId, page, limit } = params;
    const skip = (page - 1) * limit;

    this.logger.log(`Buscando jugadores: q=${q}, ciudad=${ciudad}, categoriaId=${categoriaId}`);

    // Construir where clause - mostrar usuarios activos y verificados
    const where: any = {
      estado: {
        in: [UserStatus.ACTIVO, UserStatus.NO_VERIFICADO],
      },
    };
    
    this.logger.log(`Filtro where: ${JSON.stringify(where)}`);

    // Búsqueda por nombre/apellido (case insensitive)
    if (q && q.trim()) {
      const searchTerm = q.trim();
      where.OR = [
        { nombre: { contains: searchTerm, mode: 'insensitive' } },
        { apellido: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Filtro por ciudad
    if (ciudad && ciudad.trim()) {
      where.ciudad = { contains: ciudad.trim(), mode: 'insensitive' };
    }

    // Filtro por categoría
    if (categoriaId) {
      where.categoriaActualId = categoriaId;
    }

    // Contar total para paginación
    const total = await this.prisma.user.count({ where });
    this.logger.log(`Total usuarios encontrados: ${total}`);

    // Obtener jugadores
    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        fotoUrl: true,
        ciudad: true,
        pais: true,
        categoriaActual: {
          select: {
            id: true,
            nombre: true,
          },
        },
        _count: {
          select: {
            seguidores: true,
          },
        },
      },
      orderBy: [
        { nombre: 'asc' },
        { apellido: 'asc' },
      ],
      skip,
      take: limit,
    });

    // Obtener stats adicionales para cada jugador
    const jugadoresConStats = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getStatsJugador(user.id);
        return {
          id: user.id,
          nombre: user.nombre,
          apellido: user.apellido,
          fotoUrl: user.fotoUrl,
          ciudad: user.ciudad,
          pais: user.pais,
          categoria: user.categoriaActual,
          seguidores: user._count.seguidores,
          stats,
        };
      }),
    );

    return {
      users: jugadoresConStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener datos para filtros (ciudades y categorías disponibles)
   */
  async getDatosFiltros() {
    // Obtener ciudades únicas de usuarios activos
    const ciudadesResult = await this.prisma.user.findMany({
      where: {
        estado: { in: [UserStatus.ACTIVO, UserStatus.NO_VERIFICADO] },
        ciudad: { not: null },
      },
      select: {
        ciudad: true,
      },
      distinct: ['ciudad'],
      orderBy: {
        ciudad: 'asc',
      },
    });

    // Obtener categorías con jugadores
    const categoriasResult = await this.prisma.category.findMany({
      where: {
        usuariosActuales: {
          some: {
            estado: { in: [UserStatus.ACTIVO, UserStatus.NO_VERIFICADO] },
          },
        },
      },
      select: {
        id: true,
        nombre: true,
        tipo: true,
      },
      orderBy: {
        orden: 'asc',
      },
    });

    return {
      ciudades: ciudadesResult.map(c => c.ciudad).filter(Boolean),
      categorias: categoriasResult,
    };
  }

  /**
   * Calcular estadísticas básicas del jugador
   */
  private async getStatsJugador(userId: string) {
    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId: userId },
      select: {
        posicionFinal: true,
      },
    });

    const jugados = historial.length;
    const ganados = historial.filter(h => h.posicionFinal === '1ro').length;
    const victorias = await this.prisma.ranking.aggregate({
      where: { jugadorId: userId },
      _sum: {
        victorias: true,
      },
    });

    // Calcular efectividad
    const totalPartidos = await this.prisma.ranking.aggregate({
      where: { jugadorId: userId },
      _sum: {
        victorias: true,
        derrotas: true,
      },
    });

    const totalVictorias = victorias._sum.victorias || 0;
    const totalDerrotas = totalPartidos._sum.derrotas || 0;
    const total = totalVictorias + totalDerrotas;
    const efectividad = total > 0 ? Math.round((totalVictorias / total) * 100) : 0;

    return {
      torneosJugados: jugados,
      torneosGanados: ganados,
      victorias: totalVictorias,
      efectividad,
    };
  }
}
