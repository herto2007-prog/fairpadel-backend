import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ComisionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Recalcula y actualiza el monto estimado de la comisión de un torneo
   * basado en las inscripciones confirmadas y la configuración COMISION_POR_JUGADOR.
   */
  async recalcularComision(tournamentId: string): Promise<void> {
    const configComision = await this.prisma.fairpadelConfig.findUnique({
      where: { clave: 'COMISION_POR_JUGADOR' },
    });

    const comisionPorJugador = parseInt(configComision?.valor || '0');
    if (!comisionPorJugador) return;

    const confirmadas = await this.prisma.inscripcion.count({
      where: {
        tournamentId,
        estado: 'CONFIRMADA',
      },
    });

    const montoEstimado = confirmadas * 2 * comisionPorJugador;

    await this.prisma.torneoComision.update({
      where: { tournamentId },
      data: { montoEstimado },
    });
  }

  /**
   * Calcula la comisión REAL de un torneo según el modelo de negocio acordado:
   *   monto = (jugadores que JUGARON al menos un partido real) × tarifa por jugador.
   *
   * "Jugó" = aparece en un partido cuyo estado es FINALIZADO, RETIRADO o
   * DESCALIFICADO (hubo juego real). Los WO (no se presentó), PROGRAMADO,
   * EN_JUEGO, SUSPENDIDO y CANCELADO NO cuentan: no se cobra por quien no jugó.
   * Los torneos americanos son gratis (gancho) → nunca generan comisión.
   *
   * Se calcula on-demand desde los partidos: mientras el torneo corre es un
   * estimado que sube, y al finalizar el torneo el número queda firme por sí
   * solo (no requiere "congelar" en un evento de finalización).
   */
  async calcularComisionReal(tournamentId: string): Promise<{
    jugaronCount: number;
    tarifa: number;
    monto: number;
  }> {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { formato: true },
    });

    // Americano es gratis: no genera comisión.
    if (!torneo || torneo.formato === 'americano') {
      return { jugaronCount: 0, tarifa: 0, monto: 0 };
    }

    const configComision = await this.prisma.fairpadelConfig.findUnique({
      where: { clave: 'COMISION_POR_JUGADOR' },
    });
    const tarifa = parseInt(configComision?.valor || '0');
    if (!tarifa) {
      return { jugaronCount: 0, tarifa: 0, monto: 0 };
    }

    // Solo partidos con juego REAL (excluye WO / programados / suspendidos / cancelados).
    const partidosJugados = await this.prisma.match.findMany({
      where: {
        tournamentId,
        estado: { in: ['FINALIZADO', 'RETIRADO', 'DESCALIFICADO'] },
      },
      select: {
        inscripcion1: { select: { jugador1Id: true, jugador2Id: true } },
        inscripcion2: { select: { jugador1Id: true, jugador2Id: true } },
      },
    });

    const jugadores = new Set<string>();
    for (const partido of partidosJugados) {
      for (const insc of [partido.inscripcion1, partido.inscripcion2]) {
        if (!insc) continue;
        if (insc.jugador1Id) jugadores.add(insc.jugador1Id);
        if (insc.jugador2Id) jugadores.add(insc.jugador2Id);
      }
    }

    const jugaronCount = jugadores.size;
    return { jugaronCount, tarifa, monto: jugaronCount * tarifa };
  }
}
