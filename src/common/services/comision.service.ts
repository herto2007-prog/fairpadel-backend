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
}
