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

    const searchTerm = q?.trim();
    const digitsOnly = searchTerm ? searchTerm.replace(/\D/g, '') : '';
    const esDocumento = /^\d{5,}$/.test(digitsOnly);

    let users: any[] = [];
    let total = 0;

    if (esDocumento) {
      // Búsqueda robusta por documento: traer candidatos y filtrar en memoria limpiando puntos/guiones/espacios
      this.logger.log(`Buscando por documento limpio: ${digitsOnly}`);

      const candidatos = await this.prisma.user.findMany({
        where: {
          estado: { in: [UserStatus.ACTIVO, UserStatus.NO_VERIFICADO] },
          documento: { not: '' },
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          fotoUrl: true,
          genero: true,
          ciudad: true,
          pais: true,
          documento: true,
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
      });

      const cleanDoc = (doc: string) => doc.replace(/[.\-\s]/g, '');
      const filtrados = candidatos.filter(u => cleanDoc(u.documento).includes(digitsOnly));

      total = filtrados.length;
      users = filtrados.slice(skip, skip + limit);

      this.logger.log(`Documento ${digitsOnly}: ${candidatos.length} candidatos, ${filtrados.length} coincidencias`);
    } else {
      // Búsqueda normal por nombre/apellido/documento (contains)
      const where: any = {
        estado: {
          in: [UserStatus.ACTIVO, UserStatus.NO_VERIFICADO],
        },
      };

      if (searchTerm) {
        where.OR = [
          { nombre: { contains: searchTerm, mode: 'insensitive' } },
          { apellido: { contains: searchTerm, mode: 'insensitive' } },
          { documento: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      if (ciudad && ciudad.trim()) {
        where.ciudad = { contains: ciudad.trim(), mode: 'insensitive' };
      }

      if (categoriaId) {
        where.categoriaActualId = categoriaId;
      }

      total = await this.prisma.user.count({ where });
      this.logger.log(`Total usuarios encontrados (nombre/apellido): ${total}`);

      users = await this.prisma.user.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          apellido: true,
          fotoUrl: true,
          genero: true,
          ciudad: true,
          pais: true,
          documento: true,
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
    }

    this.logger.log(`Usuarios tras query: ${users.length}`);

    // Obtener stats adicionales para cada jugador
    const jugadoresConStats = await Promise.all(
      users.map(async (user) => {
        const stats = await this.getStatsJugador(user.id);
        return {
          id: user.id,
          nombre: user.nombre,
          apellido: user.apellido,
          fotoUrl: user.fotoUrl,
          genero: user.genero,
          documento: user.documento,
          ciudad: user.ciudad,
          pais: user.pais,
          categoria: user.categoriaActual,
          categoriaActual: user.categoriaActual,
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
   * Optimizado con batch queries
   */
  private async getStatsJugador(userId: string) {
    // Torneos jugados y ganados desde historial de puntos
    const [historialCount, torneosGanados] = await Promise.all([
      this.prisma.historialPuntos.count({ where: { jugadorId: userId } }),
      this.prisma.historialPuntos.count({
        where: {
          jugadorId: userId,
          posicionFinal: '1ro',
        },
      }),
    ]);

    // Victorias y derrotas reales desde partidos (Match) incluyendo zona, octavos, cuartos, semis, final
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
      },
      select: { id: true },
    });

    const ids = inscripciones.map(i => i.id);
    let victorias = 0;
    let derrotas = 0;

    if (ids.length > 0) {
      const partidos = await this.prisma.match.findMany({
        where: {
          OR: [{ inscripcion1Id: { in: ids } }, { inscripcion2Id: { in: ids } }],
          estado: 'FINALIZADO',
        },
        select: { inscripcionGanadoraId: true },
      });

      for (const p of partidos) {
        if (p.inscripcionGanadoraId && ids.includes(p.inscripcionGanadoraId)) {
          victorias++;
        } else {
          derrotas++;
        }
      }
    }

    const total = victorias + derrotas;
    const efectividad = total > 0 ? Math.round((victorias / total) * 100) : 0;

    return {
      torneosJugados: historialCount,
      torneosGanados,
      victorias,
      efectividad,
    };
  }
}
