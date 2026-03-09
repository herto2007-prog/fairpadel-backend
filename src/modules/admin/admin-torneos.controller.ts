import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsDateString, IsNumber, IsArray, IsEnum } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TournamentStatus, TipoCancha } from '@prisma/client';

// DTOs para el Wizard
class CreateTorneoBasicoDto {
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
}

class AsignarModalidadesDto {
  @IsArray()
  modalidadIds: string[];
}

class AsignarCategoriasDto {
  @IsArray()
  categoriaIds: string[];
}

class ConfigurarBracketDto {
  @IsString()
  formato: string; // ELIMINACION_DIRECTA, GRUPOS, LIGA, etc.

  @IsNumber()
  @IsOptional()
  setsPorPartido?: number;

  @IsNumber()
  @IsOptional()
  puntosPorVictoria?: number;

  @IsNumber()
  @IsOptional()
  puntosPorDerrota?: number;

  @IsNumber()
  @IsOptional()
  minutosPorPartido?: number;
}

@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminTorneosController {
  constructor(private prisma: PrismaService) {}

  /**
   * Listar todos los torneos (admin ve todos, organizador ve los suyos)
   */
  @Get()
  async findAll(@Body('user') user: any) {
    const where = user.roles.includes('admin') 
      ? {} 
      : { organizadorId: user.id };

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

  /**
   * Crear torneo básico (Paso 1 del Wizard)
   */
  @Post()
  async create(@Body() dto: CreateTorneoBasicoDto, @Body('user') user: any) {
    try {
      // Generar slug único
      const slug = dto.nombre
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

      const torneo = await this.prisma.tournament.create({
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

      return {
        success: true,
        message: 'Torneo creado correctamente',
        torneo,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creando torneo',
        error: error.message,
      };
    }
  }

  /**
   * Asignar modalidades al torneo (Paso 2)
   */
  @Post(':id/modalidades')
  async asignarModalidades(
    @Param('id') torneoId: string,
    @Body() dto: AsignarModalidadesDto,
  ) {
    try {
      // Eliminar modalidades existentes
      await this.prisma.tournamentModalidad.deleteMany({
        where: { tournamentId: torneoId },
      });

      // Crear nuevas relaciones
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

  /**
   * Asignar categorías al torneo (Paso 2 alternativo)
   */
  @Post(':id/categorias')
  async asignarCategorias(
    @Param('id') torneoId: string,
    @Body() dto: AsignarCategoriasDto,
  ) {
    try {
      // Eliminar categorías existentes
      await this.prisma.tournamentCategory.deleteMany({
        where: { tournamentId: torneoId },
      });

      // Crear nuevas relaciones
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

  /**
   * Configurar bracket y reglas (Paso 3)
   */
  @Put(':id/configuracion')
  async configurarBracket(
    @Param('id') torneoId: string,
    @Body() dto: ConfigurarBracketDto,
  ) {
    try {
      const torneo = await this.prisma.tournament.update({
        where: { id: torneoId },
        data: {
          ...(dto.setsPorPartido && { setsPorPartido: dto.setsPorPartido }),
          ...(dto.minutosPorPartido && { minutosPorPartido: dto.minutosPorPartido }),
        },
      });

      return {
        success: true,
        message: 'Configuración actualizada',
        torneo,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error actualizando configuración',
        error: error.message,
      };
    }
  }

  /**
   * Publicar torneo (Paso final)
   */
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

  /**
   * Obtener datos para el wizard (sedes, modalidades, categorías disponibles)
   */
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

  /**
   * Obtener detalle completo de un torneo
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
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
              canchas: {
                where: { activa: true },
              },
            },
          },
          torneoSedes: {
            include: { sede: true },
          },
          _count: {
            select: { inscripciones: true },
          },
        },
      });

      if (!torneo) {
        return { error: 'Torneo no encontrado' };
      }

      return torneo;
    } catch (error) {
      return {
        success: false,
        message: 'Error obteniendo torneo',
        error: error.message,
      };
    }
  }

  /**
   * Actualizar torneo básico
   */
  @Put(':id')
  async update(
    @Param('id') torneoId: string,
    @Body() dto: Partial<CreateTorneoBasicoDto>,
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

  /**
   * Eliminar torneo
   */
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
}
