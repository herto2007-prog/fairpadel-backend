import { topCompanero, topRival, JugadorRef } from './perfil-social.util';

const ref = (id: string): JugadorRef => ({ id, nombre: id, apellido: 'X', fotoUrl: null });

describe('perfil-social.util', () => {
  describe('topCompanero', () => {
    it('cuenta al compañero (el otro de la pareja) y devuelve el más frecuente', () => {
      const insc = [
        { jugador1Id: 'yo', jugador2Id: 'ana' },
        { jugador1Id: 'ana', jugador2Id: 'yo' }, // yo de cualquier lado
        { jugador1Id: 'yo', jugador2Id: 'beto' },
      ];
      expect(topCompanero(insc, 'yo')).toEqual({ partnerId: 'ana', veces: 2 });
    });

    it('ignora inscripciones sin compañero', () => {
      const insc = [{ jugador1Id: 'yo', jugador2Id: null }];
      expect(topCompanero(insc, 'yo')).toBeNull();
    });
  });

  describe('topRival', () => {
    it('cuenta enfrentamientos por jugador rival y derrotas', () => {
      const matches = [
        { rivales: [ref('r1'), ref('r2')], perdi: true },
        { rivales: [ref('r1')], perdi: false },
        { rivales: [ref('r3')], perdi: true },
      ];
      const top = topRival(matches);
      expect(top?.rival.id).toBe('r1');
      expect(top?.jugadas).toBe(2);
      expect(top?.perdidas).toBe(1);
    });

    it('desempata por más derrotas a igualdad de enfrentamientos', () => {
      const matches = [
        { rivales: [ref('a')], perdi: false },
        { rivales: [ref('b')], perdi: true },
      ];
      expect(topRival(matches)?.rival.id).toBe('b');
    });

    it('sin partidos devuelve null', () => {
      expect(topRival([])).toBeNull();
    });
  });
});
