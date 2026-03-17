import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsOptional, IsDateString, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DateService } from '../../common/services/date.service';

// DTOs
class AgregarSedeDto {
  @IsString()
  sedeId: string;
}

class AgregarCanchaDto {
  @IsString()
  sedeCanchaId: string;
}

class ConfigurarDiaDto {
  @IsDateString()
  fecha: string;

  @IsString()
  horaInicio: string; // "18:00"

  @IsString()
  horaFin: string; // "23:00"

  @IsNumber()
  @Min(30)
  @Max(180)
  minutosSlot: number = 90;
}

class GetSlotsPorSemanaDto {
  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;
}

@Controller('admin/torneos/:id/disponibilidad')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminDisponibilidadController {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
  ) {}

  /**
   * GET /admin/torneos/:id/disponibilidad
   * Obtener configuración completa de disponibilidad del torneo
   */
  @Get()
  async getDisponibilidad(@Param('id') tournamentId: string) {
    const [torneo, sedes, canchas, dias] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, nombre: true, fechaInicio: true, fechaFin: true },
      }),
      this.prisma.torneoSede.findMany({
        where: { tournamentId },
        include: {
          sede: {
            include: {
              canchas: { where: { activa: true } },
            },
          },
        },
      }),
      this.prisma.torneoCancha.findMany({
        where: { tournamentId, activa: true },
        include: {
          sedeCancha: {
            include: {
              sede: { select: { id: true, nombre: true } },
            },
          },
        },
      }),
      this.prisma.torneoDisponibilidadDia.findMany({
        where: { tournamentId },
        include: {
          slots: {
            include: {
              torneoCancha: {
                include: {
                  sedeCancha: { select: { id: true, nombre: true } },
                },
              },
              match: {
                select: {
                  id: true,
                  ronda: true,
                  inscripcion1: { select: { id: true } },
                  inscripcion2: { select: { id: true } },
                },
              },
            },
          },
        },
        orderBy: { fecha: 'asc' },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return {
      success: true,
      torneo: {
        id: torneo.id,
        nombre: torneo.nombre,
        fechaInicio: torneo.fechaInicio,
        fechaFin: torneo.fechaFin,
      },
      sedes: sedes.map((s) => ({
        id: s.sede.id,
        nombre: s.sede.nombre,
        ciudad: s.sede.ciudad,
        orden: s.orden,
      })),
      canchas: canchas.map((c) => ({
        id: c.id,
        nombre: c.sedeCancha.nombre,
        sedeId: c.sedeCancha.sede.id,
        sedeNombre: c.sedeCancha.sede.nombre,
        orden: c.orden,
      })),
      dias: dias.map((d) => ({
        id: d.id,
        fecha: d.fecha,
        horaInicio: d.horaInicio,
        horaFin: d.horaFin,
        minutosSlot: d.minutosSlot,
        activo: d.activo,
        totalSlots: d.slots.length,
        slotsLibres: d.slots.filter((s) => s.estado === 'LIBRE').length,
        slotsOcupados: d.slots.filter((s) => s.estado === 'OCUPADO').length,
      })),
    };
  }

  /**
   * GET /admin/torneos/:id/disponibilidad/slots?fechaInicio=...&fechaFin=...
   * Obtener slots por rango de fechas para la vista de calendario
   */
  @Get('slots')
  async getSlotsPorSemana(
    @Param('id') tournamentId: string,
    @Query('fechaInicio') fechaInicioStr: string,
    @Query('fechaFin') fechaFinStr: string,
  ) {
    try {
      if (!fechaInicioStr || !fechaFinStr) {
        throw new BadRequestException('fechaInicio y fechaFin son requeridos');
      }
      // Parsear fechas como UTC 00:00:00 para consistencia con el guardado
      const fechaInicio = new Date(fechaInicioStr + 'T00:00:00.000Z');
      const fechaFin = new Date(fechaFinStr + 'T00:00:00.000Z');

      const dias = await this.prisma.torneoDisponibilidadDia.findMany({
        where: {
          tournamentId,
          fecha: {
            gte: fechaInicio,
            lte: fechaFin,
          },
          activo: true,
        },
        include: {
          slots: {
            where: {
              estado: { in: ['LIBRE', 'OCUPADO'] },
            },
            include: {
              torneoCancha: {
                include: {
                  sedeCancha: {
                    include: {
                      sede: { select: { id: true, nombre: true } },
                    },
                  },
                },
              },
              match: {
                include: {
                  inscripcion1: {
                    include: {
                      jugador1: { select: { id: true, nombre: true, apellido: true } },
                      jugador2: { select: { id: true, nombre: true, apellido: true } },
                    },
                  },
                  inscripcion2: {
                    include: {
                      jugador1: { select: { id: true, nombre: true, apellido: true } },
                      jugador2: { select: { id: true, nombre: true, apellido: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { fecha: 'asc' },
      });

      // Aplanar los slots para la vista de calendario
      const slots = dias.flatMap((dia) =>
        dia.slots.map((slot) => ({
          id: slot.id,
          fecha: dia.fecha,
          horaInicio: slot.horaInicio,
          horaFin: slot.horaFin,
          estado: slot.estado,
          cancha: {
            id: slot.torneoCancha.id,
            nombre: slot.torneoCancha.sedeCancha.nombre,
            sedeId: slot.torneoCancha.sedeCancha.sede.id,
            sedeNombre: slot.torneoCancha.sedeCancha.sede.nombre,
          },
          match: slot.match
            ? {
                id: slot.match.id,
                ronda: slot.match.ronda,
                pareja1: slot.match.inscripcion1
                  ? `${slot.match.inscripcion1.jugador1.apellido} / ${slot.match.inscripcion1.jugador2?.apellido || '?'}`
                  : 'BYE',
                pareja2: slot.match.inscripcion2
                  ? `${slot.match.inscripcion2.jugador1.apellido} / ${slot.match.inscripcion2.jugador2?.apellido || '?'}`
                  : 'BYE',
              }
            : null,
        })),
      );

      return {
        success: true,
        fechaInicio: fechaInicioStr,
        fechaFin: fechaFinStr,
        totalSlots: slots.length,
        slots,
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error obteniendo slots',
        error: error.message,
      });
    }
  }

  /**
   * POST /admin/torneos/:id/disponibilidad/sedes
   * Agregar una sede al torneo
   */
  @Post('sedes')
  async agregarSede(@Param('id') tournamentId: string, @Body() dto: AgregarSedeDto) {
    try {
      // Verificar que la sede existe
      const sede = await this.prisma.sede.findUnique({
        where: { id: dto.sedeId },
        include: {
          canchas: {
            where: { activa: true },
          },
        },
      });
      if (!sede) {
        throw new NotFoundException('Sede no encontrada');
      }

      // Verificar que no esté ya agregada
      const existing = await this.prisma.torneoSede.findUnique({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: dto.sedeId,
          },
        },
      });
      if (existing) {
        return {
          success: false,
          message: 'La sede ya está agregada al torneo',
        };
      }

      // Crear la relación torneo-sede
      const torneoSede = await this.prisma.torneoSede.create({
        data: {
          tournamentId,
          sedeId: dto.sedeId,
        },
        include: {
          sede: true,
        },
      });

      // Agregar automáticamente todas las canchas activas de la sede al torneo
      const canchasCreadas = [];
      for (const cancha of sede.canchas) {
        try {
          const torneoCancha = await this.prisma.torneoCancha.create({
            data: {
              tournamentId,
              sedeCanchaId: cancha.id,
            },
          });
          canchasCreadas.push(torneoCancha);
        } catch (canchaError) {
          // Si una cancha ya existe, ignorar y continuar
          console.log(`Cancha ${cancha.id} ya existe en el torneo, saltando...`);
        }
      }

      return {
        success: true,
        message: `Sede agregada con ${canchasCreadas.length} canchas`,
        sede: torneoSede.sede,
        canchasAgregadas: canchasCreadas.length,
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error agregando sede',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /admin/torneos/:id/disponibilidad/sedes/:sedeId
   * Quitar una sede del torneo
   */
  @Delete('sedes/:sedeId')
  async quitarSede(@Param('id') tournamentId: string, @Param('sedeId') sedeId: string) {
    try {
      await this.prisma.torneoSede.delete({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId,
          },
        },
      });

      return {
        success: true,
        message: 'Sede removida del torneo',
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error removiendo sede',
        error: error.message,
      });
    }
  }

  /**
   * POST /admin/torneos/:id/disponibilidad/canchas
   * Agregar una cancha al torneo
   */
  @Post('canchas')
  async agregarCancha(@Param('id') tournamentId: string, @Body() dto: AgregarCanchaDto) {
    try {
      // Verificar que la cancha existe
      const cancha = await this.prisma.sedeCancha.findUnique({
        where: { id: dto.sedeCanchaId },
        include: { sede: true },
      });
      if (!cancha) {
        throw new NotFoundException('Cancha no encontrada');
      }

      // Verificar que la sede esté agregada al torneo
      const sedeEnTorneo = await this.prisma.torneoSede.findUnique({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: cancha.sedeId,
          },
        },
      });
      if (!sedeEnTorneo) {
        return {
          success: false,
          message: 'Primero debe agregar la sede al torneo',
        };
      }

      // Verificar que no esté ya agregada
      const existing = await this.prisma.torneoCancha.findUnique({
        where: {
          tournamentId_sedeCanchaId: {
            tournamentId,
            sedeCanchaId: dto.sedeCanchaId,
          },
        },
      });
      if (existing) {
        return {
          success: false,
          message: 'La cancha ya está agregada al torneo',
        };
      }

      const torneoCancha = await this.prisma.torneoCancha.create({
        data: {
          tournamentId,
          sedeCanchaId: dto.sedeCanchaId,
        },
        include: {
          sedeCancha: {
            include: {
              sede: true,
            },
          },
        },
      });

      return {
        success: true,
        message: 'Cancha agregada al torneo',
        cancha: {
          id: torneoCancha.id,
          nombre: torneoCancha.sedeCancha.nombre,
          sede: torneoCancha.sedeCancha.sede.nombre,
        },
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error agregando cancha',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /admin/torneos/:id/disponibilidad/canchas/:canchaId
   * Quitar una cancha del torneo
   */
  @Delete('canchas/:canchaId')
  async quitarCancha(@Param('id') tournamentId: string, @Param('canchaId') canchaId: string) {
    try {
      await this.prisma.torneoCancha.update({
        where: { id: canchaId },
        data: { activa: false },
      });

      return {
        success: true,
        message: 'Cancha desactivada del torneo',
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error desactivando cancha',
        error: error.message,
      });
    }
  }

  /**
   * POST /admin/torneos/:id/disponibilidad/dias
   * Configurar un día de disponibilidad
   */
  @Post('dias')
  async configurarDia(@Param('id') tournamentId: string, @Body() dto: ConfigurarDiaDto) {
    console.log('[Disponibilidad] Configurando día:', { tournamentId, dto });
    try {
      // Validar que el torneo existe
      const torneo = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, nombre: true, fechaInicio: true, fechaFin: true },
      });
      
      if (!torneo) {
        console.error('[Disponibilidad] Torneo no encontrado:', tournamentId);
        throw new NotFoundException('Torneo no encontrado');
      }
      
      console.log('[Disponibilidad] Torneo encontrado:', torneo.nombre);

      // Crear fecha como UTC 00:00:00 para evitar desplazamientos de timezone
      // La fecha YYYY-MM-DD se guarda tal cual sin conversión de hora
      const fecha = new Date(dto.fecha + 'T00:00:00.000Z');
      console.log('[Disponibilidad] Fecha parseada (UTC):', fecha);

      // Crear o actualizar la disponibilidad del día
      const disponibilidad = await this.prisma.torneoDisponibilidadDia.upsert({
        where: {
          tournamentId_fecha: {
            tournamentId,
            fecha,
          },
        },
        update: {
          horaInicio: dto.horaInicio,
          horaFin: dto.horaFin,
          minutosSlot: dto.minutosSlot,
          activo: true,
        },
        create: {
          tournamentId,
          fecha,
          horaInicio: dto.horaInicio,
          horaFin: dto.horaFin,
          minutosSlot: dto.minutosSlot,
        },
      });

      console.log('[Disponibilidad] Día configurado:', disponibilidad.id);
      return {
        success: true,
        message: 'Día configurado correctamente',
        dia: disponibilidad,
      };
    } catch (error: any) {
      console.error('[Disponibilidad] Error configurando día:', error);
      throw new BadRequestException({
        success: false,
        message: 'Error configurando día',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /admin/torneos/:id/disponibilidad/dias/:diaId
   * Eliminar un día de disponibilidad
   */
  @Delete('dias/:diaId')
  async eliminarDia(@Param('id') tournamentId: string, @Param('diaId') diaId: string) {
    try {
      await this.prisma.torneoDisponibilidadDia.update({
        where: { id: diaId },
        data: { activo: false },
      });

      return {
        success: true,
        message: 'Día desactivado',
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error desactivando día',
        error: error.message,
      });
    }
  }

  /**
   * POST /admin/torneos/:id/disponibilidad/dias/:diaId/generar-slots
   * Generar los slots para un día específico
   * Body opcional: { canchaIds: string[] } - solo genera slots para esas canchas
   */
  @Post('dias/:diaId/generar-slots')
  async generarSlots(
    @Param('id') tournamentId: string, 
    @Param('diaId') diaId: string,
    @Body() body: any,
  ) {
    try {
      // Extraer canchaIds del body (si existe)
      const canchaIds = body?.canchaIds;

      // Validar que el día existe y pertenece al torneo
      const dia = await this.prisma.torneoDisponibilidadDia.findFirst({
        where: { id: diaId, tournamentId },
      });
      
      if (!dia) {
        throw new NotFoundException('Día no encontrado o no pertenece a este torneo');
      }

      // Construir filtro de canchas
      const canchaFilter: any = { tournamentId, activa: true };
      
      // Si se proporcionan canchaIds válidos, filtrar por ellas
      if (Array.isArray(canchaIds) && canchaIds.length > 0) {
        canchaFilter.id = { in: canchaIds };
      }

      const canchas = await this.prisma.torneoCancha.findMany({
        where: canchaFilter,
      });

      if (canchas.length === 0) {
        return {
          success: false,
          message: 'No hay canchas configuradas para generar slots',
        };
      }

      const slotsCreados = [];

      // Para cada cancha, generar slots según horario
      for (const cancha of canchas) {
        let horaActual = this.parseHora(dia.horaInicio);
        const horaFin = this.parseHora(dia.horaFin);

        while (horaActual <= horaFin) {
          const horaInicioStr = this.formatHora(horaActual);
          const horaFinSlot = horaActual + dia.minutosSlot;
          
          // El slot puede terminar DESPUÉS de la horaFin configurada
          // Ej: si horaFin es 23:00, el último slot puede ser 22:30-00:00
          // Lo importante es que INICIE antes o a la horaFin
          if (horaActual > horaFin) break;

          const horaFinStr = this.formatHora(horaFinSlot);

          try {
            // Intentar crear slot
            const slot = await this.prisma.torneoSlot.create({
              data: {
                disponibilidadId: diaId,
                torneoCanchaId: cancha.id,
                horaInicio: horaInicioStr,
                horaFin: horaFinStr,
                estado: 'LIBRE',
              },
            });
            slotsCreados.push(slot);
          } catch (createError: any) {
            // Si el error es de duplicado (P2002), ignorar y continuar
            if (createError.code === 'P2002') {
              // Slot ya existe, continuar sin error
            } else {
              // Si es otro error, lanzarlo
              throw createError;
            }
          }
          
          horaActual = horaFinSlot;
        }
      }

      return {
        success: true,
        message: `${slotsCreados.length} slots generados`,
        totalSlots: slotsCreados.length,
        canchasUsadas: canchas.length,
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error generando slots',
        error: error.message,
      });
    }
  }

  // Helpers
  private parseHora(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  private formatHora(minutos: number): string {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
