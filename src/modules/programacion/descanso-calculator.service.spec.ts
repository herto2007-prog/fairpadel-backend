import { Test, TestingModule } from '@nestjs/testing';
import { DescansoCalculatorService, DescansoConfig } from './descanso-calculator.service';

describe('DescansoCalculatorService', () => {
  let service: DescansoCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DescansoCalculatorService],
    }).compile();

    service = module.get<DescansoCalculatorService>(DescansoCalculatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calcularHoraMinimaDescanso', () => {
    it('debe calcular correctamente 22:30 + 3h = 01:30 siguiente día', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '22:30', 180);
      
      expect(resultado).toEqual({
        fecha: '2024-03-18',
        hora: '01:30',
      });
    });

    it('debe calcular correctamente 14:00 + 3h = 17:00 mismo día', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '14:00', 180);
      
      expect(resultado).toEqual({
        fecha: '2024-03-17',
        hora: '17:00',
      });
    });

    it('debe calcular correctamente 23:00 + 3h = 02:00 siguiente día', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '23:00', 180);
      
      expect(resultado).toEqual({
        fecha: '2024-03-18',
        hora: '02:00',
      });
    });

    it('debe usar 3 horas (180 min) por defecto si no se especifica', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '10:00');
      
      expect(resultado).toEqual({
        fecha: '2024-03-17',
        hora: '13:00',
      });
    });

    it('debe permitir descanso personalizado (ej: 2 horas)', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '14:00', 120);
      
      expect(resultado).toEqual({
        fecha: '2024-03-17',
        hora: '16:00',
      });
    });

    it('debe manejar medianoche exacta (00:00)', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '21:00', 180);
      
      expect(resultado).toEqual({
        fecha: '2024-03-18',
        hora: '00:00',
      });
    });

    it('debe manejar descanso de 0 minutos (sin descanso)', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '14:30', 0);
      
      expect(resultado).toEqual({
        fecha: '2024-03-17',
        hora: '14:30',
      });
    });
  });

  describe('validarSlotConDescanso', () => {
    it('debe validar slot día siguiente sin importar descanso (siempre válido)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slot = { fecha: '2024-03-18', horaInicio: '08:00', horaFin: '09:00' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 180);
      
      // Día siguiente: siempre válido (descanso reinicia)
      expect(resultado.valido).toBe(true);
      expect(resultado.tiempoDescansoMinutos).toBe(0);
    });

    it('debe rechazar slot mismo día sin suficiente descanso (2h < 3h)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '18:00', horaFin: '19:30' };
      const slot = { fecha: '2024-03-17', horaInicio: '21:00', horaFin: '22:30' }; // 1.5h después
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 180);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.tiempoDescansoMinutos).toBe(90); // 1.5h = 90 min (< 180)
    });

    it('debe validar slot exacto en hora mínima (válido)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '10:00', horaFin: '10:00' };
      const slot = { fecha: '2024-03-17', horaInicio: '13:00', horaFin: '14:00' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 180);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.tiempoDescansoMinutos).toBe(180); // Exacto 3h
    });

    it('debe validar slot mismo día con suficiente descanso (3h30m)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '10:00', horaFin: '10:30' };
      const slot = { fecha: '2024-03-17', horaInicio: '14:00', horaFin: '15:00' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 180);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.tiempoDescansoMinutos).toBe(210); // 3h 30m
    });

    it('debe rechazar slot mismo día sin suficiente descanso (2h < 3h)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '10:00', horaFin: '10:30' };
      const slot = { fecha: '2024-03-17', horaInicio: '12:30', horaFin: '13:30' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 180);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.tiempoDescansoMinutos).toBe(120); // 2h (< 180)
    });
  });

  describe('encontrarPrimerSlotValido', () => {
    it('debe encontrar el primer slot válido de la lista (día siguiente siempre válido)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slots = [
        { fecha: '2024-03-17', horaInicio: '23:00', horaFin: '24:00' }, // Inválido (mismo día, < 3h)
        { fecha: '2024-03-18', horaInicio: '01:00', horaFin: '02:00' }, // Válido (día siguiente)
        { fecha: '2024-03-18', horaInicio: '08:00', horaFin: '09:00' }, // Válido
      ];
      
      const resultado = service.encontrarPrimerSlotValido(slots, ultimoPartido, 180);
      
      expect(resultado).toEqual(slots[1]); // El de las 01:00 (día siguiente, siempre válido)
    });

    it('debe retornar null si ningún slot es válido mismo día', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slots = [
        { fecha: '2024-03-17', horaInicio: '23:00', horaFin: '24:00' }, // < 3h
        { fecha: '2024-03-17', horaInicio: '23:30', horaFin: '00:30' }, // < 3h
      ];
      
      const resultado = service.encontrarPrimerSlotValido(slots, ultimoPartido, 180);
      
      expect(resultado).toBeNull();
    });

    it('debe retornar el primer slot si todos son válidos', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '10:00', horaFin: '11:00' };
      const slots = [
        { fecha: '2024-03-17', horaInicio: '14:00', horaFin: '15:00' }, // 3h después
        { fecha: '2024-03-17', horaInicio: '15:00', horaFin: '16:00' },
      ];
      
      const resultado = service.encontrarPrimerSlotValido(slots, ultimoPartido, 180);
      
      expect(resultado).toEqual(slots[0]);
    });
  });

  describe('filtrarSlotsValidos', () => {
    it('debe incluir slots del día siguiente (siempre válidos)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slots = [
        { fecha: '2024-03-17', horaInicio: '23:00', horaFin: '24:00' }, // Inválido (mismo día, < 3h)
        { fecha: '2024-03-18', horaInicio: '01:00', horaFin: '02:00' }, // Válido (día siguiente)
        { fecha: '2024-03-18', horaInicio: '08:00', horaFin: '09:00' }, // Válido (día siguiente)
      ];
      
      const resultado = service.filtrarSlotsValidos(slots, ultimoPartido, 180);
      
      expect(resultado).toHaveLength(2);
      expect(resultado).toContainEqual(slots[1]);
      expect(resultado).toContainEqual(slots[2]);
    });
  });

  describe('getDescansoEntreFases', () => {
    it('debe retornar 0 min para ZONA → ZONA (misma fase)', () => {
      const resultado = service.getDescansoEntreFases('ZONA', 'ZONA');
      expect(resultado).toBe(0);
    });

    it('debe retornar 180 min (3h) para ZONA → SEMIS', () => {
      const resultado = service.getDescansoEntreFases('ZONA', 'SEMIS');
      expect(resultado).toBe(180);
    });

    it('debe retornar 180 min (3h) para SEMIS → FINAL', () => {
      const resultado = service.getDescansoEntreFases('SEMIS', 'FINAL');
      expect(resultado).toBe(180);
    });

    it('debe permitir configuración personalizada', () => {
      const config: Partial<DescansoConfig> = {
        descansoZonaASemis: 120, // 2 horas
      };
      
      const resultado = service.getDescansoEntreFases('ZONA', 'SEMIS', config);
      expect(resultado).toBe(120);
    });
  });

  describe('formatearTiempo', () => {
    it('debe formatear minutos como "30 minutos"', () => {
      expect(service.formatearTiempo(30)).toBe('30 minutos');
    });

    it('debe formatear horas exactas como "3 horas"', () => {
      expect(service.formatearTiempo(180)).toBe('3 horas');
    });

    it('debe formatear horas y minutos como "3h 30m"', () => {
      expect(service.formatearTiempo(210)).toBe('3h 30m');
    });

    it('debe formatear 0 minutos', () => {
      expect(service.formatearTiempo(0)).toBe('0 minutos');
    });
  });
});
