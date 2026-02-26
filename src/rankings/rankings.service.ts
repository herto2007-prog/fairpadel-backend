import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
const PDFDocument = require('pdfkit');

@Injectable()
export class RankingsService {
  constructor(private prisma: PrismaService) {}

  private getTemporadaActual(): string {
    return new Date().getFullYear().toString();
  }

  async obtenerRankings(tipo?: string, alcance?: string, genero?: string, temporada?: string) {
    const where: any = {};

    if (tipo) {
      where.tipoRanking = tipo;
    }
    if (alcance) {
      where.alcance = alcance;
    }
    if (genero) {
      where.genero = genero;
    }
    where.temporada = temporada || this.getTemporadaActual();

    const rankings = await this.prisma.ranking.findMany({
      where,
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            ciudad: true,
            fotoUrl: true,
            esPremium: true,
          },
        },
      },
      orderBy: {
        posicion: 'asc',
      },
    });

    return rankings;
  }

  async getTemporadasDisponibles(): Promise<string[]> {
    const result = await this.prisma.ranking.findMany({
      where: { tipoRanking: 'GLOBAL' },
      select: { temporada: true },
      distinct: ['temporada'],
      orderBy: { temporada: 'desc' },
    });
    const temporadas = result.map((r) => r.temporada);
    // Always include current year even if no rankings yet
    const currentYear = this.getTemporadaActual();
    if (!temporadas.includes(currentYear)) {
      temporadas.unshift(currentYear);
    }
    return temporadas;
  }

  async obtenerRankingGlobal(genero?: string) {
    return this.obtenerRankings('GLOBAL', undefined, genero);
  }

  async obtenerRankingPorPais(pais: string, genero?: string) {
    return this.obtenerRankings('PAIS', pais, genero);
  }

  async obtenerRankingPorCiudad(ciudad: string, genero?: string) {
    return this.obtenerRankings('CIUDAD', ciudad, genero);
  }

  async obtenerRankingPorCategoria(categoria: string, genero?: string) {
    return this.obtenerRankings('CATEGORIA', categoria, genero);
  }

  async obtenerTop10(genero?: string, temporada?: string) {
    const where: any = {
      tipoRanking: 'GLOBAL',
      temporada: temporada || this.getTemporadaActual(),
    };
    if (genero) {
      where.genero = genero;
    }

    const top10 = await this.prisma.ranking.findMany({
      where,
      take: 10,
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            ciudad: true,
            fotoUrl: true,
            esPremium: true,
          },
        },
      },
      orderBy: {
        posicion: 'asc',
      },
    });

    return top10;
  }

  async obtenerRankingJugador(jugadorId: string) {
    const rankings = await this.prisma.ranking.findMany({
      where: { jugadorId },
      include: {
        jugador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            documento: true,
            genero: true,
            ciudad: true,
            fotoUrl: true,
            esPremium: true,
          },
        },
      },
    });

    return rankings;
  }

  async obtenerHistorialPuntos(jugadorId: string) {
    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId },
      include: {
        tournament: {
          select: {
            id: true,
            nombre: true,
            ciudad: true,
            fechaInicio: true,
          },
        },
        category: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        fechaTorneo: 'desc',
      },
    });

    return historial;
  }

  async actualizarRankings(tournamentId: string) {
    // Este método se llamará cuando un torneo finaliza
    // Calculará y actualizará los rankings de todos los jugadores

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        partidos: {
          where: { ronda: { in: ['FINAL', 'SEMIFINAL', 'CUARTOS', 'OCTAVOS'] } },
          include: {
            category: true,
            parejaGanadora: {
              include: {
                jugador1: true,
                jugador2: true,
              },
            },
            parejaPerdedora: {
              include: {
                jugador1: true,
                jugador2: true,
              },
            },
          },
        },
      },
    });

    if (!tournament) {
      return;
    }

    // Tabla de puntos
    const puntosPorPosicion = {
      CAMPEON: 100,
      FINALISTA: 60,
      SEMIFINALISTA: 35,
      CUARTOS: 15,
      OCTAVOS: 8,
      PRIMERA_RONDA: 3,
    };

    // Procesar cada partido para asignar puntos
    for (const partido of tournament.partidos) {
      if (!partido.parejaGanadora || !partido.parejaPerdedora) {
        continue;
      }

      let puntos = 0;
      let posicion = '';

      if (partido.ronda === 'FINAL') {
        puntos = puntosPorPosicion.CAMPEON;
        posicion = 'CAMPEON';
        await this.registrarPuntos(
          partido.parejaGanadora,
          tournamentId,
          partido.categoryId,
          puntos,
          posicion,
        );

        puntos = puntosPorPosicion.FINALISTA;
        posicion = 'FINALISTA';
        await this.registrarPuntos(
          partido.parejaPerdedora,
          tournamentId,
          partido.categoryId,
          puntos,
          posicion,
        );
      } else if (partido.ronda === 'SEMIFINAL') {
        puntos = puntosPorPosicion.SEMIFINALISTA;
        posicion = 'SEMIFINALISTA';
        await this.registrarPuntos(
          partido.parejaPerdedora,
          tournamentId,
          partido.categoryId,
          puntos,
          posicion,
        );
      } else if (partido.ronda === 'CUARTOS') {
        puntos = puntosPorPosicion.CUARTOS;
        posicion = 'CUARTOS';
        await this.registrarPuntos(
          partido.parejaPerdedora,
          tournamentId,
          partido.categoryId,
          puntos,
          posicion,
        );
      }
    }

    // Recalcular posiciones en todos los rankings
    await this.recalcularPosiciones();

    return { message: 'Rankings actualizados' };
  }

  private async registrarPuntos(
    pareja: any,
    tournamentId: string,
    categoryId: string,
    puntos: number,
    posicion: string,
  ) {
    const jugadores = [pareja.jugador1, pareja.jugador2].filter(Boolean);

    for (const jugador of jugadores) {
      // Registrar en historial
      await this.prisma.historialPuntos.create({
        data: {
          jugadorId: jugador.id,
          tournamentId,
          categoryId,
          posicionFinal: posicion,
          puntosGanados: puntos,
          fechaTorneo: new Date(),
        },
      });

      // Actualizar o crear ranking global
      await this.actualizarRankingJugador(jugador.id, puntos);
    }
  }

  async actualizarRankingJugador(jugadorId: string, puntosNuevos: number) {
    const temporada = this.getTemporadaActual();
    const jugador = await this.prisma.user.findUnique({
      where: { id: jugadorId },
    });

    if (!jugador) {
      return;
    }

    await this.prisma.ranking.upsert({
      where: {
        jugadorId_tipoRanking_alcance_temporada: {
          jugadorId,
          tipoRanking: 'GLOBAL',
          alcance: 'GLOBAL',
          temporada,
        },
      },
      update: {
        puntosTotales: { increment: puntosNuevos },
        torneosJugados: { increment: 1 },
        ultimaActualizacion: new Date(),
      },
      create: {
        jugadorId,
        tipoRanking: 'GLOBAL',
        alcance: 'GLOBAL',
        genero: jugador.genero,
        temporada,
        puntosTotales: puntosNuevos,
        posicion: 999999,
        torneosJugados: 1,
      },
    });
  }

  async recalcularPosiciones() {
    const temporada = this.getTemporadaActual();

    // Recalcular posiciones separadas por genero
    for (const genero of ['MASCULINO', 'FEMENINO']) {
      const rankings = await this.prisma.ranking.findMany({
        where: { tipoRanking: 'GLOBAL', temporada, genero: genero as any },
        orderBy: { puntosTotales: 'desc' },
      });

      let posicion = 1;
      for (const ranking of rankings) {
        await this.prisma.ranking.update({
          where: { id: ranking.id },
          data: {
            posicionAnterior: ranking.posicion,
            posicion,
          },
        });
        posicion++;
      }
    }
  }
  async recalcularRankings() {
    // Este método se puede llamar desde el admin
    // para recalcular todos los rankings manualmente
    console.log('Recalculando rankings globales...');
    // Implementación futura si es necesario
    return { message: 'Rankings recalculados' };
  }

  /**
   * Update win/loss stats and streak for a player after a match result.
   * Called from MatchesService after cargarResultado().
   */
  async actualizarEstadisticasPartido(
    jugadorId: string,
    esVictoria: boolean,
    esCampeonato: boolean,
  ) {
    const temporada = this.getTemporadaActual();
    const jugador = await this.prisma.user.findUnique({
      where: { id: jugadorId },
      select: { id: true, genero: true },
    });

    if (!jugador) return;

    // Find or create GLOBAL ranking for current season
    let ranking = await this.prisma.ranking.findUnique({
      where: {
        jugadorId_tipoRanking_alcance_temporada: {
          jugadorId,
          tipoRanking: 'GLOBAL',
          alcance: 'GLOBAL',
          temporada,
        },
      },
    });

    if (!ranking) {
      ranking = await this.prisma.ranking.create({
        data: {
          jugadorId,
          tipoRanking: 'GLOBAL',
          alcance: 'GLOBAL',
          genero: jugador.genero,
          temporada,
          puntosTotales: 0,
          posicion: 999999,
          torneosJugados: 0,
        },
      });
    }

    const updateData: any = {
      ultimaActualizacion: new Date(),
    };

    if (esVictoria) {
      updateData.victorias = { increment: 1 };
      updateData.rachaActual = ranking.rachaActual >= 0 ? ranking.rachaActual + 1 : 1;
    } else {
      updateData.derrotas = { increment: 1 };
      updateData.rachaActual = 0;
    }

    if (esCampeonato && esVictoria) {
      updateData.campeonatos = { increment: 1 };
    }

    // Update win percentage
    const newVictorias = (ranking.victorias || 0) + (esVictoria ? 1 : 0);
    const newDerrotas = (ranking.derrotas || 0) + (esVictoria ? 0 : 1);
    const totalPartidos = newVictorias + newDerrotas;
    if (totalPartidos > 0) {
      updateData.porcentajeVictorias = Number(
        ((newVictorias / totalPartidos) * 100).toFixed(2),
      );
    }

    // Update best position if current is better
    if (ranking.posicion < (ranking.mejorPosicion || 999999)) {
      updateData.mejorPosicion = ranking.posicion;
    }

    await this.prisma.ranking.update({
      where: { id: ranking.id },
      data: updateData,
    });
  }

  // ═══════════════════════════════════════
  // EXPORT — Premium-only
  // ═══════════════════════════════════════

  /**
   * Export player career summary as PDF (Premium).
   */
  async exportCareerPdf(jugadorId: string): Promise<Buffer> {
    const user = await this.prisma.user.findUnique({
      where: { id: jugadorId },
      include: { categoriaActual: { select: { nombre: true } } },
    });
    if (!user) throw new NotFoundException('Jugador no encontrado');
    if (!user.esPremium) throw new ForbiddenException('Necesitas FairPadel Premium para exportar estadísticas');

    const ranking = await this.prisma.ranking.findUnique({
      where: {
        jugadorId_tipoRanking_alcance_temporada: {
          jugadorId,
          tipoRanking: 'GLOBAL',
          alcance: 'GLOBAL',
          temporada: this.getTemporadaActual(),
        },
      },
    });

    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId },
      include: {
        tournament: { select: { nombre: true, ciudad: true, fechaInicio: true } },
        category: { select: { nombre: true } },
      },
      orderBy: { fechaTorneo: 'desc' },
      take: 50,
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(22).fillColor('#6366f1').text('FairPadel', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(16).fillColor('#333').text(`${user.nombre} ${user.apellido}`, { align: 'center' });
      doc.fontSize(10).fillColor('#666').text(
        `${user.categoriaActual?.nombre || 'Sin categoría'} · ${user.ciudad || 'Sin ciudad'} · ${user.genero || ''}`,
        { align: 'center' },
      );
      doc.moveDown(1);

      // Ranking info
      doc.fontSize(13).fillColor('#6366f1').text('Ranking');
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#333');
      if (ranking) {
        doc.text(`Posición: #${ranking.posicion}  |  Puntos: ${ranking.puntosTotales}  |  Torneos: ${ranking.torneosJugados}`);
        doc.text(`Victorias: ${ranking.victorias || 0}  |  Derrotas: ${ranking.derrotas || 0}  |  Win%: ${ranking.porcentajeVictorias || 0}%`);
        doc.text(`Campeonatos: ${ranking.campeonatos || 0}  |  Mejor posición: #${ranking.mejorPosicion || '-'}`);
      } else {
        doc.text('Sin datos de ranking.');
      }
      doc.moveDown(1);

      // Tournament history table
      doc.fontSize(13).fillColor('#6366f1').text('Historial de Torneos');
      doc.moveDown(0.5);

      if (historial.length === 0) {
        doc.fontSize(10).fillColor('#666').text('Sin torneos registrados.');
      } else {
        // Table header
        const startX = 50;
        let y = doc.y;
        doc.fontSize(8).fillColor('#999');
        doc.text('Torneo', startX, y, { width: 150 });
        doc.text('Ciudad', startX + 155, y, { width: 80 });
        doc.text('Categoría', startX + 240, y, { width: 80 });
        doc.text('Posición', startX + 325, y, { width: 65 });
        doc.text('Pts', startX + 395, y, { width: 40 });
        doc.text('Fecha', startX + 440, y, { width: 60 });
        y += 14;
        doc.moveTo(startX, y).lineTo(startX + 500, y).strokeColor('#ddd').stroke();
        y += 4;

        for (const h of historial) {
          if (y > 750) {
            doc.addPage();
            y = 50;
          }
          doc.fontSize(8).fillColor('#333');
          doc.text(h.tournament?.nombre || '-', startX, y, { width: 150 });
          doc.text(h.tournament?.ciudad || '-', startX + 155, y, { width: 80 });
          doc.text(h.category?.nombre || '-', startX + 240, y, { width: 80 });
          doc.text(h.posicionFinal || '-', startX + 325, y, { width: 65 });
          doc.text(String(h.puntosGanados || 0), startX + 395, y, { width: 40 });
          const fecha = h.fechaTorneo ? new Date(h.fechaTorneo).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-';
          doc.text(fecha, startX + 440, y, { width: 60 });
          y += 14;
        }
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#999').text(
        `Generado el ${new Date().toLocaleDateString('es-PY')} — FairPadel Premium`,
        { align: 'center' },
      );

      doc.end();
    });
  }

  /**
   * Export player tournament + match history as Excel (Premium).
   */
  async exportHistoryExcel(jugadorId: string): Promise<Buffer> {
    const user = await this.prisma.user.findUnique({ where: { id: jugadorId } });
    if (!user) throw new NotFoundException('Jugador no encontrado');
    if (!user.esPremium) throw new ForbiddenException('Necesitas FairPadel Premium para exportar estadísticas');

    const historial = await this.prisma.historialPuntos.findMany({
      where: { jugadorId },
      include: {
        tournament: { select: { nombre: true, ciudad: true, fechaInicio: true } },
        category: { select: { nombre: true } },
      },
      orderBy: { fechaTorneo: 'desc' },
    });

    // Get matches
    const matches = await this.prisma.match.findMany({
      where: {
        estado: { in: ['FINALIZADO', 'WO'] },
        OR: [
          { pareja1: { OR: [{ jugador1Id: jugadorId }, { jugador2Id: jugadorId }] } },
          { pareja2: { OR: [{ jugador1Id: jugadorId }, { jugador2Id: jugadorId }] } },
        ],
      },
      include: {
        tournament: { select: { nombre: true } },
        category: { select: { nombre: true } },
        pareja1: { include: { jugador1: { select: { nombre: true, apellido: true } }, jugador2: { select: { nombre: true, apellido: true } } } },
        pareja2: { include: { jugador1: { select: { nombre: true, apellido: true } }, jugador2: { select: { nombre: true, apellido: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FairPadel';
    workbook.created = new Date();

    // Sheet 1: Historial Torneos
    const sheet1 = workbook.addWorksheet('Historial Torneos');
    sheet1.columns = [
      { header: 'Torneo', key: 'torneo', width: 30 },
      { header: 'Ciudad', key: 'ciudad', width: 18 },
      { header: 'Categoría', key: 'categoria', width: 18 },
      { header: 'Posición', key: 'posicion', width: 14 },
      { header: 'Puntos', key: 'puntos', width: 10 },
      { header: 'Fecha', key: 'fecha', width: 14 },
    ];
    sheet1.getRow(1).font = { bold: true };

    for (const h of historial) {
      sheet1.addRow({
        torneo: h.tournament?.nombre || '-',
        ciudad: h.tournament?.ciudad || '-',
        categoria: h.category?.nombre || '-',
        posicion: h.posicionFinal || '-',
        puntos: h.puntosGanados || 0,
        fecha: h.fechaTorneo ? new Date(h.fechaTorneo).toLocaleDateString('es-PY') : '-',
      });
    }

    // Sheet 2: Partidos
    const sheet2 = workbook.addWorksheet('Partidos');
    sheet2.columns = [
      { header: 'Torneo', key: 'torneo', width: 28 },
      { header: 'Ronda', key: 'ronda', width: 14 },
      { header: 'Compañero', key: 'companero', width: 22 },
      { header: 'Oponentes', key: 'oponentes', width: 30 },
      { header: 'Resultado', key: 'resultado', width: 16 },
      { header: 'Victoria', key: 'victoria', width: 10 },
      { header: 'Fecha', key: 'fecha', width: 14 },
    ];
    sheet2.getRow(1).font = { bold: true };

    for (const m of matches) {
      const isP1 = m.pareja1?.jugador1Id === jugadorId || m.pareja1?.jugador2Id === jugadorId;
      const myPareja = isP1 ? m.pareja1 : m.pareja2;
      const oppPareja = isP1 ? m.pareja2 : m.pareja1;
      const companion = myPareja?.jugador1Id === jugadorId ? myPareja?.jugador2 : myPareja?.jugador1;
      const opp1 = oppPareja?.jugador1;
      const opp2 = oppPareja?.jugador2;
      const victoria = m.parejaGanadoraId === (isP1 ? m.pareja1Id : m.pareja2Id);

      const scores = [];
      if (m.set1Pareja1 != null && m.set1Pareja2 != null) {
        const my = isP1 ? m.set1Pareja1 : m.set1Pareja2;
        const opp = isP1 ? m.set1Pareja2 : m.set1Pareja1;
        scores.push(`${my}-${opp}`);
      }
      if (m.set2Pareja1 != null && m.set2Pareja2 != null) {
        const my = isP1 ? m.set2Pareja1 : m.set2Pareja2;
        const opp = isP1 ? m.set2Pareja2 : m.set2Pareja1;
        scores.push(`${my}-${opp}`);
      }
      if (m.set3Pareja1 != null && m.set3Pareja2 != null) {
        const my = isP1 ? m.set3Pareja1 : m.set3Pareja2;
        const opp = isP1 ? m.set3Pareja2 : m.set3Pareja1;
        scores.push(`${my}-${opp}`);
      }

      sheet2.addRow({
        torneo: m.tournament?.nombre || '-',
        ronda: m.ronda || '-',
        companero: companion ? `${companion.nombre} ${companion.apellido}` : '-',
        oponentes: `${opp1?.nombre || ''} ${opp1?.apellido || ''} / ${opp2?.nombre || ''} ${opp2?.apellido || ''}`.trim() || '-',
        resultado: m.estado === 'WO' ? 'W.O.' : scores.join(' | '),
        victoria: victoria ? 'Sí' : 'No',
        fecha: m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-PY') : '-',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}