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
    it('debe calcular correctamente 22:30 + 4h = 02:30 siguiente día', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '22:30', 240);
      
      expect(resultado).toEqual({
        fecha: '2024-03-18',
        hora: '02:30',
      });
    });

    it('debe calcular correctamente 14:00 + 4h = 18:00 mismo día', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '14:00', 240);
      
      expect(resultado).toEqual({
        fecha: '2024-03-17',
        hora: '18:00',
      });
    });

    it('debe calcular correctamente 23:00 + 4h = 03:00 siguiente día', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '23:00', 240);
      
      expect(resultado).toEqual({
        fecha: '2024-03-18',
        hora: '03:00',
      });
    });

    it('debe usar 4 horas (240 min) por defecto si no se especifica', () => {
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '10:00');
      
      expect(resultado).toEqual({
        fecha: '2024-03-17',
        hora: '14:00',
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
      const resultado = service.calcularHoraMinimaDescanso('2024-03-17', '20:00', 240);
      
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
    it('debe validar slot 08:00 cuando hora mínima es 02:30 (válido)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slot = { fecha: '2024-03-18', horaInicio: '08:00', horaFin: '09:00' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 240);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.tiempoDescansoMinutos).toBe(570); // 9h 30m = 570 min
      expect(resultado.tiempoRequeridoMinutos).toBe(240);
    });

    it('debe rechazar slot 02:00 cuando hora mínima es 02:30 (inválido)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slot = { fecha: '2024-03-18', horaInicio: '02:00', horaFin: '03:00' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 240);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.tiempoDescansoMinutos).toBe(210); // 3h 30m = 210 min (< 240)
      expect(resultado.razon).toContain('02:00');
      expect(resultado.razon).toContain('02:30');
    });

    it('debe validar slot exacto en hora mínima (válido)', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '10:00', horaFin: '10:00' };
      const slot = { fecha: '2024-03-17', horaInicio: '14:00', horaFin: '15:00' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 240);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.tiempoDescansoMinutos).toBe(240); // Exacto 4h
    });

    it('debe validar slot mismo día con suficiente descanso', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '10:00', horaFin: '10:30' };
      const slot = { fecha: '2024-03-17', horaInicio: '15:00', horaFin: '16:00' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 240);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.tiempoDescansoMinutos).toBe(270); // 4h 30m
    });

    it('debe rechazar slot mismo día sin suficiente descanso', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '10:00', horaFin: '10:30' };
      const slot = { fecha: '2024-03-17', horaInicio: '13:00', horaFin: '14:00' };
      
      const resultado = service.validarSlotConDescanso(slot, ultimoPartido, 240);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.tiempoDescansoMinutos).toBe(150); // 2h 30m (< 240)
    });
  });

  describe('encontrarPrimerSlotValido', () => {
    it('debe encontrar el primer slot válido de la lista', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slots = [
        { fecha: '2024-03-17', horaInicio: '23:00', horaFin: '24:00' }, // Inválido
        { fecha: '2024-03-18', horaInicio: '02:00', horaFin: '03:00' }, // Inválido (antes 02:30)
        { fecha: '2024-03-18', horaInicio: '08:00', horaFin: '09:00' }, // Válido ✓
        { fecha: '2024-03-18', horaInicio: '10:00', horaFin: '11:00' }, // Válido
      ];
      
      const resultado = service.encontrarPrimerSlotValido(slots, ultimoPartido, 240);
      
      expect(resultado).toEqual(slots[2]); // El de las 08:00
    });

    it('debe retornar null si ningún slot es válido', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slots = [
        { fecha: '2024-03-17', horaInicio: '23:00', horaFin: '24:00' },
        { fecha: '2024-03-18', horaInicio: '01:00', horaFin: '02:00' },
      ];
      
      const resultado = service.encontrarPrimerSlotValido(slots, ultimoPartido, 240);
      
      expect(resultado).toBeNull();
    });

    it('debe retornar el primer slot si todos son válidos', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '10:00', horaFin: '11:00' };
      const slots = [
        { fecha: '2024-03-17', horaInicio: '16:00', horaFin: '17:00' },
        { fecha: '2024-03-17', horaInicio: '17:00', horaFin: '18:00' },
      ];
      
      const resultado = service.encontrarPrimerSlotValido(slots, ultimoPartido, 240);
      
      expect(resultado).toEqual(slots[0]);
    });
  });

  describe('filtrarSlotsValidos', () => {
    it('debe filtrar solo los slots válidos', () => {
      const ultimoPartido = { fecha: '2024-03-17', horaInicio: '20:00', horaFin: '22:30' };
      const slots = [
        { fecha: '2024-03-17', horaInicio: '23:00', horaFin: '24:00' }, // Inválido
        { fecha: '2024-03-18', horaInicio: '02:00', horaFin: '03:00' }, // Inválido
        { fecha: '2024-03-18', horaInicio: '08:00', horaFin: '09:00' }, // Válido
        { fecha: '2024-03-18', horaInicio: '10:00', horaFin: '11:00' }, // Válido
      ];
      
      const resultado = service.filtrarSlotsValidos(slots, ultimoPartido, 240);
      
      expect(resultado).toHaveLength(2);
      expect(resultado).toContainEqual(slots[2]);
      expect(resultado).toContainEqual(slots[3]);
    });
  });

  describe('getDescansoEntreFases', () => {
    it('debe retornar 0 min para ZONA → ZONA (misma fase)', () => {
      const resultado = service.getDescansoEntreFases('ZONA', 'ZONA');
      expect(resultado).toBe(0);
    });

    it('debe retornar 240 min (4h) para ZONA → SEMIS', () => {
      const resultado = service.getDescansoEntreFases('ZONA', 'SEMIS');
      expect(resultado).toBe(240);
    });

    it('debe retornar 240 min (4h) para SEMIS → FINAL', () => {
      const resultado = service.getDescansoEntreFases('SEMIS', 'FINAL');
      expect(resultado).toBe(240);
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

    it('debe formatear horas exactas como "4 horas"', () => {
      expect(service.formatearTiempo(240)).toBe('4 horas');
    });

    it('debe formatear horas y minutos como "4h 30m"', () => {
      expect(service.formatearTiempo(270)).toBe('4h 30m');
    });

    it('debe formatear 0 minutos', () => {
      expect(service.formatearTiempo(0)).toBe('0 minutos');
    });
  });
});
