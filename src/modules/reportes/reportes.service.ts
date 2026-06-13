import { Injectable, NotFoundException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Genera reportes descargables de torneos (Fase 7).
 * Por ahora: inscripciones a Excel. La autorización (puede gestionar el
 * torneo) se resuelve en el controller antes de llamar acá.
 */
@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Arma un Excel con las inscripciones del torneo.
   * Devuelve el buffer del archivo y un nombre de archivo sugerido.
   */
  async generarInscripcionesExcel(
    torneoId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      select: { id: true, nombre: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId: torneoId },
      include: {
        jugador1: { select: { nombre: true, apellido: true, telefono: true } },
        jugador2: { select: { nombre: true, apellido: true, telefono: true } },
        category: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const wb = new Workbook();
    wb.creator = 'FairPadel';
    const ws = wb.addWorksheet('Inscripciones');

    ws.columns = [
      { header: 'Categoría', key: 'categoria', width: 22 },
      { header: 'Jugador 1', key: 'jugador1', width: 28 },
      { header: 'Teléfono J1', key: 'telefonoJ1', width: 16 },
      { header: 'Jugador 2', key: 'jugador2', width: 28 },
      { header: 'Teléfono J2', key: 'telefonoJ2', width: 16 },
      { header: 'Estado', key: 'estado', width: 24 },
      { header: 'Modo de pago', key: 'modoPago', width: 16 },
      { header: 'Fecha inscripción', key: 'fecha', width: 20 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const insc of inscripciones) {
      ws.addRow({
        categoria: insc.category?.nombre ?? '',
        jugador1: insc.jugador1
          ? `${insc.jugador1.nombre} ${insc.jugador1.apellido}`
          : '',
        telefonoJ1: insc.jugador1?.telefono ?? '',
        jugador2: insc.jugador2
          ? `${insc.jugador2.nombre} ${insc.jugador2.apellido}`
          : 'Pendiente',
        telefonoJ2: insc.jugador2?.telefono ?? '',
        estado: insc.estado,
        modoPago: insc.modoPago ?? '',
        fecha: insc.createdAt
          ? new Date(insc.createdAt).toISOString().slice(0, 10)
          : '',
      });
    }

    const data = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(data as ArrayBuffer);
    const filename = `inscripciones-${this.slug(torneo.nombre)}.xlsx`;

    return { buffer, filename };
  }

  /** Convierte un nombre a un slug seguro para nombre de archivo. */
  private slug(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // quitar acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'torneo';
  }
}
