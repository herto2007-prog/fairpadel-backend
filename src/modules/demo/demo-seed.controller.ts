import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { Gender } from '@prisma/client';

@Controller('admin/demo/seed')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DemoSeedController {
  constructor(private prisma: PrismaService) {}

  /**
   * POST /admin/demo/seed/ejecutar
   * Ejecuta el seed de jugadores demo manualmente
   */
  @Post('ejecutar')
  async ejecutarSeed() {
    try {
      console.log('🌱 ==========================================');
      console.log('🌱 EJECUTANDO SEED DE JUGADORES DEMO');
      console.log('🌱 ==========================================');

      // Obtener categorías
      const categorias = await this.prisma.category.findMany({
        orderBy: { orden: 'asc' },
      });

      const categoriasMasc = categorias.filter((c) => c.tipo === 'MASCULINO');
      const categoriasFem = categorias.filter((c) => c.tipo === 'FEMENINO');

      if (categoriasMasc.length === 0 || categoriasFem.length === 0) {
        return {
          success: false,
          message: 'No hay categorías suficientes. Ejecutar seed de categorías primero.',
          categoriasMasc: categoriasMasc.length,
          categoriasFem: categoriasFem.length,
        };
      }

      // Verificar si ya existen
      const existingCount = await this.prisma.jugadorDemo.count();
      if (existingCount > 0) {
        return {
          success: true,
          message: `Ya existen ${existingCount} jugadores demo. No se crearon nuevos.`,
          existingCount,
        };
      }

      const jugadores = [];

      // 200 masculinos
      for (let i = 1; i <= 200; i++) {
        const categoriaIndex = (i - 1) % categoriasMasc.length;
        const categoria = categoriasMasc[categoriaIndex];
        
        jugadores.push({
          nombre: `Player ${i}`,
          apellido: `Masculino ${i}`,
          documento: `DEMO-M-${String(i).padStart(5, '0')}`,
          email: `demo.m${i}@fairpadel.test`,
          telefono: `+595991${String(i).padStart(6, '0')}`,
          genero: Gender.MASCULINO,
          categoriaId: categoria.id,
        });
      }

      // 200 femeninas
      for (let i = 1; i <= 200; i++) {
        const categoriaIndex = (i - 1) % categoriasFem.length;
        const categoria = categoriasFem[categoriaIndex];
        
        jugadores.push({
          nombre: `Player ${i}`,
          apellido: `Femenino ${i}`,
          documento: `DEMO-F-${String(i).padStart(5, '0')}`,
          email: `demo.f${i}@fairpadel.test`,
          telefono: `+595992${String(i).padStart(6, '0')}`,
          genero: Gender.FEMENINO,
          categoriaId: categoria.id,
        });
      }

      // Insertar
      const batchSize = 50;
      let inserted = 0;
      for (let i = 0; i < jugadores.length; i += batchSize) {
        const batch = jugadores.slice(i, i + batchSize);
        const result = await this.prisma.jugadorDemo.createMany({
          data: batch,
          skipDuplicates: true,
        });
        inserted += result.count;
        console.log(`  ✅ Insertados ${inserted}/${jugadores.length} jugadores`);
      }

      return {
        success: true,
        message: `Seed completado: ${inserted} jugadores demo creados`,
        total: inserted,
        masculinos: 200,
        femeninos: 200,
      };
    } catch (error: any) {
      console.error('❌ Error en seed:', error);
      return {
        success: false,
        message: 'Error ejecutando seed',
        error: error.message,
        stack: error.stack,
      };
    }
  }
}
