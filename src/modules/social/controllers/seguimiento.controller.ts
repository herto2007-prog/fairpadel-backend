import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { SeguimientoService } from '../services/seguimiento.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('users')
export class SeguimientoController {
  constructor(private readonly seguimientoService: SeguimientoService) {}

  /**
   * POST /users/:id/seguir
   * Seguir a un usuario (requiere autenticación)
   */
  @Post(':id/seguir')
  @UseGuards(JwtAuthGuard)
  async seguirUsuario(@Param('id') usuarioId: string, @Request() req: any) {
    return this.seguimientoService.seguirUsuario(req.user.userId, usuarioId);
  }

  /**
   * DELETE /users/:id/seguir
   * Dejar de seguir a un usuario (requiere autenticación)
   */
  @Delete(':id/seguir')
  @UseGuards(JwtAuthGuard)
  async dejarDeSeguir(@Param('id') usuarioId: string, @Request() req: any) {
    return this.seguimientoService.dejarDeSeguir(req.user.userId, usuarioId);
  }

  /**
   * GET /users/:id/siguiendo
   * Verificar si el usuario autenticado sigue al usuario :id
   * Público pero devuelve false si no está autenticado
   */
  @Get(':id/siguiendo')
  @Public()
  async checkSiguiendo(@Param('id') usuarioId: string, @Request() req: any) {
    const seguidorId = req.user?.userId || null;
    return this.seguimientoService.checkSiguiendo(seguidorId, usuarioId);
  }

  /**
   * GET /users/:id/seguidores
   * Obtener lista de seguidores de un usuario
   */
  @Get(':id/seguidores')
  @Public()
  async getSeguidores(
    @Param('id') usuarioId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.seguimientoService.getSeguidores(usuarioId, page, limit);
  }

  /**
   * GET /users/:id/siguiendo-lista
   * Obtener lista de usuarios que sigue un usuario
   */
  @Get(':id/siguiendo-lista')
  @Public()
  async getSiguiendo(
    @Param('id') usuarioId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.seguimientoService.getSiguiendo(usuarioId, page, limit);
  }
}
