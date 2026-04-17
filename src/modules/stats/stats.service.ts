import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface StatsGlobales {
  usuarios: { total: number };
  torneos: { total: number; activos: number };
  partidos: { total: number };
  sedes: { total: number; ciudades: number };
  reservas: { total: number };
  inscripciones: { total: number };
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerStatsGlobales(): Promise<StatsGlobales> {
    const [
      totalUsuarios,
      totalTorneos,
      totalTorneosActivos,
      totalPartidos,
      totalSedes,
      totalReservas,
      totalInscripciones,
      ciudadesDistinct,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.tournament.count(),
      this.prisma.tournament.count({
        where: { estado: { not: 'BORRADOR' } },
      }),
      this.prisma.match.count(),
      this.prisma.sede.count(),
      this.prisma.reservaCancha.count(),
      this.prisma.inscripcion.count(),
      this.prisma.sede.groupBy({ by: ['ciudad'], _count: true }),
    ]);

    return {
      usuarios: { total: totalUsuarios },
      torneos: { total: totalTorneos, activos: totalTorneosActivos },
      partidos: { total: totalPartidos },
      sedes: { total: totalSedes, ciudades: ciudadesDistinct.length },
      reservas: { total: totalReservas },
      inscripciones: { total: totalInscripciones },
    };
  }
}
