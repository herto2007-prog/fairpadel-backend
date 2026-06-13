import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { IsString, IsOptional, IsDateString, IsNumber, IsArray, IsUUID, ValidateNested, Matches, ValidatorConstraint, ValidatorConstraintInterface, Validate } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { ComisionService } from '../../common/services/comision.service';
import { RankingsService } from '../rankings/rankings.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Validador custom para fechas futuras
@ValidatorConstraint({ name: 'isFutureDate', async: false })
class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(dateString: string) {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inputDate = new Date(dateString + 'T00:00:00');
    return inputDate >= today;
  }
  defaultMessage() {
    return 'La fecha debe ser hoy o futura';
  }
}

// DTOs
class CreateTorneoDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaInicio debe tener formato YYYY-MM-DD' })
  @Validate(IsFutureDateConstraint)
  fechaInicio: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaFin debe tener formato YYYY-MM-DD' })
  @Validate(IsFutureDateConstraint)
  fechaFin: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaFinales debe tener formato YYYY-MM-DD' })
  fechaFinales?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fechaLimiteInscripcion debe tener formato YYYY-MM-DD' })
  fechaLimiteInscripcion?: string;

  @IsString()
  ciudad: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  pais?: string;

  @IsNumber()
  @Transform(({ value }) => {
    // Convertir string a number si es necesario
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  costoInscripcion: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  minutosPorPartido?: number;

  @IsString()
  @IsOptional()
  sedeId?: string;

  @IsString()
  @IsOptional()
  flyerUrl?: string;

  @IsString()
  @IsOptional()
  flyerPublicId?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  modalidadIds?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  categoriaIds?: string[];
}

@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminTorneosController {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private comisionService: ComisionService,
    private rankingsService: RankingsService,
    private tournamentsService: TournamentsService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CRUD BÁSICO
  // ═══════════════════════════════════════════════════════════

  @Get()
  async findAll(@Request() req) {
    const user = req.user;
    const where = user.roles.includes('admin')
      ? {}
      : {
          OR: [
            { organizadorId: user.userId },
            { coorganizadores: { some: { userId: user.userId } } },
          ],
        };

    const torneos = await this.prisma.tournament.findMany({
      where,
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true },
        },
        categorias: {
          include: { category: true },
        },
        modalidades: {
          include: { modalidadConfig: true },
        },
        sedePrincipal: true,
        _count: {
          select: { inscripciones: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      torneos,
    };
  }

  /**
   * GET /admin/torneos/pendientes-aprobacion
   * Solo para admin: listar torneos pendientes de aprobación
   */
  @Get('pendientes-aprobacion')
  @Roles('admin')
  async getPendientesAprobacion() {
    const torneos = await this.prisma.tournament.findMany({
      where: {
        estado: {
          in: ['BORRADOR', 'PENDIENTE_APROBACION'],
        },
      },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
        },
        categorias: {
          include: { category: true },
        },
        _count: {
          select: { inscripciones: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      torneos,
    };
  }

  /**
   * POST /admin/torneos/:id/aprobar
   * Solo para admin: aprobar y publicar un torneo
   */
  @Post(':id/aprobar')
  @Roles('admin')
  async aprobarTorneo(@Param('id') id: string) {
    const torneo = await this.prisma.tournament.update({
      where: { id },
      data: {
        estado: 'PUBLICADO',
      },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
      },
    });

    // Crear notificación para el organizador
    await this.prisma.notificacion.create({
      data: {
        userId: torneo.organizadorId,
        tipo: 'TORNEO',
        titulo: '¡Tu torneo fue aprobado!',
        contenido: `El torneo "${torneo.nombre}" ha sido aprobado y ya está visible públicamente.`,
        enlace: `/mis-torneos/${torneo.id}/gestionar`,
      },
    });

    return {
      success: true,
      message: 'Torneo aprobado y publicado exitosamente',
      torneo,
    };
  }

  /**
   * POST /admin/torneos/:id/rechazar
   * Solo para admin: rechazar un torneo
   */
  @Post(':id/rechazar')
  @Roles('admin')
  async rechazarTorneo(
    @Param('id') id: string,
    @Body('motivo') motivo?: string,
  ) {
    const torneo = await this.prisma.tournament.update({
      where: { id },
      data: {
        estado: 'RECHAZADO',
      },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
      },
    });

    // Crear notificación para el organizador
    await this.prisma.notificacion.create({
      data: {
        userId: torneo.organizadorId,
        tipo: 'TORNEO',
        titulo: 'Tu torneo no fue aprobado',
        contenido: `El torneo "${torneo.nombre}" no cumple con los requisitos.${motivo ? ` Motivo: ${motivo}` : ''}`,
        enlace: `/mis-torneos`,
      },
    });

    return {
      success: true,
      message: 'Torneo rechazado',
      torneo,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true },
        },
        categorias: {
          include: { category: true },
        },
        modalidades: {
          include: { modalidadConfig: true },
        },
        sedePrincipal: {
          include: {
            canchas: { where: { activa: true } },
          },
        },
        _count: {
          select: { inscripciones: true },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return torneo;
  }

  @Post()
  async create(@Body() dto: CreateTorneoDto, @Request() req) {
    const user = req.user;
    console.log('[CreateTorneo] User desde JWT:', user);
    console.log('[CreateTorneo] User.userId:', user.userId);
    try {
      // Obtener configuración de comisión
      const configComision = await this.prisma.fairpadelConfig.findUnique({
        where: { clave: 'COMISION_POR_JUGADOR' },
      });
      const comisionPorJugador = parseInt(configComision?.valor || '0');

      // Crear en transacción
      const result = await this.prisma.$transaction(async (tx) => {
        // Generar slug único
        const slug = dto.nombre
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

        // Preparar datos del torneo para Prisma
        const torneoData: any = {
          nombre: dto.nombre,
          descripcion: dto.descripcion || '',
          // FIX: fechas ahora son String YYYY-MM-DD directamente
          fechaInicio: dto.fechaInicio,
          fechaFin: dto.fechaFin,
          fechaFinales: dto.fechaFinales,
          fechaLimiteInscr: dto.fechaLimiteInscripcion || dto.fechaInicio || dto.fechaFinales,
          ciudad: dto.ciudad,
          costoInscripcion: dto.costoInscripcion, // Prisma maneja Decimal desde number
          organizador: { connect: { id: user.userId } },
          estado: 'BORRADOR',
          pais: dto.pais || 'Paraguay',
          region: dto.region || dto.ciudad,
          flyerUrl: dto.flyerUrl || '',
          slug,
          minutosPorPartido: dto.minutosPorPartido || 120,
        };

        // Agregar sede solo si existe
        if (dto.sedeId) {
          torneoData.sedePrincipal = { connect: { id: dto.sedeId } };
        }

        // Crear torneo usando sintaxis de relación de Prisma
        const torneo = await tx.tournament.create({
          data: torneoData,
        });

        // Si hay sede, copiar sus canchas activas como TorneoCancha
        if (dto.sedeId) {
          const canchasSede = await tx.sedeCancha.findMany({
            where: {
              sedeId: dto.sedeId,
              activa: true,
            },
          });

          for (const cancha of canchasSede) {
            await tx.torneoCancha.create({
              data: {
                tournamentId: torneo.id,
                sedeCanchaId: cancha.id,
              },
            });
          }

          console.log(`[CreateTorneo] ${canchasSede.length} canchas copiadas de la sede`);
        }

        // Crear registro de comisión
        await tx.torneoComision.create({
          data: {
            tournamentId: torneo.id,
            montoEstimado: 0,
            montoPagado: 0,
            estado: 'PENDIENTE_PAGO',
            bloqueoActivo: false,
          },
        });

        // Crear checklist desde template
        const template = await tx.checklistTemplate.findFirst({
          where: { esDefault: true, activo: true },
          include: { items: true },
        });

        if (template) {
          for (const item of template.items) {
            await tx.checklistItem.create({
              data: {
                tournamentId: torneo.id,
                templateItemId: item.id,
                categoria: item.categoria,
                titulo: item.titulo,
                descripcion: item.descripcion,
                orden: item.orden,
                valorCalculado: item.esCalculado ? 0 : null,
              },
            });
          }
        }

        // Asignar modalidades si se proporcionaron
        if (dto.modalidadIds?.length) {
          for (const modalidadId of dto.modalidadIds) {
            await tx.tournamentModalidad.create({
              data: {
                tournamentId: torneo.id,
                modalidadConfigId: modalidadId,
              },
            });
          }
        }

        // Asignar categorías si se proporcionaron
        if (dto.categoriaIds?.length) {
          for (const categoriaId of dto.categoriaIds) {
            await tx.tournamentCategory.create({
              data: {
                tournamentId: torneo.id,
                categoryId: categoriaId,
              },
            });
          }
        }

        return torneo;
      });

      console.log('[CreateTorneo] Torneo creado exitosamente:', result.id);
      
      return {
        success: true,
        message: 'Torneo creado correctamente con checklist inicial',
        torneo: result,
        comisionPorJugador,
      };
    } catch (error: any) {
      console.error('[CreateTorneo] Error:', error);
      throw new BadRequestException({
        success: false,
        message: 'Error creando torneo',
        error: error.message,
      });
    }
  }

  @Put(':id')
  async update(
    @Param('id') torneoId: string,
    @Body() dto: Partial<CreateTorneoDto> & { canchasFinales?: string[]; horaInicioFinales?: string; horaFinFinales?: string },
    @Request() req,
  ) {
    try {
      const user = req.user;
      
      // Verificar que el torneo existe
      const torneo = await this.prisma.tournament.findUnique({
        where: { id: torneoId },
        select: { id: true, organizadorId: true, fechaFinales: true, minutosPorPartido: true } as any,
      });
      
      if (!torneo) {
        throw new NotFoundException('Torneo no encontrado');
      }
      
      // Verificar permisos (admin, organizador o co-organizador)
      const puede = await this.tournamentsService.puedeGestionarTorneo(torneoId, user.userId, user.roles);
      if (!puede) {
        throw new ForbiddenException('No tienes permiso para editar este torneo');
      }

      const torneoActualizado = await this.prisma.tournament.update({
        where: { id: torneoId },
        data: {
          ...(dto.nombre && { nombre: dto.nombre }),
          ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
          ...(dto.fechaInicio && { fechaInicio: dto.fechaInicio }),
          ...(dto.fechaFin && { fechaFin: dto.fechaFin }),
          ...(dto.fechaLimiteInscripcion && { fechaLimiteInscr: dto.fechaLimiteInscripcion }),
          ...(dto.ciudad && { ciudad: dto.ciudad, region: dto.ciudad }),
          ...(dto.costoInscripcion !== undefined && { costoInscripcion: dto.costoInscripcion }),
          ...(dto.sedeId !== undefined && { sedeId: dto.sedeId }),
          ...(dto.flyerUrl !== undefined && { flyerUrl: dto.flyerUrl }),
          ...(dto.canchasFinales !== undefined && { canchasFinales: dto.canchasFinales }),
          ...(dto.horaInicioFinales !== undefined && { horaInicioFinales: dto.horaInicioFinales }),
          // @ts-ignore - campo nuevo
          ...(dto.horaFinFinales !== undefined && { horaFinFinales: dto.horaFinFinales }),
        },
      });

      // Crear automáticamente día y slots para finales si se configuran canchas
      if (dto.canchasFinales !== undefined && dto.canchasFinales.length > 0) {
        // @ts-ignore
        const fechaFinales = torneoActualizado.fechaFinales || torneo.fechaFinales;
        // @ts-ignore
        const horaInicio = dto.horaInicioFinales || torneoActualizado.horaInicioFinales || '18:00';
        // @ts-ignore
        const horaFin = dto.horaFinFinales || torneoActualizado.horaFinFinales || '23:00';
        
        if (fechaFinales) {
          // FIX: fechaFinales ya es String YYYY-MM-DD
          const fechaStr = fechaFinales as string;
          // @ts-ignore
          const minutosSlot: number = torneoActualizado.minutosPorPartido || torneo.minutosPorPartido || 70;
          
          console.log('[UpdateTorneo] Creando día de finales automáticamente:', {
            torneoId,
            fecha: fechaStr,
            horaInicio,
            canchas: dto.canchasFinales,
          });

          try {
            // 1. Crear o actualizar el día de disponibilidad para finales
            // Nueva clave compuesta permite múltiples franjas por día
            const diaFinales = await this.prisma.torneoDisponibilidadDia.upsert({
              where: {
                tournamentId_fecha_horaInicio: {
                  tournamentId: torneoId,
                  fecha: fechaStr,
                  horaInicio,
                },
              },
              update: {
                horaFin, // Horario configurable para finales
                minutosSlot,
                activo: true,
              },
              create: {
                tournamentId: torneoId,
                fecha: fechaStr,
                horaInicio,
                horaFin,
                minutosSlot,
              },
            });

            console.log('[UpdateTorneo] Día de finales creado/actualizado:', diaFinales.id);

            // 2. Generar slots para cada cancha seleccionada
            const slotsCreados = [];
            const horaFinNum = this.parseHora(horaFin);
            for (const torneoCanchaId of dto.canchasFinales) {
              let horaActual = this.parseHora(horaInicio);

              while (horaActual < horaFinNum) {
                const horaInicioStr = this.formatHora(horaActual);
                const horaFinSlot = horaActual + minutosSlot;
                const horaFinStr = this.formatHora(horaFinSlot);

                try {
                  const slot = await this.prisma.torneoSlot.create({
                    data: {
                      disponibilidadId: diaFinales.id,
                      torneoCanchaId,
                      horaInicio: horaInicioStr,
                      horaFin: horaFinStr,
                      estado: 'LIBRE',
                    },
                  });
                  slotsCreados.push(slot);
                } catch (createError: any) {
                  // Si el error es de duplicado (P2002), ignorar y continuar
                  if (createError.code !== 'P2002') {
                    throw createError;
                  }
                }

                horaActual = horaFinSlot;
              }
            }

            console.log('[UpdateTorneo] Slots creados para finales:', slotsCreados.length);
          } catch (error: any) {
            console.error('[UpdateTorneo] Error creando día/slots para finales:', error);
            // No lanzamos el error para no fallar la actualización del torneo
          }
        }
      }

      return {
        success: true,
        message: 'Torneo actualizado',
        torneo: torneoActualizado,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error actualizando torneo',
        error: error.message,
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id') torneoId: string) {
    try {
      await this.prisma.tournament.delete({
        where: { id: torneoId },
      });

      return {
        success: true,
        message: 'Torneo eliminado correctamente',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error eliminando torneo',
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FINALIZACIÓN DE CATEGORÍA Y CÁLCULO DE PUNTOS
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /admin/torneos/:tournamentId/categorias/:categoryId/finalizar
   * Finaliza una categoría de torneo y calcula automáticamente los puntos de ranking.
   * Solo disponible para torneos con circuito aprobado.
   */
  @Post(':tournamentId/categorias/:categoryId/finalizar')
  async finalizarCategoria(
    @Param('tournamentId') tournamentId: string,
    @Param('categoryId') categoryId: string,
    @Request() req: any,
  ) {
    const user = req.user;

    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, organizadorId: true, nombre: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Verificar permisos
    const puede = await this.tournamentsService.puedeGestionarTorneo(tournamentId, user.userId, user.roles);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso para finalizar esta categoría');
    }

    // Verificar que la categoría pertenezca al torneo
    const tournamentCategory = await this.prisma.tournamentCategory.findFirst({
      where: { tournamentId, categoryId },
    });

    if (!tournamentCategory) {
      throw new NotFoundException('Categoría no encontrada en este torneo');
    }

    // Verificar que el torneo tenga un circuito aprobado
    const torneoCircuito = await this.prisma.torneoCircuito.findFirst({
      where: { torneoId: tournamentId, estado: 'APROBADO' },
      include: { circuito: true },
    });

    if (!torneoCircuito) {
      throw new BadRequestException('Esta categoría no puede finalizarse automáticamente porque el torneo no está asignado a un circuito aprobado');
    }

    // Actualizar estado de la categoría
    await this.prisma.tournamentCategory.update({
      where: { id: tournamentCategory.id },
      data: { estado: 'FINALIZADA' },
    });

    // Calcular puntos
    const resultado = await this.rankingsService.calcularPuntosTorneo(tournamentId, categoryId);

    return {
      success: true,
      message: `Categoría finalizada y puntos calculados para ${torneo.nombre}`,
      data: {
        categoriaId: categoryId,
        circuito: torneoCircuito.circuito.nombre,
        puntos: resultado.data,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

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
