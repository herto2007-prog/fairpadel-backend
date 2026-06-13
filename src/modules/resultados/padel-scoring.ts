import { BadRequestException } from '@nestjs/common';
import { FormatoSet3 } from '@prisma/client';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import {
  LiveScore,
  SetCompletado,
  VALORES_PUNTOS,
  GAMES_PARA_SET,
  PUNTOS_TIE_BREAK,
  PUNTOS_SUPER_TIE_BREAK,
} from './entities/live-score.entity';

// Lógica PURA de puntuación de pádel, extraída verbatim de resultados.service.
// Sin dependencias inyectadas ni acceso a BD: valida/cuenta sets, calcula
// ganador, y avanza el marcador en vivo (puntos, tie-break, súper tie-break,
// saque, cierre de set). El servicio orquesta BD y delega aquí el cálculo.

export function esSetValido(g1: number, g2: number): boolean {
    // Set válido: 6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6 (o viceversa)
    if (g1 === 6 && g2 <= 4) return true;
    if (g2 === 6 && g1 <= 4) return true;
    if ((g1 === 7 && (g2 === 5 || g2 === 6))) return true;
    if ((g2 === 7 && (g1 === 5 || g1 === 6))) return true;
    return false;
  }

export function validarResultado(dto: RegistrarResultadoDto) {
    // Validar sets 1 y 2 (deben tener ganador)
    const sets = [
      { p1: dto.set1Pareja1, p2: dto.set1Pareja2 },
      { p1: dto.set2Pareja1, p2: dto.set2Pareja2 },
    ];

    for (const set of sets) {
      if (set.p1 === set.p2) {
        throw new BadRequestException('Los sets 1 y 2 no pueden quedar empatados');
      }
      if (!esSetValido(set.p1, set.p2)) {
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
        if (!esSetValido(dto.set3Pareja1, dto.set3Pareja2)) {
          throw new BadRequestException('El set 3 no tiene un resultado válido');
        }
      }
    }
  }

export function calcularGanador(match: any, dto: RegistrarResultadoDto) {
    const setsGanadosP1 = 
      (dto.set1Pareja1 > dto.set1Pareja2 ? 1 : 0) +
      (dto.set2Pareja1 > dto.set2Pareja2 ? 1 : 0) +
      ((dto.set3Pareja1 !== undefined && dto.set3Pareja2 !== undefined && dto.set3Pareja1 > dto.set3Pareja2) ? 1 : 0);

    const setsGanadosP2 = 
      (dto.set1Pareja1 < dto.set1Pareja2 ? 1 : 0) +
      (dto.set2Pareja1 < dto.set2Pareja2 ? 1 : 0) +
      ((dto.set3Pareja1 !== undefined && dto.set3Pareja2 !== undefined && dto.set3Pareja1 < dto.set3Pareja2) ? 1 : 0);

    if (setsGanadosP1 === setsGanadosP2) {
      throw new BadRequestException('El partido no puede terminar empatado');
    }

    const ganadorId = setsGanadosP1 > setsGanadosP2 ? match.inscripcion1Id : match.inscripcion2Id;
    const perdedorId = setsGanadosP1 > setsGanadosP2 ? match.inscripcion2Id : match.inscripcion1Id;

    return { ganadorId, perdedorId, setsGanadosP1, setsGanadosP2 };
  }

export function formatearScore(dto: RegistrarResultadoDto): string {
    let score = `${dto.set1Pareja1}-${dto.set1Pareja2}, ${dto.set2Pareja1}-${dto.set2Pareja2}`;
    if (dto.set3Pareja1 !== undefined && dto.set3Pareja2 !== undefined) {
      score += `, ${dto.set3Pareja1}-${dto.set3Pareja2}`;
    }
    return score;
  }

export function esTieBreak(liveScore: LiveScore): boolean {
    return liveScore.gameP1 === 6 && liveScore.gameP2 === 6;
  }

export function actualizarPuntoNormal(liveScore: LiveScore, ganador: number) {
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

export function actualizarTieBreak(liveScore: LiveScore, ganador: number) {
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

export function actualizarSuperTieBreak(liveScore: LiveScore, ganador: number) {
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

export function actualizarSaque(liveScore: LiveScore, gameAntes: number) {
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

export function verificarGanadorSet(liveScore: LiveScore, formatoSet3?: FormatoSet3) {
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

