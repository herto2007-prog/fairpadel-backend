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

class AsignarModalidadesDto {
  @IsArray()
  modalidadIds: string[];
}

class AsignarCategoriasDto {
  @IsArray()
  categoriaIds: string[];
}

class SubirComprobanteDto {
  @IsString()
  comprobanteUrl: string;

  @IsString()
  @IsOptional()
  notas?: string;
}

class CompletarChecklistDto {
  @IsString()
  @IsOptional()
  notas?: string;

  @IsNumber()
  @IsOptional()
  valorReal?: number;
}

class ConfigurarRecordatorioDto {
  @IsDateString()
  fechaRecordatorio: string;
}

@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminTorneosController {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CRUD BÁSICO
  // ═══════════════════════════════════════════════════════════

  @Get()
  async findAll(@Request() req) {
    const user = req.user;
    const where = user.roles.includes('admin') 
      ? {} 
      : { organizadorId: user.userId };

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
            estado: 'PENDIENTE',
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
      
      // Si es organizador (no admin), verificar que sea el dueño del torneo
      const esAdmin = user.roles?.includes('admin');
      const esOrganizador = user.roles?.includes('organizador');
      
      if (!esAdmin && esOrganizador && torneo.organizadorId !== user.userId) {
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
  // DATOS AUXILIARES
  // ═══════════════════════════════════════════════════════════

  @Get('datos/wizard')
  async getDatosWizard() {
    try {
      const [sedes, modalidades, categorias] = await Promise.all([
        this.prisma.sede.findMany({
          where: { activa: true },
          select: { id: true, nombre: true, ciudad: true },
          orderBy: { nombre: 'asc' },
        }),
        this.prisma.modalidadConfig.findMany({
          where: { activa: true },
          orderBy: { nombre: 'asc' },
        }),
        this.prisma.category.findMany({
          orderBy: { orden: 'asc' },
        }),
      ]);

      return {
        success: true,
        sedes,
        modalidades,
        categorias,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error cargando datos',
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MODALIDADES Y CATEGORÍAS
  // ═══════════════════════════════════════════════════════════

  @Post(':id/modalidades')
  async asignarModalidades(
    @Param('id') torneoId: string,
    @Body() dto: AsignarModalidadesDto,
  ) {
    try {
      await this.prisma.tournamentModalidad.deleteMany({
        where: { tournamentId: torneoId },
      });

      for (const modalidadId of dto.modalidadIds) {
        await this.prisma.tournamentModalidad.create({
          data: {
            tournamentId: torneoId,
            modalidadConfigId: modalidadId,
          },
        });
      }

      const modalidades = await this.prisma.tournamentModalidad.findMany({
        where: { tournamentId: torneoId },
        include: { modalidadConfig: true },
      });

      return {
        success: true,
        message: 'Modalidades asignadas correctamente',
        modalidades,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error asignando modalidades',
        error: error.message,
      };
    }
  }

  @Post(':id/categorias')
  async asignarCategorias(
    @Param('id') torneoId: string,
    @Body() dto: AsignarCategoriasDto,
  ) {
    try {
      await this.prisma.tournamentCategory.deleteMany({
        where: { tournamentId: torneoId },
      });

      for (const categoriaId of dto.categoriaIds) {
        await this.prisma.tournamentCategory.create({
          data: {
            tournamentId: torneoId,
            categoryId: categoriaId,
          },
        });
      }

      const categorias = await this.prisma.tournamentCategory.findMany({
        where: { tournamentId: torneoId },
        include: { category: true },
      });

      return {
        success: true,
        message: 'Categorías asignadas correctamente',
        categorias,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error asignando categorías',
        error: error.message,
      };
    }
  }

  @Put(':id/publicar')
  async publicar(@Param('id') torneoId: string) {
    try {
      const torneo = await this.prisma.tournament.update({
        where: { id: torneoId },
        data: { estado: 'PUBLICADO' },
      });

      return {
        success: true,
        message: 'Torneo publicado correctamente',
        torneo,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error publicando torneo',
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CHECKLIST
  // ═══════════════════════════════════════════════════════════

  @Get(':id/checklist')
  async getChecklist(@Param('id') tournamentId: string) {
    const items = await this.prisma.checklistItem.findMany({
      where: { tournamentId },
      orderBy: { orden: 'asc' },
    });

    return {
      success: true,
      items,
      progreso: {
        total: items.length,
        completados: items.filter(i => i.completado).length,
        porcentaje: Math.round((items.filter(i => i.completado).length / items.length) * 100) || 0,
      },
    };
  }

  @Put(':id/checklist/:itemId')
  async completarChecklistItem(
    @Param('id') tournamentId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CompletarChecklistDto,
  ) {
    const item = await this.prisma.checklistItem.update({
      where: { id: itemId, tournamentId },
      data: {
        completado: true,
        completadoAt: new Date(),
        notas: dto.notas,
        valorReal: dto.valorReal,
      },
    });

    return {
      success: true,
      message: 'Ítem completado',
      item,
    };
  }

  @Put(':id/checklist/:itemId/recordatorio')
  async configurarRecordatorio(
    @Param('id') tournamentId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ConfigurarRecordatorioDto,
  ) {
    const item = await this.prisma.checklistItem.update({
      where: { id: itemId, tournamentId },
      data: {
        fechaRecordatorio: new Date(dto.fechaRecordatorio + 'T03:00:00.000Z'),
        recordatorioEnviado: false,
      },
    });

    return {
      success: true,
      message: 'Recordatorio configurado',
      item,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // COMISIÓN Y BLOQUEO
  // ═══════════════════════════════════════════════════════════

  @Get(':id/detalle')
  async getDetalleCompleto(@Param('id') id: string) {
    const [torneo, comision, checklist, configComision] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id },
        include: {
          organizador: {
            select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
          },
          categorias: { include: { category: true } },
          modalidades: { include: { modalidadConfig: true } },
          sedePrincipal: true,
          _count: { select: { inscripciones: true } },
        },
      }),
      this.prisma.torneoComision.findUnique({
        where: { tournamentId: id },
      }),
      this.prisma.checklistItem.findMany({
        where: { tournamentId: id },
        orderBy: { orden: 'asc' },
      }),
      this.prisma.fairpadelConfig.findUnique({
        where: { clave: 'COMISION_POR_JUGADOR' },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Calcular estadísticas
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId: id },
      select: { estado: true },
    });

    const stats = {
      total: inscripciones.length,
      confirmadas: inscripciones.filter(i => i.estado === 'CONFIRMADA').length,
      pendientesPago: inscripciones.filter(i => i.estado === 'PENDIENTE_PAGO').length,
    };

    const comisionPorJugador = parseInt(configComision?.valor || '0');
    const montoEstimado = stats.confirmadas * 2 * comisionPorJugador;

    return {
      ...torneo,
      comision: {
        ...comision,
        montoEstimado,
        comisionPorJugador,
      },
      checklist,
      stats,
    };
  }

  @Post(':id/comision/comprobante')
  async subirComprobante(
    @Param('id') tournamentId: string,
    @Body() dto: SubirComprobanteDto,
  ) {
    const comision = await this.prisma.torneoComision.update({
      where: { tournamentId },
      data: {
        comprobanteUrl: dto.comprobanteUrl,
        comprobanteNotas: dto.notas,
        estado: 'PENDIENTE_VERIFICACION',
      },
    });

    return {
      success: true,
      message: 'Comprobante subido. Pendiente de verificación por admin.',
      comision,
    };
  }

  @Get(':id/estado')
  async verificarEstado(@Param('id') tournamentId: string) {
    const [torneo, comision, configRonda] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { estado: true, nombre: true },
      }),
      this.prisma.torneoComision.findUnique({
        where: { tournamentId },
      }),
      this.prisma.fairpadelConfig.findUnique({
        where: { clave: 'RONDA_BLOQUEO_PAGO' },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const rondaBloqueo = configRonda?.valor || 'CUARTOS';
    
    return {
      torneo: {
        nombre: torneo.nombre,
        estado: torneo.estado,
      },
      bloqueo: {
        activo: comision?.bloqueoActivo || false,
        rondaBloqueo,
        comisionEstado: comision?.estado || 'PENDIENTE',
        montoPagado: comision?.montoPagado || 0,
        montoEstimado: comision?.montoEstimado || 0,
      },
      mensaje: comision?.bloqueoActivo 
        ? `Torneo bloqueado. Para continuar a semifinales, regulariza el pago de comisión.`
        : 'Torneo activo',
    };
  }

  // ═══════════════════════════════════════════════════════════
  // INSCRIPCIONES
  // ═══════════════════════════════════════════════════════════

  @Get(':id/inscripciones')
  async getInscripciones(@Param('id') tournamentId: string) {
    try {
      const [inscripciones, categorias] = await Promise.all([
        this.prisma.inscripcion.findMany({
          where: { tournamentId },
          include: {
            category: true,
            jugador1: {
              select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
            },
            jugador2: {
              select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
            },
            pagos: {
              where: { estado: 'CONFIRMADO' },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.tournamentCategory.findMany({
          where: { tournamentId },
          include: { category: true },
        }),
      ]);

      // Agrupar por categoría
      const porCategoria = categorias.map(cat => {
        const inscritos = inscripciones.filter(i => i.categoryId === cat.categoryId);
        return {
          categoriaId: cat.categoryId,
          categoriaNombre: cat.category.nombre,
          categoriaTipo: cat.category.tipo,
          total: inscritos.length,
          confirmadas: inscritos.filter(i => i.estado === 'CONFIRMADA').length,
          pendientes: inscritos.filter(i => i.estado === 'PENDIENTE_PAGO' || i.estado === 'PENDIENTE_CONFIRMACION').length,
          inscripciones: inscritos,
        };
      });

      // Stats globales
      const stats = {
        total: inscripciones.length,
        confirmadas: inscripciones.filter(i => i.estado === 'CONFIRMADA').length,
        pendientes: inscripciones.filter(i => i.estado === 'PENDIENTE_PAGO' || i.estado === 'PENDIENTE_CONFIRMACION').length,
        incompletas: inscripciones.filter(i => !i.jugador2Id).length,
        ingresos: inscripciones
          .filter(i => i.estado === 'CONFIRMADA')
          .reduce((sum, i: any) => sum + (i.pagos?.reduce((pSum: number, p: any) => pSum + Number(p.monto || 0), 0) || 0), 0),
      };

      return {
        success: true,
        stats,
        porCategoria,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error cargando inscripciones',
        error: error.message,
      });
    }
  }

  @Put(':id/inscripciones/:inscripcionId/confirmar')
  async confirmarInscripcion(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
  ) {
    try {
      const inscripcion = await this.prisma.inscripcion.update({
        where: { id: inscripcionId, tournamentId },
        data: { estado: 'CONFIRMADA' },
      });

      return {
        success: true,
        message: 'Inscripción confirmada',
        inscripcion,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error confirmando inscripción',
        error: error.message,
      });
    }
  }

  @Put(':id/inscripciones/:inscripcionId/cancelar')
  async cancelarInscripcion(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body('motivo') motivo?: string,
  ) {
    try {
      const inscripcion = await this.prisma.inscripcion.update({
        where: { id: inscripcionId, tournamentId },
        data: { estado: 'CANCELADA' },
      });

      return {
        success: true,
        message: 'Inscripción cancelada',
        motivo: motivo || 'Sin motivo especificado',
        inscripcion,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error cancelando inscripción',
        error: error.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
  // INSCRIPCIÓN MANUAL (Organizador)
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /admin/torneos/:id/jugadores/buscar
   * Buscar jugadores para inscripción manual
   */
  @Get(':id/jugadores/buscar')
  async buscarJugadores(
    @Param('id') tournamentId: string,
    @Query('q') query: string,
  ) {
    if (!query || query.length < 2) {
      throw new BadRequestException('Mínimo 2 caracteres para buscar');
    }

    const jugadores = await this.prisma.user.findMany({
      where: {
        estado: 'ACTIVO',
        OR: [
          { nombre: { contains: query, mode: 'insensitive' } },
          { apellido: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { documento: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        telefono: true,
        documento: true,
        fotoUrl: true,
        categoriaActual: { select: { id: true, nombre: true, tipo: true } },
      },
      take: 10,
    });

    return { success: true, jugadores };
  }

  /**
   * GET /admin/torneos/:id/partidos
   * Obtener todos los partidos del torneo para programación
   */
  @Get(':id/partidos')
  async getPartidos(@Param('id') tournamentId: string) {
    const partidos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        fixtureVersionId: { not: null },
      },
      include: {
        fixtureVersion: {
          include: {
            tournamentCategory: {
              include: {
                category: {
                  select: { id: true, nombre: true },
                },
              },
            },
          },
        },
        inscripcion1: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        inscripcion2: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: { select: { nombre: true } },
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
      partidos: partidos.map(p => ({
        id: p.id,
        fase: p.ronda,
        orden: p.numeroRonda,
        categoriaId: p.fixtureVersion?.tournamentCategory?.category?.id,
        categoriaNombre: p.fixtureVersion?.tournamentCategory?.category?.nombre,
        esBye: p.esBye,
        estado: p.estado,
        fechaProgramada: p.fechaProgramada,
        horaProgramada: p.horaProgramada,
        torneoCanchaId: p.torneoCanchaId,
        canchaNombre: p.torneoCancha?.sedeCancha?.nombre,
        sedeNombre: p.torneoCancha?.sedeCancha?.sede?.nombre,
        inscripcion1: p.inscripcion1,
        inscripcion2: p.inscripcion2,
      })),
    };
  }

  /**
   * POST /admin/torneos/:id/inscripciones/manual
   * Crear inscripción manual por organizador
   */
  @Post(':id/inscripciones/manual')
  async crearInscripcionManual(
    @Param('id') tournamentId: string,
    @Body() body: {
      categoryId: string;
      jugador1Id: string;
      jugador2Id?: string;
      jugador2Temp?: {
        nombre: string;
        apellido: string;
        email: string;
        telefono?: string;
        documento?: string;
      };
      modoPago?: 'COMPLETO' | 'INDIVIDUAL';
      montoPagado?: number;
      notas?: string;
    },
    @Request() req,
  ) {
    const {
      categoryId,
      jugador1Id,
      jugador2Id,
      jugador2Temp,
      modoPago = 'COMPLETO',
      montoPagado = 0,
      notas,
    } = body;

    // Validar torneo
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { categorias: { include: { category: true } } },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Validar categoría
    const categoria = torneo.categorias.find(c => c.categoryId === categoryId);
    if (!categoria) {
      throw new BadRequestException('Categoría no válida para este torneo');
    }

    // Verificar si jugador1 ya está inscrito
    const existeJugador1 = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId,
        categoryId,
        OR: [
          { jugador1Id },
          { jugador2Id: jugador1Id },
        ],
        estado: { not: 'CANCELADA' },
      },
    });

    if (existeJugador1) {
      throw new BadRequestException('El jugador 1 ya está inscrito en esta categoría');
    }

    // Verificar jugador2 si existe
    let jugador2Documento = jugador2Temp?.documento || '';
    let jugador2Email = jugador2Temp?.email;

    if (jugador2Id) {
      const existeJugador2 = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId,
          OR: [
            { jugador1Id: jugador2Id },
            { jugador2Id },
          ],
          estado: { not: 'CANCELADA' },
        },
      });

      if (existeJugador2) {
        throw new BadRequestException('El jugador 2 ya está inscrito en esta categoría');
      }

      const jugador2DB = await this.prisma.user.findUnique({
        where: { id: jugador2Id },
        select: { documento: true, email: true },
      });

      if (jugador2DB) {
        jugador2Documento = jugador2DB.documento;
        jugador2Email = jugador2DB.email;
      }
    }

    // Crear inscripción
    const inscripcion = await this.prisma.inscripcion.create({
      data: {
        tournamentId,
        categoryId,
        jugador1Id,
        jugador2Id,
        jugador2Email,
        jugador2Documento,
        estado: montoPagado > 0 ? 'CONFIRMADA' : 'PENDIENTE_PAGO',
        modoPago,
        notas: notas,
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        category: true,
      },
    });

    // Crear pago si corresponde
    if (montoPagado > 0) {
      await this.prisma.pago.create({
        data: {
          inscripcionId: inscripcion.id,
          monto: montoPagado,
          comision: 0,
          estado: 'CONFIRMADO',
          metodoPago: 'EFECTIVO',
          jugadorId: req.user.userId,
          // FIX: fechas son String YYYY-MM-DD
          fechaPago: new Date().toISOString().split('T')[0],
          fechaConfirm: new Date().toISOString().split('T')[0],
        },
      });
    }

    return {
      success: true,
      message: 'Inscripción creada correctamente',
      inscripcion,
    };
  }

  // 
  // ═══════════════════════════════════════════════════════════
  // EDITAR INSCRIPCIÓN Y MOVER DE CATEGORÍA
  // ═══════════════════════════════════════════════════════════

  /**
   * PUT /admin/torneos/:id/inscripciones/:inscripcionId
   * Editar datos de una inscripción
   */
  @Put(':id/inscripciones/:inscripcionId')
  async editarInscripcion(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body() body: {
      jugador2Id?: string;
      jugador2Temp?: {
        nombre?: string;
        apellido?: string;
        email?: string;
        telefono?: string;
        documento?: string;
      };
      modoPago?: 'COMPLETO' | 'INDIVIDUAL';
      notas?: string;
    },
  ) {
    let updateData: any = {
      jugador2Id: body.jugador2Id,
      modoPago: body.modoPago,
      notas: body.notas,
    };

    if (body.jugador2Temp) {
      updateData.jugador2Email = body.jugador2Temp.email;
      updateData.jugador2Documento = body.jugador2Temp.documento;
    }

    if (body.jugador2Id && !body.jugador2Temp) {
      const jugador2DB = await this.prisma.user.findUnique({
        where: { id: body.jugador2Id },
        select: { documento: true, email: true },
      });
      if (jugador2DB) {
        updateData.jugador2Documento = jugador2DB.documento;
        updateData.jugador2Email = jugador2DB.email;
      }
    }

    const inscripcion = await this.prisma.inscripcion.update({
      where: { id: inscripcionId, tournamentId },
      data: updateData,
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        category: true,
      },
    });

    return {
      success: true,
      message: 'Inscripción actualizada',
      inscripcion,
    };
  }

  /**
   * PUT /admin/torneos/:id/inscripciones/:inscripcionId/cambiar-categoria
   * Mover inscripción a otra categoría
   */
  @Put(':id/inscripciones/:inscripcionId/cambiar-categoria')
  async cambiarCategoria(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body('nuevaCategoriaId') nuevaCategoriaId: string,
  ) {
    // Validar que la nueva categoría existe en el torneo
    const categoriaExiste = await this.prisma.tournamentCategory.findFirst({
      where: { tournamentId, categoryId: nuevaCategoriaId },
    });

    if (!categoriaExiste) {
      throw new BadRequestException('La categoría no existe en este torneo');
    }

    // Obtener inscripción actual
    const inscripcionActual = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId, tournamentId },
      select: { jugador1Id: true, jugador2Id: true },
    });

    if (!inscripcionActual) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    // Verificar que ninguno de los jugadores esté ya en la nueva categoría
    if (inscripcionActual.jugador1Id) {
      const existe = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId: nuevaCategoriaId,
          OR: [
            { jugador1Id: inscripcionActual.jugador1Id },
            { jugador2Id: inscripcionActual.jugador1Id },
          ],
          estado: { not: 'CANCELADA' },
          id: { not: inscripcionId },
        },
      });
      if (existe) {
        throw new BadRequestException('El jugador 1 ya está inscrito en la categoría destino');
      }
    }

    if (inscripcionActual.jugador2Id) {
      const existe = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId: nuevaCategoriaId,
          OR: [
            { jugador1Id: inscripcionActual.jugador2Id },
            { jugador2Id: inscripcionActual.jugador2Id },
          ],
          estado: { not: 'CANCELADA' },
          id: { not: inscripcionId },
        },
      });
      if (existe) {
        throw new BadRequestException('El jugador 2 ya está inscrito en la categoría destino');
      }
    }

    const inscripcion = await this.prisma.inscripcion.update({
      where: { id: inscripcionId, tournamentId },
      data: { categoryId: nuevaCategoriaId },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true } },
        category: true,
      },
    });

    return {
      success: true,
      message: 'Inscripción movida a ' + inscripcion.category.nombre,
      inscripcion,
    };
  }

  // // OVERVIEW / DASHBOARD DEL TORNEO
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /admin/torneos/:id/overview
   * Resumen ejecutivo del torneo con progreso y tareas pendientes
   */
  @Get(':id/overview')
  async getOverview(@Param('id') tournamentId: string) {
    const [
      torneo,
      inscripciones,
      categorias,
      comision,
      checklist,
      fixtureVersions,
      disponibilidad,
    ] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          id: true,
          nombre: true,
          slug: true,
          estado: true,
          fechaInicio: true,
          fechaFin: true,
          // @ts-ignore
          fechaFinales: true,
          fechaLimiteInscr: true,
          ciudad: true,
          flyerUrl: true,
          sedeId: true,
          // @ts-ignore - campos nuevos en schema
          canchasFinales: true,
          // @ts-ignore
          horaInicioFinales: true,
          // @ts-ignore
          horaFinFinales: true,
          sedePrincipal: true,
          categorias: { include: { category: true } },
          modalidades: { include: { modalidadConfig: true } },
          organizador: {
            select: { id: true, nombre: true, apellido: true, email: true },
          },
        },
      }),
      this.prisma.inscripcion.findMany({
        where: { tournamentId },
        include: {
          category: true,
          pagos: { where: { estado: 'CONFIRMADO' } },
        },
      }),
      this.prisma.tournamentCategory.findMany({
        where: { tournamentId },
        include: { category: true },
      }),
      this.prisma.torneoComision.findUnique({
        where: { tournamentId },
      }),
      this.prisma.checklistItem.findMany({
        where: { tournamentId },
      }),
      this.prisma.fixtureVersion.findMany({
        where: { tournamentId },
      }),
      this.prisma.torneoDisponibilidadDia.findMany({
        where: { tournamentId },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // FIX: fechas son String YYYY-MM-DD, calcular días diferente
    const hoy = new Date().toISOString().split('T')[0];
    const fechaInicio = torneo.fechaInicio;
    const fechaLimite = torneo.fechaLimiteInscr;
    
    // Función helper para calcular diferencia de días entre strings YYYY-MM-DD
    const diasEntre = (fecha1: string, fecha2: string): number => {
      const d1 = new Date(fecha1 + 'T12:00:00');
      const d2 = new Date(fecha2 + 'T12:00:00');
      return Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    };
    
    // Casting a string porque Prisma types aún no están actualizados
    const diasHastaInicio = fechaInicio ? diasEntre((fechaInicio as unknown) as string, hoy) : null;
    const diasHastaCierre = fechaLimite ? diasEntre((fechaLimite as unknown) as string, hoy) : null;

    const inscripcionesStats = {
      total: inscripciones.length,
      confirmadas: inscripciones.filter(i => i.estado === 'CONFIRMADA').length,
      pendientesPago: inscripciones.filter(i => i.estado === 'PENDIENTE_PAGO').length,
      pendientesConfirmacion: inscripciones.filter(i => i.estado === 'PENDIENTE_CONFIRMACION').length,
      incompletas: inscripciones.filter(i => !i.jugador2Id).length,
      ingresos: inscripciones
        .filter(i => i.estado === 'CONFIRMADA')
        .reduce((sum, i: any) => sum + (i.pagos?.reduce((pSum: number, p: any) => pSum + Number(p.monto || 0), 0) || 0), 0),
    };

    const inscripcionesPorCategoria = categorias.map(cat => {
      const insc = inscripciones.filter(i => i.categoryId === cat.categoryId);
      return {
        categoriaId: cat.categoryId,
        nombre: cat.category.nombre,
        tipo: cat.category.tipo,
        total: insc.length,
        confirmadas: insc.filter(i => i.estado === 'CONFIRMADA').length,
        pendientes: insc.filter(i => i.estado === 'PENDIENTE_PAGO' || i.estado === 'PENDIENTE_CONFIRMACION').length,
      };
    });

    const checklistTotal = checklist.length || 10;
    const checklistCompletados = checklist.filter(c => c.completado).length;
    const checklistProgress = Math.round((checklistCompletados / checklistTotal) * 100);

    const tareasPendientes: any[] = [];

    if (!torneo.flyerUrl) {
      tareasPendientes.push({
        id: 'flyer',
        tipo: 'advertencia',
        titulo: 'Subir flyer del torneo',
        descripcion: 'Un buen flyer atrae mas inscripciones',
        accion: { texto: 'Subir flyer', link: 'configuracion' },
      });
    }

    // @ts-ignore - sedeId viene del schema pero Prisma client local no lo reconoce
    if (!torneo.sedeId) {
      tareasPendientes.push({
        id: 'sede',
        tipo: 'urgente',
        titulo: 'Asignar sede principal',
        descripcion: 'Los jugadores necesitan saber donde jugar',
        accion: { texto: 'Asignar sede', link: 'disponibilidad' },
      });
    }

    if (comision?.bloqueoActivo) {
      tareasPendientes.push({
        id: 'comision',
        tipo: 'urgente',
        titulo: 'Pagar comision para desbloquear',
        descripcion: `Debes pagar Gs. ${comision.montoEstimado?.toLocaleString('es-PY')} para acceder al fixture`,
        accion: { texto: 'Pagar comision', link: 'comision' },
      });
    }

    const tieneFixture = fixtureVersions.length > 0;
    if (!tieneFixture && inscripcionesStats.confirmadas >= 4) {
      tareasPendientes.push({
        id: 'fixture',
        tipo: diasHastaInicio && diasHastaInicio <= 2 ? 'urgente' : 'advertencia',
        titulo: 'Sortear fixture',
        descripcion: `Tienes ${inscripcionesStats.confirmadas} inscripciones confirmadas. Es hora de sortear!`,
        accion: { texto: 'Sortear', link: 'bracket' },
      });
    }

    if (tieneFixture && disponibilidad.length === 0) {
      tareasPendientes.push({
        id: 'disponibilidad',
        tipo: diasHastaInicio && diasHastaInicio <= 3 ? 'urgente' : 'advertencia',
        titulo: 'Configurar disponibilidad de canchas',
        descripcion: 'Necesitas definir cuando y donde se juegan los partidos',
        accion: { texto: 'Configurar', link: 'disponibilidad' },
      });
    }

    if (diasHastaCierre !== null && diasHastaCierre <= 2 && diasHastaCierre > 0) {
      tareasPendientes.push({
        id: 'cierre',
        tipo: 'info',
        titulo: 'Cierre de inscripciones proximo',
        descripcion: `Faltan ${diasHastaCierre} dias para cerrar inscripciones`,
        accion: { texto: 'Ver inscripciones', link: 'inscripciones' },
      });
    }

    if (inscripcionesStats.pendientesPago > 0) {
      tareasPendientes.push({
        id: 'pendientes',
        tipo: 'advertencia',
        titulo: `${inscripcionesStats.pendientesPago} inscripciones pendientes de pago`,
        descripcion: 'Algunos jugadores completaron el registro pero no pagaron',
        accion: { texto: 'Revisar', link: 'inscripciones' },
      });
    }

    const requisitos = [
      { nombre: 'flyer', completado: !!torneo.flyerUrl, peso: 10 },
      // @ts-ignore - sedeId viene del schema
      { nombre: 'sede', completado: !!(torneo as any).sedeId, peso: 15 },
      { nombre: 'comision', completado: !comision?.bloqueoActivo, peso: 15 },
      { nombre: 'fixture', completado: tieneFixture, peso: 25 },
      { nombre: 'disponibilidad', completado: disponibilidad.length > 0, peso: 20 },
      { nombre: 'inscripciones', completado: inscripcionesStats.confirmadas >= 4, peso: 15 },
    ];

    const progresoGeneral = Math.round(
      requisitos.reduce((acc, r) => acc + (r.completado ? r.peso : 0), 0)
    );

    let estadoTorneo: 'configuracion' | 'inscripciones' | 'sorteo' | 'programacion' | 'en_curso' | 'finalizado';
    if (torneo.estado === 'FINALIZADO') {
      estadoTorneo = 'finalizado';
    } else if (fechaInicio && ((fechaInicio as unknown) as string) <= hoy) {
      estadoTorneo = 'en_curso';
    } else if (tieneFixture && disponibilidad.length > 0) {
      estadoTorneo = 'programacion';
    } else if (tieneFixture) {
      estadoTorneo = 'sorteo';
    } else if (torneo.estado === 'PUBLICADO') {
      estadoTorneo = 'inscripciones';
    } else {
      estadoTorneo = 'configuracion';
    }

    return {
      success: true,
      data: {
        torneo: {
          id: torneo.id,
          nombre: torneo.nombre,
          slug: torneo.slug,
          estado: torneo.estado,
          estadoProceso: estadoTorneo,
          fechaInicio: torneo.fechaInicio,
          fechaFin: torneo.fechaFin,
          // @ts-ignore
          fechaFinales: torneo.fechaFinales,
          fechaLimiteInscr: torneo.fechaLimiteInscr,
          // @ts-ignore
          canchasFinales: torneo.canchasFinales,
          // @ts-ignore
          horaInicioFinales: torneo.horaInicioFinales,
          // @ts-ignore
          horaFinFinales: torneo.horaFinFinales,
          ciudad: torneo.ciudad,
          flyerUrl: torneo.flyerUrl,
          // @ts-ignore
          sede: torneo.sedePrincipal,
          diasHastaInicio,
          diasHastaCierre,
        },
        progreso: {
          general: progresoGeneral,
          checklist: checklistProgress,
          detalle: requisitos,
        },
        inscripciones: {
          ...inscripcionesStats,
          porCategoria: inscripcionesPorCategoria,
        },
        comision: comision ? {
          estado: comision.estado,
          bloqueoActivo: comision.bloqueoActivo,
          montoEstimado: comision.montoEstimado,
          montoPagado: comision.montoPagado,
        } : null,
        tareasPendientes: tareasPendientes.slice(0, 5),
        linkPublico: `/t/${torneo.slug}`,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // GESTIÓN DE SEDES DEL TORNEO
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /admin/torneos/:id/sedes
   * Obtener sedes asignadas al torneo (con conteo de canchas activas del torneo)
   */
  @Get(':id/sedes')
  async obtenerSedes(@Param('id') tournamentId: string) {
    try {
      // Obtener sedes del torneo
      const torneoSedes = await this.prisma.torneoSede.findMany({
        where: { tournamentId },
        include: {
          sede: true,
        },
      });

      // Contar canchas activas del torneo (TorneoCancha)
      const canchasCount = await this.prisma.torneoCancha.count({
        where: { tournamentId, activa: true },
      });

      return {
        success: true,
        sedes: torneoSedes.map((ts) => ({
          id: ts.sede.id,
          nombre: ts.sede.nombre,
          ciudad: ts.sede.ciudad,
          direccion: ts.sede.direccion,
          canchas: canchasCount, // IMPORTANTE: Canchas activas del torneo, no de la sede
        })),
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error obteniendo sedes',
        error: error.message,
      });
    }
  }

  /**
   * POST /admin/torneos/:id/sedes
   * Agregar/Actualizar sede del torneo (MVP: UNA sola sede por torneo)
   */
  @Post(':id/sedes')
  async agregarSede(@Param('id') tournamentId: string, @Body() dto: { sedeId: string }) {
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

      // Verificar si la sede ya está agregada
      const sedeExistente = await this.prisma.torneoSede.findUnique({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: dto.sedeId,
          },
        },
      });

      if (sedeExistente) {
        return {
          success: false,
          message: 'La sede ya está agregada al torneo',
        };
      }

      // Calcular el orden (siguiente número disponible)
      const sedesActuales = await this.prisma.torneoSede.count({
        where: { tournamentId },
      });
      const nuevoOrden = sedesActuales;

      // Crear la nueva relación torneo-sede con orden
      const torneoSede = await this.prisma.torneoSede.create({
        data: {
          tournamentId,
          sedeId: dto.sedeId,
          orden: nuevoOrden,
        },
        include: {
          sede: true,
        },
      });
      console.log(`[agregarSede] Creada nueva relación con sede ${sede.nombre} (orden: ${nuevoOrden})`);

      // Agregar automáticamente todas las canchas activas de la sede al torneo
      const canchasCreadas = [];
      for (const cancha of sede.canchas) {
        try {
          // Intentar crear nueva cancha
          const torneoCancha = await this.prisma.torneoCancha.create({
            data: {
              tournamentId,
              sedeCanchaId: cancha.id,
              activa: true,
            },
          });
          canchasCreadas.push(torneoCancha);
        } catch (canchaError) {
          // Si ya existe, activarla
          console.log(`[agregarSede] Cancha ${cancha.id} ya existe, activando...`);
          const updated = await this.prisma.torneoCancha.updateMany({
            where: {
              tournamentId,
              sedeCanchaId: cancha.id,
            },
            data: { activa: true },
          });
          if (updated.count > 0) {
            canchasCreadas.push({ id: cancha.id, reactivada: true });
          }
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
   * DELETE /admin/torneos/:id/sedes/:sedeId
   * Quitar una sede del torneo y desactivar sus canchas
   */
  @Delete(':id/sedes/:sedeId')
  async quitarSede(@Param('id') tournamentId: string, @Param('sedeId') sedeId: string) {
    try {
      // 1. Desactivar todas las canchas de esta sede en el torneo
      const canchasDesactivadas = await this.prisma.torneoCancha.updateMany({
        where: { 
          tournamentId,
          sedeCancha: {
            sedeId: sedeId,
          },
        },
        data: { activa: false },
      });

      // 2. Eliminar la relación torneo-sede
      await this.prisma.torneoSede.delete({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId,
          },
        },
      });

      // 3. Reordenar las sedes restantes (para mantener secuencia 0,1,2...)
      const sedesRestantes = await this.prisma.torneoSede.findMany({
        where: { tournamentId },
        orderBy: { orden: 'asc' },
      });

      for (let i = 0; i < sedesRestantes.length; i++) {
        await this.prisma.torneoSede.update({
          where: { id: sedesRestantes[i].id },
          data: { orden: i },
        });
      }

      return {
        success: true,
        message: `Sede removida. ${canchasDesactivadas.count} canchas desactivadas.`,
        canchasDesactivadas: canchasDesactivadas.count,
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
   * PUT /admin/torneos/:id/sedes/:sedeId/cambiar
   * Cambiar una sede por otra (mantiene el orden)
   */
  @Put(':id/sedes/:sedeId/cambiar')
  async cambiarSede(
    @Param('id') tournamentId: string,
    @Param('sedeId') sedeIdActual: string,
    @Body() dto: { nuevaSedeId: string },
  ) {
    try {
      // 1. Obtener el orden de la sede actual
      const sedeActual = await this.prisma.torneoSede.findUnique({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: sedeIdActual,
          },
        },
      });

      if (!sedeActual) {
        throw new NotFoundException('Sede actual no encontrada');
      }

      const ordenActual = sedeActual.orden;

      // 2. Verificar que la nueva sede existe
      const nuevaSede = await this.prisma.sede.findUnique({
        where: { id: dto.nuevaSedeId },
        include: {
          canchas: { where: { activa: true } },
        },
      });

      if (!nuevaSede) {
        throw new NotFoundException('Nueva sede no encontrada');
      }

      // 3. Verificar que la nueva sede no esté ya asignada
      const sedeYaAsignada = await this.prisma.torneoSede.findUnique({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: dto.nuevaSedeId,
          },
        },
      });

      if (sedeYaAsignada) {
        return {
          success: false,
          message: 'La nueva sede ya está agregada al torneo',
        };
      }

      // 4. Desactivar canchas de la sede vieja
      await this.prisma.torneoCancha.updateMany({
        where: {
          tournamentId,
          sedeCancha: {
            sedeId: sedeIdActual,
          },
        },
        data: { activa: false },
      });

      // 5. Eliminar relación vieja
      await this.prisma.torneoSede.delete({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId: sedeIdActual,
          },
        },
      });

      // 6. Crear relación nueva con el mismo orden
      await this.prisma.torneoSede.create({
        data: {
          tournamentId,
          sedeId: dto.nuevaSedeId,
          orden: ordenActual,
        },
      });

      // 7. Agregar canchas de la nueva sede
      const canchasAgregadas = [];
      for (const cancha of nuevaSede.canchas) {
        try {
          const torneoCancha = await this.prisma.torneoCancha.create({
            data: {
              tournamentId,
              sedeCanchaId: cancha.id,
              activa: true,
            },
          });
          canchasAgregadas.push(torneoCancha);
        } catch (canchaError) {
          // Si ya existe, activarla
          const updated = await this.prisma.torneoCancha.updateMany({
            where: {
              tournamentId,
              sedeCanchaId: cancha.id,
            },
            data: { activa: true },
          });
          if (updated.count > 0) {
            canchasAgregadas.push({ id: cancha.id, reactivada: true });
          }
        }
      }

      return {
        success: true,
        message: `Sede cambiada. ${canchasAgregadas.length} canchas agregadas.`,
        sede: {
          id: nuevaSede.id,
          nombre: nuevaSede.nombre,
          ciudad: nuevaSede.ciudad,
        },
        canchasAgregadas: canchasAgregadas.length,
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error cambiando sede',
        error: error.message,
      });
    }
  }

  /**
   * PUT /admin/torneos/:id/sedes/reordenar
   * Reordenar sedes del torneo
   * Body: { ordenSedes: [{ sedeId: string, orden: number }] }
   */
  @Put(':id/sedes/reordenar')
  async reordenarSedes(
    @Param('id') tournamentId: string,
    @Body() dto: { ordenSedes: { sedeId: string; orden: number }[] },
  ) {
    try {
      // Validar que hay datos
      if (!dto.ordenSedes || !Array.isArray(dto.ordenSedes) || dto.ordenSedes.length === 0) {
        throw new BadRequestException('ordenSedes debe ser un array no vacío');
      }

      // Actualizar el orden de cada sede
      const updates = dto.ordenSedes.map(async (item) => {
        return this.prisma.torneoSede.update({
          where: {
            tournamentId_sedeId: {
              tournamentId,
              sedeId: item.sedeId,
            },
          },
          data: {
            orden: item.orden,
          },
        });
      });

      await Promise.all(updates);

      // Retornar sedes actualizadas
      const sedesActualizadas = await this.prisma.torneoSede.findMany({
        where: { tournamentId },
        include: { sede: { select: { id: true, nombre: true, ciudad: true } } },
        orderBy: { orden: 'asc' },
      });

      return {
        success: true,
        message: 'Sedes reordenadas correctamente',
        sedes: sedesActualizadas.map((s) => ({
          id: s.sede.id,
          nombre: s.sede.nombre,
          ciudad: s.sede.ciudad,
          orden: s.orden,
        })),
      };
    } catch (error: any) {
      throw new BadRequestException({
        success: false,
        message: 'Error reordenando sedes',
        error: error.message,
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // CONTROL DE PAGOS DEL ORGANIZADOR (Sistema paralelo - no relacionado con pagos premium)
  // ═════════════════════════════════════════════════════════════════

  /**
   * GET /admin/torneos/:id/control-pagos
   * Listar estado de pagos individual por jugador
   */
  @Get(':id/control-pagos')
  async listarControlPagos(
    @Param('id') tournamentId: string,
    @Request() req: any,
    @Query('filtro') filtro?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    // Verificar que el usuario es organizador del torneo
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizadorId: true, costoInscripcion: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== req.user.userId) {
      throw new ForbiddenException('No tienes permiso para ver este torneo');
    }

    const costoInscripcion = Number(torneo.costoInscripcion || 0);

    // Obtener todas las inscripciones con sus pagos
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId },
      include: {
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
        },
        controlPagos: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transformar a vista por jugador individual
    const jugadores: any[] = [];
    
    for (const insc of inscripciones) {
      // Jugador 1 siempre existe
      const pagosJ1 = insc.controlPagos.filter(p => p.jugadorId === insc.jugador1Id);
      const totalPagadoJ1 = pagosJ1.reduce((sum, p) => sum + p.monto, 0);
      const debeJ1 = Math.max(0, costoInscripcion / 2 - totalPagadoJ1);

      jugadores.push({
        inscripcionId: insc.id,
        jugadorId: insc.jugador1.id,
        jugadorNombre: `${insc.jugador1.nombre} ${insc.jugador1.apellido}`,
        jugadorTelefono: insc.jugador1.telefono,
        jugadorEmail: insc.jugador1.email,
        parejaNombre: insc.jugador2 ? `${insc.jugador2.nombre} ${insc.jugador2.apellido}` : 'Sin pareja',
        categoriaId: insc.category.id,
        categoriaNombre: insc.category.nombre,
        estadoInscripcion: insc.estado,
        costoIndividual: costoInscripcion / 2,
        totalPagado: totalPagadoJ1,
        debe: debeJ1,
        estaAlDia: debeJ1 === 0,
        pagos: pagosJ1.map(p => ({
          id: p.id,
          monto: p.monto,
          metodo: p.metodo,
          fecha: p.fecha,
          nota: p.nota,
        })),
      });

      // Jugador 2 (si existe y ya aceptó)
      if (insc.jugador2) {
        const pagosJ2 = insc.controlPagos.filter(p => p.jugadorId === insc.jugador2!.id);
        const totalPagadoJ2 = pagosJ2.reduce((sum, p) => sum + p.monto, 0);
        const debeJ2 = Math.max(0, costoInscripcion / 2 - totalPagadoJ2);

        jugadores.push({
          inscripcionId: insc.id,
          jugadorId: insc.jugador2.id,
          jugadorNombre: `${insc.jugador2.nombre} ${insc.jugador2.apellido}`,
          jugadorTelefono: insc.jugador2.telefono,
          jugadorEmail: insc.jugador2.email,
          parejaNombre: `${insc.jugador1.nombre} ${insc.jugador1.apellido}`,
          categoriaId: insc.category.id,
          categoriaNombre: insc.category.nombre,
          estadoInscripcion: insc.estado,
          costoIndividual: costoInscripcion / 2,
          totalPagado: totalPagadoJ2,
          debe: debeJ2,
          estaAlDia: debeJ2 === 0,
          pagos: pagosJ2.map(p => ({
            id: p.id,
            monto: p.monto,
            metodo: p.metodo,
            fecha: p.fecha,
            nota: p.nota,
          })),
        });
      }
    }

    // Aplicar filtros
    let filtrados = jugadores;

    if (categoriaId && categoriaId !== 'todas') {
      filtrados = filtrados.filter(j => j.categoriaId === categoriaId);
    }

    if (filtro === 'deudores') {
      filtrados = filtrados.filter(j => j.debe > 0);
    } else if (filtro === 'pagados') {
      filtrados = filtrados.filter(j => j.debe === 0);
    }

    if (busqueda) {
      const term = busqueda.toLowerCase();
      filtrados = filtrados.filter(j => 
        j.jugadorNombre.toLowerCase().includes(term) ||
        j.parejaNombre.toLowerCase().includes(term)
      );
    }

    // Calcular totales
    const totalCobrado = filtrados.reduce((sum, j) => sum + j.totalPagado, 0);
    const totalDeben = filtrados.reduce((sum, j) => sum + j.debe, 0);

    return {
      success: true,
      stats: {
        totalJugadores: filtrados.length,
        totalCobrado,
        totalDeben,
        alDia: filtrados.filter(j => j.estaAlDia).length,
        deudores: filtrados.filter(j => !j.estaAlDia).length,
      },
      jugadores: filtrados,
    };
  }

  /**
   * POST /admin/torneos/:id/control-pagos
   * Registrar un pago de un jugador
   */
  @Post(':id/control-pagos')
  async registrarPago(
    @Param('id') tournamentId: string,
    @Request() req: any,
    @Body() body: { inscripcionId: string; jugadorId: string; monto: number; metodo: 'EFECTIVO' | 'TRANSFERENCIA'; fecha: string; nota?: string },
  ) {
    // Verificar organizador
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizadorId: true, costoInscripcion: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== req.user.userId) {
      throw new ForbiddenException('No tienes permiso');
    }

    // Verificar que la inscripción existe y pertenece al torneo
    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: { 
        id: body.inscripcionId,
        tournamentId,
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    // Crear el pago
    const pago = await this.prisma.controlPagoOrganizador.create({
      data: {
        inscripcionId: body.inscripcionId,
        jugadorId: body.jugadorId,
        monto: body.monto,
        metodo: body.metodo,
        fecha: body.fecha,
        nota: body.nota,
        registradoPor: req.user.userId,
      },
    });

    return {
      success: true,
      message: 'Pago registrado correctamente',
      pago: {
        id: pago.id,
        monto: pago.monto,
        metodo: pago.metodo,
        fecha: pago.fecha,
        nota: pago.nota,
      },
    };
  }

  /**
   * DELETE /admin/torneos/:id/control-pagos/:pagoId
   * Eliminar un pago registrado (en caso de error)
   */
  @Delete(':id/control-pagos/:pagoId')
  async eliminarPago(
    @Param('id') tournamentId: string,
    @Param('pagoId') pagoId: string,
    @Request() req: any,
  ) {
    // Verificar organizador
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizadorId: true },
    });

    if (!torneo || torneo.organizadorId !== req.user.userId) {
      throw new ForbiddenException('No tienes permiso');
    }

    // Verificar que el pago existe y pertenece a una inscripción del torneo
    const pago = await this.prisma.controlPagoOrganizador.findFirst({
      where: {
        id: pagoId,
        inscripcion: { tournamentId },
      },
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    await this.prisma.controlPagoOrganizador.delete({
      where: { id: pagoId },
    });

    return {
      success: true,
      message: 'Pago eliminado correctamente',
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
