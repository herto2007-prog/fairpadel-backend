import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('🚀 Iniciando aplicación FairPadel v2026.03.22...');
  console.log('📝 Cambio: Soporte múltiples franjas horarias por día');
  const app = await NestFactory.create(AppModule);
  console.log('✅ AppModule creado');
  
  // CORS: Configuración para dominios custom de producción
  const allowedOrigins = [
    // Desarrollo local
    'http://localhost:5173',
    'http://localhost:3000',
    
    // Producción - Dominios custom (oficial)
    'https://fairpadel.com',
    'https://www.fairpadel.com',
    
    // Fallback - Railway (mientras se configura el dominio)
    'https://fairpadel-frontend-production.up.railway.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);
      
      // Verificar si el origen está permitido
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`[CORS] Bloqueado: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type', 
      'Accept',
      'Authorization',
    ],
    optionsSuccessStatus: 204,
  });

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  console.log(`🔌 Intentando escuchar en puerto ${port}...`);
  await app.listen(port, '0.0.0.0');
  console.log(`✅ Backend corriendo en puerto ${port}`);
  console.log(`🌐 CORS permitido para:`);
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
}
bootstrap();
