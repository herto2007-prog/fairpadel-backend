import { NotFoundException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ReportesService } from './reportes.service';

/**
 * Tests del generador de Excel de inscripciones. Genera el buffer real y lo
 * vuelve a leer con exceljs para verificar encabezados y filas (no se mockea
 * la librería: probamos el archivo de verdad).
 */
const TORNEO = { id: 't1', nombre: 'Copa Test 2026' };

const INSCRIPCIONES = [
  {
    category: { nombre: 'Cuarta' },
    jugador1: { nombre: 'Ana', apellido: 'García', telefono: '0991' },
    jugador2: { nombre: 'Beto', apellido: 'López', telefono: '0992' },
    estado: 'CONFIRMADA',
    modoPago: 'COMPLETO',
    createdAt: '2026-06-01T10:00:00.000Z',
  },
  {
    category: { nombre: 'Quinta' },
    jugador1: { nombre: 'Carla', apellido: 'Díaz', telefono: null },
    jugador2: null,
    estado: 'PENDIENTE_PAGO',
    modoPago: 'INDIVIDUAL',
    createdAt: '2026-06-02T10:00:00.000Z',
  },
];

const buildService = (torneo: any, inscripciones: any[]) => {
  const prisma = {
    tournament: { findUnique: jest.fn().mockResolvedValue(torneo) },
    inscripcion: { findMany: jest.fn().mockResolvedValue(inscripciones) },
  } as any;
  return new ReportesService(prisma);
};

describe('ReportesService.generarInscripcionesExcel', () => {
  it('lanza 404 si el torneo no existe', async () => {
    const service = buildService(null, []);
    await expect(service.generarInscripcionesExcel('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('genera un Excel con encabezados y una fila por inscripción', async () => {
    const service = buildService(TORNEO, INSCRIPCIONES);
    const { buffer, filename } = await service.generarInscripcionesExcel('t1');

    expect(filename).toBe('inscripciones-copa-test-2026.xlsx');

    const wb = new Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.getWorksheet('Inscripciones');
    expect(ws).toBeDefined();

    // Encabezados (fila 1)
    expect(ws!.getRow(1).values).toEqual([
      undefined, // exceljs deja el índice 0 vacío
      'Categoría',
      'Jugador 1',
      'Teléfono J1',
      'Jugador 2',
      'Teléfono J2',
      'Estado',
      'Modo de pago',
      'Fecha inscripción',
    ]);

    // Fila 2: inscripción completa
    const f2 = ws!.getRow(2);
    expect(f2.getCell(1).value).toBe('Cuarta');
    expect(f2.getCell(2).value).toBe('Ana García');
    expect(f2.getCell(3).value).toBe('0991');
    expect(f2.getCell(4).value).toBe('Beto López');
    expect(f2.getCell(5).value).toBe('0992');
    expect(f2.getCell(6).value).toBe('CONFIRMADA');
    expect(f2.getCell(7).value).toBe('COMPLETO');
    expect(f2.getCell(8).value).toBe('2026-06-01');

    // Fila 3: sin jugador2 ni teléfonos
    const f3 = ws!.getRow(3);
    expect(f3.getCell(1).value).toBe('Quinta');
    expect(f3.getCell(2).value).toBe('Carla Díaz');
    expect(f3.getCell(3).value ?? '').toBe(''); // teléfono vacío
    expect(f3.getCell(4).value).toBe('Pendiente');
    expect(f3.getCell(6).value).toBe('PENDIENTE_PAGO');
    expect(f3.getCell(8).value).toBe('2026-06-02');

    // No hay filas de más (1 header + 2 datos)
    expect(ws!.rowCount).toBe(3);
  });
});
