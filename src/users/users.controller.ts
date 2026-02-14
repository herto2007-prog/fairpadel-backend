import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('documento/:documento')
  @UseGuards(JwtAuthGuard)
  async getByDocumento(@Param('documento') documento: string) {
    const user = await this.usersService.buscarPorDocumento(documento);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: user.id,
      documento: user.documento,
      nombre: user.nombre,
      apellido: user.apellido,
      genero: user.genero,
      ciudad: user.ciudad,
      fotoUrl: user.fotoUrl,
    };
  }

  @Get(':id/perfil-completo')
  @UseGuards(OptionalJwtAuthGuard)
  obtenerPerfilCompleto(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const viewerId = req.user?.id || req.user?.userId || null;
    return this.usersService.obtenerPerfilCompleto(id, viewerId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  obtenerPerfil(@Param('id') id: string) {
    return this.usersService.obtenerPerfilPublico(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  actualizarPerfil(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    // Verificar que el usuario solo pueda editar su propio perfil
    if (req.user.userId !== id) {
      throw new Error('No puedes editar el perfil de otro usuario');
    }
    return this.usersService.actualizarPerfil(id, data);
  }
}
