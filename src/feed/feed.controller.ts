import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FeedService } from './feed.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePublicacionDto } from './dto';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  obtenerFeed(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.obtenerFeed(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('publicar')
  @UseGuards(JwtAuthGuard)
  crearPublicacion(@Body() dto: CreatePublicacionDto, @Request() req) {
    return this.feedService.crearPublicacionFoto(
      req.user.id,
      dto.contenido,
      dto.fotoId,
    );
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  toggleLike(@Param('id') id: string, @Request() req) {
    return this.feedService.toggleLike(id, req.user.id);
  }

  @Post(':id/comentar')
  @UseGuards(JwtAuthGuard)
  comentar(
    @Param('id') id: string,
    @Body() body: { contenido: string },
    @Request() req,
  ) {
    return this.feedService.comentar(id, req.user.id, body.contenido);
  }

  @Get(':id/comentarios')
  @UseGuards(JwtAuthGuard)
  obtenerComentarios(
    @Param('id') id: string,
    @Query('page') page?: string,
  ) {
    return this.feedService.obtenerComentarios(id, page ? parseInt(page) : 1);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminarPublicacion(@Param('id') id: string, @Request() req) {
    return this.feedService.eliminarPublicacion(id, req.user.id);
  }
}
