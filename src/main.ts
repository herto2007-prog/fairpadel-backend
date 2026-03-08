import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configuración CORS robusta
  const allowedOrigins = [
    'http://localhost:5173',
    'https://fairpadel-frontend-production.up.railway.app',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);
      
      // Permitir orígenes de la lista
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log(`CORS bloqueado para origen: ${origin}`);
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
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Middleware para loguear todas las peticiones (debugging temporal)
  app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url} from ${req.headers.origin || 'no-origin'}`);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
  console.log(`CORS allowed for: ${allowedOrigins.join(', ')}`);
}
bootstrap();
