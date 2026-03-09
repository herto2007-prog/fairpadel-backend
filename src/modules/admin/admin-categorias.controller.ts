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
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Gender } from '@prisma/client';

class CreateCategoriaDto {
  nombre: string;
  tipo: Gender;
  orden: number;
}

class UpdateCategoriaDto {
  nombre?: string;
  tipo?: Gender;
  orden?: number;
}

@Controller('admin/categorias')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminCategoriasController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll() {
    const categorias = await this.prisma.category.findMany({
      orderBy: { orden: 'asc' },
      include: {
        _count: {
          select: {
            torneos: true,
            usuariosActuales: true,
          },
        },
      },
    });
    return categorias;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const categoria = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            torneos: true,
            usuariosActuales: true,
          },
        },
      },
    });

    if (!categoria) {
      return { error: 'Categoría no encontrada' };
    }

    return categoria;
  }

  @Post()
  async create(@Body() dto: CreateCategoriaDto) {
    try {
      const categoria = await this.prisma.category.create({
        data: {
          nombre: dto.nombre,
          tipo: dto.tipo,
          orden: dto.orden,
        },
      });

      return {
        success: true,
        message: 'Categoría creada correctamente',
        categoria,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creando categoría',
        error: error.message,
      };
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoriaDto) {
    try {
      const categoria = await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.nombre && { nombre: dto.nombre }),
          ...(dto.tipo && { tipo: dto.tipo }),
          ...(dto.orden !== undefined && { orden: dto.orden }),
        },
      });

      return {
        success: true,
        message: 'Categoría actualizada correctamente',
        categoria,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error actualizando categoría',
        error: error.message,
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      // Verificar si hay usuarios o torneos usando esta categoría
      const categoria = await this.prisma.category.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              torneos: true,
              usuariosActuales: true,
            },
          },
        },
      });

      if (categoria._count.torneos > 0 || categoria._count.usuariosActuales > 0) {
        return {
          success: false,
          message: 'No se puede eliminar la categoría porque está en uso',
          uso: {
            torneos: categoria._count.torneos,
            usuarios: categoria._count.usuariosActuales,
          },
        };
      }

      await this.prisma.category.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Categoría eliminada correctamente',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error eliminando categoría',
        error: error.message,
      };
    }
  }
}
