import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BracketService } from '../bracket/bracket.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminBracketController {
  constructor(
    private prisma: PrismaService,
    private bracketService: BracketService,
  ) {}

  /**
   * GET /admin/torneos/:id/categorias
   * Listar categorías de un torneo con conteo de inscripciones
   */
  @Get('torneos/:id/categorias')
  async getCategoriasConInscripciones(@Param('id') tournamentId: string) {
    // Obtener categorías
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId },
      include: {
        category: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
            orden: true,
          },
        },
        fixtureVersion: {
          select: {
            id: true,
            estado: true,
          },
        },
      },
      orderBy: {
        category: {
          orden: 'asc',
        },
      },
    });

    // Contar inscripciones por categoría
    const inscripcionesCount = await this.prisma.inscripcion.groupBy({
      by: ['categoryId'],
      where: {
        tournamentId,
        estado: {
          in: ['CONFIRMADA', 'PENDIENTE_PAGO'],
        },
      },
      _count: {
        id: true,
      },
    });

    const countMap = new Map(
      inscripcionesCount.map((i) => [i.categoryId, i._count.id]),
    );

    return {
      success: true,
      categorias: categorias.map((cat) => ({
        id: cat.id,
        categoryId: cat.categoryId,
        category: cat.category,
        inscripcionAbierta: cat.inscripcionAbierta,
        estado: cat.estado,
        fixtureVersionId: cat.fixtureVersionId,
        inscripcionesCount: countMap.get(cat.categoryId) || 0,
      })),
    };
  }

  /**
   * POST /admin/categorias/:id/bracket/generar
   * Generar bracket para una categoría
   */
  @Post('categorias/:id/bracket/generar')
  async generarBracket(@Param('id') tournamentCategoryId: string) {
    try {
      // 1. Obtener la categoría
      const categoria = await this.prisma.tournamentCategory.findUnique({
        where: { id: tournamentCategoryId },
        include: {
          tournament: true,
          category: true,
        },
      });

      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada');
      }

      // 2. Obtener inscripciones confirmadas
      const inscripciones = await this.prisma.inscripcion.findMany({
        where: {
          tournamentId: categoria.tournamentId,
          categoryId: categoria.categoryId,
          estado: {
            in: ['CONFIRMADA', 'PENDIENTE_PAGO'],
          },
        },
        include: {
          jugador1: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
            },
          },
          jugador2: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      if (inscripciones.length < 3) {
        throw new BadRequestException(
          `Mínimo 3 parejas para generar bracket. Actual: ${inscripciones.length}`,
        );
      }

      // 3. Calcular configuración
      const config = this.bracketService.calcularConfiguracion(
        inscripciones.length,
      );

      // 4. Generar bracket (estructura de partidos)
      const inscripcionIds = inscripciones.map((i) => i.id);
      const { partidos } = await this.bracketService.generarBracket({
        tournamentCategoryId,
        totalParejas: inscripciones.length,
        inscripcionIds,
      });

      // 5. Crear FixtureVersion
      const definicion = {
        config: {
          totalParejas: config.totalParejas,
          tamanoBracket: config.tamanoBracket,
          parejasConBye: config.parejasConBye,
          partidosZona: config.partidosZona,
          parejasEnRepechaje: config.parejasEnRepechaje,
          partidosRepechaje: config.partidosRepechaje,
          ganadoresZona: config.ganadoresZona,
          ganadoresRepechaje: config.ganadoresRepechaje,
          perdedoresDirectos: config.perdedoresDirectos,
          fases: config.fases,
        },
        partidos: partidos.map((p) => ({
          id: p.id,
          fase: p.fase,
          orden: p.orden,
          esBye: p.esBye,
          tipoEntrada1: p.tipoEntrada1,
          tipoEntrada2: p.tipoEntrada2,
          partidoOrigen1Id: p.partidoOrigen1Id,
          partidoOrigen2Id: p.partidoOrigen2Id,
          partidoSiguienteId: p.partidoSiguienteId,
          partidoPerdedorSiguienteId: p.partidoPerdedorSiguienteId,
          posicionEnSiguiente: p.posicionEnSiguiente,
          posicionEnPerdedor: p.posicionEnPerdedor,
        })),
        inscripciones: inscripciones.map((i) => ({
          id: i.id,
          jugador1: i.jugador1,
          jugador2: i.jugador2,
        })),
      };

      const fixtureVersion = await this.prisma.fixtureVersion.create({
        data: {
          tournamentId: categoria.tournamentId,
          categoryId: categoria.categoryId,
          definicion: definicion as any,
          totalPartidos: partidos.length,
          estado: 'BORRADOR',
        },
      });

      // 6. Crear los partidos (matches)
      for (const partido of partidos) {
        await this.prisma.match.create({
          data: {
            tournamentId: categoria.tournamentId,
            categoryId: categoria.categoryId,
            fixtureVersionId: fixtureVersion.id,
            ronda: partido.fase,
            numeroRonda: partido.orden,
            esBye: partido.esBye,
            tipoEntrada1: partido.tipoEntrada1,
            tipoEntrada2: partido.tipoEntrada2,
            partidoOrigen1Id: partido.partidoOrigen1Id,
            partidoOrigen2Id: partido.partidoOrigen2Id,
            partidoSiguienteId: partido.partidoSiguienteId,
            partidoPerdedorSiguienteId: partido.partidoPerdedorSiguienteId,
            posicionEnSiguiente: partido.posicionEnSiguiente,
            posicionEnPerdedor: partido.posicionEnPerdedor,
            estado: 'PROGRAMADO',
          },
        });
      }

      // 7. Actualizar estado de la categoría
      await this.prisma.tournamentCategory.update({
        where: { id: tournamentCategoryId },
        data: {
          estado: 'FIXTURE_BORRADOR',
          fixtureVersionId: fixtureVersion.id,
        },
      });

      return {
        success: true,
        message: 'Bracket generado exitosamente',
        fixtureVersionId: fixtureVersion.id,
        config,
        totalPartidos: partidos.length,
      };
    } catch (error: any) {
      console.error('[generarBracket] Error:', error);
      throw new BadRequestException({
        success: false,
        message: error.message || 'Error generando bracket',
      });
    }
  }

  /**
   * GET /admin/bracket/:fixtureVersionId/partidos
   * Obtener partidos de un bracket
   */
  @Get('bracket/:fixtureVersionId/partidos')
  async getPartidosBracket(@Param('fixtureVersionId') fixtureVersionId: string) {
    try {
      const partidos = await this.prisma.match.findMany({
        where: { fixtureVersionId },
        include: {
          inscripcion1: {
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
            },
          },
          inscripcion2: {
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
            },
          },
          inscripcionGanadora: {
            include: {
              jugador1: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                },
              },
              jugador2: {
                select: {
                  id: true,
                  nombre: true,
                  apellido: true,
                },
              },
            },
          },
          torneoCancha: {
            include: {
              sedeCancha: {
                include: {
                  sede: {
                    select: {
                      nombre: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { ronda: 'asc' },
          { numeroRonda: 'asc' },
        ],
      });

      return {
        success: true,
        partidos: partidos.map((p) => ({
          id: p.id,
          fase: p.ronda,
          orden: p.numeroRonda,
          esBye: p.esBye,
          inscripcion1: p.inscripcion1,
          inscripcion2: p.inscripcion2,
          ganador: p.inscripcionGanadora,
          resultado:
            p.set1Pareja1 !== null
              ? {
                  set1: [p.set1Pareja1, p.set1Pareja2],
                  set2: [p.set2Pareja1, p.set2Pareja2],
                  set3:
                    p.set3Pareja1 !== null
                      ? [p.set3Pareja1, p.set3Pareja2]
                      : undefined,
                }
              : undefined,
          fecha: p.fechaProgramada,
          hora: p.horaProgramada,
          cancha: p.torneoCancha
            ? `${p.torneoCancha.sedeCancha.sede.nombre} - ${p.torneoCancha.sedeCancha.nombre}`
            : undefined,
          estado: p.estado,
        })),
      };
    } catch (error: any) {
      console.error('[getPartidosBracket] Error:', error);
      throw new BadRequestException({
        success: false,
        message: 'Error cargando partidos',
      });
    }
  }

  /**
   * POST /admin/bracket/:fixtureVersionId/publicar
   * Publicar bracket (cambiar de BORRADOR a PUBLICADO)
   */
  @Post('bracket/:fixtureVersionId/publicar')
  async publicarBracket(@Param('fixtureVersionId') fixtureVersionId: string) {
    try {
      // Actualizar fixture
      await this.prisma.fixtureVersion.update({
        where: { id: fixtureVersionId },
        data: {
          estado: 'PUBLICADO',
          publicadoAt: new Date(),
        },
      });

      // Actualizar categoría
      const fixture = await this.prisma.fixtureVersion.findUnique({
        where: { id: fixtureVersionId },
        select: { tournamentId: true, categoryId: true },
      });

      if (fixture) {
        await this.prisma.tournamentCategory.updateMany({
          where: {
            tournamentId: fixture.tournamentId,
            categoryId: fixture.categoryId,
          },
          data: {
            estado: 'SORTEO_REALIZADO',
          },
        });
      }

      return {
        success: true,
        message: 'Bracket publicado exitosamente',
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error publicando bracket',
      });
    }
  }
}
