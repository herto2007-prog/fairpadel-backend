import {
  parseTimeToMinutes,
  formatTimeFromMinutes,
  generarSlots,
  getDiaSemanaFromString,
  diasEntre,
  hashStringToInt64,
} from './alquileres-utils';

/**
 * Spec de CARACTERIZACIÓN (red de seguridad del refactor de alquileres).
 *
 * Fija con golden values el comportamiento EXACTO de las funciones puras de
 * cálculo (horarios, slots, fechas, hash). Se escribió contra el servicio
 * ANTES de extraerlas y luego se repuntó a alquileres-utils: como la
 * extracción fue verbatim, estos mismos valores siguen dando idénticos. Si un
 * corte futuro cambia algo, este spec se pone rojo.
 */
const svc = {
  parseTimeToMinutes,
  formatTimeFromMinutes,
  generarSlots,
  getDiaSemanaFromString,
  diasEntre,
  hashStringToInt64,
};

describe('alquileres - funciones puras (caracterización)', () => {
  describe('parseTimeToMinutes', () => {
    it.each([
      ['00:00', 0],
      ['08:30', 510],
      ['14:00', 840],
      ['23:59', 1439],
    ])('%s -> %i', (hhmm, esperado) => {
      expect(svc.parseTimeToMinutes(hhmm)).toBe(esperado);
    });
  });

  describe('formatTimeFromMinutes', () => {
    it.each([
      [0, '00:00'],
      [510, '08:30'],
      [840, '14:00'],
      [1439, '23:59'],
      [1440, '24:00'],
    ])('%i -> %s', (min, esperado) => {
      expect(svc.formatTimeFromMinutes(min)).toBe(esperado);
    });
  });

  describe('getDiaSemanaFromString', () => {
    // 2026-01-01 es jueves (getDay=4); 2026-01-04 domingo (0); 2026-01-05 lunes (1)
    it.each([
      ['2026-01-01', 4],
      ['2026-01-04', 0],
      ['2026-01-05', 1],
    ])('%s -> %i', (fecha, esperado) => {
      expect(svc.getDiaSemanaFromString(fecha)).toBe(esperado);
    });
  });

  describe('diasEntre', () => {
    // Fechas de junio: sin transiciones DST en ninguna zona horaria común
    it('mismas fechas -> 0', () => {
      expect(svc.diasEntre('2026-06-15', '2026-06-15')).toBe(0);
    });
    it('14 días hacia adelante', () => {
      expect(svc.diasEntre('2026-06-01', '2026-06-15')).toBe(14);
    });
    it('hacia atrás es negativo', () => {
      expect(svc.diasEntre('2026-06-15', '2026-06-01')).toBe(-14);
    });
  });

  describe('hashStringToInt64', () => {
    it('"abc" -> 96354 (valor determinista)', () => {
      expect(svc.hashStringToInt64('abc')).toBe(96354);
    });
    it('mismo input -> mismo output', () => {
      const key = 'cancha-123:2026-07-01';
      expect(svc.hashStringToInt64(key)).toBe(svc.hashStringToInt64(key));
    });
    it('siempre entero positivo dentro de MAX_SAFE_INTEGER', () => {
      const v = svc.hashStringToInt64('cualquier-cosa-larga-xyz');
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('generarSlots', () => {
    it('franja 08:00-12:00, slots de 90min, sin ocupación -> 2 slots', () => {
      const slots = svc.generarSlots(
        [{ horaInicio: '08:00', horaFin: '12:00' }],
        [],
        [],
        'cancha-1',
        90,
      );
      expect(slots).toEqual([
        { horaInicio: '08:00', horaFin: '09:30', disponible: true },
        { horaInicio: '09:30', horaFin: '11:00', disponible: true },
      ]);
    });

    it('excluye el slot que solapa una reserva existente', () => {
      const slots = svc.generarSlots(
        [{ horaInicio: '08:00', horaFin: '12:00' }],
        [{ horaInicio: '09:30', horaFin: '11:00' }],
        [],
        'cancha-1',
        90,
      );
      expect(slots).toEqual([
        { horaInicio: '08:00', horaFin: '09:30', disponible: true },
      ]);
    });

    it('excluye el slot que solapa un horario de torneo', () => {
      const slots = svc.generarSlots(
        [{ horaInicio: '08:00', horaFin: '12:00' }],
        [],
        [{ sedeCanchaId: 'cancha-1', horaInicio: '08:00', horaFin: '09:00' }],
        'cancha-1',
        90,
      );
      expect(slots).toEqual([
        { horaInicio: '09:30', horaFin: '11:00', disponible: true },
      ]);
    });

    it('franja 22:00-00:00 (medianoche=24:00), slots de 60min', () => {
      const slots = svc.generarSlots(
        [{ horaInicio: '22:00', horaFin: '00:00' }],
        [],
        [],
        'cancha-1',
        60,
      );
      expect(slots).toEqual([
        { horaInicio: '22:00', horaFin: '23:00', disponible: true },
        { horaInicio: '23:00', horaFin: '24:00', disponible: true },
      ]);
    });
  });
});
