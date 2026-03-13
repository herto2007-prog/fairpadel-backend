import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { PerfilService } from './perfil.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('users')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  /**
   * GET /users/profile/:id
   * Obtiene el perfil público de cualquier jugador
   * No requiere autenticación
   */
  @Get('profile/:id')
  @Public()
  async getPerfilJugador(@Param('id') userId: string) {
    return this.perfilService.getPerfilJugador(userId);
  }

  /**
   * GET /users/profile/me
   * Obtiene el perfil completo del usuario autenticado
   * Requiere autenticación
   */
  @Get('profile/me')
  @UseGuards(JwtAuthGuard)
  async getMiPerfil(@Request() req: any) {
    return this.perfilService.getMiPerfil(req.user.userId);
  }
}
