import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { FormatoSet3, MatchStatus, Prisma } from '@prisma/client';
import { RegistrarResultadoDto, RegistrarPuntoDto, IniciarPartidoDto, FinalizarPartidoDto } from './dto/registrar-resultado.dto';
import { ResultadoEspecialDto, TipoResultadoEspecial } from './dto/resultado-especial.dto';
import { LiveScore, HistorialPunto, SetCompletado, VALORES_PUNTOS, GAMES_PARA_SET, PUNTOS_TIE_BREAK, PUNTOS_SUPER_TIE_BREAK } from './entities/live-score.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ResultadosService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS PÚBLICOS - CARGA DIRECTA DE RESULTADOS
  // ═══════════════════════════════════════════════════════════

  /**
   * Registra un resultado completo (post-partido)
   * Usado cuando el partido ya terminó y se ingresan los sets
   */
  async registrarResultado(matchId: string, dto: RegistrarResultadoDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        inscripcion1: { include: { jugador1: true, jugador2: true } },
        inscripcion2: { include: { jugador1: true, jugador2: true } },
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Validar que haya inscripciones en ambas posiciones (a menos que sea BYE)
    if (!match.esBye && (!match.inscripcion1Id || !match.inscripcion2Id)) {
      throw new BadRequestException('El partido no tiene ambas parejas asignadas');
    }

    // Validar resultado lógico
    this.validarResultado(dto);

    // Determinar ganador
    const { ganadorId, perdedorId, setsGanadosP1, setsGanadosP2 } = this.calcularGanador(match, dto);

    // Actualizar partido
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
        formatoSet3: dto.formatoSet3,
        inscripcionGanadoraId: ganadorId,
        inscripcionPerdedoraId: perdedorId,
        observaciones: dto.observaciones,
        duracionMinutos: dto.duracionMinutos,
        horaFinReal: this.dateService.now(),
      },
      include: {
        inscripcion1: true,
        inscripcion2: true,
        inscripcionGanadora: true,
      },
    });

    // Avanzar ganador al siguiente partido si existe
    await this.avanzarGanador(match, ganadorId);

    return {
      success: true,
      message: 'Resultado registrado correctamente',
      data: {
        match: matchActualizado,
        resultado: {
          sets: `${setsGanadosP1}-${setsGanadosP2}`,
          ganadorId,
          score: this.formatearScore(dto),
        },
      },
    };
  }

  /**
   * Registra un resultado especial (retiro, descalificación, WO)
   * Usado cuando el partido no se completa normalmente
   */
  async registrarResultadoEspecial(matchId: string, dto: ResultadoEspecialDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        inscripcion1: true,
        inscripcion2: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Validar que haya inscripciones
    if (!match.esBye && (!match.inscripcion1Id || !match.inscripcion2Id)) {
      throw new BadRequestException('El partido no tiene ambas parejas asignadas');
    }

    // Determinar ganador (la pareja que NO es la afectada)
    const ganadorId = dto.parejaAfectada === 1 
      ? match.inscripcion2Id 
      : match.inscripcion1Id;
    const perdedorId = dto.parejaAfectada === 1
      ? match.inscripcion1Id
      : match.inscripcion2Id;

    // Determinar estado según tipo
    let estado: MatchStatus;
    switch (dto.tipo) {
      case TipoResultadoEspecial.RETIRO_LESION:
      case TipoResultadoEspecial.RETIRO_OTRO:
        estado = MatchStatus.RETIRADO;
        break;
      case TipoResultadoEspecial.DESCALIFICACION:
        estado = MatchStatus.DESCALIFICADO;
        break;
      case TipoResultadoEspecial.WO:
        estado = MatchStatus.WO;
        break;
      default:
        throw new BadRequestException('Tipo de resultado especial inválido');
    }

    // Actualizar partido
    const matchActualizado = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        estado,
        inscripcionGanadoraId: ganadorId,
        inscripcionPerdedoraId: perdedorId,
        parejaRetirada: dto.parejaAfectada,
        razonResultado: dto.razon || dto.tipo,
        observaciones: dto.observaciones,
        duracionMinutos: dto.duracionMinutos,
        horaFinReal: this.dateService.now(),
        // En sets guardamos null para indicar que no hubo juego real
        set1Pareja1: null,
        set1Pareja2: null,
        set2Pareja1: null,
        set2Pareja2: null,
        set3Pareja1: null,
        set3Pareja2: null,
      },
      include: {
        inscripcion1: true,
        inscripcion2: true,
        inscripcionGanadora: true,
      },
    });

    // Avanzar ganador al siguiente partido si existe
    await this.avanzarGanador(match, ganadorId);

    // Mensaje según tipo
    const mensajes = {
      [TipoResultadoEspecial.RETIRO_LESION]: 'Retiro por lesión registrado',
      [TipoResultadoEspecial.RETIRO_OTRO]: 'Retiro registrado',
      [TipoResultadoEspecial.DESCALIFICACION]: 'Descalificación registrada',
      [TipoResultadoEspecial.WO]: 'WO registrado',
    };

    return {
      success: true,
      message: mensajes[dto.tipo],
      data: {
        match: matchActualizado,
        resultado: {
          tipo: dto.tipo,
          ganadorId,
          parejaAfectada: dto.parejaAfectada,
          razon: dto.razon,
        },
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS PÚBLICOS - MARCADOR EN VIVO
  // ═══════════════════════════════════════════════════════════

  /**
   * Inicia un partido en modo "en juego"
   * Inicializa el liveScore con el marcador en 0
   */
  async iniciarPartido(matchId: string, dto: IniciarPartidoDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (match.estado === MatchStatus.FINALIZADO) {
      throw new BadRequestException('El partido ya está finalizado');
    }

    const liveScore: LiveScore = {
      setActual: 1,
      gameP1: 0,
      gameP2: 0,
      puntoP1: 0,
      puntoP2: 0,
      saque: dto.saqueInicial || 1, // Pareja que saca primero (configurable)
      jugadorSacaP1: dto.jugadorSacaP1 || 1, // Por defecto jugador 1 de la pareja 1
      jugadorSacaP2: dto.jugadorSacaP2 || 1, // Por defecto jugador 1 de la pareja 2
      puntosConsecutivos: 0, // Contador de puntos con el mismo saque
      historial: [],
      setsCompletados: [],
      estado: 'EN_JUEGO',
      iniciadoAt: this.dateService.now().toISOString(),
      modoPunto: dto.modoPunto || 'PUNTO_ORO', // Por defecto punto de oro (amateur)
      formatoSet3: dto.formatoSet3 || 'SET_COMPLETO',
    };

    const matchActualizado = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        estado: MatchStatus.EN_JUEGO,
        formatoSet3: dto.formatoSet3 || FormatoSet3.SET_COMPLETO,
        liveScore: liveScore as unknown as Prisma.InputJsonValue,
        horaInicioReal: this.dateService.now(),
      },
    });

    return {
      success: true,
      message: 'Partido iniciado',
      data: {
        matchId,
        liveScore,
        estado: matchActualizado.estado,
      },
    };
  }

  /**
   * Obtiene el marcador actual del partido
   */
  async obtenerMarcador(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        inscripcion1: { include: { jugador1: true, jugador2: true } },
        inscripcion2: { include: { jugador1: true, jugador2: true } },
        tournament: true,
        category: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Si está finalizado, devolver resultado final
    if (match.estado === MatchStatus.FINALIZADO) {
      return {
        success: true,
        data: {
          estado: match.estado,
          resultado: {
            set1: { p1: match.set1Pareja1, p2: match.set1Pareja2 },
            set2: { p1: match.set2Pareja1, p2: match.set2Pareja2 },
            set3: match.set3Pareja1 !== null ? { p1: match.set3Pareja1, p2: match.set3Pareja2 } : null,
            formatoSet3: match.formatoSet3,
          },
          ganadorId: match.inscripcionGanadoraId,
          duracionMinutos: match.duracionMinutos,
        },
      };
    }

    // Si está en juego, devolver liveScore
    if (match.estado === MatchStatus.EN_JUEGO && match.liveScore) {
      return {
        success: true,
        data: {
          estado: match.estado,
          liveScore: match.liveScore,
          pareja1: match.inscripcion1 ? {
            id: match.inscripcion1.id,
            jugador1: match.inscripcion1.jugador1,
            jugador2: match.inscripcion1.jugador2,
          } : null,
          pareja2: match.inscripcion2 ? {
            id: match.inscripcion2.id,
            jugador1: match.inscripcion2.jugador1,
            jugador2: match.inscripcion2.jugador2,
          } : null,
          formatoSet3: match.formatoSet3,
        },
      };
    }

    // Programado - no hay marcador
    return {
      success: true,
      data: {
        estado: match.estado,
        mensaje: 'El partido aún no ha comenzado',
      },
    };
  }

  /**
   * Cambia la configuración del partido durante el juego
   * Solo permite cambiar el formato del set 3 si aún no se ha jugado
   */
  async cambiarConfiguracion(matchId: string, dto: { formatoSet3?: 'SET_COMPLETO' | 'SUPER_TIE_BREAK'; modoPunto?: 'VENTAJA' | 'PUNTO_ORO' }) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (match.estado !== MatchStatus.EN_JUEGO) {
      throw new BadRequestException('El partido no está en juego');
    }

    if (!match.liveScore) {
      throw new BadRequestException('No hay marcador iniciado');
    }

    const liveScore = match.liveScore as unknown as LiveScore;

    // Validar que no se puede cambiar el formato del set 3 si ya se está jugando el set 3
    if (dto.formatoSet3 && liveScore.setActual === 3 && liveScore.setsCompletados.length < 2) {
      throw new BadRequestException('No se puede cambiar el formato del set 3 una vez iniciado');
    }

    // Actualizar liveScore
    if (dto.modoPunto) {
      liveScore.modoPunto = dto.modoPunto;
    }
    if (dto.formatoSet3) {
      liveScore.formatoSet3 = dto.formatoSet3;
    }

    const matchActualizado = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        liveScore: liveScore as unknown as Prisma.InputJsonValue,
        formatoSet3: dto.formatoSet3 || match.formatoSet3,
      },
    });

    return {
      success: true,
      message: 'Configuración actualizada',
      data: {
        liveScore,
        formatoSet3: matchActualizado.formatoSet3,
      },
    };
  }

  /**
   * Registra un punto en el marcador en vivo
   */
  async registrarPunto(matchId: string, dto: RegistrarPuntoDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (match.estado !== MatchStatus.EN_JUEGO) {
      throw new BadRequestException('El partido no está en juego');
    }

    if (!match.liveScore) {
      throw new BadRequestException('No hay marcador iniciado para este partido');
    }

    const liveScore = match.liveScore as unknown as LiveScore;

    // Registrar el punto en el historial
    const punto: HistorialPunto = {
      id: uuidv4(),
      set: liveScore.setActual,
      game: liveScore.gameP1 + liveScore.gameP2 + 1,
      tipo: dto.tipo,
      ganador: dto.ganador,
      detalle: dto.detalle,
      timestamp: this.dateService.now().toISOString(),
      marcadorAntes: {
        gameP1: liveScore.gameP1,
        gameP2: liveScore.gameP2,
        puntoP1: liveScore.puntoP1,
        puntoP2: liveScore.puntoP2,
      },
    };

    liveScore.historial.push(punto);

    // Actualizar marcador según ganador
    const esTieBreak = this.esTieBreak(liveScore);
    const esSuperTieBreak = liveScore.setActual === 3 && match.formatoSet3 === FormatoSet3.SUPER_TIE_BREAK;
    const gameAntes = liveScore.gameP1 + liveScore.gameP2;

    if (esSuperTieBreak) {
      this.actualizarSuperTieBreak(liveScore, dto.ganador);
    } else if (esTieBreak) {
      this.actualizarTieBreak(liveScore, dto.ganador);
    } else {
      this.actualizarPuntoNormal(liveScore, dto.ganador);
    }

    // Verificar si se ganó el set o el partido
    this.verificarGanadorSet(liveScore, match.formatoSet3);

    // Actualizar el saque (cambia cada 2 puntos, o al cambiar de game cambia la pareja)
    this.actualizarSaque(liveScore, gameAntes);

    // Guardar cambios
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        liveScore: liveScore as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      message: 'Punto registrado',
      data: {
        liveScore,
        punto,
      },
    };
  }

  /**
   * Deshace el último punto (útil para correcciones)
   */
  async deshacerUltimoPunto(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.estado !== MatchStatus.EN_JUEGO || !match.liveScore) {
      throw new BadRequestException('No se puede deshacer el punto');
    }

    const liveScore = match.liveScore as unknown as LiveScore;

    if (liveScore.historial.length === 0) {
      throw new BadRequestException('No hay puntos para deshacer');
    }

    // Eliminar último punto
    const ultimoPunto = liveScore.historial.pop()!;

    // Restaurar marcador anterior
    liveScore.setActual = ultimoPunto.set;
    liveScore.gameP1 = ultimoPunto.marcadorAntes.gameP1;
    liveScore.gameP2 = ultimoPunto.marcadorAntes.gameP2;
    liveScore.puntoP1 = ultimoPunto.marcadorAntes.puntoP1;
    liveScore.puntoP2 = ultimoPunto.marcadorAntes.puntoP2;

    // Recalcular sets completados (eliminar el último si corresponde)
    if (liveScore.setsCompletados.length > 0) {
      const ultimoSet = liveScore.setsCompletados[liveScore.setsCompletados.length - 1];
      if (ultimoSet.numero >= liveScore.setActual) {
        liveScore.setsCompletados.pop();
      }
    }

    // Actualizar estado
    liveScore.estado = 'EN_JUEGO';

    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        liveScore: liveScore as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      message: 'Último punto deshecho',
      data: { liveScore },
    };
  }

  /**
   * Finaliza el partido desde el modo en vivo
   * Guarda el resultado final y avanza al ganador
   */
  async finalizarPartido(matchId: string, dto: FinalizarPartidoDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        inscripcion1: true,
        inscripcion2: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    if (match.estado !== MatchStatus.EN_JUEGO) {
      throw new BadRequestException('El partido no está en juego');
    }

    if (!match.liveScore) {
      throw new BadRequestException('No hay marcador para finalizar');
    }

    const liveScore = match.liveScore as unknown as LiveScore;

    // Verificar que haya un ganador definido
    if (liveScore.estado !== 'FINALIZADO') {
      throw new BadRequestException('El partido no tiene un ganador definido. Continúe el marcador hasta el final.');
    }

    // Determinar ganador desde los sets completados
    const setsGanadosP1 = liveScore.setsCompletados.filter(s => s.ganador === 1).length;
    const setsGanadosP2 = liveScore.setsCompletados.filter(s => s.ganador === 2).length;

    const ganadorId = setsGanadosP1 > setsGanadosP2 ? match.inscripcion1Id : match.inscripcion2Id;
    const perdedorId = setsGanadosP1 > setsGanadosP2 ? match.inscripcion2Id : match.inscripcion1Id;

    // Extraer resultados de sets
    const set1 = liveScore.setsCompletados.find(s => s.numero === 1);
    const set2 = liveScore.setsCompletados.find(s => s.numero === 2);
    const set3 = liveScore.setsCompletados.find(s => s.numero === 3);

    // Actualizar partido
    const matchActualizado = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        estado: MatchStatus.FINALIZADO,
        set1Pareja1: set1?.gamesP1 ?? 0,
        set1Pareja2: set1?.gamesP2 ?? 0,
        set2Pareja1: set2?.gamesP1 ?? 0,
        set2Pareja2: set2?.gamesP2 ?? 0,
        set3Pareja1: set3?.gamesP1 ?? null,
        set3Pareja2: set3?.gamesP2 ?? null,
        inscripcionGanadoraId: ganadorId,
        inscripcionPerdedoraId: perdedorId,
        observaciones: dto.observaciones,
        duracionMinutos: dto.duracionMinutos || this.calcularDuracion(liveScore.iniciadoAt),
        horaFinReal: this.dateService.now(),
      },
    });

    // Avanzar ganador
    await this.avanzarGanador(match, ganadorId);

    return {
      success: true,
      message: 'Partido finalizado correctamente',
      data: {
        match: matchActualizado,
        resultado: {
          sets: `${setsGanadosP1}-${setsGanadosP2}`,
          setsDetalle: liveScore.setsCompletados,
        },
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS - LÓGICA DEL JUEGO
  // ═══════════════════════════════════════════════════════════

  private validarResultado(dto: RegistrarResultadoDto) {
    // Validar sets 1 y 2 (deben tener ganador)
    const sets = [
      { p1: dto.set1Pareja1, p2: dto.set1Pareja2 },
      { p1: dto.set2Pareja1, p2: dto.set2Pareja2 },
    ];

    for (const set of sets) {
      if (set.p1 === set.p2) {
        throw new BadRequestException('Los sets 1 y 2 no pueden quedar empatados');
      }
      if (!this.esSetValido(set.p1, set.p2)) {
        throw new BadRequestException(`Set inválido: ${set.p1}-${set.p2}. Debe llegar a 6 con diferencia de 2, o 7-5/7-6.`);
      }
    }

    // Validar set 3 si existe
    if (dto.set3Pareja1 !== undefined && dto.set3Pareja2 !== undefined) {
      if (dto.formatoSet3 === FormatoSet3.SUPER_TIE_BREAK) {
        // Súper tie-break: primeros a 10 puntos con diferencia de 2
        if (dto.set3Pareja1 === dto.set3Pareja2) {
          throw new BadRequestException('El súper tie-break no puede quedar empatado');
        }
        if (Math.max(dto.set3Pareja1, dto.set3Pareja2) < 10) {
          throw new BadRequestException('El súper tie-break debe llegar al menos a 10 puntos');
        }
        if (Math.abs(dto.set3Pareja1 - dto.set3Pareja2) < 2) {
          throw new BadRequestException('El súper tie-break debe ganarse por diferencia de 2 puntos');
        }
      } else {
        // Set completo
        if (dto.set3Pareja1 === dto.set3Pareja2) {
          throw new BadRequestException('El set 3 no puede quedar empatado');
        }
        if (!this.esSetValido(dto.set3Pareja1, dto.set3Pareja2)) {
          throw new BadRequestException('El set 3 no tiene un resultado válido');
        }
      }
    }
  }

  private esSetValido(g1: number, g2: number): boolean {
    // Set válido: 6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6 (o viceversa)
    if (g1 === 6 && g2 <= 4) return true;
    if (g2 === 6 && g1 <= 4) return true;
    if ((g1 === 7 && (g2 === 5 || g2 === 6))) return true;
    if ((g2 === 7 && (g1 === 5 || g1 === 6))) return true;
    return false;
  }

  private calcularGanador(match: any, dto: RegistrarResultadoDto) {
    const setsGanadosP1 = 
      (dto.set1Pareja1 > dto.set1Pareja2 ? 1 : 0) +
      (dto.set2Pareja1 > dto.set2Pareja2 ? 1 : 0) +
      ((dto.set3Pareja1 && dto.set3Pareja2 && dto.set3Pareja1 > dto.set3Pareja2) ? 1 : 0);

    const setsGanadosP2 = 
      (dto.set1Pareja1 < dto.set1Pareja2 ? 1 : 0) +
      (dto.set2Pareja1 < dto.set2Pareja2 ? 1 : 0) +
      ((dto.set3Pareja1 && dto.set3Pareja2 && dto.set3Pareja1 < dto.set3Pareja2) ? 1 : 0);

    if (setsGanadosP1 === setsGanadosP2) {
      throw new BadRequestException('El partido no puede terminar empatado');
    }

    const ganadorId = setsGanadosP1 > setsGanadosP2 ? match.inscripcion1Id : match.inscripcion2Id;
    const perdedorId = setsGanadosP1 > setsGanadosP2 ? match.inscripcion2Id : match.inscripcion1Id;

    return { ganadorId, perdedorId, setsGanadosP1, setsGanadosP2 };
  }

  private async avanzarGanador(match: any, ganadorId: string) {
    // Si hay partido siguiente para el ganador
    if (match.partidoSiguienteId) {
      const posicion = match.posicionEnSiguiente || 1;
      
      await this.prisma.match.update({
        where: { id: match.partidoSiguienteId },
        data: posicion === 1 
          ? { inscripcion1Id: ganadorId, tipoEntrada1: 'GANADOR_PARTIDO' }
          : { inscripcion2Id: ganadorId, tipoEntrada2: 'GANADOR_PARTIDO' },
      });
    }

    // Si hay partido de perdedores (repechaje)
    if (match.partidoPerdedorSiguienteId) {
      const perdedorId = match.inscripcion1Id === ganadorId ? match.inscripcion2Id : match.inscripcion1Id;
      const posicion = match.posicionEnPerdedor || 1;

      await this.prisma.match.update({
        where: { id: match.partidoPerdedorSiguienteId },
        data: posicion === 1
          ? { inscripcion1Id: perdedorId, tipoEntrada1: 'PERDEDOR_PARTIDO' }
          : { inscripcion2Id: perdedorId, tipoEntrada2: 'PERDEDOR_PARTIDO' },
      });
    }
  }

  private formatearScore(dto: RegistrarResultadoDto): string {
    let score = `${dto.set1Pareja1}-${dto.set1Pareja2}, ${dto.set2Pareja1}-${dto.set2Pareja2}`;
    if (dto.set3Pareja1 !== undefined && dto.set3Pareja2 !== undefined) {
      score += `, ${dto.set3Pareja1}-${dto.set3Pareja2}`;
    }
    return score;
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS - LÓGICA EN VIVO
  // ═══════════════════════════════════════════════════════════

  private esTieBreak(liveScore: LiveScore): boolean {
    return liveScore.gameP1 === 6 && liveScore.gameP2 === 6;
  }

  private actualizarPuntoNormal(liveScore: LiveScore, ganador: number) {
    const idxP1 = VALORES_PUNTOS.indexOf(liveScore.puntoP1 as typeof VALORES_PUNTOS[number]);
    const idxP2 = VALORES_PUNTOS.indexOf(liveScore.puntoP2 as typeof VALORES_PUNTOS[number]);
    const esPuntoOro = liveScore.modoPunto === 'PUNTO_ORO';

    if (ganador === 1) {
      if (liveScore.puntoP1 === 40 && liveScore.puntoP2 !== 40 && liveScore.puntoP2 !== 'AD') {
        // Game para P1
        liveScore.gameP1++;
        liveScore.puntoP1 = 0;
        liveScore.puntoP2 = 0;
        // NOTA: El cambio de saque lo maneja actualizarSaque()
      } else if (liveScore.puntoP2 === 'AD') {
        // Deuce - volvemos a 40-40
        liveScore.puntoP1 = 40;
        liveScore.puntoP2 = 40;
      } else if (liveScore.puntoP1 === 40 && liveScore.puntoP2 === 40 && esPuntoOro) {
        // PUNTO DE ORO: a 40-40, el siguiente punto gana el game
        liveScore.gameP1++;
        liveScore.puntoP1 = 0;
        liveScore.puntoP2 = 0;
        // NOTA: El cambio de saque lo maneja actualizarSaque()
      } else {
        liveScore.puntoP1 = VALORES_PUNTOS[idxP1 + 1];
      }
    } else {
      if (liveScore.puntoP2 === 40 && liveScore.puntoP1 !== 40 && liveScore.puntoP1 !== 'AD') {
        // Game para P2
        liveScore.gameP2++;
        liveScore.puntoP1 = 0;
        liveScore.puntoP2 = 0;
        // NOTA: El cambio de saque lo maneja actualizarSaque()
      } else if (liveScore.puntoP1 === 'AD') {
        // Deuce - volvemos a 40-40
        liveScore.puntoP1 = 40;
        liveScore.puntoP2 = 40;
      } else if (liveScore.puntoP1 === 40 && liveScore.puntoP2 === 40 && esPuntoOro) {
        // PUNTO DE ORO: a 40-40, el siguiente punto gana el game
        liveScore.gameP2++;
        liveScore.puntoP1 = 0;
        liveScore.puntoP2 = 0;
        // NOTA: El cambio de saque lo maneja actualizarSaque()
      } else {
        liveScore.puntoP2 = VALORES_PUNTOS[idxP2 + 1];
      }
    }
  }

  private actualizarTieBreak(liveScore: LiveScore, ganador: number) {
    liveScore.estado = 'TIE_BREAK';

    if (ganador === 1) {
      liveScore.puntoP1 = (liveScore.puntoP1 as number) + 1;
    } else {
      liveScore.puntoP2 = (liveScore.puntoP2 as number) + 1;
    }

    const p1 = liveScore.puntoP1 as number;
    const p2 = liveScore.puntoP2 as number;

    // Verificar si se ganó el tie-break
    if (p1 >= PUNTOS_TIE_BREAK && p1 - p2 >= 2) {
      liveScore.gameP1 = 7;
      liveScore.puntoP1 = 0;
      liveScore.puntoP2 = 0;
    } else if (p2 >= PUNTOS_TIE_BREAK && p2 - p1 >= 2) {
      liveScore.gameP2 = 7;
      liveScore.puntoP1 = 0;
      liveScore.puntoP2 = 0;
    }

    // Cambio de saque cada 2 puntos en tie-break, y también cambia el jugador
    const totalPuntos = p1 + p2;
    if (totalPuntos % 2 === 0 && totalPuntos > 0) {
      // Cambiar de jugador dentro de la misma pareja
      if (liveScore.saque === 1) {
        liveScore.jugadorSacaP1 = liveScore.jugadorSacaP1 === 1 ? 2 : 1;
      } else {
        liveScore.jugadorSacaP2 = liveScore.jugadorSacaP2 === 1 ? 2 : 1;
      }
    }
    liveScore.saque = (Math.floor(totalPuntos / 2) % 2 === 0) ? 1 : 2;
  }

  private actualizarSuperTieBreak(liveScore: LiveScore, ganador: number) {
    liveScore.estado = 'SUPER_TIE_BREAK';

    if (ganador === 1) {
      liveScore.puntoP1 = (liveScore.puntoP1 as number) + 1;
    } else {
      liveScore.puntoP2 = (liveScore.puntoP2 as number) + 1;
    }

    const p1 = liveScore.puntoP1 as number;
    const p2 = liveScore.puntoP2 as number;

    // Verificar si se ganó el súper tie-break (10 puntos con diferencia de 2)
    if (p1 >= PUNTOS_SUPER_TIE_BREAK && p1 - p2 >= 2) {
      liveScore.gameP1 = 1; // En súper tie-break se cuenta como 1 game
      liveScore.puntoP1 = p1;
      liveScore.puntoP2 = p2;
    } else if (p2 >= PUNTOS_SUPER_TIE_BREAK && p2 - p1 >= 2) {
      liveScore.gameP2 = 1;
      liveScore.puntoP1 = p1;
      liveScore.puntoP2 = p2;
    }

    // En súper tie-break el saque cambia cada 2 puntos
    const totalPuntos = p1 + p2;
    if (totalPuntos % 2 === 0 && totalPuntos > 0) {
      // Cambiar de jugador dentro de la misma pareja
      if (liveScore.saque === 1) {
        liveScore.jugadorSacaP1 = liveScore.jugadorSacaP1 === 1 ? 2 : 1;
      } else {
        liveScore.jugadorSacaP2 = liveScore.jugadorSacaP2 === 1 ? 2 : 1;
      }
    }
    // Cambiar de pareja cada 2 puntos también
    liveScore.saque = (Math.floor(totalPuntos / 2) % 2 === 0) ? 1 : 2;
  }

  /**
   * Actualiza el saque según las reglas del pádel:
   * - El mismo jugador saca durante 2 puntos consecutivos
   * REGLAMENTO OFICIAL FIP:
   * - El mismo jugador saca durante TODO el game
   * - Al cambiar de game: cambia la pareja que saca
   * - Al cambiar de game: alterna el jugador dentro de la pareja
   * Ejemplo: P1-J1, P2-J1, P1-J2, P2-J2, P1-J1...
   */
  private actualizarSaque(liveScore: LiveScore, gameAntes: number) {
    const gameDespues = liveScore.gameP1 + liveScore.gameP2;
    
    // Solo cambia al finalizar un game
    if (gameDespues > gameAntes) {
      // Cambia la pareja que saca
      const nuevaPareja = liveScore.saque === 1 ? 2 : 1;
      liveScore.saque = nuevaPareja;
      
      // Alterna el jugador dentro de la pareja que ahora saca
      if (nuevaPareja === 1) {
        liveScore.jugadorSacaP1 = liveScore.jugadorSacaP1 === 1 ? 2 : 1;
      } else {
        liveScore.jugadorSacaP2 = liveScore.jugadorSacaP2 === 1 ? 2 : 1;
      }
    }
    // Durante el game, el mismo jugador sigue sacando (no se cambia nada)
  }

  private verificarGanadorSet(liveScore: LiveScore, formatoSet3?: FormatoSet3) {
    const gamesParaSet = GAMES_PARA_SET;
    
    // Verificar si se ganó el set actual
    const g1 = liveScore.gameP1;
    const g2 = liveScore.gameP2;

    let setGanado = false;
    let ganadorSet = 0;

    if (g1 >= gamesParaSet && g1 - g2 >= 2) {
      setGanado = true;
      ganadorSet = 1;
    } else if (g2 >= gamesParaSet && g2 - g1 >= 2) {
      setGanado = true;
      ganadorSet = 2;
    } else if (g1 === 7 || g2 === 7) {
      // Tie-break (7-6)
      setGanado = true;
      ganadorSet = g1 === 7 ? 1 : 2;
    }

    // En súper tie-break (set 3), es diferente
    if (liveScore.setActual === 3 && formatoSet3 === FormatoSet3.SUPER_TIE_BREAK) {
      const p1 = liveScore.puntoP1 as number;
      const p2 = liveScore.puntoP2 as number;
      
      if (p1 >= PUNTOS_SUPER_TIE_BREAK && p1 - p2 >= 2) {
        setGanado = true;
        ganadorSet = 1;
      } else if (p2 >= PUNTOS_SUPER_TIE_BREAK && p2 - p1 >= 2) {
        setGanado = true;
        ganadorSet = 2;
      }
    }

    if (setGanado) {
      // Guardar set completado
      const setCompletado: SetCompletado = {
        numero: liveScore.setActual,
        gamesP1: g1,
        gamesP2: g2,
        tieBreakP1: (liveScore.puntoP1 as number) > 0 && liveScore.estado === 'TIE_BREAK' ? (liveScore.puntoP1 as number) : undefined,
        tieBreakP2: (liveScore.puntoP2 as number) > 0 && liveScore.estado === 'TIE_BREAK' ? (liveScore.puntoP2 as number) : undefined,
        ganador: ganadorSet,
      };
      liveScore.setsCompletados.push(setCompletado);

      // Verificar si se ganó el partido
      const setsGanadosP1 = liveScore.setsCompletados.filter(s => s.ganador === 1).length;
      const setsGanadosP2 = liveScore.setsCompletados.filter(s => s.ganador === 2).length;

      if (setsGanadosP1 === 2 || setsGanadosP2 === 2) {
        liveScore.estado = 'FINALIZADO';
      } else {
        // Pasar al siguiente set
        liveScore.setActual++;
        liveScore.gameP1 = 0;
        liveScore.gameP2 = 0;
        liveScore.puntoP1 = 0;
        liveScore.puntoP2 = 0;
        liveScore.estado = 'EN_JUEGO';
      }
    } else {
      // Verificar situaciones especiales
      const totalGames = g1 + g2;
      if ((g1 === gamesParaSet && g2 === gamesParaSet) || liveScore.estado === 'TIE_BREAK') {
        liveScore.estado = 'TIE_BREAK';
      } else if ((g1 > gamesParaSet || g2 > gamesParaSet) && Math.abs(g1 - g2) === 1) {
        liveScore.estado = g1 > g2 ? 'SET_POINT' : 'MATCH_POINT';
      }
    }
  }

  private calcularDuracion(iniciadoAt: string): number {
    const inicio = new Date(iniciadoAt);
    const fin = this.dateService.now();
    return Math.floor((fin.getTime() - inicio.getTime()) / 60000); // minutos
  }
}
