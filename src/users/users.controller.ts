import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  obtenerPerfil(@Param('id') id: string) {
    return this.usersService.obtenerPerfilPublico(id);
  }

  @Put(':id')
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