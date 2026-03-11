import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { IsString, IsOptional, IsDateString, IsNumber, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// DTOs
class CreateTorneoDto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsDateString()
  @Transform(({ value }) => {
    // Si viene como YYYY-MM-DD, agregar tiempo para hacerlo ISO-8601
    if (value && typeof value === 'string' && value.length === 10) {
      return `${value}T00:00:00.000Z`;
    }
    return value;
  })
  fechaInicio: string;

  @IsDateString()
  @Transform(({ value }) => {
    if (value && typeof value === 'string' && value.length === 10) {
      return `${value}T23:59:59.999Z`;
    }
    return value;
  })
  fechaFin: string;

  @IsDateString()
  @IsOptional()
  @Transform(({ value }) => {
    if (value && typeof value === 'string' && value.length === 10) {
      return `${value}T23:59:59.999Z`;
    }
    return value;
  })
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
  constructor(private prisma: PrismaService) {}

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

    return torneos;
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
          fechaInicio: new Date(dto.fechaInicio),
          fechaFin: new Date(dto.fechaFin),
          fechaLimiteInscr: new Date(dto.fechaLimiteInscripcion || dto.fechaInicio),
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
    @Body() dto: Partial<CreateTorneoDto>,
  ) {
    try {
      const torneo = await this.prisma.tournament.update({
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
        },
      });

      return {
        success: true,
        message: 'Torneo actualizado',
        torneo,
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
        fechaRecordatorio: new Date(dto.fechaRecordatorio),
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
}
