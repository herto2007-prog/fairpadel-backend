import * as bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

// Mock de la verificación del ID token de Google: devuelve siempre el mismo
// payload (email nuevo-google@mail.com) para no depender de la red.
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        email: 'nuevo-google@mail.com',
        given_name: 'Goo',
        family_name: 'Gle',
        picture: 'https://foto',
      }),
    }),
  })),
}));

/**
 * Tests del registro mínimo + login flexible (Fase registro, corte 1).
 * Foco: login por email O documento, y registro sin los campos opcionales
 * (documento/categoría/género). Se mockean prisma y los servicios de
 * efectos secundarios (email/whatsapp se disparan en segundo plano).
 */
const buildService = (overrides: any = {}) => {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    category: { findFirst: jest.fn() },
    inscripcion: { findMany: jest.fn().mockResolvedValue([]) },
    emailVerification: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
  const jwt = { sign: jest.fn().mockReturnValue('token-firmado') };
  const config = { get: jest.fn().mockReturnValue('x') };
  const email = { sendVerificationEmail: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = { requestConsent: jest.fn().mockResolvedValue(undefined) };
  const notif = {} as any;
  const comision = {} as any;
  const service = new AuthService(prisma as any, jwt as any, config as any, email as any, whatsapp as any, notif, comision);
  return { service, prisma, jwt };
};

describe('AuthService - login por email o documento', () => {
  it('busca al usuario por email OR documento', async () => {
    const password = await bcrypt.hash('secreto', 10);
    const user = {
      id: 'u1', email: 'ana@mail.com', documento: '1234567', password,
      estado: UserStatus.ACTIVO, nombre: 'Ana', apellido: 'García', fotoUrl: null,
      roles: [{ role: { nombre: 'jugador' } }],
    };
    const { service, prisma, jwt } = buildService({
      user: { findFirst: jest.fn().mockResolvedValue(user), findUnique: jest.fn(), create: jest.fn() },
    });

    const res = await service.login({ documento: 'ana@mail.com', password: 'secreto' });

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ email: 'ana@mail.com' }, { documento: 'ana@mail.com' }] },
      }),
    );
    expect(res.access_token).toBe('token-firmado');
    expect(res.user.email).toBe('ana@mail.com');
  });

  it('rechaza credenciales si no encuentra usuario', async () => {
    const { service } = buildService();
    await expect(service.login({ documento: 'no@existe.com', password: 'x' })).rejects.toThrow();
  });
});

describe('AuthService - registro mínimo', () => {
  it('crea cuenta sin documento/categoría/género (categoriaActualId null)', async () => {
    const created = {
      id: 'u2', email: 'nuevo@mail.com', nombre: 'Nuevo', apellido: 'Jugador',
      documento: null, estado: UserStatus.NO_VERIFICADO, fotoUrl: null,
      roles: [{ role: { nombre: 'jugador' } }],
    };
    const create = jest.fn().mockResolvedValue(created);
    const categoryFindFirst = jest.fn();
    const { service, prisma } = buildService({
      user: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn(), create },
      category: { findFirst: categoryFindFirst },
    });

    const res = await service.register({
      email: 'nuevo@mail.com',
      password: 'secreto',
      nombre: 'Nuevo',
      apellido: 'Jugador',
    } as any);

    expect(categoryFindFirst).not.toHaveBeenCalled(); // sin categoría, no se busca
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoriaActualId: null }),
      }),
    );
    expect(res.access_token).toBeDefined();
    expect(res.user.documento).toBeNull();
  });

  it('rechaza si el email ya existe', async () => {
    const { service } = buildService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'x' }), findFirst: jest.fn(), create: jest.fn() },
    });
    await expect(
      service.register({ email: 'repetido@mail.com', password: 'secreto', nombre: 'A', apellido: 'B' } as any),
    ).rejects.toThrow('El email ya está registrado');
  });
});

describe('AuthService - login con Google', () => {
  it('loguea a un usuario existente por email (no crea)', async () => {
    const existente = {
      id: 'g1', email: 'nuevo-google@mail.com', nombre: 'Goo', apellido: 'Gle',
      documento: null, estado: UserStatus.ACTIVO, fotoUrl: null,
      roles: [{ role: { nombre: 'jugador' } }],
    };
    const create = jest.fn();
    const { service, prisma } = buildService({
      user: { findUnique: jest.fn().mockResolvedValue(existente), findFirst: jest.fn(), create },
    });

    const res = await service.loginConGoogle('id-token-falso');

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(res.access_token).toBeDefined();
    expect(res.user.email).toBe('nuevo-google@mail.com');
  });

  it('crea cuenta mínima ACTIVA si el email no existe', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'g2', email: 'nuevo-google@mail.com', nombre: 'Goo', apellido: 'Gle',
      documento: null, estado: UserStatus.ACTIVO, fotoUrl: 'https://foto',
      roles: [{ role: { nombre: 'jugador' } }],
    });
    const { service } = buildService({
      user: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn(), create },
    });

    const res = await service.loginConGoogle('id-token-falso');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'nuevo-google@mail.com', estado: UserStatus.ACTIVO, nombre: 'Goo' }),
      }),
    );
    expect(res.user.email).toBe('nuevo-google@mail.com');
  });

  it('falla si GOOGLE_CLIENT_ID no está configurado', async () => {
    const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } } as any;
    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    const service = new AuthService(
      prisma, { sign: jest.fn() } as any, config,
      {} as any, {} as any, {} as any, {} as any,
    );
    await expect(service.loginConGoogle('x')).rejects.toThrow('no está configurado');
  });
});
