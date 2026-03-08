import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Gender } from '@prisma/client';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('🌱 Verificando datos iniciales...');
    await this.seedCategories();
    await this.seedRoles();
    this.logger.log('✅ Datos iniciales verificados');
  }

  private async seedCategories() {
    // Categorías del sistema paraguayo de pádel
    const categoriasMasculinas = [
      { nombre: 'Principiante', tipo: Gender.MASCULINO, orden: 0 },
      { nombre: '8ª Categoría', tipo: Gender.MASCULINO, orden: 1 },
      { nombre: '7ª Categoría', tipo: Gender.MASCULINO, orden: 2 },
      { nombre: '6ª Categoría', tipo: Gender.MASCULINO, orden: 3 },
      { nombre: '5ª Categoría', tipo: Gender.MASCULINO, orden: 4 },
      { nombre: '4ª Categoría', tipo: Gender.MASCULINO, orden: 5 },
      { nombre: '3ª Categoría', tipo: Gender.MASCULINO, orden: 6 },
      { nombre: '2ª Categoría', tipo: Gender.MASCULINO, orden: 7 },
      { nombre: '1ª Categoría', tipo: Gender.MASCULINO, orden: 8 },
    ];

    const categoriasFemeninas = [
      { nombre: 'Principiante Femenino', tipo: Gender.FEMENINO, orden: 0 },
      { nombre: '8ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 1 },
      { nombre: '7ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 2 },
      { nombre: '6ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 3 },
      { nombre: '5ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 4 },
      { nombre: '4ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 5 },
      { nombre: '3ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 6 },
      { nombre: '2ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 7 },
      { nombre: '1ª Categoría Femenina', tipo: Gender.FEMENINO, orden: 8 },
    ];

    const todasLasCategorias = [...categoriasMasculinas, ...categoriasFemeninas];

    for (const categoria of todasLasCategorias) {
      await this.prisma.category.upsert({
        where: { nombre: categoria.nombre },
        update: {}, // No actualizar si ya existe
        create: categoria,
      });
    }

    this.logger.log('✅ Categorías verificadas');
  }

  private async seedRoles() {
    const roles = [
      { nombre: 'jugador', descripcion: 'Jugador de pádel' },
      { nombre: 'admin', descripcion: 'Administrador del sistema' },
      { nombre: 'organizador', descripcion: 'Organizador de torneos' },
    ];

    for (const rol of roles) {
      await this.prisma.role.upsert({
        where: { nombre: rol.nombre },
        update: {},
        create: rol,
      });
    }

    this.logger.log('✅ Roles verificados');
  }
}
