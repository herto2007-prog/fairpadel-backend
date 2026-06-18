import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsOptional, IsEnum, IsNumber, IsInt, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InscripcionEstado, MatchStatus, MetodoPago, PagoEstado } from '@prisma/client';
import {
  mapInscripcionAuditoria,
  filtrarInscripcionesAuditoria,
  mapPartidoAuditoria,
  filtrarPartidosAuditoria,
  mapSlotAuditoria,
  calcularStatsSlots,
} from './admin-auditoria.mappers';

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

// DTO para cambiar estado de inscripción (emergencia)
class CambiarEstadoInscripcionDto {
  @IsEnum(InscripcionEstado)
  estado: InscripcionEstado;
}

// DTO para asignar cancha a partido
class AsignarCanchaDto {
  @IsString()
  torneoCanchaId: string;

  @IsOptional()
  @IsString()
  fecha?: string; // Opcional: si se quiere cambiar la fecha

  @IsOptional()
  @IsString()
  hora?: string; // Opcional: si se quiere cambiar la hora
}

// DTO para corregir las parejas de un partido (god-panel). null = vaciar el lado.
class CorregirParejasDto {
  @IsOptional()
  @IsString()
  inscripcion1Id?: string | null;

  @IsOptional()
  @IsString()
  inscripcion2Id?: string | null;
}

// DTO para reprogramar un partido puntual (fecha/hora/cancha). Todo opcional.
class ReprogramarPartidoDto {
  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsString()
  hora?: string;

  @IsOptional()
  @IsString()
  torneoCanchaId?: string | null; // null = sacar la cancha
}

// DTO para mover una inscripción a otra categoría del mismo torneo
class MoverCategoriaDto {
  @IsString()
  categoryId: string;
}

// DTO para corregir/completar la pareja de una inscripción
class CorregirParejaDto {
  @IsOptional()
  @IsString()
  jugador1Id?: string;

  @IsOptional()
  @IsString()
  jugador2Id?: string | null; // null = dejar pendiente (sin pareja)

  @IsOptional()
  @IsString()
  jugador2Documento?: string;
}

// DTO para editar datos de un jugador (afecta al usuario en toda la app)
class EditarJugadorDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  documento?: string;
}

// DTO para crear un pago de inscripción
class CrearPagoDto {
  @IsNumber()
  monto: number;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsOptional()
  @IsEnum(PagoEstado)
  estado?: PagoEstado;

  @IsOptional()
  @IsString()
  fechaPago?: string;
}

// DTO para editar un pago de inscripción (todo opcional)
class EditarPagoDto {
  @IsOptional()
  @IsNumber()
  monto?: number;

  @IsOptional()
  @IsEnum(MetodoPago)
  metodoPago?: MetodoPago;

  @IsOptional()
  @IsEnum(PagoEstado)
  estado?: PagoEstado;

  @IsOptional()
  @IsString()
  fechaPago?: string;
}

// DTO para ajustar la comisión del torneo (todo opcional)
class AjustarComisionDto {
  @IsOptional()
  @IsInt()
  montoEstimado?: number;

  @IsOptional()
  @IsInt()
  montoPagado?: number;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsBoolean()
  bloqueoActivo?: boolean;
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
            documento: true,
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
            documento: true,
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
    let resultado = inscripciones.map(mapInscripcionAuditoria);

    resultado = filtrarInscripcionesAuditoria(resultado, filtros);

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
    let resultado = partidos.map(mapPartidoAuditoria);

