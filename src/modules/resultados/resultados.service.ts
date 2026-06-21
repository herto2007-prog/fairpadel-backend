import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DateService } from '../../common/services/date.service';
import { ProgramacionService } from '../programacion/programacion.service';
import { ClasificacionService } from '../bracket/clasificacion.service';
import { PushService } from '../push/push.service';
import { FormatoSet3, MatchStatus, Prisma } from '@prisma/client';
import { RegistrarResultadoDto, RegistrarPuntoDto, IniciarPartidoDto, FinalizarPartidoDto } from './dto/registrar-resultado.dto';
import { ResultadoEspecialDto, TipoResultadoEspecial } from './dto/resultado-especial.dto';
import { LiveScore, HistorialPunto } from './entities/live-score.entity';
import { v4 as uuidv4 } from 'uuid';
import {
  validarResultado,
  esSetValido,
  calcularGanador,
  formatearScore,
  esTieBreak,
  actualizarPuntoNormal,
  actualizarTieBreak,
  actualizarSuperTieBreak,
  actualizarSaque,
  verificarGanadorSet,
} from './padel-scoring';

@Injectable()
export class ResultadosService {
  constructor(
    private prisma: PrismaService,
    private dateService: DateService,
    private programacionService: ProgramacionService,
    private clasificacionService: ClasificacionService,
    private pushService: PushService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // VALIDACIONES PRIVADAS
  // ═══════════════════════════════════════════════════════════

  /**
   * [MVP] Validación simplificada - permite cargar resultados sin programación previa
   * En el flujo MVP, los partidos se juegan y luego se cargan resultados directamente
   */
  private validarPartidoProgramado(match: any): void {
    // MVP: No requerir programación previa para cargar resultados
    // El partido solo necesita tener ambas parejas asignadas (validado en el método principal)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = match; // Evitar warning de parámetro no usado
    return; // Siempre permitir para MVP
  }

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

    // Cargar datos completos del match para avance (incluye IDs de navegación)
    const matchCompleto = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        categoryId: true,
        partidoSiguienteId: true,
        partidoPerdedorSiguienteId: true,
        posicionEnSiguiente: true,
        posicionEnPerdedor: true,
        inscripcion1Id: true,
        inscripcion2Id: true,
        esBye: true,
        ronda: true,
      },
    });

    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }

    // Validar que haya inscripciones en ambas posiciones (a menos que sea BYE)
    if (!match.esBye && (!match.inscripcion1Id || !match.inscripcion2Id)) {
      throw new BadRequestException('El partido no tiene ambas parejas asignadas');
    }

    // Si el partido YA tiene un resultado, aplicar la misma protección que la
    // edición: no permitir re-registrar si un partido posterior ya se definió
    // (evita corromper un bracket que ya avanzó).
    const estadosConResultado: MatchStatus[] = [
      MatchStatus.FINALIZADO,
      MatchStatus.WO,
      MatchStatus.RETIRADO,
      MatchStatus.DESCALIFICADO,
    ];
    if (estadosConResultado.includes(match.estado)) {
      await this.validarPuedeEditar(matchId);
    }

    // Validar que el partido esté programado
    this.validarPartidoProgramado(match);

    // Validar resultado lógico
    validarResultado(dto);

    // Determinar ganador
    const { ganadorId, perdedorId, setsGanadosP1, setsGanadosP2 } = calcularGanador(match, dto);

    this.validarGanadorDeterminado(ganadorId, perdedorId);

    // Actualizar partido y avanzar al ganador de forma atómica (transacción).
    // matchCompleto tiene los IDs de navegación del bracket cargados.
    const matchActualizado = await this.finalizarYAvanzar(
      matchId,
      {
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
      matchCompleto,
      ganadorId,
    );

    return {
      success: true,
      message: 'Resultado registrado correctamente',
      data: {
        match: matchActualizado,
        resultado: {
          sets: `${setsGanadosP1}-${setsGanadosP2}`,
          ganadorId,
          score: formatearScore(dto),
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

    // Cargar datos completos del match para avance
    const matchCompleto = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        categoryId: true,
        partidoSiguienteId: true,
        partidoPerdedorSiguienteId: true,
        posicionEnSiguiente: true,
        posicionEnPerdedor: true,
        inscripcion1Id: true,
        inscripcion2Id: true,
        esBye: true,
        ronda: true,
      },
    });

    // Validar que haya inscripciones
    if (!match.esBye && (!match.inscripcion1Id || !match.inscripcion2Id)) {
      throw new BadRequestException('El partido no tiene ambas parejas asignadas');
    }

    // Si el partido YA tiene un resultado, aplicar la misma protección que la
    // edición: no permitir re-registrar si un partido posterior ya se definió.
    const estadosConResultado: MatchStatus[] = [
      MatchStatus.FINALIZADO,
      MatchStatus.WO,
      MatchStatus.RETIRADO,
      MatchStatus.DESCALIFICADO,
    ];
    if (estadosConResultado.includes(match.estado)) {
      await this.validarPuedeEditar(matchId);
    }

    // Validar que el partido esté programado
    this.validarPartidoProgramado(match);

    // Determinar ganador (la pareja que NO es la afectada)
    const ganadorId = dto.parejaAfectada === 1 
      ? match.inscripcion2Id 
      : match.inscripcion1Id;
    const perdedorId = dto.parejaAfectada === 1
      ? match.inscripcion1Id
      : match.inscripcion2Id;

    this.validarGanadorDeterminado(ganadorId, perdedorId);

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

    // Actualizar partido y avanzar al ganador de forma atómica (transacción)
    const matchActualizado = await this.finalizarYAvanzar(
      matchId,
      {
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
      matchCompleto,
      ganadorId,
    );

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
  // MÉTODOS PÚBLICOS - EDICIÓN DE RESULTADOS
  // ═══════════════════════════════════════════════════════════

  /**
   * Edita un resultado completo ya registrado
   * Solo permite editar si los partidos siguientes no tienen resultado
   */
  async editarResultado(matchId: string, dto: RegistrarResultadoDto) {
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

    const estadosEditables: MatchStatus[] = [MatchStatus.FINALIZADO, MatchStatus.WO, MatchStatus.RETIRADO, MatchStatus.DESCALIFICADO];
    if (!estadosEditables.includes(match.estado)) {
      throw new BadRequestException('El partido no tiene un resultado registrado para editar');
    }

    await this.validarPuedeEditar(matchId);
    validarResultado(dto);

    const { ganadorId, perdedorId, setsGanadosP1, setsGanadosP2 } = calcularGanador(match, dto);

    this.validarGanadorDeterminado(ganadorId, perdedorId);

    const matchCompleto = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        categoryId: true,
        partidoSiguienteId: true,
        partidoPerdedorSiguienteId: true,
        posicionEnSiguiente: true,
        posicionEnPerdedor: true,
        inscripcion1Id: true,
        inscripcion2Id: true,
        esBye: true,
        ronda: true,
      },
    });

    const matchActualizado = await this.finalizarYAvanzar(
      matchId,
      {
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
        parejaRetirada: null,
        razonResultado: null,
      },
      matchCompleto,
      ganadorId,
    );

    return {
      success: true,
      message: 'Resultado actualizado correctamente',
      data: {
        match: matchActualizado,
        resultado: {
          sets: `${setsGanadosP1}-${setsGanadosP2}`,
          ganadorId,
          score: formatearScore(dto),
        },
      },
    };
  }

  /**
   * Edita un resultado especial ya registrado
   * Solo permite editar si los partidos siguientes no tienen resultado
   */
  async editarResultadoEspecial(matchId: string, dto: ResultadoEspecialDto) {
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

    const estadosEditables: MatchStatus[] = [MatchStatus.FINALIZADO, MatchStatus.WO, MatchStatus.RETIRADO, MatchStatus.DESCALIFICADO];
    if (!estadosEditables.includes(match.estado)) {
      throw new BadRequestException('El partido no tiene un resultado registrado para editar');
    }

    await this.validarPuedeEditar(matchId);

    const ganadorId = dto.parejaAfectada === 1 ? match.inscripcion2Id : match.inscripcion1Id;
    const perdedorId = dto.parejaAfectada === 1 ? match.inscripcion1Id : match.inscripcion2Id;

    this.validarGanadorDeterminado(ganadorId, perdedorId);

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

    const matchCompleto = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        categoryId: true,
        partidoSiguienteId: true,
        partidoPerdedorSiguienteId: true,
        posicionEnSiguiente: true,
        posicionEnPerdedor: true,
        inscripcion1Id: true,
        inscripcion2Id: true,
        esBye: true,
        ronda: true,
      },
    });

    const matchActualizado = await this.finalizarYAvanzar(
      matchId,
      {
        estado,
        inscripcionGanadoraId: ganadorId,
        inscripcionPerdedoraId: perdedorId,
        parejaRetirada: dto.parejaAfectada,
        razonResultado: dto.razon || dto.tipo,
        observaciones: dto.observaciones,
        duracionMinutos: dto.duracionMinutos,
        set1Pareja1: null,
        set1Pareja2: null,
        set2Pareja1: null,
        set2Pareja2: null,
        set3Pareja1: null,
        set3Pareja2: null,
      },
      matchCompleto,
      ganadorId,
    );

    const mensajes = {
      [TipoResultadoEspecial.RETIRO_LESION]: 'Retiro por lesión actualizado',
      [TipoResultadoEspecial.RETIRO_OTRO]: 'Retiro actualizado',
      [TipoResultadoEspecial.DESCALIFICACION]: 'Descalificación actualizada',
      [TipoResultadoEspecial.WO]: 'WO actualizado',
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

  /**
   * Valida que un partido pueda ser editado verificando que
   * los partidos siguientes no tengan resultado cargado
   */
  private validarGanadorDeterminado(
    ganadorId: string | null | undefined,
    perdedorId: string | null | undefined,
  ) {
    if (!ganadorId || !perdedorId) {
      throw new BadRequestException(
        'No se pudo determinar el ganador o perdedor del partido. Verifica que ambas parejas estén asignadas.',
      );
    }
  }

  private async validarPuedeEditar(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        partidoSiguienteId: true,
        partidoPerdedorSiguienteId: true,
      },
    });

    if (!match) return;

    const idsSiguientes = [
      match.partidoSiguienteId,
      match.partidoPerdedorSiguienteId,
    ].filter((id): id is string => !!id);

    if (idsSiguientes.length === 0) return;

    const partidosSiguientes = await this.prisma.match.findMany({
      where: {
        id: { in: idsSiguientes },
        inscripcionGanadoraId: { not: null },
      },
      select: { id: true },
    });

    if (partidosSiguientes.length > 0) {
      throw new BadRequestException(
        'No se puede editar el resultado porque ya hay partidos posteriores definidos. Si necesitas corregirlo, contacta al administrador.',
      );
    }
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

    // Validar que el partido esté programado antes de iniciar
    this.validarPartidoProgramado(match);

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
    const enTieBreak = esTieBreak(liveScore);
    const esSuperTieBreak = liveScore.setActual === 3 && match.formatoSet3 === FormatoSet3.SUPER_TIE_BREAK;
    const gameAntes = liveScore.gameP1 + liveScore.gameP2;

    if (esSuperTieBreak) {
      actualizarSuperTieBreak(liveScore, dto.ganador);
    } else if (enTieBreak) {
      actualizarTieBreak(liveScore, dto.ganador);
    } else {
      actualizarPuntoNormal(liveScore, dto.ganador);
    }

    // Verificar si se ganó el set o el partido
    verificarGanadorSet(liveScore, match.formatoSet3);

    // Actualizar el saque (cambia cada 2 puntos, o al cambiar de game cambia la pareja)
    actualizarSaque(liveScore, gameAntes);

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

    // Cargar datos completos para avance
    const matchCompleto = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        tournamentId: true,
        categoryId: true,
        partidoSiguienteId: true,
        partidoPerdedorSiguienteId: true,
        posicionEnSiguiente: true,
        posicionEnPerdedor: true,
        inscripcion1Id: true,
        inscripcion2Id: true,
        esBye: true,
        ronda: true,
      },
    });

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

    console.log('[finalizarPartido] Sets extraídos:', {
      set1: set1 ? [set1.gamesP1, set1.gamesP2] : null,
      set2: set2 ? [set2.gamesP1, set2.gamesP2] : null,
      set3: set3 ? [set3.gamesP1, set3.gamesP2] : null,
      ganadorId,
    });

    this.validarGanadorDeterminado(ganadorId, perdedorId);

    // Actualizar partido y avanzar al ganador de forma atómica (transacción)
    const matchActualizado = await this.finalizarYAvanzar(
      matchId,
      {
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
      matchCompleto,
      ganadorId,
    );

    console.log('[finalizarPartido] Partido actualizado:', {
      id: matchActualizado.id,
      set1: [matchActualizado.set1Pareja1, matchActualizado.set1Pareja2],
      set2: [matchActualizado.set2Pareja1, matchActualizado.set2Pareja2],
      set3: [matchActualizado.set3Pareja1, matchActualizado.set3Pareja2],
      estado: matchActualizado.estado,
    });

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

  /**
   * Marca el partido como finalizado y avanza al ganador (y perdedor) de forma
   * ATÓMICA: el update del partido y la escritura de los casilleros del bracket
   * ocurren en una sola transacción. Si algo falla, no queda el partido
   * finalizado sin el ganador avanzado (se revierte todo).
   *
   * Los efectos secundarios best-effort (programación automática y recálculo de
   * clasificación) se ejecutan DESPUÉS del commit: nunca deben revertir el
   * resultado ni bloquear el flujo (ya tragan sus propios errores), y mantienen
   * la transacción corta.
   */
  private async finalizarYAvanzar(
    matchId: string,
    data: Prisma.MatchUncheckedUpdateInput,
    matchCompleto: any,
    ganadorId: string,
  ) {
    const matchActualizado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.match.update({
        where: { id: matchId },
        data,
        include: {
          inscripcion1: true,
          inscripcion2: true,
          inscripcionGanadora: true,
          tournament: { select: { nombre: true } },
        },
      });

      if (matchCompleto) {
        await this.avanzarGanadorEnTx(tx, matchCompleto, ganadorId);
      }

      return actualizado;
    });

    if (matchCompleto) {
      await this.ejecutarEfectosPostAvance(matchCompleto);
    }

    // Avisar al ganador (in-app + push). Best-effort: no rompe la carga del resultado.
    try {
      const g = matchActualizado.inscripcionGanadora;
      const torneoNombre = (matchActualizado as any).tournament?.nombre || 'el torneo';
      if (g) {
        for (const uid of [g.jugador1Id, g.jugador2Id]) {
          if (uid) {
            await this.pushService.notificar(uid, {
              tipo: 'PARTIDO',
              titulo: '¡Ganaste tu partido! 🎾',
              contenido: `Avanzás en ${torneoNombre}. ¡Seguí así!`,
              enlace: '/mijuego',
            });
          }
        }
      }
    } catch {
      // ignorar: el aviso no es crítico
    }

    return matchActualizado;
  }

  /**
   * Escribe los casilleros del bracket dentro de la transacción recibida:
   * el ganador al partido siguiente y el perdedor al repechaje / bracket por
   * suerte. Solo escrituras críticas; nada best-effort acá.
   */
  private async avanzarGanadorEnTx(
    tx: Prisma.TransactionClient,
    match: any,
    ganadorId: string,
  ) {
    if (match.partidoSiguienteId) {
      const posicion = match.posicionEnSiguiente || 1;
      await tx.match.update({
        where: { id: match.partidoSiguienteId },
        data: posicion === 1
          ? { inscripcion1Id: ganadorId, tipoEntrada1: 'GANADOR_PARTIDO' }
          : { inscripcion2Id: ganadorId, tipoEntrada2: 'GANADOR_PARTIDO' },
      });
    }

    if (match.partidoPerdedorSiguienteId) {
      const perdedorId = match.inscripcion1Id === ganadorId ? match.inscripcion2Id : match.inscripcion1Id;
      const posicion = match.posicionEnPerdedor || 1;

      // Si el destino es REPECHAJE es un perdedor normal; si no, perdedor por suerte
      const partidoDestino = await tx.match.findUnique({
        where: { id: match.partidoPerdedorSiguienteId },
        select: { ronda: true },
      });
      const esRepechaje = partidoDestino?.ronda === 'REPECHAJE';

      await tx.match.update({
        where: { id: match.partidoPerdedorSiguienteId },
        data: posicion === 1
          ? { inscripcion1Id: perdedorId, tipoEntrada1: esRepechaje ? 'PERDEDOR_PARTIDO' : 'PERDEDOR_ZONA_SUERTE' }
          : { inscripcion2Id: perdedorId, tipoEntrada2: esRepechaje ? 'PERDEDOR_PARTIDO' : 'PERDEDOR_ZONA_SUERTE' },
      });
    }
  }

  /**
   * Efectos secundarios best-effort tras avanzar, FUERA de la transacción:
   * programación automática de los partidos que quedaron completos y recálculo
   * de clasificación. Nunca interrumpen ni revierten el resultado.
   */
  private async ejecutarEfectosPostAvance(match: any) {
    if (match.partidoSiguienteId) {
      await this.programarPartidoSiCompleto(match.partidoSiguienteId, match.tournamentId);
    }
    if (match.partidoPerdedorSiguienteId) {
      await this.programarPartidoSiCompleto(match.partidoPerdedorSiguienteId, match.tournamentId);
    }
    await this.recalcularClasificacion(match.tournamentId, match.categoryId);
  }

  /**
   * Recalcula los estados de clasificación de todas las inscripciones
   */
  private async recalcularClasificacion(tournamentId: string, categoryId: string): Promise<void> {
    try {
      await this.clasificacionService.recalcularEstados(tournamentId, categoryId);
    } catch (error) {
      // No lanzar error para no interrumpir el flujo principal
      console.error(`[recalcularClasificacion] Error:`, error);
    }
  }

  /**
   * Verifica si un partido tiene ambas parejas definidas y lo programa automáticamente
   */
  private async programarPartidoSiCompleto(matchId: string, tournamentId: string): Promise<void> {
    try {
      const resultado = await this.programacionService.programarPartidoAutomatico(tournamentId, matchId);
      
      if (resultado.success) {
        console.log(`[avanzarGanador] Partido ${matchId} programado automáticamente:`, {
          fecha: resultado.asignacion?.fecha,
          hora: resultado.asignacion?.horaInicio,
          cancha: resultado.asignacion?.canchaNombre,
        });
      } else {
        console.log(`[avanzarGanador] No se pudo programar partido ${matchId}:`, resultado.message);
      }
    } catch (error) {
      // No lanzar error para no interrumpir el flujo principal
      console.error(`[avanzarGanador] Error programando partido ${matchId}:`, error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MÉTODOS PRIVADOS - LÓGICA EN VIVO
  // ═══════════════════════════════════════════════════════════

  private calcularDuracion(iniciadoAt: string): number {
    const inicio = new Date(iniciadoAt);
    const fin = this.dateService.now();
    return Math.floor((fin.getTime() - inicio.getTime()) / 60000); // minutos
  }
}
