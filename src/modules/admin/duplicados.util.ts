/**
 * Detección de posibles cuentas DUPLICADAS (Capa 1, Corte 3 — alertas blandas).
 *
 * No bloquea nada: agrupa cuentas que se PARECEN para que el admin (la
 * "federación") las revise. Dos señales baratas y efectivas:
 *  - mismo teléfono (normalizado a dígitos),
 *  - mismo nombre+apellido (normalizado) Y misma fecha de nacimiento.
 *
 * Función pura → testeable sin BD. El cruce fuerte de cédula ya lo hace la
 * unicidad de `documento`; esto cubre el hueco de cuentas sin/with distinta
 * cédula que igual parecen la misma persona.
 */

export interface UsuarioDup {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  documento: string | null;
  telefono: string | null;
  fechaNacimiento: string | null; // YYYY-MM-DD
  fotoUrl?: string | null;
  estado: string;
}

export interface GrupoDuplicado {
  motivo: 'Mismo teléfono' | 'Mismo nombre y fecha de nacimiento';
  clave: string;
  usuarios: UsuarioDup[];
}

function normalizarNombre(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizarTelefono(s: string | null): string {
  return (s || '').replace(/\D/g, '');
}

function agregar(mapa: Map<string, UsuarioDup[]>, clave: string, u: UsuarioDup) {
  const lista = mapa.get(clave);
  if (lista) lista.push(u);
  else mapa.set(clave, [u]);
}

export function detectarPosiblesDuplicados(usuarios: UsuarioDup[]): GrupoDuplicado[] {
  const grupos: GrupoDuplicado[] = [];

  // 1) Por teléfono (al menos 6 dígitos para evitar falsos por números cortos/vacíos)
  const porTelefono = new Map<string, UsuarioDup[]>();
  for (const u of usuarios) {
    const tel = normalizarTelefono(u.telefono);
    if (tel.length >= 6) agregar(porTelefono, tel, u);
  }
  for (const [clave, us] of porTelefono) {
    if (us.length >= 2) grupos.push({ motivo: 'Mismo teléfono', clave, usuarios: us });
  }

  // 2) Por nombre+apellido + fecha de nacimiento (ambos presentes)
  const porNombre = new Map<string, UsuarioDup[]>();
  for (const u of usuarios) {
    if (!u.fechaNacimiento) continue;
    const clave = `${normalizarNombre(`${u.nombre} ${u.apellido}`)}|${u.fechaNacimiento.slice(0, 10)}`;
    agregar(porNombre, clave, u);
  }
  for (const [clave, us] of porNombre) {
    if (us.length >= 2) grupos.push({ motivo: 'Mismo nombre y fecha de nacimiento', clave, usuarios: us });
  }

  return grupos;
}
