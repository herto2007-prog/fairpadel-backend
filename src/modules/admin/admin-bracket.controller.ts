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
   * POST /admin/categorias/:id/cerrar-inscripciones
   * Cierra las inscripciones para una categoría específica
   */
  @Post('categorias/:id/cerrar-inscripciones')
  async cerrarInscripciones(@Param('id') tournamentCategoryId: string) {
    try {
      const categoria = await this.prisma.tournamentCategory.findUnique({
        where: { id: tournamentCategoryId },
        include: { category: true },
      });

      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada');
      }

      if (categoria.estado !== 'INSCRIPCIONES_ABIERTAS') {
        return {
          success: false,
          message: `Las inscripciones ya están cerradas o el sorteo ya fue realizado. Estado actual: ${categoria.estado}`,
          estado: categoria.estado,
        };
      }

      // Contar inscripciones confirmadas
      const inscripcionesCount = await this.prisma.inscripcion.count({
        where: {
          tournamentId: categoria.tournamentId,
          categoryId: categoria.categoryId,
          estado: {
            in: ['CONFIRMADA', 'PENDIENTE_PAGO'],
          },
        },
      });

      const MINIMO_PARA_SORTEAR = 8;
      
      // Actualizar estado
      await this.prisma.tournamentCategory.update({
        where: { id: tournamentCategoryId },
        data: {
          estado: 'INSCRIPCIONES_CERRADAS',
          inscripcionAbierta: false,
        },
      });

      return {
        success: true,
        message: `Inscripciones cerradas para ${categoria.category.nombre}`,
        estado: 'INSCRIPCIONES_CERRADAS',
        totalInscripciones: inscripcionesCount,
        puedeSortear: inscripcionesCount >= MINIMO_PARA_SORTEAR,
        minimoRequerido: MINIMO_PARA_SORTEAR,
      };
    } catch (error: any) {
      console.error('[cerrarInscripciones] Error:', error);
      throw new BadRequestException({
        success: false,
        message: error.message || 'Error cerrando inscripciones',
      });
    }
  }

  /**
   * POST /admin/categorias/:id/abrir-inscripciones
   * Reabre las inscripciones para una categoría (solo si no hay sorteo aún)
   */
  @Post('categorias/:id/abrir-inscripciones')
  async abrirInscripciones(@Param('id') tournamentCategoryId: string) {
    try {
      const categoria = await this.prisma.tournamentCategory.findUnique({
        where: { id: tournamentCategoryId },
        include: { category: true },
      });

      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada');
      }

      // Solo se puede reabrir si está cerrada pero sin sorteo
      if (categoria.estado !== 'INSCRIPCIONES_CERRADAS') {
        return {
          success: false,
          message: `No se pueden reabrir inscripciones en estado ${categoria.estado}. Solo se puede reabrir si están cerradas pero sin sorteo.`,
          estado: categoria.estado,
        };
      }

      await this.prisma.tournamentCategory.update({
        where: { id: tournamentCategoryId },
        data: {
          estado: 'INSCRIPCIONES_ABIERTAS',
          inscripcionAbierta: true,
        },
      });

      return {
        success: true,
        message: `Inscripciones reabiertas para ${categoria.category.nombre}`,
        estado: 'INSCRIPCIONES_ABIERTAS',
      };
    } catch (error: any) {
      console.error('[abrirInscripciones] Error:', error);
      throw new BadRequestException({
        success: false,
        message: error.message || 'Error abriendo inscripciones',
      });
    }
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

      // Validar mínimo de parejas (8 para poder sortear)
      const MINIMO_PARA_SORTEAR = 8;
      const puedeSortear = inscripciones.length >= MINIMO_PARA_SORTEAR;
      const inscripcionesCerradas = categoria.estado !== 'INSCRIPCIONES_ABIERTAS';
      
      if (inscripciones.length < 3) {
        return {
          success: false,
          message: `Se necesitan al menos 3 parejas para generar bracket. Actual: ${inscripciones.length}`,
          puedeGenerar: false,
          puedeSortear: false,
          estado: categoria.estado,
          inscripcionesCerradas,
          totalInscripciones: inscripciones.length,
        };
      }

      const config = this.bracketService.calcularConfiguracion(
        inscripciones.length,
      );

      return {
        success: true,
        puedeGenerar: true,
        puedeSortear,
        estado: categoria.estado,
        inscripcionesCerradas,
        minimoRequerido: MINIMO_PARA_SORTEAR,
        config,
        inscripciones: inscripciones.map((i) => ({
          id: i.id,
          jugador1: i.jugador1,
          jugador2: i.jugador2,
        })),
        totalInscripciones: inscripciones.length,
        faltanParaMinimo: Math.max(0, MINIMO_PARA_SORTEAR - inscripciones.length),
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
    @Body() body?: { guardar?: boolean; ordenInscripciones?: string[]; usarSemillas?: boolean },
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

      // Validar mínimo de parejas (8 para sortear)
      const MINIMO_PARA_SORTEAR = 8;
      if (inscripciones.length < MINIMO_PARA_SORTEAR) {
        throw new BadRequestException(
          `Se necesitan al menos ${MINIMO_PARA_SORTEAR} parejas para sortear. Actual: ${inscripciones.length}`,
        );
      }

      // Validar que las inscripciones estén cerradas
      if (categoria.estado === 'INSCRIPCIONES_ABIERTAS') {
        throw new BadRequestException(
          'Las inscripciones deben estar cerradas antes de sortear. Use el endpoint de cerrar inscripciones primero.',
        );
      }

      // Validar que no haya un sorteo ya publicado
      if (categoria.estado === 'SORTEO_REALIZADO' && body?.guardar) {
        throw new BadRequestException(
          'El sorteo ya fue realizado y publicado. Use "sortear-nuevo" para regenerar.',
        );
      }

      // Determinar método de sorteo
      const usarSemillas = body?.usarSemillas ?? false;
      
      let ordenSorteo: string[];
      
      if (body?.ordenInscripciones) {
        // Usar orden proporcionado manualmente
        ordenSorteo = body.ordenInscripciones;
      } else if (usarSemillas) {
        // Sorteo con semillas basado en ranking
        ordenSorteo = await this.realizarSorteoConSemillas(inscripciones, categoria);
      } else {
        // Sorteo aleatorio puro
        ordenSorteo = [...inscripciones].sort(() => Math.random() - 0.5).map(i => i.id);
      }

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

  /**
   * Realiza sorteo con semillas basado en ranking del circuito
   * Las parejas se ordenan por ranking y se distribuyen en el bracket
   * para evitar que los mejores se encuentren antes de las finales
   */
  private async realizarSorteoConSemillas(
    inscripciones: any[],
    categoria: any,
  ): Promise<string[]> {
    // Obtener rankings de los jugadores para esta categoría
    const jugadorIds = [...new Set(inscripciones.flatMap(i => [i.jugador1Id, i.jugador2Id].filter(Boolean)))];
    
    // Consultar rankings de tipo CATEGORIA para esta categoría específica
    const rankings = await this.prisma.ranking.findMany({
      where: {
        jugadorId: { in: jugadorIds },
        tipoRanking: 'CATEGORIA',
        alcance: categoria.categoryId,
        temporada: new Date().getFullYear().toString(),
      },
    });

    // Crear mapa de rankings por jugador
    const rankingMap = new Map(rankings.map(r => [r.jugadorId, r]));

    // Calcular semilla para cada pareja
    // La semilla se calcula sumando la posición inversa de ambos jugadores
    // (menor número = mejor semilla)
    const parejasConSemilla = inscripciones.map(inscripcion => {
      const rankingJ1 = rankingMap.get(inscripcion.jugador1Id);
      const rankingJ2 = rankingMap.get(inscripcion.jugador2Id);
      
      // Calcular puntos de semilla (más alto = mejor)
      // Si no tiene ranking, asignar 0 puntos (será considerado como sin semilla)
      const puntosJ1 = rankingJ1 ? (1000 - rankingJ1.posicion) : 0;
      const puntosJ2 = rankingJ2 ? (1000 - rankingJ2.posicion) : 0;
      
      // La semilla es la suma de puntos de ambos jugadores
      // Si ambos tienen 0, se asigna -1 para identificar que no tienen semilla
      const semilla = (puntosJ1 === 0 && puntosJ2 === 0) ? -1 : (puntosJ1 + puntosJ2);
      
      return {
        inscripcionId: inscripcion.id,
        semilla,
        tieneRanking: semilla !== -1,
      };
    });

    // Separar parejas con y sin ranking
    const conRanking = parejasConSemilla.filter(p => p.tieneRanking).sort((a, b) => b.semilla - a.semilla);
    const sinRanking = parejasConSemilla.filter(p => !p.tieneRanking);

    // Mezclar las sin ranking aleatoriamente
    const sinRankingMezcladas = sinRanking.sort(() => Math.random() - 0.5);

    // Orden final: primero las con ranking (de mejor a peor), luego las sin ranking (aleatorio)
    const ordenFinal = [...conRanking, ...sinRankingMezcladas].map(p => p.inscripcionId);

    // Aplicar algoritmo de distribución de semillas
    // Esto asegura que las mejores parejas estén en posiciones opuestas del bracket
    return this.distribuirSemillasEnBracket(ordenFinal);
  }

  /**
   * Distribuye las semillas en el bracket para que los mejores
   * no se encuentren hasta las rondas finales
   * Algoritmo: posición 1, 2, luego distribuir el resto
   */
  private distribuirSemillasEnBracket(orden: string[]): string[] {
    if (orden.length <= 2) return orden;

    const resultado: string[] = new Array(orden.length);
    const mitad = Math.floor(orden.length / 2);

    // Cabeza de serie #1 va a posición 0
    resultado[0] = orden[0];
    // Cabeza de serie #2 va a última posición
    resultado[orden.length - 1] = orden[1];

    // El resto se distribuye alternando entre primera y segunda mitad
    let idxIzquierda = 1;
    let idxDerecha = orden.length - 2;

    for (let i = 2; i < orden.length; i++) {
      if (i % 2 === 0) {
        // Par: poner en mitad izquierda
        resultado[idxIzquierda++] = orden[i];
      } else {
        // Impar: poner en mitad derecha
        resultado[idxDerecha--] = orden[i];
      }
    }

    return resultado;
  }
}
