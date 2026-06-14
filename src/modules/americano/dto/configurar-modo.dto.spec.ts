import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfigurarModoJuegoDto } from './configurar-modo.dto';

/**
 * Regresión: el frontend manda numRondas como NÚMERO (default 4). El DTO lo
 * coerciona a string vía @Transform, así no falla con "numRondas must be a string".
 */
function baseModo(overrides: Record<string, unknown> = {}) {
  return {
    tipoInscripcion: 'individual',
    rotacion: 'automatica',
    sistemaPuntos: 'games',
    formatoPartido: 'games',
    valorObjetivo: 6,
    categorias: 'sin',
    numRondas: 4, // ← número, como lo manda el frontend
    ...overrides,
  };
}

describe('ConfigurarModoJuegoDto', () => {
  it('acepta numRondas numérico coercionándolo a string', async () => {
    const dto = plainToInstance(ConfigurarModoJuegoDto, baseModo());
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.numRondas).toBe('4');
  });

  it('acepta numRondas = "automatico"', async () => {
    const dto = plainToInstance(ConfigurarModoJuegoDto, baseModo({ numRondas: 'automatico' }));
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.numRondas).toBe('automatico');
  });
});
