import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FotosService } from './fotos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('fotos')
export class FotosController {
  constructor(private readonly fotosService: FotosService) {}

  @Post('subir')
  @UseGuards(JwtAuthGuard)
  subirFoto(@Body() dto: any, @Request() req: any) {
    return this.fotosService.subirFoto(req.user.userId, dto);
  }

  @Get()
  listarFotos(
    @Query('userId') userId?: string,
    @Query('tournamentId') tournamentId?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.fotosService.obtenerFotos({ userId, tournamentId, tipo });
  }

  @Get(':id')
  obtenerFoto(@Param('id') id: string) {
    return this.fotosService.obtenerFotoDetalle(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  actualizarFoto(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.fotosService.actualizarFoto(id, body, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminarFoto(@Param('id') id: string, @Request() req: any) {
    return this.fotosService.eliminarFoto(id, req.user.userId);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  darLike(@Param('id') id: string, @Request() req: any) {
    return this.fotosService.darLike(id, req.user.userId);
  }

  @Get(':id/likes')
  obtenerLikes(@Param('id') id: string) {
    return this.fotosService.obtenerLikes(id);
  }

  @Post(':id/comentar')
  @UseGuards(JwtAuthGuard)
  comentar(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.fotosService.comentar(id, req.user.userId, body.contenido);
  }

  @Get(':id/comentarios')
  obtenerComentarios(@Param('id') id: string) {
    return this.fotosService.obtenerComentarios(id);
  }

  @Delete('comentarios/:comentarioId')
  @UseGuards(JwtAuthGuard)
  eliminarComentario(@Param('comentarioId') comentarioId: string, @Request() req: any) {
    return this.fotosService.eliminarComentario(comentarioId, req.user.userId);
  }

  @Post(':id/reportar')
  @UseGuards(JwtAuthGuard)
  reportarFoto(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.fotosService.reportarFoto(id, req.user.userId, body.motivo);
  }
}