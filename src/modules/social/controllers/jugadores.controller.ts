import {
  Controller,
  Get,
  Query,
  Param,
  Header,
} from '@nestjs/common';
import { JugadoresService } from '../services/jugadores.service';
import { BuscarJugadoresDto } from '../dto/buscar-jugadores.dto';
import { Public } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('users')
export class JugadoresController {
  constructor(
    private readonly jugadoresService: JugadoresService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /users/buscar
   * Buscar jugadores con filtros (público)
   *
   * Query params:
   * - q: string (búsqueda por nombre/apellido)
   * - ciudad: string
   * - categoriaId: string
   * - page: number (default: 1)
   * - limit: number (default: 20)
   * - _t: string (cache buster, ignorado)
   */
  @Get('buscar')
  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('CDN-Cache-Control', 'no-store')
  @Header('Cloudflare-CDN-Cache-Control', 'no-store')
  async buscarJugadores(@Query() query: BuscarJugadoresDto) {
    console.log('🔥 ENDPOINT /users/buscar LLAMADO');
    console.log('Query params:', query);

    const result = await this.jugadoresService.buscarJugadores({
      q: query.q,
      ciudad: query.ciudad,
      categoriaId: query.categoriaId,
      page: query.page || 1,
      limit: query.limit || 20,
    });

    return {
      success: true,
      data: result.users,
      pagination: result.pagination,
    };
  }

  /**
   * GET /users/filtros/datos
   * Obtener ciudades y categorías disponibles para filtros
   */
  @Get('filtros/datos')
  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('CDN-Cache-Control', 'no-store')
  async getDatosFiltros() {
    const data = await this.jugadoresService.getDatosFiltros();

    return {
      success: true,
      data,
    };
  }

  /**
   * GET /users/debug
   * Debug: Ver todos los usuarios sin filtros
   */
  @Get('debug')
  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('CDN-Cache-Control', 'no-store')
  async debugUsuarios() {
    // Contar todos los usuarios por estado
    const todos = await this.prisma.user.count();
    const activos = await this.prisma.user.count({ where: { estado: 'ACTIVO' } });
    const noVerificados = await this.prisma.user.count({ where: { estado: 'NO_VERIFICADO' } });
    const inactivos = await this.prisma.user.count({ where: { estado: 'INACTIVO' } });
    const suspendidos = await this.prisma.user.count({ where: { estado: 'SUSPENDIDO' } });

    // Traer 5 usuarios de ejemplo
    const ejemplos = await this.prisma.user.findMany({
      take: 5,
      select: { id: true, nombre: true, apellido: true, estado: true, email: true, documento: true },
    });

    return {
      success: true,
      data: {
        conteos: { todos, activos, noVerificados, inactivos, suspendidos },
        ejemplos,
      },
    };
  }

  /**
   * GET /users/debug/buscar-doc/:doc
   * Debug: Buscar por documento con raw query limpia
   */
  @Get('debug/buscar-doc/:doc')
  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('CDN-Cache-Control', 'no-store')
  async debugBuscarDocumento(@Param('doc') doc: string) {
    const searchTerm = doc.trim();
    const digitsOnly = searchTerm.replace(/\D/g, '');

    // Raw query exacta que usamos en buscarJugadores
    const rawUsers = await this.prisma.$queryRaw<{ id: string; nombre: string; apellido: string; documento: string; estado: string }[]>`
      SELECT id, nombre, apellido, documento, estado
      FROM "User"
      WHERE estado IN ('ACTIVO', 'NO_VERIFICADO')
        AND REPLACE(REPLACE(REPLACE(documento, '.', ''), '-', ''), ' ', '') ILIKE ${'%' + digitsOnly + '%'}
      ORDER BY nombre ASC, apellido ASC
      LIMIT 10
    `;

    // También buscar sin limpiar (contains normal)
    const normalUsers = await this.prisma.user.findMany({
      where: {
        estado: { in: ['ACTIVO', 'NO_VERIFICADO'] },
        documento: { contains: searchTerm, mode: 'insensitive' },
      },
      select: { id: true, nombre: true, apellido: true, documento: true, estado: true },
      take: 10,
    });

    return {
      success: true,
      data: {
        searchTerm,
        digitsOnly,
        rawResults: rawUsers,
        normalResults: normalUsers,
      },
    };
  }
}
