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

// Reglas base para modalidades
const REGLAS_BASE = {
  tipoEmparejamiento: 'PAREJA_FIJA',
  generoRequerido: 'CUALQUIERA',
  sistemaPuntos: 'TRADICIONAL',
  formatoBracket: 'ELIMINACION_DIRECTA',
  setsPorPartido: 3,
  puntosPorVictoria: 100,
  puntosPorDerrota: 50,
  requierePareja: true,
  permiteIndividual: false,
  descripcionLarga: '',
  minimoPartidosGarantizados: 1,
  variante: 'MUNDIAL',
};

class CreateModalidadDto {
  nombre: string;
  descripcion: string;
  reglas?: any;
}

class UpdateModalidadDto {
  nombre?: string;
  descripcion?: string;
  activa?: boolean;
  reglas?: any;
}

@Controller('admin/modalidades')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminModalidadesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll() {
    const modalidades = await this.prisma.modalidadConfig.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: {
            torneos: true,
          },
        },
      },
    });
    return modalidades;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const modalidad = await this.prisma.modalidadConfig.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            torneos: true,
          },
        },
      },
    });

    if (!modalidad) {
      return { error: 'Modalidad no encontrada' };
    }

    return modalidad;
  }

  @Post()
  async create(@Body() dto: CreateModalidadDto) {
    try {
      const modalidad = await this.prisma.modalidadConfig.create({
        data: {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          reglas: dto.reglas || REGLAS_BASE,
          activa: true,
        },
      });

      return {
        success: true,
        message: 'Modalidad creada correctamente',
        modalidad,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error creando modalidad',
        error: error.message,
      };
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateModalidadDto) {
    try {
      // Si se envían reglas, mergear con los existentes
      let reglasActualizadas = undefined;
      if (dto.reglas) {
        const modalidadActual = await this.prisma.modalidadConfig.findUnique({
          where: { id },
        });
        const reglasActuales = modalidadActual.reglas as Record<string, any> || {};
        reglasActualizadas = { ...reglasActuales, ...dto.reglas };
      }

      const modalidad = await this.prisma.modalidadConfig.update({
        where: { id },
        data: {
          ...(dto.nombre && { nombre: dto.nombre }),
          ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
          ...(dto.activa !== undefined && { activa: dto.activa }),
          ...(reglasActualizadas && { reglas: reglasActualizadas }),
        },
      });

      return {
        success: true,
        message: 'Modalidad actualizada correctamente',
        modalidad,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error actualizando modalidad',
        error: error.message,
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      // Verificar si hay torneos usando esta modalidad
      const modalidad = await this.prisma.modalidadConfig.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              torneos: true,
            },
          },
        },
      });

      if (modalidad._count.torneos > 0) {
        return {
          success: false,
          message: 'No se puede eliminar la modalidad porque está en uso en torneos',
          uso: {
            torneos: modalidad._count.torneos,
          },
        };
      }

      await this.prisma.modalidadConfig.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Modalidad eliminada correctamente',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error eliminando modalidad',
        error: error.message,
      };
    }
  }

  @Post('seed-defaults')
  @Roles('admin')
  async seedDefaults() {
    const modalidades = [
      // ═══════════════════════════════════════════════════════════
      // CLÁSICO
      // ═══════════════════════════════════════════════════════════
      {
        nombre: 'Clásico PY',
        descripcion: 'Modalidad tradicional paraguaya. Todos juegan mínimo 2 partidos.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'PY',
          tipoEmparejamiento: 'PAREJA_FIJA',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'GARANTIZADO_2_PARTIDOS',
          setsPorPartido: 3,
          requierePareja: true,
          minimoPartidosGarantizados: 2,
          descripcionLarga: 'Formato tradicional de Paraguay. Cada jugador forma pareja fija y garantiza jugar al menos 2 partidos.',
        },
      },
      {
        nombre: 'Clásico Mundo',
        descripcion: 'Modalidad clásica internacional. Eliminación directa pura.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'MUNDIAL',
          tipoEmparejamiento: 'PAREJA_FIJA',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'ELIMINACION_DIRECTA',
          setsPorPartido: 3,
          requierePareja: true,
          minimoPartidosGarantizados: 1,
          descripcionLarga: 'Formato internacional de eliminación directa. Pierdes un partido y quedas eliminado.',
        },
      },
      // ═══════════════════════════════════════════════════════════
      // MIXTO
      // ═══════════════════════════════════════════════════════════
      {
        nombre: 'Mixto PY',
        descripcion: 'Modalidad mixta paraguaya. 1 hombre + 1 mujer, mínimo 2 partidos.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'PY',
          tipoEmparejamiento: 'PAREJA_FIJA',
          generoRequerido: 'MIXTO',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'GARANTIZADO_2_PARTIDOS',
          setsPorPartido: 3,
          requierePareja: true,
          minimoPartidosGarantizados: 2,
          descripcionLarga: 'Cada pareja está conformada por un jugador masculino y uno femenino. Todos garantizan jugar al menos 2 partidos.',
        },
      },
      {
        nombre: 'Mixto Mundo',
        descripcion: 'Modalidad mixta internacional. Eliminación directa.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'MUNDIAL',
          tipoEmparejamiento: 'PAREJA_FIJA',
          generoRequerido: 'MIXTO',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'ELIMINACION_DIRECTA',
          setsPorPartido: 3,
          requierePareja: true,
          minimoPartidosGarantizados: 1,
          descripcionLarga: 'Pareja mixta con eliminación directa. Pierdes, quedas fuera.',
        },
      },
      // ═══════════════════════════════════════════════════════════
      // SUMA
      // ═══════════════════════════════════════════════════════════
      {
        nombre: 'Suma PY',
        descripcion: 'Formato suma paraguayo. Rotación de parejas, todos juegan igual.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'PY',
          tipoEmparejamiento: 'ROTATIVO',
          sistemaPuntos: 'SUMA',
          formatoBracket: 'LIGA_ROTATIVA_PY',
          setsPorPartido: 1,
          puntosPorVictoria: 100,
          puntosPorDerrota: 50,
          requierePareja: false,
          permiteIndividual: true,
          descripcionLarga: 'Los jugadores rotan parejas según el sistema paraguayo. Se acumulan puntos individuales.',
        },
      },
      {
        nombre: 'Suma Mundo',
        descripcion: 'Formato suma internacional. Rotación suiza.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'MUNDIAL',
          tipoEmparejamiento: 'ROTATIVO',
          sistemaPuntos: 'SUMA',
          formatoBracket: 'SUIZO',
          setsPorPartido: 1,
          puntosPorVictoria: 100,
          puntosPorDerrota: 50,
          requierePareja: false,
          permiteIndividual: true,
          descripcionLarga: 'Rotación de parejas estilo suizo. Los emparejamientos se ajustan según el desempeño.',
        },
      },
      // ═══════════════════════════════════════════════════════════
      // AMERICANO
      // ═══════════════════════════════════════════════════════════
      {
        nombre: 'Americano PY',
        descripcion: 'Americano a la paraguaya. Rotación aleatoria, mismas oportunidades.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'PY',
          tipoEmparejamiento: 'ROTATIVO',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'AMERICANO_PY',
          setsPorPartido: 1,
          puntosPorVictoria: 2,
          puntosPorDerrota: 1,
          requierePareja: false,
          permiteIndividual: true,
          descripcionLarga: 'Los jugadores cambian de pareja en cada partido según sorteo aleatorio. Todos juegan la misma cantidad de partidos.',
        },
      },
      {
        nombre: 'Americano Mundo',
        descripcion: 'Americano internacional. Rotación por ranking.',
        reglas: {
          ...REGLAS_BASE,
          variante: 'MUNDIAL',
          tipoEmparejamiento: 'ROTATIVO',
          sistemaPuntos: 'TRADICIONAL',
          formatoBracket: 'AMERICANO_SUIZO',
          setsPorPartido: 1,
          puntosPorVictoria: 2,
          puntosPorDerrota: 1,
          requierePareja: false,
          permiteIndividual: true,
          descripcionLarga: 'Rotación de parejas basada en ranking y resultados.',
        },
      },
    ];

    const creadas = [];
    const existentes = [];

    for (const modalidad of modalidades) {
      const existente = await this.prisma.modalidadConfig.findUnique({
        where: { nombre: modalidad.nombre },
      });

      if (!existente) {
        const creada = await this.prisma.modalidadConfig.create({
          data: {
            ...modalidad,
            activa: true,
          },
        });
        creadas.push(creada);
      } else {
        existentes.push(existente.nombre);
      }
    }

    return {
      success: true,
      message: `${creadas.length} modalidades creadas, ${existentes.length} ya existían`,
      creadas: creadas.map(m => m.nombre),
      existentes,
    };
  }
}
