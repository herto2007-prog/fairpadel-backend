import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHello() {
    return {
      message: 'Bienvenido a FairPadel API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        tournaments: '/api/tournaments',
        categories: '/api/tournaments/categories',
        rankings: '/api/rankings',
        auth: '/api/auth/login',
      },
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    };
  }

  @Get('stats')
  async getPublicStats() {
    const [torneos, jugadores, partidos, categorias] = await Promise.all([
      this.prisma.tournament.count(),
      this.prisma.user.count(),
      this.prisma.match.count({ where: { estado: 'FINALIZADO' } }),
      this.prisma.category.count(),
    ]);

    return { torneos, jugadores, partidos, categorias };
  }
}