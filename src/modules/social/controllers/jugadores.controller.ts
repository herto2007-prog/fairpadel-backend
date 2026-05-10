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
      _debug: {
        version: '2025-05-08-memfilter-v1',
        q: query.q,
        esDocumento: /^\d{5,}$/.test((query.q || '').replace(/\D/g, '')),
        total: result.pagination.total,
      },
    };
  }

  /**
   * GET /users/filtros/datos
   */
  @Get('filtros/datos')
  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('CDN-Cache-Control', 'no-store')
  async getDatosFiltros() {
    const data = await this.jugadoresService.getDatosFiltros();
    return { success: true, data };
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
    try {
      const todos = await this.prisma.user.count();
      const activos = await this.prisma.user.count({ where: { estado: 'ACTIVO' } });
      const noVerificados = await this.prisma.user.count({ where: { estado: 'NO_VERIFICADO' } });
      const inactivos = await this.prisma.user.count({ where: { estado: 'INACTIVO' } });
      const suspendidos = await this.prisma.user.count({ where: { estado: 'SUSPENDIDO' } });

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
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        stack: err.stack,
      };
    }
  }

  /**
   * GET /users/debug/version
   * Debug: Verificar versión deployada
   */
  @Get('debug/version')
  @Public()
  @Header('Cache-Control', 'no-store')
  async debugVersion() {
    return {
      success: true,
      version: '2025-05-08-memfilter-v1',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /users/debug/buscar-doc/:doc
   * Debug: Buscar por documento limpiando formato en memoria
   */
  @Get('debug/buscar-doc/:doc')
  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  @Header('CDN-Cache-Control', 'no-store')
  async debugBuscarDocumento(@Param('doc') doc: string) {
    try {
      const searchTerm = doc.trim();
      const digitsOnly = searchTerm.replace(/\D/g, '');

      const candidatos = await this.prisma.user.findMany({
        where: {
          estado: { in: ['ACTIVO', 'NO_VERIFICADO'] },
          documento: { not: '' },
        },
        select: { id: true, nombre: true, apellido: true, documento: true, estado: true },
        orderBy: [{ nombre: 'asc' }, { apellido: 'asc' }],
      });

      const cleanDoc = (d: string) => d.replace(/[.\-\s]/g, '');
      const memResults = candidatos.filter(u => cleanDoc(u.documento).includes(digitsOnly)).slice(0, 10);

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
          totalCandidatos: candidatos.length,
          memResults,
          normalResults: normalUsers,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        stack: err.stack,
      };
    }
  }
}
