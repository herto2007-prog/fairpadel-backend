import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { construirOrigenLabels } from '../bracket/bracket-labels';

@Controller('public/torneos')
export class PublicBracketController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async getTorneoPublico(@Param('id') id: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        ciudad: true,
        fechaInicio: true,
        bracketPublicado: true,
      },
    });

    if (!torneo) {
      return { success: false, message: 'Torneo no encontrado' };
    }

    return {
      success: true,
      torneo,
    };
  }

  @Get(':id/categorias')
  async getCategoriasPublico(@Param('id') tournamentId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true },
    });

    if (!torneo) {
      return { success: false, message: 'Torneo no encontrado' };
    }

    // Publicación POR CATEGORÍA: solo mostramos las que tienen su cuadro
    // (fixtureVersion) PUBLICADO. Las que están en borrador no aparecen.
    const publicados = await this.prisma.fixtureVersion.findMany({
      where: { tournamentId, estado: 'PUBLICADO' },
      select: { categoryId: true },
    });
    const categoryIdsPublicados = [...new Set(publicados.map(f => f.categoryId))];

    if (categoryIdsPublicados.length === 0) {
      return { success: true, categorias: [] };
    }

    const categorias = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId, categoryId: { in: categoryIdsPublicados } },
      include: {
        category: {
          select: { id: true, nombre: true, tipo: true },
        },
      },
      orderBy: { category: { orden: 'asc' } },
    });

    return {
      success: true,
      categorias: categorias.map(c => ({
        id: c.category.id,
        nombre: c.category.nombre,
        tipo: c.category.tipo,
      })),
    };
  }

  @Get(':id/bracket')
  async getBracketPublico(
    @Param('id') tournamentId: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    // Verificar que el bracket esté publicado
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        nombre: true,
        ciudad: true,
        fechaInicio: true,
        bracketPublicado: true,
      },
    });

    if (!torneo) {
      return { success: false, message: 'Torneo no encontrado' };
    }

    // Publicación POR CATEGORÍA: solo se ven los cuadros cuya fixtureVersion
    // está PUBLICADO. Si la categoría pedida no está publicada, se oculta.
    const publicados = await this.prisma.fixtureVersion.findMany({
      where: { tournamentId, estado: 'PUBLICADO' },
      select: { id: true, categoryId: true },
    });

    if (publicados.length === 0) {
      return { success: false, message: 'El bracket no está publicado' };
    }

    if (categoriaId && !publicados.some(f => f.categoryId === categoriaId)) {
      return { success: false, message: 'Esta categoría no está publicada' };
    }

    // Solo partidos de cuadros publicados (filtrar por categoría si se especifica)
    const whereClause: any = {
      tournamentId,
      fixtureVersionId: { in: publicados.map(f => f.id) },
    };

    if (categoriaId) {
      whereClause.categoryId = categoriaId;
    }
    
    const partidosRaw = await this.prisma.match.findMany({
      where: whereClause,
      include: {
        inscripcion1: {
          include: {
            jugador1: { select: { nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        inscripcion2: {
          include: {
            jugador1: { select: { nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        inscripcionGanadora: {
          include: {
            jugador1: { select: { nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        category: {
          select: {
            nombre: true,
          }
        },
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: { select: { nombre: true } }
              }
            },
          },
        },
      },
      orderBy: { numeroRonda: 'asc' },
    });

    // Procedencia de cada lado vacío ("Ganador Zona 3", etc.)
    const origenLabels = construirOrigenLabels(partidosRaw as any);

    // Transformar partidos al formato esperado
    const partidos = partidosRaw.map(p => ({
      id: p.id,
      fase: p.ronda,
      orden: p.numeroRonda,
      esBye: !!p.inscripcion1Id && !p.inscripcion2Id,
      inscripcion1: p.inscripcion1,
      inscripcion2: p.inscripcion2,
      origen1: origenLabels.get(p.id)?.origen1 ?? null,
      origen2: origenLabels.get(p.id)?.origen2 ?? null,
      ganador: p.inscripcionGanadora,
      resultado: p.set1Pareja1 !== null ? {
        set1: [p.set1Pareja1, p.set1Pareja2],
        set2: p.set2Pareja1 !== null ? [p.set2Pareja1, p.set2Pareja2] : undefined,
        set3: p.set3Pareja1 !== null ? [p.set3Pareja1, p.set3Pareja2] : undefined,
      } : undefined,
      fecha: p.fechaProgramada,
      hora: p.horaProgramada,
      cancha: p.torneoCancha?.sedeCancha?.nombre,
      sede: p.torneoCancha?.sedeCancha?.sede?.nombre,
      categoriaNombre: p.category?.nombre || 'Sin categoría',
    }));

    return {
      success: true,
      torneo,
      partidos,
    };
  }

  /**
   * GET /public/torneos/:id/campeones
   * Campeón de cada categoría publicada (ganador del partido FINAL). Público.
   */
  @Get(':id/campeones')
  async getCampeonesPublico(@Param('id') tournamentId: string) {
    const publicados = await this.prisma.fixtureVersion.findMany({
      where: { tournamentId, estado: 'PUBLICADO' },
      select: { id: true },
    });
    if (publicados.length === 0) {
      return { success: true, campeones: [] };
    }

    const finales = await this.prisma.match.findMany({
      where: {
        tournamentId,
        fixtureVersionId: { in: publicados.map((f) => f.id) },
        ronda: 'FINAL',
        inscripcionGanadoraId: { not: null },
      },
      include: {
        category: { select: { id: true, nombre: true, tipo: true, orden: true } },
        inscripcionGanadora: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
      },
    });

    const campeones = finales
      .sort((a, b) => (a.category?.orden ?? 0) - (b.category?.orden ?? 0))
      .map((m) => ({
        categoriaId: m.category?.id,
        categoriaNombre: m.category?.nombre,
        campeon: {
          id: m.inscripcionGanadora?.id,
          jugador1: m.inscripcionGanadora?.jugador1,
          jugador2: m.inscripcionGanadora?.jugador2,
        },
      }));

    return { success: true, campeones };
  }

  /**
   * GET /public/torneos/:id/inscritos
   * Lista todos los inscritos confirmados de un torneo (público)
   * Agrupados por categoría
   */
  @Get(':id/inscritos')
  async getInscritosPublico(@Param('id') tournamentId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, nombre: true },
    });

    if (!torneo) {
      return { success: false, message: 'Torneo no encontrado' };
    }

    // Obtener inscripciones confirmadas con datos de jugadores
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        estado: 'CONFIRMADA',
      },
      include: {
        jugador1: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
        jugador2: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            fotoUrl: true,
          },
        },
        category: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Agrupar por categoría
    const porCategoria = inscripciones.reduce((acc, insc) => {
      const catNombre = insc.category?.nombre || 'Sin categoría';
      const catId = insc.category?.id || 'sin-categoria';
      const catTipo = insc.category?.tipo || 'MIXTO';
      
      if (!acc[catId]) {
        acc[catId] = {
          categoriaId: catId,
          categoriaNombre: catNombre,
          categoriaTipo: catTipo,
          parejas: [],
        };
      }
      
      acc[catId].parejas.push({
        id: insc.id,
        jugador1: insc.jugador1,
        jugador2: insc.jugador2,
        fechaInscripcion: insc.createdAt,
      });
      
      return acc;
    }, {});

    return {
      success: true,
      torneo: {
        id: torneo.id,
        nombre: torneo.nombre,
      },
      totalInscritos: inscripciones.length,
      categorias: Object.values(porCategoria),
    };
  }
}
