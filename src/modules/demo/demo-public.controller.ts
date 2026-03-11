import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('demo-status')
export class DemoPublicController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /demo-status
   * Endpoint público para verificar si el seed de demo se ejecutó
   * (Sin autenticación para poder diagnosticar desde el navegador)
   */
  @Get()
  async getPublicStatus() {
    try {
      const countMasc = await this.prisma.jugadorDemo.count({
        where: { genero: 'MASCULINO' },
      });
      const countFem = await this.prisma.jugadorDemo.count({
        where: { genero: 'FEMENINO' },
      });

      return {
        ok: true,
        seedEjecutado: countMasc > 0 || countFem > 0,
        jugadores: {
          masculinos: countMasc,
          femeninos: countFem,
          total: countMasc + countFem,
        },
        esperado: 400,
        mensaje:
          countMasc > 0 || countFem > 0
            ? 'Seed ejecutado correctamente'
            : 'Seed NO ejecutado. La tabla jugadores_demo está vacía o no existe.',
      };
    } catch (error: any) {
      return {
        ok: false,
        error: error.message,
        mensaje:
          'Error al consultar la base de datos. Posiblemente la tabla jugadores_demo no existe.',
        solucion:
          'Verificar que el deploy de Railway haya terminado y que prisma db push se haya ejecutado.',
      };
    }
  }
}
