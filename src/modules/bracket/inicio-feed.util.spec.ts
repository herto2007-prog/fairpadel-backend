import { esTipoInicio, mapNotificacionAInicio } from './inicio-feed.util';

describe('inicio-feed.util', () => {
  describe('esTipoInicio', () => {
    it('acepta los tipos personales/plataforma', () => {
      for (const t of ['SISTEMA', 'TORNEO', 'INSCRIPCION', 'PARTIDO', 'RANKING', 'PAGO', 'MENSAJE'] as const) {
        expect(esTipoInicio(t)).toBe(true);
      }
    });

    it('descarta lo social (te siguen / me gusta)', () => {
      expect(esTipoInicio('SOCIAL')).toBe(false);
    });
  });

  describe('mapNotificacionAInicio', () => {
    const base = {
      id: 'n1',
      tipo: 'PARTIDO' as const,
      contenido: 'Avanzás a la final',
      enlace: '/mijuego',
      leida: false,
      createdAt: new Date('2026-06-24T12:00:00.000Z'),
    };

    it('usa el título como encabezado y el contenido como detalle', () => {
      const card = mapNotificacionAInicio({ ...base, titulo: '¡Ganaste tu partido!' });
      expect(card).toEqual({
        id: 'n1',
        tipo: 'PARTIDO',
        titulo: '¡Ganaste tu partido!',
        detalle: 'Avanzás a la final',
        link: '/mijuego',
        fecha: '2026-06-24T12:00:00.000Z',
        leida: false,
      });
    });

    it('si no hay título, el contenido es el encabezado y el detalle queda vacío', () => {
      const card = mapNotificacionAInicio({ ...base, titulo: null });
      expect(card.titulo).toBe('Avanzás a la final');
      expect(card.detalle).toBe('');
    });

    it('título en blanco se trata como ausente', () => {
      const card = mapNotificacionAInicio({ ...base, titulo: '   ' });
      expect(card.titulo).toBe('Avanzás a la final');
      expect(card.detalle).toBe('');
    });

    it('enlace nulo queda como link null', () => {
      const card = mapNotificacionAInicio({ ...base, titulo: 'X', enlace: null });
      expect(card.link).toBeNull();
    });
  });
});
