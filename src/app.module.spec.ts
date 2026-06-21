import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

/**
 * Red de seguridad del GRAFO DE DEPENDENCIAS (NestJS DI).
 *
 * Compila el AppModule entero: si algún provider pide una dependencia que su
 * módulo no tiene disponible, esto FALLA acá (no en producción al arrancar).
 * `tsc` y los specs unitarios NO detectan esta clase de error.
 *
 * Prisma se reemplaza por un doble para no conectar a la base.
 */
describe('AppModule — grafo de dependencias', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://u:p@localhost:5432/test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  });

  it('compila: todas las dependencias resuelven', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => {}, $disconnect: async () => {}, $on: () => {} })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
