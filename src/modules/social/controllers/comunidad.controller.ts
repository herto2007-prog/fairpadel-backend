import {
  Controller,
  Get,
  Header,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('comunidad')
export class ComunidadController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /comunidad/jugadores
   * Trae TODOS los jugadores sin filtros de estado
   * Endpoint simple sin validaciones complejas
   */
  @Get('jugadores')
  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getJugadoresSimple() {
    console.log('🔥 ENDPOINT /comunidad/jugadores LLAMADO');

    try {
      // Traer todos los usuarios con datos básicos (sin filtro de estado)
      const usuarios = await this.prisma.user.findMany({
        take: 50, // Limitar a 50 para no sobrecargar
        select: {
          id: true,
          nombre: true,
          apellido: true,
          fotoUrl: true,
          ciudad: true,
          pais: true,
          estado: true,
          categoriaActual: {
            select: {
              id: true,
              nombre: true,
            },
          },
          _count: {
            select: {
              seguidores: true,
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
      });

      console.log(`✅ Encontrados ${usuarios.length} usuarios`);

      // Formatear respuesta
      const jugadores = usuarios.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        fotoUrl: u.fotoUrl,
        ciudad: u.ciudad,
        pais: u.pais,
        estado: u.estado,
        categoria: u.categoriaActual,
        seguidores: u._count.seguidores,
      }));

      return {
        success: true,
        count: jugadores.length,
        data: jugadores,
      };
    } catch (error) {
      console.error('❌ Error en /comunidad/jugadores:', error);
      return {
        success: false,
        message: 'Error al obtener jugadores',
        error: error.message,
      };
    }
  }

  /**
   * GET /comunidad/stats
   * Stats básicas para debug
   */
  @Get('stats')
  @Public()
  async getStats() {
    try {
      const total = await this.prisma.user.count();
      const conFoto = await this.prisma.user.count({
        where: { fotoUrl: { not: null } },
      });

      return {
        success: true,
        data: {
          totalUsuarios: total,
          usuariosConFoto: conFoto,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
