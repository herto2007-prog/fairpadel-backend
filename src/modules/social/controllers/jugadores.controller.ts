import { Controller, Get, Query, ValidationPipe, Header } from '@nestjs/common';
import { JugadoresService } from '../services/jugadores.service';
import { BuscarJugadoresDto } from '../dto/buscar-jugadores.dto';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('users')
export class JugadoresController {
  constructor(private readonly jugadoresService: JugadoresService) {}

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
   */
  @Get('buscar')
  @Public()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async buscarJugadores(
    @Query(new ValidationPipe({ transform: true })) query: BuscarJugadoresDto,
  ) {
    console.log('🔥 ENDPOINT /users/buscar LLAMADO');
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
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getDatosFiltros() {
    const data = await this.jugadoresService.getDatosFiltros();
    
    return {
      success: true,
      data,
    };
  }
}
