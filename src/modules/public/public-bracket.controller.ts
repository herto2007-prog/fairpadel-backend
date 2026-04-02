import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
      select: { bracketPublicado: true },
    });

    if (!torneo) {
      return { success: false, message: 'Torneo no encontrado' };
    }

    const categorias = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId },
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

    if (!torneo.bracketPublicado) {
      return { success: false, message: 'El bracket no está publicado' };
    }

    // Obtener partidos del torneo (filtrar por categoría si se especifica)
    const whereClause: any = { 
      tournamentId,
      fixtureVersionId: { not: null }
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
        slot: {
          include: {
            disponibilidad: true,
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
        },
      },
      orderBy: { numeroRonda: 'asc' },
    });

    // Transformar partidos al formato esperado
    const partidos = partidosRaw.map(p => ({
      id: p.id,
      fase: p.ronda,
      orden: p.numeroRonda,
      esBye: !!p.inscripcion1Id && !p.inscripcion2Id,
      inscripcion1: p.inscripcion1,
      inscripcion2: p.inscripcion2,
      ganador: p.inscripcionGanadora,
      resultado: p.set1Pareja1 !== null ? {
        set1: [p.set1Pareja1, p.set1Pareja2],
        set2: p.set2Pareja1 !== null ? [p.set2Pareja1, p.set2Pareja2] : undefined,
        set3: p.set3Pareja1 !== null ? [p.set3Pareja1, p.set3Pareja2] : undefined,
      } : undefined,
      fecha: p.fechaProgramada,
      hora: p.horaProgramada,
      cancha: p.slot?.torneoCancha?.sedeCancha?.nombre,
      sede: p.slot?.torneoCancha?.sedeCancha?.sede?.nombre,
      categoriaNombre: p.category?.nombre || 'Sin categoría',
    }));

    return {
      success: true,
      torneo,
      partidos,
    };
  }
}
