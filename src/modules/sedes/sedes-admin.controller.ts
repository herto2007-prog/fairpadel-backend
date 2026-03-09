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
import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { TipoCancha } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// DTOs con validaciones
class CreateSedeDto {
  @IsString()
  nombre: string;

  @IsString()
  ciudad: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  mapsUrl?: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}

class UpdateSedeDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  mapsUrl?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

// DTOs para Canchas
class CreateCanchaDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsEnum(TipoCancha)
  tipo?: TipoCancha;

  @IsOptional()
  @IsBoolean()
  tieneLuz?: boolean;
}

class UpdateCanchaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEnum(TipoCancha)
  tipo?: TipoCancha;

  @IsOptional()
  @IsBoolean()
  tieneLuz?: boolean;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

@Controller('admin/sedes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class SedesAdminController {
  constructor(private prisma: PrismaService) {}

  /**
   * Listar todas las sedes con sus canchas
   */
  @Get()
  async findAll() {
    const sedes = await this.prisma.sede.findMany({
      include: {
        canchas: {
          where: { activa: true },
          orderBy: { nombre: 'asc' },
        },
        _count: {
          select: {
            canchas: true,
            torneosPrincipal: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    return sedes;
  }

  /**
   * Obtener una sede por ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
      include: {
        canchas: {
          orderBy: { nombre: 'asc' },
        },
      },
    });

    if (!sede) {
      return { error: 'Sede no encontrada' };
    }

    return sede;
  }

  /**
   * Crear nueva sede
   */
  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateSedeDto) {
    try {
      const sede = await this.prisma.sede.create({
        data: {
          nombre: dto.nombre,
          ciudad: dto.ciudad,
          direccion: dto.direccion,
          mapsUrl: dto.mapsUrl,
          telefono: dto.telefono,
          activa: true,
        },
      });

      return {
        success: true,
        message: 'Sede creada correctamente',
        sede,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creando sede',
        error: error.message,
      };
    }
  }

  /**
   * Actualizar sede
   */
  @Put(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateSedeDto) {
    try {
      const sede = await this.prisma.sede.update({
        where: { id },
        data: {
          ...(dto.nombre && { nombre: dto.nombre }),
          ...(dto.ciudad && { ciudad: dto.ciudad }),
          ...(dto.direccion !== undefined && { direccion: dto.direccion }),
          ...(dto.mapsUrl !== undefined && { mapsUrl: dto.mapsUrl }),
          ...(dto.telefono !== undefined && { telefono: dto.telefono }),
          ...(dto.activa !== undefined && { activa: dto.activa }),
        },
      });

      return {
        success: true,
        message: 'Sede actualizada correctamente',
        sede,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error actualizando sede',
        error: error.message,
      };
    }
  }

  /**
   * Eliminar sede (soft delete - desactivar)
   */
  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    try {
      // Soft delete: desactivar en lugar de borrar
      const sede = await this.prisma.sede.update({
        where: { id },
        data: { activa: false },
      });

      return {
        success: true,
        message: 'Sede desactivada correctamente',
        sede,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error desactivando sede',
        error: error.message,
      };
    }
  }

  /**
   * Reactivar sede
   */
  @Put(':id/activate')
  @Roles('admin')
  async activate(@Param('id') id: string) {
    try {
      const sede = await this.prisma.sede.update({
        where: { id },
        data: { activa: true },
      });

      return {
        success: true,
        message: 'Sede reactivada correctamente',
        sede,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error reactivando sede',
        error: error.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CANCHAS
  // ═══════════════════════════════════════════════════════════

  /**
   * Listar canchas de una sede
   */
  @Get(':id/canchas')
  async findCanchas(@Param('id') sedeId: string) {
    const canchas = await this.prisma.sedeCancha.findMany({
      where: { sedeId, activa: true },
      orderBy: { nombre: 'asc' },
    });
    return canchas;
  }

  /**
   * Crear cancha en una sede
   */
  @Post(':id/canchas')
  @Roles('admin')
  async createCancha(
    @Param('id') sedeId: string,
    @Body() dto: CreateCanchaDto,
  ) {
    try {
      const cancha = await this.prisma.sedeCancha.create({
        data: {
          sedeId,
          nombre: dto.nombre,
          tipo: dto.tipo || TipoCancha.CEMENTO,
          tieneLuz: dto.tieneLuz ?? false,
          activa: true,
        },
      });

      return {
        success: true,
        message: 'Cancha creada correctamente',
        cancha,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creando cancha',
        error: error.message,
      };
    }
  }

  /**
   * Actualizar cancha
   */
  @Put('canchas/:canchaId')
  @Roles('admin')
  async updateCancha(
    @Param('canchaId') canchaId: string,
    @Body() dto: UpdateCanchaDto,
  ) {
    try {
      const cancha = await this.prisma.sedeCancha.update({
        where: { id: canchaId },
        data: {
          ...(dto.nombre && { nombre: dto.nombre }),
          ...(dto.tipo && { tipo: dto.tipo }),
          ...(dto.tieneLuz !== undefined && { tieneLuz: dto.tieneLuz }),
          ...(dto.activa !== undefined && { activa: dto.activa }),
        },
      });

      return {
        success: true,
        message: 'Cancha actualizada correctamente',
        cancha,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error actualizando cancha',
        error: error.message,
      };
    }
  }

  /**
   * Eliminar cancha (soft delete)
   */
  @Delete('canchas/:canchaId')
  @Roles('admin')
  async removeCancha(@Param('canchaId') canchaId: string) {
    try {
      const cancha = await this.prisma.sedeCancha.update({
        where: { id: canchaId },
        data: { activa: false },
      });

      return {
        success: true,
        message: 'Cancha desactivada correctamente',
        cancha,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error desactivando cancha',
        error: error.message,
      };
    }
  }

  /**
   * Reactivar cancha
   */
  @Put('canchas/:canchaId/activate')
  @Roles('admin')
  async activateCancha(@Param('canchaId') canchaId: string) {
    try {
      const cancha = await this.prisma.sedeCancha.update({
        where: { id: canchaId },
        data: { activa: true },
      });

      return {
        success: true,
        message: 'Cancha reactivada correctamente',
        cancha,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error reactivando cancha',
        error: error.message,
      };
    }
  }
}
