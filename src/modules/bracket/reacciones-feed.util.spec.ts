import { parseFeedItemId, esReaccionable } from './reacciones-feed.util';

describe('parseFeedItemId', () => {
  it('resultado: r-<matchId>', () => {
    expect(parseFeedItemId('r-abc123')).toEqual({ origen: 'resultado', refId: 'abc123' });
  });

  it('inscripcion: i-<inscId>', () => {
    expect(parseFeedItemId('i-xyz')).toEqual({ origen: 'inscripcion', refId: 'xyz' });
  });

  it('torneo: t-<id>', () => {
    expect(parseFeedItemId('t-99')).toEqual({ origen: 'torneo', refId: '99' });
  });

  it('publicacion: p-<id>', () => {
    expect(parseFeedItemId('p-abc')).toEqual({ origen: 'publicacion', refId: 'abc' });
  });

  it('refId puede contener guiones (uuid)', () => {
    expect(parseFeedItemId('r-3d03364-aaaa-bbbb')).toEqual({ origen: 'resultado', refId: '3d03364-aaaa-bbbb' });
  });

  it('prefijo desconocido -> desconocido', () => {
    expect(parseFeedItemId('x-1')).toEqual({ origen: 'desconocido', refId: '' });
  });

  it('sin guion o sin refId -> desconocido', () => {
    expect(parseFeedItemId('r')).toEqual({ origen: 'desconocido', refId: '' });
    expect(parseFeedItemId('r-')).toEqual({ origen: 'desconocido', refId: '' });
    expect(parseFeedItemId('')).toEqual({ origen: 'desconocido', refId: '' });
  });
});

describe('esReaccionable', () => {
  it('resultado, inscripcion y publicacion -> true', () => {
    expect(esReaccionable('r-1')).toBe(true);
    expect(esReaccionable('i-1')).toBe(true);
    expect(esReaccionable('p-1')).toBe(true);
  });

  it('torneo y desconocido -> false', () => {
    expect(esReaccionable('t-1')).toBe(false);
    expect(esReaccionable('x-1')).toBe(false);
    expect(esReaccionable('basura')).toBe(false);
  });
});
