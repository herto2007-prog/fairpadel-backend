import { Controller, Post, Delete, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** POST /push/registrar — guarda el token de push del dispositivo */
  @Post('registrar')
  async registrar(@Body() body: { token: string; platform?: string }, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.pushService.registrar(userId, body?.token, body?.platform);
  }

  /** DELETE /push/registrar — quita el token (al cerrar sesión) */
  @Delete('registrar')
  async eliminar(@Body() body: { token: string }, @Req() req: Request) {
    const userId = (req as any).user?.userId;
    return this.pushService.eliminar(userId, body?.token);
  }
}
