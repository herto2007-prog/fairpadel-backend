import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsOptional, IsDateString, IsNumber, IsArray, IsUUID } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// DTOs
class CreateTorneoV2Dto {
  @IsString()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsDateString()
  fechaLimiteInscripcion: string;

  @IsString()
  ciudad: string;

  @IsNumber()
  costoInscripcion: number;

  @IsString()
  @IsOptional()
  sedeId?: string;

  @IsString()
  @IsOptional()
  flyerUrl?: string;

  @IsArray()
  @IsOptional()
  modalidadIds?: string[];

  @IsArray()
  @IsOptional()
  categoriaIds?: string[];
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

@Controller('admin/torneos/v2')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminTorneosV2Controller {
  constructor(private prisma: PrismaService) {}

  /**
   * Crear torneo completo con checklist automático
   * Versión 2: Incluye checklist, comisión tracking, configuración inicial
   */
  @Post()
  async create(@Body() dto: CreateTorneoV2Dto, @Body('user') user: any) {
    try {
      // Obtener configuración de comisión
      const configComision = await this.prisma.fairpadelConfig.findUnique({
        where: { clave: 'COMISION_POR_JUGADOR' },
      });
      const comisionPorJugador = parseInt(configComision?.valor || '0');

      // Crear torneo en transacción
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Crear torneo base
        const slug = dto.nombre
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

        const torneo = await tx.tournament.create({
          data: {
            nombre: dto.nombre,
            descripcion: dto.descripcion || '',
            fechaInicio: dto.fechaInicio,
            fechaFin: dto.fechaFin,
            fechaLimiteInscr: dto.fechaLimiteInscripcion,
            ciudad: dto.ciudad,
            costoInscripcion: dto.costoInscripcion,
            organizadorId: user.id,
            estado: 'BORRADOR',
            pais: 'Paraguay',
            region: dto.ciudad,
            flyerUrl: dto.flyerUrl || '',
            sedeId: dto.sedeId || null,
            slug,
            minutosPorPartido: 60,
          },
        });

        // 2. Crear registro de comisión (inicialmente en 0)
        await tx.torneoComision.create({
          data: {
            tournamentId: torneo.id,
            montoEstimado: 0,
            montoPagado: 0,
            estado: 'PENDIENTE',
            bloqueoActivo: false,
          },
        });

        // 3. Crear checklist desde template por defecto
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

        // 4. Asignar modalidades si se proporcionaron
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

        // 5. Asignar categorías si se proporcionaron
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

      return {
        success: true,
        message: 'Torneo creado correctamente con checklist inicial',
        torneo: result,
        comisionPorJugador,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error creando torneo',
        error: error.message,
      });
    }
  }

  /**
   * Obtener torneo con toda la información V2
   * Incluye: comisión, checklist, estadísticas de inscripciones
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
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
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Datos V2
    const [comision, checklist, configComision] = await Promise.all([
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

    // Calcular estadísticas de inscripciones
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId: id },
      select: { estado: true },
    });

    const stats = {
      total: inscripciones.length,
      confirmadas: inscripciones.filter(i => i.estado === 'CONFIRMADA').length,
      pendientesPago: inscripciones.filter(i => i.estado === 'PENDIENTE_PAGO').length,
    };

    // Actualizar monto estimado de comisión
    const comisionPorJugador = parseInt(configComision?.valor || '0');
    const montoEstimado = stats.confirmadas * 2 * comisionPorJugador; // 2 jugadores por pareja

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

  /**
   * Obtener checklist del torneo
   */
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

  /**
   * Completar ítem del checklist
   */
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

  /**
   * Configurar recordatorio para ítem del checklist
   */
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

  /**
   * Subir comprobante de pago de comisión
   */
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

  /**
   * Verificar estado de bloqueo del torneo
   * Retorna si está bloqueado y el motivo
   */
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
