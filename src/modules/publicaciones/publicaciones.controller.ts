import { Controller, Post, Delete, Get, Body, Param, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { PublicacionesService, CrearPublicacionDto } from './publicaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('jugador/posts')
@UseGuards(JwtAuthGuard)
export class PublicacionesController {
  constructor(private readonly publicacionesService: PublicacionesService) {}

  /** POST /jugador/posts — crea una publicación (foto y/o texto) */
  @Post()
  async crear(@Body() dto: CrearPublicacionDto, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.publicacionesService.crear(userId, dto);
  }

  /** GET /jugador/posts/usuario/:userId — publicaciones de un jugador (grid de su ficha) */
  @Get('usuario/:userId')
  async listarDeUsuario(@Param('userId') userId: string, @Req() req: Request) {
    const viewerId = (req as any).user?.userId;
    const data = await this.publicacionesService.listarDeUsuario(viewerId, userId);
    return { success: true, data };
  }

  /** DELETE /jugador/posts/:id — borra una publicación propia */
  @Delete(':id')
  async eliminar(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.publicacionesService.eliminar(userId, id);
  }
}
