import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchStatus } from '@prisma/client';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Registra el resultado de un partido y avanza al ganador en el bracket
   */
  async registrarResultado(
    matchId: string,
    dto: RegistrarResultadoDto,
    organizadorId: string,
  ) {
    // Obtener el match con sus relaciones
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { select: { organizadorId: true } },
        fixtureVersion: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Verificar permisos
    if (match.tournament.organizadorId !== organizadorId) {
      throw new BadRequestException('No tienes permiso para registrar resultados');
    }

    // Verificar que el partido está programado o en juego
    if (match.estado !== MatchStatus.PROGRAMADO && match.estado !== MatchStatus.EN_JUEGO) {
      throw new BadRequestException('El partido no puede recibir resultados en su estado actual');
    }

    // Determinar ganador por sets
    const setsPareja1 = [
      dto.set1Pareja1,
      dto.set2Pareja1,
      dto.set3Pareja1,
    ].filter(s => s !== undefined && s !== null);

    const setsPareja2 = [
      dto.set1Pareja2,
      dto.set2Pareja2,
      dto.set3Pareja2,
    ].filter(s => s !== undefined && s !== null);

    // Validar que hay al menos 2 sets
    if (setsPareja1.length < 2 || setsPareja2.length < 2) {
      throw new BadRequestException('Se requieren al menos 2 sets');
    }

    // Contar sets ganados
    let setsGanadosPareja1 = 0;
    let setsGanadosPareja2 = 0;

    for (let i = 0; i < Math.min(setsPareja1.length, setsPareja2.length); i++) {
      if (setsPareja1[i] > setsPareja2[i]) setsGanadosPareja1++;
      else if (setsPareja2[i] > setsPareja1[i]) setsGanadosPareja2++;
    }

    // Determinar ganador (mejor de 3 sets)
    let parejaGanadoraId: string;
    let parejaPerdedoraId: string;

    if (setsGanadosPareja1 >= 2) {
      parejaGanadoraId = match.pareja1Id;
      parejaPerdedoraId = match.pareja2Id;
    } else if (setsGanadosPareja2 >= 2) {
      parejaGanadoraId = match.pareja2Id;
      parejaPerdedoraId = match.pareja1Id;
    } else {
      throw new BadRequestException('Resultado inválido: no hay ganador claro');
    }

    // Actualizar el match con el resultado
    const matchActualizado = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        estado: MatchStatus.FINALIZADO,
        set1Pareja1: dto.set1Pareja1,
        set1Pareja2: dto.set1Pareja2,
        set2Pareja1: dto.set2Pareja1,
        set2Pareja2: dto.set2Pareja2,
        set3Pareja1: dto.set3Pareja1,
        set3Pareja2: dto.set3Pareja2,
        parejaGanadoraId,
        parejaPerdedoraId,
        notas: dto.notas,
      },
    });

    // Avanzar el ganador al siguiente partido si existe
    if (match.partidoSiguienteId && parejaGanadoraId) {
      await this.avanzarGanador(match.partidoSiguienteId, parejaGanadoraId, match.posicionEnSiguiente);
    }

    return this.getMatchById(matchId);
  }

  /**
   * Avanza un ganador al siguiente partido del bracket
   */
  private async avanzarGanador(
    partidoSiguienteId: string,
    parejaGanadoraId: string,
    posicion: string,
  ) {
    const updateData: any = {};
    
    if (posicion === 'P1') {
      updateData.pareja1Id = parejaGanadoraId;
    } else if (posicion === 'P2') {
      updateData.pareja2Id = parejaGanadoraId;
    }

    // Obtener info de la pareja
    const pareja = await this.prisma.inscripcion.findUnique({
      where: { id: parejaGanadoraId },
      include: {
        jugador1: { select: { nombre: true, apellido: true } },
        jugador2: { select: { nombre: true, apellido: true } },
      },
    });

    if (pareja) {
      const nombrePareja = `${pareja.jugador1.nombre} ${pareja.jugador1.apellido} / ${pareja.jugador2?.nombre || '?'}`;
      
      if (posicion === 'P1') {
        updateData.pareja1Nombre = nombrePareja;
      } else {
        updateData.pareja2Nombre = nombrePareja;
      }
    }

    await this.prisma.match.update({
      where: { id: partidoSiguienteId },
      data: updateData,
    });
  }

  /**
   * Programa un partido (fecha, hora, cancha)
   */
  async programarPartido(
    matchId: string,
    data: {
      canchaId?: string;
      canchaNombre?: string;
      fechaProgramada?: Date;
      horaProgramada?: string;
      horaFinEstimada?: string;
    },
    organizadorId: string,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { select: { organizadorId: true } },
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (match.tournament.organizadorId !== organizadorId) {
      throw new BadRequestException('No tienes permiso para programar este partido');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        canchaId: data.canchaId,
        canchaNombre: data.canchaNombre,
        fechaProgramada: data.fechaProgramada,
        horaProgramada: data.horaProgramada,
        horaFinEstimada: data.horaFinEstimada,
        estado: MatchStatus.PROGRAMADO,
      },
    });
  }

  /**
   * Obtiene un partido por ID
   */
  async getMatchById(matchId: string) {
    return this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        pareja1: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        pareja2: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        parejaGanadora: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        partidoSiguiente: {
          select: { id: true, ronda: true, ordenEnRonda: true },
        },
      },
    });
  }

  /**
   * Lista los partidos de un torneo/categoría
   */
  async listarPartidos(tournamentId: string, categoryId?: string) {
    const where: any = { tournamentId };
    if (categoryId) where.categoryId = categoryId;

    return this.prisma.match.findMany({
      where,
      orderBy: [
        { numeroRonda: 'asc' },
        { ordenEnRonda: 'asc' },
      ],
      include: {
        pareja1: {
          include: {
            jugador1: { select: { nombre: true, apellido: true } },
            jugador2: { select: { nombre: true, apellido: true } },
          },
        },
        pareja2: {
          include: {
            jugador1: { select: { nombre: true, apellido: true } },
            jugador2: { select: { nombre: true, apellido: true } },
          },
        },
        parejaGanadora: {
          include: {
            jugador1: { select: { nombre: true, apellido: true } },
            jugador2: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });
  }

  /**
   * Marca un partido como WO
   */
  async registrarWO(
    matchId: string,
    parejaGanadoraId: string,
    organizadorId: string,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { select: { organizadorId: true } },
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (match.tournament.organizadorId !== organizadorId) {
      throw new BadRequestException('No tienes permiso');
    }

    const parejaPerdedoraId = match.pareja1Id === parejaGanadoraId 
      ? match.pareja2Id 
      : match.pareja1Id;

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        estado: MatchStatus.WO,
        parejaGanadoraId,
        parejaPerdedoraId,
        set1Pareja1: 6,
        set1Pareja2: 0,
        set2Pareja1: 6,
        set2Pareja2: 0,
      },
    });

    // Avanzar al siguiente
    if (match.partidoSiguienteId) {
      await this.avanzarGanador(match.partidoSiguienteId, parejaGanadoraId, match.posicionEnSiguiente);
    }

    return this.getMatchById(matchId);
  }
}
