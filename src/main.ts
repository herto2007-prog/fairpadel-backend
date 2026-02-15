import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Security Headers (Helmet) ──
  // Protege contra: clickjacking, MIME sniffing, XSS, fuerza HTTPS
  app.use(
    helmet({
      // Content-Security-Policy: permitir recursos propios + Cloudinary images + Bancard iframe
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.cloudinary.com'],
          frameSrc: ["'self'", 'https://vpos.infonet.com.py'],
          connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
      },
      // X-Frame-Options: SAMEORIGIN — bloquea iframes de terceros
      frameguard: { action: 'sameorigin' },
      // Strict-Transport-Security: fuerza HTTPS por 1 año
      hsts: {
        maxAge: 31536000, // 1 año en segundos
        includeSubDomains: true,
      },
    }),
  );

  // ── CORS ──
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // ── Validation pipe global ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Prefix global para API ──
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Servidor corriendo en: http://localhost:${port}`);
  console.log(`📡 API disponible en: http://localhost:${port}/api`);
}

bootstrap();
