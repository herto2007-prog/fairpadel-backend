import { Controller, Get, Param } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('modalidades')
export class ModalidadesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll() {
    const modalidades = await this.prisma.modalidadConfig.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        reglas: true,
      },
    });
    return modalidades;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const modalidad = await this.prisma.modalidadConfig.findUnique({
      where: { id, activa: true },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        reglas: true,
      },
    });

    if (!modalidad) {
      return { error: 'Modalidad no encontrada' };
    }

    return modalidad;
  }
}
