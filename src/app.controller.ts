import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
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
}