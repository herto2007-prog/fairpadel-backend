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
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FotosService } from './fotos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('fotos')
export class FotosController {
  constructor(private readonly fotosService: FotosService) {}

  @Post('subir')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return callback(
          new BadRequestException('Solo se permiten imágenes (JPEG, PNG, WebP, GIF)'),
          false,
        );
      }
      callback(null, true);
    },
  }))
  subirFoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: any,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar una imagen');
    }
    return this.fotosService.subirFoto(req.user.id, file, dto);
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
    return this.fotosService.actualizarFoto(id, body, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  eliminarFoto(@Param('id') id: string, @Request() req: any) {
    return this.fotosService.eliminarFoto(id, req.user.id);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  darLike(@Param('id') id: string, @Request() req: any) {
    return this.fotosService.darLike(id, req.user.id);
  }

  @Get(':id/likes')
  obtenerLikes(@Param('id') id: string) {
    return this.fotosService.obtenerLikes(id);
  }

  @Post(':id/comentar')
  @UseGuards(JwtAuthGuard)
  comentar(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.fotosService.comentar(id, req.user.id, body.contenido);
  }

  @Get(':id/comentarios')
  obtenerComentarios(@Param('id') id: string) {
    return this.fotosService.obtenerComentarios(id);
  }

  @Delete('comentarios/:comentarioId')
  @UseGuards(JwtAuthGuard)
  eliminarComentario(@Param('comentarioId') comentarioId: string, @Request() req: any) {
    return this.fotosService.eliminarComentario(comentarioId, req.user.id);
  }

  @Post(':id/reportar')
  @UseGuards(JwtAuthGuard)
  reportarFoto(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.fotosService.reportarFoto(id, req.user.id, body.motivo);
  }
}
