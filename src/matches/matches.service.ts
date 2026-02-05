import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CargarResultadoDto } from './dto/cargar-resultado.dto';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        tournament: true,
        category: true,
        pareja1: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        pareja2: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        parejaGanadora: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: true,
              },
            },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    return match;
  }

  async cargarResultado(id: string, dto: CargarResultadoDto) {
    const match = await this.findOne(id);

    if (match.estado === 'FINALIZADO') {
      throw new BadRequestException('Este partido ya tiene resultado cargado');
    }

    const {
      set1Pareja1,
      set1Pareja2,
      set2Pareja1,
      set2Pareja2,
      set3Pareja1,
      set3Pareja2,
      esWalkOver,
      parejaGanadoraId,
      observaciones,
    } = dto;

    let ganadorId: string;
    let perdedorId: string;

    if (esWalkOver) {
      // Walk Over - el ganador es especificado
      ganadorId = parejaGanadoraId;
      perdedorId = ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;

      await this.prisma.match.update({
        where: { id },
        data: {
          estado: 'WO',
          parejaGanadoraId: ganadorId,
          parejaPerdedoraId: perdedorId,
          observaciones: observaciones || 'Walk Over',
        },
      });
    } else {
      // Validar marcador
      this.validarMarcador(
        set1Pareja1,
        set1Pareja2,
        set2Pareja1,
        set2Pareja2,
        set3Pareja1,
        set3Pareja2,
      );

      // Determinar ganador
      let setsGanadosP1 = 0;
      let setsGanadosP2 = 0;

      if (set1Pareja1 > set1Pareja2) setsGanadosP1++;
      else setsGanadosP2++;

      if (set2Pareja1 > set2Pareja2) setsGanadosP1++;
      else setsGanadosP2++;

      if (set3Pareja1 !== null && set3Pareja2 !== null) {
        if (set3Pareja1 > set3Pareja2) setsGanadosP1++;
        else setsGanadosP2++;
      }

      ganadorId = setsGanadosP1 > setsGanadosP2 ? match.pareja1Id : match.pareja2Id;
      perdedorId = ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;

      await this.prisma.match.update({
        where: { id },
        data: {
          set1Pareja1,
          set1Pareja2,
          set2Pareja1,
          set2Pareja2,
          set3Pareja1,
          set3Pareja2,
          estado: 'FINALIZADO',
          parejaGanadoraId: ganadorId,
          parejaPerdedoraId: perdedorId,
          observaciones,
        },
      });
    }

    // Avanzar ganador al siguiente partido (si existe)
    if (match.partidoSiguienteId) {
      await this.avanzarGanador(match.partidoSiguienteId, ganadorId, match.numeroRonda);
    }

    // TODO: Actualizar ranking
    // TODO: Enviar notificaciones

    return this.findOne(id);
  }

  private validarMarcador(
    s1p1: number,
    s1p2: number,
    s2p1: number,
    s2p2: number,
    s3p1?: number,
    s3p2?: number,
  ) {
    // Validar que los games estén entre 0 y 7
    const games = [s1p1, s1p2, s2p1, s2p2];
    if (s3p1 !== null) games.push(s3p1);
    if (s3p2 !== null) games.push(s3p2);

    for (const g of games) {
      if (g < 0 || g > 7) {
        throw new BadRequestException('Los games deben estar entre 0 y 7');
      }
    }

    // Validar que un set se gana con 6 games y diferencia de 2
    const validarSet = (p1: number, p2: number) => {
      const diff = Math.abs(p1 - p2);
      if (p1 === 6 && p2 <= 4) return true;
      if (p2 === 6 && p1 <= 4) return true;
      if (p1 === 7 && (p2 === 5 || p2 === 6)) return true;
      if (p2 === 7 && (p1 === 5 || p1 === 6)) return true;
      return false;
    };

    if (!validarSet(s1p1, s1p2)) {
      throw new BadRequestException('Marcador inválido en set 1');
    }
    if (!validarSet(s2p1, s2p2)) {
      throw new BadRequestException('Marcador inválido en set 2');
    }

    // Si hay set 3, debe ser tie-break a 10 (o validar normal)
    if (s3p1 !== null && s3p2 !== null) {
      if (!validarSet(s3p1, s3p2)) {
        throw new BadRequestException('Marcador inválido en set 3');
      }
    }
  }

  private async avanzarGanador(
    partidoSiguienteId: string,
    ganadorId: string,
    rondaAnterior: number,
  ) {
    const partidoSiguiente = await this.prisma.match.findUnique({
      where: { id: partidoSiguienteId },
    });

    // Determinar si va a pareja1 o pareja2 del siguiente partido
    // Esto depende del bracket (par/impar)
    const campo = rondaAnterior % 2 === 0 ? 'pareja1Id' : 'pareja2Id';

    await this.prisma.match.update({
      where: { id: partidoSiguienteId },
      data: { [campo]: ganadorId },
    });
  }

  async reprogramar(id: string, data: any) {
    const match = await this.findOne(id);

    if (match.estado === 'FINALIZADO') {
      throw new BadRequestException('No se puede reprogramar un partido finalizado');
    }

    return this.prisma.match.update({
      where: { id },
      data: {
        fechaProgramada: new Date(data.fechaProgramada),
        horaProgramada: data.horaProgramada,
        torneoCanchaId: data.torneoCanchaId || match.torneoCanchaId,
      },
    });
  }

  async obtenerPartidosPendientes(tournamentId: string) {
    return this.prisma.match.findMany({
      where: {
        tournamentId,
        estado: { in: ['PROGRAMADO', 'EN_JUEGO'] },
      },
      include: {
        category: true,
        pareja1: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        pareja2: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: true,
              },
            },
          },
        },
      },
      orderBy: [
        { fechaProgramada: 'asc' },
        { horaProgramada: 'asc' },
      ],
    });
  }
}