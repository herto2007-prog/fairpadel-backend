import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
      this.validarMarcador(
        set1Pareja1,
        set1Pareja2,
        set2Pareja1,
        set2Pareja2,
        set3Pareja1,
        set3Pareja2,
      );

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

    // Avanzar ganador al siguiente partido (usa posicionEnSiguiente)
    if (match.partidoSiguienteId) {
      await this.avanzarGanador(match.partidoSiguienteId, ganadorId, match.id);
    }

    // Si es SEMIFINAL, colocar perdedor en partido de UBICACION
    if (match.ronda === 'SEMIFINAL' && perdedorId) {
      await this.colocarPerdedorEnUbicacion(
        match.tournamentId,
        match.categoryId,
        perdedorId,
      );
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
    const games = [s1p1, s1p2, s2p1, s2p2];
    if (s3p1 !== null) games.push(s3p1);
    if (s3p2 !== null) games.push(s3p2);

    for (const g of games) {
      if (g < 0 || g > 7) {
        throw new BadRequestException('Los games deben estar entre 0 y 7');
      }
    }

    const validarSet = (p1: number, p2: number) => {
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

    if (s3p1 !== null && s3p2 !== null) {
      if (!validarSet(s3p1, s3p2)) {
        throw new BadRequestException('Marcador inválido en set 3');
      }
    }
  }

  // Fix: usa posicionEnSiguiente del match actual en vez de rondaAnterior % 2
  private async avanzarGanador(
    partidoSiguienteId: string,
    ganadorId: string,
    matchId: string,
  ) {
    // Obtener el match actual para leer posicionEnSiguiente
    const currentMatch = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!currentMatch || !currentMatch.posicionEnSiguiente) {
      return; // No hay info de posición, no se puede avanzar
    }

    const campo = currentMatch.posicionEnSiguiente === 1 ? 'pareja1Id' : 'pareja2Id';

    await this.prisma.match.update({
      where: { id: partidoSiguienteId },
      data: { [campo]: ganadorId },
    });
  }

  // Colocar perdedor de SEMIFINAL en el partido de UBICACION (3er y 4to lugar)
  private async colocarPerdedorEnUbicacion(
    tournamentId: string,
    categoryId: string,
    perdedorId: string,
  ) {
    const ubicacionMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        categoryId,
        ronda: 'UBICACION',
      },
    });

    if (!ubicacionMatch) return;

    // Colocar en primer slot vacío
    if (!ubicacionMatch.pareja1Id) {
      await this.prisma.match.update({
        where: { id: ubicacionMatch.id },
        data: { pareja1Id: perdedorId },
      });
    } else if (!ubicacionMatch.pareja2Id) {
      await this.prisma.match.update({
        where: { id: ubicacionMatch.id },
        data: { pareja2Id: perdedorId },
      });
    }
  }

  // Intercambiar horarios/canchas entre dos partidos (Premium only)
  async swapMatchSchedules(match1Id: string, match2Id: string, userId: string) {
    // Validar que el usuario es premium
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.esPremium) {
      throw new ForbiddenException(
        'Esta función requiere una suscripción Premium',
      );
    }

    // Obtener ambos partidos
    const [match1, match2] = await Promise.all([
      this.prisma.match.findUnique({ where: { id: match1Id } }),
      this.prisma.match.findUnique({ where: { id: match2Id } }),
    ]);

    if (!match1 || !match2) {
      throw new NotFoundException('Uno o ambos partidos no encontrados');
    }

    // Validar mismo torneo
    if (match1.tournamentId !== match2.tournamentId) {
      throw new BadRequestException('Los partidos deben ser del mismo torneo');
    }

    // Validar ninguno finalizado
    if (match1.estado === 'FINALIZADO' || match2.estado === 'FINALIZADO') {
      throw new BadRequestException(
        'No se puede intercambiar horarios de partidos finalizados',
      );
    }

    // Swap atómico de horarios y canchas
    await this.prisma.$transaction([
      this.prisma.match.update({
        where: { id: match1Id },
        data: {
          fechaProgramada: match2.fechaProgramada,
          horaProgramada: match2.horaProgramada,
          horaFinEstimada: match2.horaFinEstimada,
          torneoCanchaId: match2.torneoCanchaId,
        },
      }),
      this.prisma.match.update({
        where: { id: match2Id },
        data: {
          fechaProgramada: match1.fechaProgramada,
          horaProgramada: match1.horaProgramada,
          horaFinEstimada: match1.horaFinEstimada,
          torneoCanchaId: match1.torneoCanchaId,
        },
      }),
    ]);

    return { message: 'Horarios intercambiados exitosamente' };
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
