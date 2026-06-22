import { detectarPosiblesDuplicados, UsuarioDup } from './duplicados.util';

const u = (p: Partial<UsuarioDup> & { id: string }): UsuarioDup => ({
  nombre: 'Juan',
  apellido: 'Perez',
  email: `${p.id}@mail.com`,
  documento: null,
  telefono: null,
  fechaNacimiento: null,
  estado: 'ACTIVO',
  ...p,
});

describe('detectarPosiblesDuplicados', () => {
  it('sin coincidencias → sin grupos', () => {
    const out = detectarPosiblesDuplicados([
      u({ id: 'a', telefono: '0981111111', fechaNacimiento: '1990-01-01' }),
      u({ id: 'b', nombre: 'Ana', apellido: 'Lopez', telefono: '0982222222', fechaNacimiento: '1991-02-02' }),
    ]);
    expect(out).toEqual([]);
  });

  it('agrupa por mismo teléfono (ignora formato)', () => {
    const out = detectarPosiblesDuplicados([
      u({ id: 'a', telefono: '0981 123-456' }),
      u({ id: 'b', telefono: '0981123456' }),
    ]);
    const g = out.find((x) => x.motivo === 'Mismo teléfono');
    expect(g?.usuarios.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('agrupa por nombre+apellido (sin acentos/mayúsculas) + fecha de nacimiento', () => {
    const out = detectarPosiblesDuplicados([
      u({ id: 'a', nombre: 'José', apellido: 'Núñez', fechaNacimiento: '1988-05-05' }),
      u({ id: 'b', nombre: 'jose', apellido: 'nunez', fechaNacimiento: '1988-05-05' }),
    ]);
    const g = out.find((x) => x.motivo === 'Mismo nombre y fecha de nacimiento');
    expect(g?.usuarios.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });

  it('mismo nombre pero distinta fecha de nacimiento → NO agrupa', () => {
    const out = detectarPosiblesDuplicados([
      u({ id: 'a', nombre: 'Luis', apellido: 'Gomez', fechaNacimiento: '1990-01-01' }),
      u({ id: 'b', nombre: 'Luis', apellido: 'Gomez', fechaNacimiento: '1995-01-01' }),
    ]);
    expect(out.filter((x) => x.motivo === 'Mismo nombre y fecha de nacimiento')).toEqual([]);
  });

  it('ignora teléfonos muy cortos o vacíos', () => {
    const out = detectarPosiblesDuplicados([
      u({ id: 'a', telefono: '123' }),
      u({ id: 'b', telefono: '123' }),
      u({ id: 'c', telefono: null }),
      u({ id: 'd', telefono: '' }),
    ]);
    expect(out).toEqual([]);
  });

  it('no agrupa por nombre si falta la fecha de nacimiento', () => {
    const out = detectarPosiblesDuplicados([
      u({ id: 'a', nombre: 'Pedro', apellido: 'Diaz' }),
      u({ id: 'b', nombre: 'Pedro', apellido: 'Diaz' }),
    ]);
    expect(out).toEqual([]);
  });
});
