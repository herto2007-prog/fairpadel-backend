import * as crypto from 'crypto';
import { BancardService } from './bancard.service';

/**
 * Tests de la integración Bancard VPOS 2.0.
 * Foco: generación y verificación de tokens MD5 (integridad de pagos).
 * Las fórmulas esperadas se derivan de la documentación de Bancard de forma
 * independiente, para que un cambio accidental en el servicio rompa el test.
 */
const PRIVATE_KEY = 'clave-privada-de-prueba';

const md5 = (data: string) => crypto.createHash('md5').update(data).digest('hex');

const buildService = (overrides: Record<string, string> = {}) => {
  const config: Record<string, string> = {
    BANCARD_PRIVATE_KEY: PRIVATE_KEY,
    BANCARD_PUBLIC_KEY: 'clave-publica-de-prueba',
    BANCARD_ENV: 'staging',
    FRONTEND_URL: 'https://fairpadel.com',
    ...overrides,
  };
  const configService = { get: (key: string) => config[key] } as any;
  return new BancardService(configService);
};

describe('BancardService - tokens MD5', () => {
  it('generateConfirmToken = md5(priv + shopProcessId + "confirm" + amount + currency)', () => {
    const service = buildService();
    const token = service.generateConfirmToken('1234', '150000.00', 'PYG');

    expect(token).toBe(md5(`${PRIVATE_KEY}1234confirm150000.00PYG`));
  });

  it('generateRollbackToken = md5(priv + shopId + "rollback0.00") (sin currency)', () => {
    const service = buildService();
    const token = service.generateRollbackToken('1234');

    expect(token).toBe(md5(`${PRIVATE_KEY}1234rollback0.00`));
  });

  it('generateRollbackToken normaliza el shopProcessId string a entero', () => {
    const service = buildService();

    // "001234" debe tratarse como 1234 (Bancard lo envía como número)
    expect(service.generateRollbackToken('001234')).toBe(
      md5(`${PRIVATE_KEY}1234rollback0.00`),
    );
    expect(service.generateRollbackToken('1234')).toBe(
      service.generateRollbackToken(1234),
    );
  });

  it('generateSingleBuyToken = md5(priv + shopProcessId + amount + currency)', () => {
    const service = buildService();
    const token = (service as any).generateSingleBuyToken('99', '10.00', 'USD');

    expect(token).toBe(md5(`${PRIVATE_KEY}9910.00USD`));
  });
});

describe('BancardService - verificarTokenConfirmacion (gate del webhook)', () => {
  it('acepta el token correcto', () => {
    const service = buildService();
    const tokenValido = md5(`${PRIVATE_KEY}555confirm200000.00PYG`);

    expect(service.verificarTokenConfirmacion('555', '200000.00', 'PYG', tokenValido)).toBe(true);
  });

  it('rechaza si el monto fue alterado', () => {
    const service = buildService();
    // Token firmado para 200.000 pero el webhook llega con monto inflado
    const tokenParaMontoReal = md5(`${PRIVATE_KEY}555confirm200000.00PYG`);

    expect(
      service.verificarTokenConfirmacion('555', '999999.00', 'PYG', tokenParaMontoReal),
    ).toBe(false);
  });

  it('rechaza un token basura', () => {
    const service = buildService();

    expect(service.verificarTokenConfirmacion('555', '200000.00', 'PYG', 'token-falso')).toBe(false);
  });
});

describe('BancardService - configuración de ambiente', () => {
  it('staging usa el puerto :8888', () => {
    const service = buildService({ BANCARD_ENV: 'staging' });
    expect(service.getBaseUrl()).toBe('https://vpos.infonet.com.py:8888');
  });

  it('production usa el host sin puerto', () => {
    const service = buildService({ BANCARD_ENV: 'production' });
    expect(service.getBaseUrl()).toBe('https://vpos.infonet.com.py');
  });

  it('expone la public key configurada', () => {
    const service = buildService({ BANCARD_PUBLIC_KEY: 'pk-visible' });
    expect(service.getPublicKey()).toBe('pk-visible');
  });
});
