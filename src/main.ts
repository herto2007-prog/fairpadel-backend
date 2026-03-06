import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Set timezone for the entire application
process.env.TZ = 'America/Asuncion';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  console.log(`🌍 Timezone: ${process.env.TZ}`);
  console.log(`🕐 Server time: ${new Date().toLocaleString('es-PY')}`);

  // Security
  app.use(helmet());

  // CORS - Allow multiple origins
  const allowedOrigins = [
    'http://localhost:5173',
    'https://fairpadel-frontend-production.up.railway.app',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked origin: ${origin}`);
        callback(null, true); // Temporarily allow all for debugging
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}/api`);
  console.log(`✅ CORS enabled for: ${allowedOrigins.join(', ')}`);
}

bootstrap();
