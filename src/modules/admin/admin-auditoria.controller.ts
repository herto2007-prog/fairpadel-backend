import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InscripcionEstado, MatchStatus } from '@prisma/client';

// Enums para filtros
enum PartidoFase {
  ZONA = 'ZONA',
  REPECHAJE = 'REPECHAJE',
  TREINTAYDOSAVOS = 'TREINTAYDOSAVOS',
  DIECISEISAVOS = 'DIECISEISAVOS',
  OCTAVOS = 'OCTAVOS',
  CUARTOS = 'CUARTOS',
  SEMIS = 'SEMIS',
  FINAL = 'FINAL',
}

// DTOs para query params
class FiltrosInscripcionesDto {
  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsEnum(InscripcionEstado)
  estado?: InscripcionEstado;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  sinPareja?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  sinSlot?: boolean;
}

class FiltrosPartidosDto {
  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsEnum(PartidoFase)
  fase?: PartidoFase;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  sinProgramar?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  finalizados?: boolean;
}

class FiltrosSlotsDto {
  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  soloOcupados?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  soloLibres?: boolean;

  @IsOptional()
  @IsString()
  canchaId?: string;
}

@Controller('admin/auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene todas las inscripciones de un torneo con información enriquecida
   */
  @Get('torneos/:id/inscripciones')
  async getInscripciones(
    @Param('id') torneoId: string,
    @Query() filtros: FiltrosInscripcionesDto,
  ) {
    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Construir where clause
    const where: any = { tournamentId: torneoId };

    if (filtros.estado) {
      where.estado = filtros.estado;
    }

    if (filtros.categoriaId) {
      where.categoryId = filtros.categoriaId;
    }

    if (filtros.sinPareja) {
      where.jugador2Id = null;
    }

    // Buscar inscripciones con toda la info relacionada
    const inscripciones = await this.prisma.inscripcion.findMany({
      where,
      include: {
        jugador1: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            categoriaActual: {
              select: {
                nombre: true,
              },
            },
            fotoUrl: true,
          },
        },
        jugador2: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            categoriaActual: {
              select: {
                nombre: true,
              },
            },
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
        pagos: {
          select: {
            id: true,
            monto: true,
            estado: true,
            metodoPago: true,
            fechaPago: true,
          },
        },
        partidosComoP1: {
          where: {
            torneoCanchaId: { not: null },
          },
          select: {
            id: true,
            ronda: true,
            fechaProgramada: true,
            horaProgramada: true,
            torneoCancha: {
              select: {
                sedeCancha: {
                  select: {
                    nombre: true,
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
        },
        partidosComoP2: {
          where: {
            torneoCanchaId: { not: null },
          },
          select: {
            id: true,
            ronda: true,
            fechaProgramada: true,
            horaProgramada: true,
            torneoCancha: {
              select: {
                sedeCancha: {
                  select: {
                    nombre: true,
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
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transformar datos para mostrar nombres en lugar de IDs
    let resultado = inscripciones.map((insc) => {
      const partidos = [...insc.partidosComoP1, ...insc.partidosComoP2];
      
      return {
        id: insc.id,
        estado: insc.estado,
        modoPago: insc.modoPago,
        notas: insc.notas,
        createdAt: insc.createdAt,
        estadoClasificacion: insc.estadoClasificacion,
        rondaClasificacion: insc.rondaClasificacion,
        pareja: {
          jugador1: insc.jugador1
            ? `${insc.jugador1.nombre} ${insc.jugador1.apellido}`
            : 'N/A',
          jugador1Categoria: insc.jugador1?.categoriaActual?.nombre || 'N/A',
          jugador2: insc.jugador2
            ? `${insc.jugador2.nombre} ${insc.jugador2.apellido}`
            : '(Pendiente)',
          jugador2Categoria: insc.jugador2?.categoriaActual?.nombre || 'N/A',
          telefonoJ1: insc.jugador1?.telefono,
          telefonoJ2: insc.jugador2?.telefono,
          completa: !!insc.jugador2,
        },
        categoria: {
          id: insc.category.id,
          nombre: insc.category.nombre,
          genero: insc.category.tipo,
        },
        pagos: insc.pagos.map((p) => ({
          id: p.id,
          estado: p.estado,
          monto: p.monto,
          metodo: p.metodoPago,
          fecha: p.fechaPago,
        })),
        programacion: partidos.map((p) => ({
          fase: p.ronda,
          fecha: p.fechaProgramada,
          hora: p.horaProgramada,
          cancha: p.torneoCancha?.sedeCancha?.nombre,
          sede: p.torneoCancha?.sedeCancha?.sede?.nombre,
        })),
        tieneSlotAsignado: partidos.length > 0,
      };
    });

    // Filtro de búsqueda por nombre
    if (filtros.busqueda) {
      const busqueda = filtros.busqueda.toLowerCase();
      resultado = resultado.filter(
        (r) =>
          r.pareja.jugador1.toLowerCase().includes(busqueda) ||
          r.pareja.jugador2.toLowerCase().includes(busqueda) ||
          r.categoria.nombre.toLowerCase().includes(busqueda),
      );
    }

    // Filtro de sin slot
    if (filtros.sinSlot) {
      resultado = resultado.filter((r) => !r.tieneSlotAsignado);
    }

    return {
      success: true,
      data: resultado,
      total: resultado.length,
    };
  }

  /**
   * Obtiene todos los partidos/matches de un torneo con información completa
   */
  @Get('torneos/:id/partidos')
  async getPartidos(
    @Param('id') torneoId: string,
    @Query() filtros: FiltrosPartidosDto,
  ) {
    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Construir where clause
    const where: any = {
      tournamentId: torneoId,
      esBye: false, // Excluir BYEs para no contaminar la vista
    };

    if (filtros.categoriaId) {
      where.categoryId = filtros.categoriaId;
    }

    if (filtros.fase) {
      where.ronda = filtros.fase;
    }

    if (filtros.finalizados !== undefined) {
      where.estado = filtros.finalizados ? MatchStatus.FINALIZADO : MatchStatus.PROGRAMADO;
    }

    if (filtros.sinProgramar) {
      where.torneoCanchaId = null;
    }

    const partidos = await this.prisma.match.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
          },
        },
        inscripcion1: {
          include: {
            jugador1: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
            jugador2: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        inscripcion2: {
          include: {
            jugador1: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
            jugador2: {
              select: {
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
        inscripcionGanadora: {
          include: {
            jugador1: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
            jugador2: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
      orderBy: [
        { categoryId: 'asc' },
        { numeroRonda: 'asc' },
        { fechaProgramada: 'asc' },
        { horaProgramada: 'asc' },
      ],
    });

    // Transformar datos
    let resultado = partidos.map((p) => {
      const pareja1 = p.inscripcion1
        ? `${p.inscripcion1.jugador1?.nombre || ''} ${
            p.inscripcion1.jugador1?.apellido || ''
          } / ${p.inscripcion1.jugador2?.nombre || ''} ${
            p.inscripcion1.jugador2?.apellido || ''
          }`
        : 'Por definir';

      const pareja2 = p.inscripcion2
        ? `${p.inscripcion2.jugador1?.nombre || ''} ${
            p.inscripcion2.jugador1?.apellido || ''
          } / ${p.inscripcion2.jugador2?.nombre || ''} ${
            p.inscripcion2.jugador2?.apellido || ''
          }`
        : 'Por definir';

      const parejaGanadora = p.inscripcionGanadora
        ? `${p.inscripcionGanadora.jugador1?.nombre || ''} ${
            p.inscripcionGanadora.jugador1?.apellido || ''
          } / ${p.inscripcionGanadora.jugador2?.nombre || ''} ${
            p.inscripcionGanadora.jugador2?.apellido || ''
          }`
        : null;

      return {
        id: p.id,
        fase: p.ronda,
        numeroRonda: p.numeroRonda,
        estado: p.estado,
        categoria: {
          id: p.category.id,
          nombre: p.category.nombre,
          genero: p.category.tipo,
        },
        pareja1,
        pareja2,
        parejaGanadora,
        programacion: p.torneoCancha
          ? {
              fecha: p.fechaProgramada,
              hora: p.horaProgramada,
              cancha: p.torneoCancha.sedeCancha?.nombre,
              sede: p.torneoCancha.sedeCancha?.sede?.nombre,
            }
          : null,
        estaProgramado: !!p.torneoCanchaId,
        resultado: p.set1Pareja1 !== null
          ? {
              set1: `${p.set1Pareja1}-${p.set1Pareja2}`,
              set2: p.set2Pareja1 !== null ? `${p.set2Pareja1}-${p.set2Pareja2}` : null,
              set3: p.set3Pareja1 !== null ? `${p.set3Pareja1}-${p.set3Pareja2}` : null,
              ganador: parejaGanadora,
            }
          : null,
        esBye: p.esBye,
        tipoEntrada1: p.tipoEntrada1,
        tipoEntrada2: p.tipoEntrada2,
        createdAt: p.createdAt,
      };
    });

    // Filtro de búsqueda
    if (filtros.busqueda) {
      const busqueda = filtros.busqueda.toLowerCase();
      resultado = resultado.filter(
        (r) =>
          r.pareja1.toLowerCase().includes(busqueda) ||
          r.pareja2.toLowerCase().includes(busqueda),
      );
    }

    return {
      success: true,
      data: resultado,
      total: resultado.length,
    };
  }

  /**
   * Obtiene todos los slots configurados para un torneo
   */
  @Get('torneos/:id/slots')
  async getSlots(
    @Param('id') torneoId: string,
    @Query() filtros: FiltrosSlotsDto,
  ) {
    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Obtener días configurados
    const dias = await this.prisma.torneoDisponibilidadDia.findMany({
      where: { tournamentId: torneoId },
      orderBy: {
        fecha: 'asc',
      },
    });

    // Obtener todos los slots con su información
    const resultado = await Promise.all(
      dias.map(async (dia) => {
        const whereSlots: any = {
          disponibilidadId: dia.id,
        };

        if (filtros.canchaId) {
          whereSlots.torneoCanchaId = filtros.canchaId;
        }

        if (filtros.soloOcupados) {
          whereSlots.estado = 'OCUPADO';
        }

        if (filtros.soloLibres) {
          whereSlots.estado = 'LIBRE';
        }

        const slots = await this.prisma.torneoSlot.findMany({
          where: whereSlots,
          include: {
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
            match: {
              include: {
                category: {
                  select: {
                    nombre: true,
                  },
                },
                inscripcion1: {
                  include: {
                    jugador1: {
                      select: {
                        nombre: true,
                        apellido: true,
                      },
                    },
                    jugador2: {
                      select: {
                        nombre: true,
                        apellido: true,
                      },
                    },
                  },
                },
                inscripcion2: {
                  include: {
                    jugador1: {
                      select: {
                        nombre: true,
                        apellido: true,
                      },
                    },
                    jugador2: {
                      select: {
                        nombre: true,
                        apellido: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            { horaInicio: 'asc' },
          ],
        });

        return {
          fecha: dia.fecha,
          horaInicio: dia.horaInicio,
          horaFin: dia.horaFin,
          minutosSlot: dia.minutosSlot,
          fasesPermitidas: dia.fasesPermitidas,
          slots: slots.map((slot) => ({
            id: slot.id,
            horaInicio: slot.horaInicio,
            horaFin: slot.horaFin,
            estado: slot.estado,
            fase: slot.fase,
            cancha: slot.torneoCancha
              ? {
                  id: slot.torneoCancha.id,
                  nombre: slot.torneoCancha.sedeCancha?.nombre || 'Cancha',
                  sede: slot.torneoCancha.sedeCancha?.sede?.nombre,
                }
              : null,
            ocupadoPor: slot.match
              ? {
                  partidoId: slot.match.id,
                  fase: slot.match.ronda,
                  categoria: slot.match.category?.nombre,
                  pareja1: slot.match.inscripcion1
                    ? `${slot.match.inscripcion1.jugador1?.nombre || ''} ${
                        slot.match.inscripcion1.jugador1?.apellido || ''
                      } / ${slot.match.inscripcion1.jugador2?.nombre || ''} ${
                        slot.match.inscripcion1.jugador2?.apellido || ''
                      }`
                    : 'Por definir',
                  pareja2: slot.match.inscripcion2
                    ? `${slot.match.inscripcion2.jugador1?.nombre || ''} ${
                        slot.match.inscripcion2.jugador1?.apellido || ''
                      } / ${slot.match.inscripcion2.jugador2?.nombre || ''} ${
                        slot.match.inscripcion2.jugador2?.apellido || ''
                      }`
                    : 'Por definir',
                }
              : null,
          })),
        };
      }),
    );

    // Filtrar por fecha si se especificó
    let data = resultado;
    if (filtros.fecha) {
      data = resultado.filter((d) => d.fecha === filtros.fecha);
    }

    // Calcular estadísticas
    const totalSlots = data.reduce((acc, dia) => acc + dia.slots.length, 0);
    const ocupados = data.reduce(
      (acc, dia) => acc + dia.slots.filter((s) => s.estado === 'OCUPADO').length,
      0,
    );
    const libres = totalSlots - ocupados;

    return {
      success: true,
      data,
      stats: {
        total: totalSlots,
        ocupados,
        libres,
        porcentajeOcupacion: totalSlots > 0 ? Math.round((ocupados / totalSlots) * 100) : 0,
      },
    };
  }

  /**
   * Resumen general del torneo para auditoría
   */
  @Get('torneos/:id/resumen')
  async getResumen(@Param('id') torneoId: string) {
    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: {
        categorias: {
          include: {
            category: {
              select: {
                id: true,
                nombre: true,
                tipo: true,
              },
            },
          },
        },
        disponibilidadDias: {
          include: {
            _count: {
              select: {
                slots: true,
              },
            },
          },
        },
        _count: {
          select: {
            inscripciones: true,
            partidos: true,
          },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Contar slots ocupados
    const slotsOcupados = await this.prisma.torneoSlot.count({
      where: {
        disponibilidad: {
          tournamentId: torneoId,
        },
        estado: 'OCUPADO',
      },
    });

    // Contar partidos finalizados
    const partidosFinalizados = await this.prisma.match.count({
      where: {
        tournamentId: torneoId,
        estado: MatchStatus.FINALIZADO,
      },
    });

    // Contar inscripciones por estado
    const inscripcionesPorEstado = await this.prisma.inscripcion.groupBy({
      by: ['estado'],
      where: { tournamentId: torneoId },
      _count: {
        estado: true,
      },
    });

    return {
      success: true,
      data: {
        torneo: {
          id: torneo.id,
          nombre: torneo.nombre,
          estado: torneo.estado,
          fechaInicio: torneo.fechaInicio,
          fechaFin: torneo.fechaFin,
          fechaFinales: torneo.fechaFinales,
        },
        estadisticas: {
          totalInscripciones: torneo._count.inscripciones,
          totalPartidos: torneo._count.partidos,
          totalCategorias: torneo.categorias.length,
          diasConfigurados: torneo.disponibilidadDias.length,
          totalSlots: torneo.disponibilidadDias.reduce(
            (acc, d) => acc + d._count.slots,
            0,
          ),
          slotsOcupados,
          partidosFinalizados,
          inscripcionesPorEstado: inscripcionesPorEstado.reduce(
            (acc, item) => {
              acc[item.estado] = item._count.estado;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
        categorias: torneo.categorias.map((cat) => ({
          id: cat.id,
          nombre: cat.category.nombre,
          estado: cat.estado,
          inscripcionesAbiertas: cat.inscripcionAbierta,
        })),
      },
    };
  }
}