    resultado = filtrarPartidosAuditoria(resultado, filtros);

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
          slots: slots.map(mapSlotAuditoria),
        };
      }),
    );

    // Filtrar por fecha si se especificó
    let data = resultado;
    if (filtros.fecha) {
      data = resultado.filter((d) => d.fecha === filtros.fecha);
    }

    // Calcular estadísticas
    const stats = calcularStatsSlots(data);

    return {
      success: true,
      data,
      stats,
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

  /**
   * PUT /admin/auditoria/partidos/:id/asignar-cancha
   * Asigna una cancha a un partido que quedó sin cancha después del sorteo
   */
  @Put('partidos/:id/asignar-cancha')
  async asignarCanchaAPartido(
    @Param('id') partidoId: string,
    @Body() dto: AsignarCanchaDto,
  ) {
    // Verificar que el partido existe
    const partido = await this.prisma.match.findUnique({
      where: { id: partidoId },
      include: {
        category: {
          select: { nombre: true },
        },
        inscripcion1: {
          include: {
            jugador1: { select: { nombre: true, apellido: true } },
            jugador2: { select: { nombre: true, apellido: true } },
          },
        },
        inscripcion2: {
          include: {
            jugador1: { select: { nombre: true, apellido: true } },
            jugador2: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });

    if (!partido) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Verificar que la cancha existe
    const cancha = await this.prisma.torneoCancha.findUnique({
      where: { id: dto.torneoCanchaId },
      include: {
        sedeCancha: {
          include: {
            sede: { select: { nombre: true } },
          },
        },
      },
    });

    if (!cancha) {
      throw new NotFoundException('Cancha no encontrada');
    }

    // Determinar fecha y hora a usar
    const fecha = dto.fecha || partido.fechaProgramada;
    const hora = dto.hora || partido.horaProgramada;

    if (!fecha || !hora) {
      throw new BadRequestException('El partido no tiene fecha/hora programada. Debe especificar fecha y hora.');
    }

    // Actualizar el partido con la cancha asignada
    await this.prisma.match.update({
      where: { id: partidoId },
      data: {
        torneoCanchaId: dto.torneoCanchaId,
        fechaProgramada: fecha,
        horaProgramada: hora,
      },
    });

    return {
      success: true,
      message: 'Cancha asignada correctamente',
      data: {
        partidoId,
        pareja1: partido.inscripcion1 
          ? `${partido.inscripcion1.jugador1?.nombre} ${partido.inscripcion1.jugador1?.apellido} / ${partido.inscripcion1.jugador2?.nombre} ${partido.inscripcion1.jugador2?.apellido}`
          : 'Por definir',
        pareja2: partido.inscripcion2
          ? `${partido.inscripcion2.jugador1?.nombre} ${partido.inscripcion2.jugador1?.apellido} / ${partido.inscripcion2.jugador2?.nombre} ${partido.inscripcion2.jugador2?.apellido}`
          : 'Por definir',
        programacion: {
          fecha,
          hora,
          cancha: cancha.sedeCancha?.nombre || 'Cancha',
          sede: cancha.sedeCancha?.sede?.nombre || '',
        },
      },
    };
  }

  /**
   * PUT /admin/auditoria/partidos/:id/corregir-parejas
   * God-panel: corrige QUIÉN juega un partido (cambia las inscripciones de los lados).
   * SEGURO: solo si el partido no tiene resultado (no finalizado y sin ganador), para
   * no corromper el cuadro. Cada inscripción debe ser del mismo torneo y categoría.
   */
  @Put('partidos/:id/corregir-parejas')
  async corregirParejas(
    @Param('id') partidoId: string,
    @Body() dto: CorregirParejasDto,
  ) {
    const partido = await this.prisma.match.findUnique({
      where: { id: partidoId },
      select: {
        id: true, tournamentId: true, categoryId: true, estado: true,
        inscripcionGanadoraId: true, esBye: true,
      },
    });
    if (!partido) {
      throw new NotFoundException('Partido no encontrado');
    }

    const estadosConResultado: MatchStatus[] = [
      MatchStatus.FINALIZADO, MatchStatus.WO, MatchStatus.RETIRADO, MatchStatus.DESCALIFICADO,
    ];
    if (estadosConResultado.includes(partido.estado) || partido.inscripcionGanadoraId) {
      throw new BadRequestException(
        'El partido ya tiene resultado. Limpiá el resultado antes de cambiar las parejas (para no corromper el cuadro).',
      );
    }

    const ins1 = dto.inscripcion1Id ?? null;
    const ins2 = dto.inscripcion2Id ?? null;

    if (ins1 && ins2 && ins1 === ins2) {
      throw new BadRequestException('No podés poner la misma pareja en los dos lados.');
    }

    // Validar que cada inscripción pertenece a este torneo + categoría
    for (const insId of [ins1, ins2].filter(Boolean) as string[]) {
      const insc = await this.prisma.inscripcion.findUnique({
        where: { id: insId },
        select: { id: true, tournamentId: true, categoryId: true },
      });
      if (!insc) {
        throw new BadRequestException(`La inscripción ${insId} no existe.`);
      }
      if (insc.tournamentId !== partido.tournamentId || insc.categoryId !== partido.categoryId) {
        throw new BadRequestException('Esa pareja no es de este torneo/categoría.');
      }
    }

    await this.prisma.match.update({
      where: { id: partidoId },
      data: { inscripcion1Id: ins1, inscripcion2Id: ins2 },
    });

    return { success: true, message: 'Parejas del partido actualizadas' };
  }

  /**
   * PUT /admin/auditoria/partidos/:id/reprogramar
   * God-panel: cambia fecha/hora/cancha de un partido puntual. Todo opcional;
   * torneoCanchaId=null saca la cancha. No toca resultados ni el cuadro.
   */
  @Put('partidos/:id/reprogramar')
  async reprogramarPartido(
    @Param('id') partidoId: string,
    @Body() dto: ReprogramarPartidoDto,
  ) {
    const partido = await this.prisma.match.findUnique({
      where: { id: partidoId },
      select: { id: true },
    });
    if (!partido) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (dto.torneoCanchaId) {
      const cancha = await this.prisma.torneoCancha.findUnique({
        where: { id: dto.torneoCanchaId },
        select: { id: true },
      });
      if (!cancha) {
        throw new NotFoundException('Cancha no encontrada');
      }
    }

    await this.prisma.match.update({
      where: { id: partidoId },
      data: {
        ...(dto.fecha !== undefined && { fechaProgramada: dto.fecha || null }),
        ...(dto.hora !== undefined && { horaProgramada: dto.hora || null }),
        ...(dto.torneoCanchaId !== undefined && { torneoCanchaId: dto.torneoCanchaId || null }),
      },
    });

    return { success: true, message: 'Partido reprogramado' };
  }

  /**
   * POST /admin/auditoria/partidos/:id/limpiar-resultado
   * God-panel A2/A3: revierte un partido a SIN resultado. Si rondas posteriores
   * ya se jugaron usando su ganador/perdedor, las limpia EN CASCADA y vacía los
   * casilleros que este partido había llenado — dejando el cuadro consistente.
   * Habilita "forzar editar aunque ya avanzó": limpiar y volver a cargar.
   */
  @Post('partidos/:id/limpiar-resultado')
  async limpiarResultado(@Param('id') partidoId: string) {
    const partido = await this.prisma.match.findUnique({
      where: { id: partidoId },
      select: { id: true, estado: true, inscripcionGanadoraId: true },
    });
    if (!partido) {
      throw new NotFoundException('Partido no encontrado');
    }
    if (!this.tieneResultado(partido.estado, partido.inscripcionGanadoraId)) {
      throw new BadRequestException('El partido no tiene resultado para limpiar.');
    }

    const partidosAfectados = await this.prisma.$transaction((tx) =>
      this.limpiarResultadoCascadaTx(tx, partidoId),
    );

    return { success: true, message: 'Resultado limpiado', partidosAfectados };
  }

  // ¿El partido tiene un resultado cargado?
  private tieneResultado(estado: MatchStatus, ganadorId: string | null): boolean {
    const conResultado: MatchStatus[] = [
      MatchStatus.FINALIZADO, MatchStatus.WO, MatchStatus.RETIRADO, MatchStatus.DESCALIFICADO,
    ];
    return conResultado.includes(estado) || !!ganadorId;
  }

  // Limpia el resultado de un partido y, recursivamente, el de las rondas que
  // dependían de él (las que tienen resultado), vaciando los casilleros llenados.
  // Devuelve cuántos partidos quedaron limpiados (incluye el propio).
  private async limpiarResultadoCascadaTx(tx: any, matchId: string): Promise<number> {
    const m = await tx.match.findUnique({
      where: { id: matchId },
      select: {
        id: true, estado: true, inscripcionGanadoraId: true,
        partidoSiguienteId: true, posicionEnSiguiente: true,
        partidoPerdedorSiguienteId: true, posicionEnPerdedor: true,
      },
    });
    if (!m || !this.tieneResultado(m.estado, m.inscripcionGanadoraId)) {
      return 0;
    }

    let count = 0;

    // Hacia adelante: ganador (y, en su caso, perdedor) — limpiar el destino si ya
    // tenía resultado y después vaciar SOLO el casillero que este partido había llenado.
    const adelante: { id: string | null; pos: number | null }[] = [
      { id: m.partidoSiguienteId, pos: m.posicionEnSiguiente },
      { id: m.partidoPerdedorSiguienteId, pos: m.posicionEnPerdedor },
    ];
    for (const dest of adelante) {
      if (!dest.id) continue;
      count += await this.limpiarResultadoCascadaTx(tx, dest.id);
      const pos = dest.pos || 1;
      await tx.match.update({
        where: { id: dest.id },
        data: pos === 1
          ? { inscripcion1Id: null, tipoEntrada1: null }
          : { inscripcion2Id: null, tipoEntrada2: null },
      });
    }

    // Limpiar el resultado propio (vuelve a PROGRAMADO, sin sets ni ganador)
    await tx.match.update({
      where: { id: matchId },
      data: {
        estado: MatchStatus.PROGRAMADO,
        set1Pareja1: null, set1Pareja2: null,
        set2Pareja1: null, set2Pareja2: null,
        set3Pareja1: null, set3Pareja2: null,
        inscripcionGanadoraId: null, inscripcionPerdedoraId: null,
        parejaRetirada: null, razonResultado: null,
        liveScore: null, duracionMinutos: null,
        horaInicioReal: null, horaFinReal: null,
      },
    });

    return count + 1;
  }

  /**
   * PATCH /admin/auditoria/inscripciones/:id/categoria
   * God-panel B: mueve una inscripción a otra categoría del mismo torneo.
   * SEGURO: bloquea si la pareja ya está en el cuadro (tiene partidos).
   */
  @Patch('inscripciones/:id/categoria')
  async moverCategoria(
    @Param('id') inscripcionId: string,
    @Body() dto: MoverCategoriaDto,
  ) {
    const insc = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      select: { id: true, tournamentId: true, categoryId: true },
    });
    if (!insc) {
      throw new NotFoundException('Inscripción no encontrada');
    }
    if (dto.categoryId === insc.categoryId) {
      return { success: true, message: 'Sin cambios' };
    }

    const enCuadro = await this.prisma.match.count({
      where: {
        tournamentId: insc.tournamentId,
        OR: [{ inscripcion1Id: inscripcionId }, { inscripcion2Id: inscripcionId }],
      },
    });
    if (enCuadro > 0) {
      throw new BadRequestException('La pareja ya está en el cuadro. Limpiá sus partidos antes de moverla de categoría.');
    }

    const tc = await this.prisma.tournamentCategory.findFirst({
      where: { tournamentId: insc.tournamentId, categoryId: dto.categoryId },
    });
    if (!tc) {
      throw new BadRequestException('Esa categoría no pertenece a este torneo.');
    }

    try {
      await this.prisma.inscripcion.update({
        where: { id: inscripcionId },
        data: { categoryId: dto.categoryId },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Ya existe una inscripción igual en esa categoría.');
      }
      throw error;
    }
    return { success: true, message: 'Inscripción movida de categoría' };
  }

  /**
   * PATCH /admin/auditoria/inscripciones/:id/pareja
   * God-panel B: corrige o completa la pareja (quién la integra). No corrompe el
   * cuadro: los partidos referencian la inscripción, no a los jugadores.
   */
  @Patch('inscripciones/:id/pareja')
  async corregirPareja(
    @Param('id') inscripcionId: string,
    @Body() dto: CorregirParejaDto,
  ) {
    const insc = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      select: { id: true },
    });
    if (!insc) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    const data: any = {};
    if (dto.jugador1Id) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.jugador1Id }, select: { id: true } });
      if (!u) throw new BadRequestException('El jugador 1 no existe.');
      data.jugador1Id = dto.jugador1Id;
    }
    if (dto.jugador2Id === null) {
      data.jugador2Id = null;
    } else if (dto.jugador2Id) {
      const u = await this.prisma.user.findUnique({ where: { id: dto.jugador2Id }, select: { id: true, documento: true } });
      if (!u) throw new BadRequestException('El jugador 2 no existe.');
      data.jugador2Id = dto.jugador2Id;
      data.jugador2Documento = dto.jugador2Documento || u.documento || '';
    } else if (dto.jugador2Documento !== undefined) {
      data.jugador2Documento = dto.jugador2Documento;
    }

    if (Object.keys(data).length === 0) {
      return { success: true, message: 'Sin cambios' };
    }

    try {
      await this.prisma.inscripcion.update({ where: { id: inscripcionId }, data });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Esa combinación de pareja ya existe en la categoría.');
      }
      throw error;
    }
    return { success: true, message: 'Pareja actualizada' };
  }

  /**
   * PATCH /admin/auditoria/jugadores/:id
   * God-panel B: edita datos de un jugador (nombre/apellido/teléfono/documento).
   * OJO: afecta al usuario en TODA la app, no solo en este torneo.
   */
  @Patch('jugadores/:id')
  async editarJugador(
    @Param('id') userId: string,
    @Body() dto: EditarJugadorDto,
  ) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!u) {
      throw new NotFoundException('Jugador no encontrado');
    }

    const data: any = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.apellido !== undefined) data.apellido = dto.apellido;
    if (dto.telefono !== undefined) data.telefono = dto.telefono;
    if (dto.documento !== undefined) data.documento = dto.documento || null;

    if (Object.keys(data).length === 0) {
      return { success: true, message: 'Sin cambios' };
    }

    try {
      await this.prisma.user.update({ where: { id: userId }, data });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Ese documento ya está en uso por otro jugador.');
      }
      throw error;
    }
    return { success: true, message: 'Datos del jugador actualizados' };
  }

  /**
   * POST /admin/auditoria/inscripciones/:id/pagos
   * God-panel C: agrega un pago a una inscripción (efectivo/transferencia/bancard).
   */
  @Post('inscripciones/:id/pagos')
  async agregarPago(
    @Param('id') inscripcionId: string,
    @Body() dto: CrearPagoDto,
  ) {
    const insc = await this.prisma.inscripcion.findUnique({ where: { id: inscripcionId }, select: { id: true } });
    if (!insc) {
      throw new NotFoundException('Inscripción no encontrada');
    }
    const pago = await this.prisma.pago.create({
      data: {
        inscripcionId,
        monto: dto.monto,
        comision: 0,
        metodoPago: dto.metodoPago,
        estado: dto.estado || PagoEstado.PENDIENTE,
        fechaPago: dto.fechaPago || null,
      },
    });
    return { success: true, message: 'Pago agregado', pago };
  }

  /**
   * PATCH /admin/auditoria/pagos/:id
   * God-panel C: edita un pago (marcar confirmado/pendiente, monto, método, fecha).
   */
  @Patch('pagos/:id')
  async editarPago(
    @Param('id') pagoId: string,
    @Body() dto: EditarPagoDto,
  ) {
    const pago = await this.prisma.pago.findUnique({ where: { id: pagoId }, select: { id: true } });
    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }
    const data: any = {};
    if (dto.monto !== undefined) data.monto = dto.monto;
    if (dto.metodoPago !== undefined) data.metodoPago = dto.metodoPago;
    if (dto.estado !== undefined) data.estado = dto.estado;
    if (dto.fechaPago !== undefined) data.fechaPago = dto.fechaPago || null;
    if (Object.keys(data).length === 0) {
      return { success: true, message: 'Sin cambios' };
    }
    await this.prisma.pago.update({ where: { id: pagoId }, data });
    return { success: true, message: 'Pago actualizado' };
  }

  /**
   * DELETE /admin/auditoria/pagos/:id
   * God-panel C: elimina un pago de una inscripción.
   */
  @Delete('pagos/:id')
  async eliminarPago(@Param('id') pagoId: string) {
    const pago = await this.prisma.pago.findUnique({ where: { id: pagoId }, select: { id: true } });
    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }
    await this.prisma.pago.delete({ where: { id: pagoId } });
    return { success: true, message: 'Pago eliminado' };
  }

  /**
   * GET /admin/auditoria/torneos/:id/comision
   * God-panel C: lee la comisión del torneo (devuelve defaults si no existe).
   */
  @Get('torneos/:id/comision')
  async getComision(@Param('id') torneoId: string) {
    const torneo = await this.prisma.tournament.findUnique({ where: { id: torneoId }, select: { id: true } });
    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }
    const comision = await this.prisma.torneoComision.findUnique({ where: { tournamentId: torneoId } });
    return {
      success: true,
      comision: comision || { tournamentId: torneoId, montoEstimado: 0, montoPagado: 0, estado: 'PENDIENTE', bloqueoActivo: false },
    };
  }

  /**
   * PATCH /admin/auditoria/torneos/:id/comision
   * God-panel C: ajusta la comisión del torneo (montos, estado, bloqueo).
   */
  @Patch('torneos/:id/comision')
  async ajustarComision(
    @Param('id') torneoId: string,
    @Body() dto: AjustarComisionDto,
  ) {
    const torneo = await this.prisma.tournament.findUnique({ where: { id: torneoId }, select: { id: true } });
    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }
    const data: any = {};
    if (dto.montoEstimado !== undefined) data.montoEstimado = dto.montoEstimado;
    if (dto.montoPagado !== undefined) data.montoPagado = dto.montoPagado;
    if (dto.estado !== undefined) data.estado = dto.estado;
    if (dto.bloqueoActivo !== undefined) data.bloqueoActivo = dto.bloqueoActivo;

    const comision = await this.prisma.torneoComision.upsert({
      where: { tournamentId: torneoId },
      update: data,
      create: {
        tournamentId: torneoId,
        montoEstimado: dto.montoEstimado ?? 0,
        montoPagado: dto.montoPagado ?? 0,
        estado: dto.estado ?? 'PENDIENTE',
        bloqueoActivo: dto.bloqueoActivo ?? false,
      },
    });
    return { success: true, message: 'Comisión actualizada', comision };
  }

  /**
   * DELETE /admin/auditoria/inscripciones/:id
   * Elimina una inscripción del torneo
   */
  @Delete('inscripciones/:id')
  async eliminarInscripcion(
    @Param('id') inscripcionId: string,
  ) {
    // Verificar que la inscripción existe
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: {
        jugador1: { select: { nombre: true, apellido: true } },
        jugador2: { select: { nombre: true, apellido: true } },
        tournament: { select: { nombre: true } },
        category: { select: { nombre: true } },
        partidosComoP1: { select: { id: true } },
        partidosComoP2: { select: { id: true } },
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    // Verificar si tiene partidos asociados
    const tienePartidos = inscripcion.partidosComoP1.length > 0 || inscripcion.partidosComoP2.length > 0;
    
    if (tienePartidos) {
      throw new BadRequestException(
        'No se puede eliminar la inscripción porque tiene partidos asignados. ' +
        'Primero debe eliminar los partidos del bracket.'
      );
    }

    // Eliminar la inscripción
    await this.prisma.inscripcion.delete({
      where: { id: inscripcionId },
    });

    return {
      success: true,
      message: 'Inscripción eliminada correctamente',
      data: {
        inscripcionId,
        pareja: `${inscripcion.jugador1?.nombre} ${inscripcion.jugador1?.apellido} / ${inscripcion.jugador2?.nombre || 'Pendiente'} ${inscripcion.jugador2?.apellido || ''}`,
        torneo: inscripcion.tournament.nombre,
        categoria: inscripcion.category.nombre,
      },
    };
  }

  /**
   * PATCH /admin/auditoria/inscripciones/:id/estado
   * Cambiar el estado de una inscripción (modo emergencia)
   */
  @Patch('inscripciones/:id/estado')
  async cambiarEstadoInscripcion(
    @Param('id') inscripcionId: string,
    @Body() dto: CambiarEstadoInscripcionDto,
  ) {
    // Verificar que la inscripción existe
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: {
        jugador1: { select: { nombre: true, apellido: true } },
        jugador2: { select: { nombre: true, apellido: true } },
        tournament: { select: { nombre: true } },
        category: { select: { nombre: true } },
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    const estadoAnterior = inscripcion.estado;

    // Actualizar el estado
    const inscripcionActualizada = await this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: { estado: dto.estado },
      include: {
        jugador1: { select: { nombre: true, apellido: true, email: true } },
        jugador2: { select: { nombre: true, apellido: true, email: true } },
        tournament: { select: { nombre: true } },
        category: { select: { nombre: true } },
      },
    });

    return {
      success: true,
      message: 'Estado de inscripción actualizado correctamente',
      data: {
        inscripcionId,
        estadoAnterior,
        estadoNuevo: dto.estado,
        pareja: `${inscripcion.jugador1?.nombre} ${inscripcion.jugador1?.apellido} / ${inscripcion.jugador2?.nombre || 'Pendiente'} ${inscripcion.jugador2?.apellido || ''}`,
        torneo: inscripcion.tournament.nombre,
        categoria: inscripcion.category.nombre,
      },
    };
  }
}
