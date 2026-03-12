import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Body,
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

    // Contar inscripciones confirmadas por categoría
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
   * GET /admin/categorias/:id/bracket/config
   * Obtiene la configuración del bracket para una categoría (sistema paraguayo)
   */
  @Get('categorias/:id/bracket/config')
  async getBracketConfig(@Param('id') tournamentCategoryId: string) {
    try {
      // Obtener la categoría
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

      // Obtener inscripciones confirmadas
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
      });

      if (inscripciones.length < 3) {
        return {
          success: false,
          message: `Se necesitan al menos 3 parejas para generar bracket. Actual: ${inscripciones.length}`,
          puedeGenerar: false,
        };
      }

      const config = this.bracketService.calcularConfiguracion(
        inscripciones.length,
      );

      return {
        success: true,
        puedeGenerar: true,
        config,
        inscripciones: inscripciones.map((i) => ({
          id: i.id,
          jugador1: i.jugador1,
          jugador2: i.jugador2,
        })),
        totalInscripciones: inscripciones.length,
      };
    } catch (error: any) {
      console.error('[getBracketConfig] Error:', error);
      throw new BadRequestException({
        success: false,
        message: error.message || 'Error obteniendo configuración del bracket',
      });
    }
  }

  /**
   * POST /admin/categorias/:id/bracket/sortear
   * Realiza el sorteo aleatorio de las parejas (sistema paraguayo: Zona → Repechaje → Bracket)
   */
  @Post('categorias/:id/bracket/sortear')
  async sortearBracket(
    @Param('id') tournamentCategoryId: string,
    @Body() body?: { guardar?: boolean; ordenInscripciones?: string[] },
  ) {
    try {
      // Obtener la categoría
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

      // Obtener inscripciones confirmadas
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
      });

      if (inscripciones.length < 3) {
        throw new BadRequestException(
          `Se necesitan al menos 3 parejas para generar bracket. Actual: ${inscripciones.length}`,
        );
      }

      // Realizar el sorteo aleatorio
      const ordenSorteo = body?.ordenInscripciones 
        ? body.ordenInscripciones 
        : [...inscripciones].sort(() => Math.random() - 0.5).map(i => i.id);

      // Generar bracket con sistema paraguayo
      const { config, partidos } = await this.bracketService.generarBracket({
        tournamentCategoryId,
        totalParejas: inscripciones.length,
        inscripcionIds: ordenSorteo,
      });

      // Crear mapa de inscripciones para lookup
      const inscripcionesMap = new Map(
        inscripciones.map((i) => [
          i.id,
          {
            id: i.id,
            jugador1: i.jugador1,
            jugador2: i.jugador2,
          },
        ]),
      );

      // Preparar respuesta con datos completos
      const partidosConDetalle = partidos.map((p) => ({
        id: p.id,
        fase: p.fase,
        orden: p.orden,
        esBye: p.esBye,
        tipoEntrada1: p.tipoEntrada1,
        tipoEntrada2: p.tipoEntrada2,
      }));

      let fixtureVersionId: string | undefined;

      // Guardar si se solicita
      if (body?.guardar) {
        // Archivar versión anterior si existe
        if (categoria.fixtureVersionId) {
          await this.prisma.fixtureVersion.update({
            where: { id: categoria.fixtureVersionId },
            data: { estado: 'ARCHIVADO', archivadoAt: new Date() },
          });
        }

        fixtureVersionId = await this.bracketService.guardarBracket(
          tournamentCategoryId,
          config,
          partidos,
          inscripciones,
        );

        // Actualizar categoría
        await this.prisma.tournamentCategory.update({
          where: { id: tournamentCategoryId },
          data: {
            estado: 'FIXTURE_BORRADOR',
            fixtureVersionId,
          },
        });
      }

      return {
        success: true,
        message: body?.guardar
          ? 'Sorteo guardado exitosamente'
          : 'Sorteo realizado (preview)',
        fixtureVersionId,
        config,
        ordenSorteo: ordenSorteo.map((id) => inscripcionesMap.get(id)),
        partidos: partidosConDetalle,
        totalPartidos: partidos.length,
      };
    } catch (error: any) {
      console.error('[sortearBracket] Error:', error);
      throw new BadRequestException({
        success: false,
        message: error.message || 'Error realizando sorteo',
      });
    }
  }

  /**
   * POST /admin/categorias/:id/bracket/generar
   * Genera bracket para una categoría (alias de sortear con guardar=true)
   */
  @Post('categorias/:id/bracket/generar')
  async generarBracket(@Param('id') tournamentCategoryId: string) {
    return this.sortearBracket(tournamentCategoryId, { guardar: true });
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
          { numeroRonda: 'asc' },
        ],
      });

      // Obtener información del fixture para la definición
      const fixtureVersion = await this.prisma.fixtureVersion.findUnique({
        where: { id: fixtureVersionId },
        select: { definicion: true, estado: true },
      });

      return {
        success: true,
        fixtureEstado: fixtureVersion?.estado,
        definicion: fixtureVersion?.definicion,
        partidos: partidos.map((p) => ({
          id: p.id,
          fase: p.ronda,
          orden: p.numeroRonda,
          esBye: p.esBye,
          pareja1: p.inscripcion1,
          pareja2: p.inscripcion2,
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
      // Verificar que existe el fixture
      const fixture = await this.prisma.fixtureVersion.findUnique({
        where: { id: fixtureVersionId },
        select: { tournamentId: true, categoryId: true, estado: true },
      });

      if (!fixture) {
        throw new NotFoundException('Fixture no encontrado');
      }

      if (fixture.estado !== 'BORRADOR') {
        throw new BadRequestException(
          `No se puede publicar un fixture en estado ${fixture.estado}`,
        );
      }

      // Archivar versiones anteriores publicadas
      await this.prisma.fixtureVersion.updateMany({
        where: {
          tournamentId: fixture.tournamentId,
          categoryId: fixture.categoryId,
          estado: 'PUBLICADO',
        },
        data: { estado: 'ARCHIVADO', archivadoAt: new Date() },
      });

      // Publicar nueva versión
      await this.prisma.fixtureVersion.update({
        where: { id: fixtureVersionId },
        data: {
          estado: 'PUBLICADO',
          publicadoAt: new Date(),
        },
      });

      // Actualizar categoría
      await this.prisma.tournamentCategory.updateMany({
        where: {
          tournamentId: fixture.tournamentId,
          categoryId: fixture.categoryId,
        },
        data: {
          estado: 'SORTEO_REALIZADO',
        },
      });

      return {
        success: true,
        message: 'Bracket publicado exitosamente',
      };
    } catch (error: any) {
      console.error('[publicarBracket] Error:', error);
      throw new BadRequestException({
        success: false,
        message: error.message || 'Error publicando bracket',
      });
    }
  }

  /**
   * POST /admin/bracket/:fixtureVersionId/sortear-nuevo
   * Realiza un nuevo sorteo y reemplaza el borrador actual
   */
  @Post('bracket/:fixtureVersionId/sortear-nuevo')
  async reSortearBracket(@Param('fixtureVersionId') fixtureVersionId: string) {
    try {
      const fixture = await this.prisma.fixtureVersion.findUnique({
        where: { id: fixtureVersionId },
        select: {
          tournamentId: true,
          categoryId: true,
          estado: true,
        },
      });

      if (!fixture) {
        throw new NotFoundException('Fixture no encontrado');
      }

      if (fixture.estado === 'PUBLICADO') {
        throw new BadRequestException(
          'No se puede re-sortear un bracket ya publicado',
        );
      }

      // Encontrar la categoría
      const categoria = await this.prisma.tournamentCategory.findFirst({
        where: {
          tournamentId: fixture.tournamentId,
          categoryId: fixture.categoryId,
        },
      });

      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada');
      }

      // Eliminar los partidos actuales
      await this.prisma.match.deleteMany({
        where: { fixtureVersionId },
      });

      // Eliminar el fixture
      await this.prisma.fixtureVersion.delete({
        where: { id: fixtureVersionId },
      });

      // Generar nuevo sorteo
      return this.sortearBracket(categoria.id, { guardar: true });
    } catch (error: any) {
      console.error('[reSortearBracket] Error:', error);
      throw new BadRequestException({
        success: false,
        message: error.message || 'Error re-sorteando bracket',
      });
    }
  }
}
