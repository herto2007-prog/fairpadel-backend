import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GenerateBracketDto,
  BracketConfigResponse,
  FaseBracket,
  TipoEntrada,
  MatchNode,
} from './dto/generate-bracket.dto';

@Injectable()
export class BracketService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula la configuración del bracket según la fórmula del usuario
   * 
   * SISTEMA:
   * 1. ZONA: Todos juegan 1 partido
   *    PartidosZona = floor(parejas / 2)
   * 
   * 2. RONDA DE AJUSTE: Eliminar la cantidad necesaria
   *    ObjetivoBracket = 8 o 16
   *    Eliminaciones = parejas - ObjetivoBracket
   *    PartidosRonda2 = Eliminaciones
   *    (Puede incluir ganadores o perdedores de zona)
   * 
   * 3. BRACKET: Eliminación directa
   */
  calcularConfiguracion(totalParejas: number): BracketConfigResponse {
    if (totalParejas < 3) {
      throw new BadRequestException('Mínimo 3 parejas para generar bracket');
    }

    // PASO 1: ZONA
    // Todos juegan. Si es impar, uno tiene BYE en zona.
    let parejasConByeZona = 0;
    if (totalParejas % 2 !== 0) {
      parejasConByeZona = 1;
    }

    const partidosZona = Math.floor(totalParejas / 2);
    // En zona: mitad ganan (redondeado), mitad pierden
    const ganadoresZona = Math.ceil(totalParejas / 2);
    const perdedoresZona = Math.floor(totalParejas / 2);

    // PASO 2: DETERMINAR BRACKET OBJETIVO
    // 8-15 parejas → Bracket de 8 (Cuartos)
    // 16-31 parejas → Bracket de 16 (Octavos)
    // 32-63 parejas → Bracket de 32 (16avos)
    // 64+ parejas → Bracket de 64 (32avos)
    let objetivoBracket: number;
    if (totalParejas <= 15) {
      objetivoBracket = 8;
    } else if (totalParejas <= 31) {
      objetivoBracket = 16;
    } else if (totalParejas <= 63) {
      objetivoBracket = 32;
    } else {
      objetivoBracket = 64;
    }

    // PASO 3: RONDA DE AJUSTE
    // Necesitamos eliminar: totalParejas - objetivoBracket
    const eliminacionesNecesarias = Math.max(0, totalParejas - objetivoBracket);
    
    // Partidos de ajuste = Eliminaciones necesarias
    // Cada partido elimina 1 pareja
    const partidosRondaAjuste = eliminacionesNecesarias;
    
    // Parejas que juegan la ronda de ajuste: 2 por partido
    const parejasEnRondaAjuste = partidosRondaAjuste * 2;
    
    // De la ronda de ajuste: la mitad pasa, la mitad se elimina
    const ganadoresRondaAjuste = partidosRondaAjuste;
    const eliminadosRondaAjuste = partidosRondaAjuste;

    // PASO 4: DISTRIBUCIÓN AL BRACKET
    // Entran al bracket: los que NO fueron eliminados en ronda de ajuste
    // Total que debe quedar: objetivoBracket
    // Composición: mix de ganadores de zona, ganadores de ronda ajuste, y algunos que no jugaron ronda ajuste

    // Verificación: todas las parejas deben estar contabilizadas
    // - Eliminados en ronda de ajuste: eliminadosRondaAjuste
    // - Que pasan al bracket: objetivoBracket
    // Total: eliminadosRondaAjuste + objetivoBracket = totalParejas ✓

    // Determinar fases del bracket
    const fases: FaseBracket[] = [FaseBracket.ZONA];
    if (partidosRondaAjuste > 0) {
      fases.push(FaseBracket.REPECHAJE); // Usamos REPECHAJE como "Ronda de Ajuste"
    }

    if (objetivoBracket >= 64) fases.push(FaseBracket.TREINTAYDOSAVOS);
    if (objetivoBracket >= 32) fases.push(FaseBracket.DIECISEISAVOS);
    if (objetivoBracket >= 16) fases.push(FaseBracket.OCTAVOS);
    if (objetivoBracket >= 8) fases.push(FaseBracket.CUARTOS);
    fases.push(FaseBracket.SEMIS, FaseBracket.FINAL);

    return {
      totalParejas,
      tamanoBracket: objetivoBracket,
      parejasConBye: parejasConByeZona, // BYEs en zona (no en bracket)
      partidosZona,
      parejasEnRepechaje: parejasEnRondaAjuste, // Renombrado conceptualmente como "Ronda Ajuste"
      partidosRepechaje: partidosRondaAjuste,
      ganadoresZona,
      ganadoresRepechaje: ganadoresRondaAjuste,
      perdedoresDirectos: eliminadosRondaAjuste, // Los eliminados en ronda de ajuste
      fases,
    };
  }

  /**
   * Calcula el total de slots necesarios para todo el torneo
   * incluyendo ZONA, REPECHAJE, y todas las rondas del bracket
   */
  calcularSlotsNecesarios(totalParejas: number): {
    totalPartidos: number;
    partidosZona: number;
    partidosRepechaje: number;
    partidosBracket: number;
    detallePorFase: { fase: string; partidos: number }[];
  } {
    const config = this.calcularConfiguracion(totalParejas);
    
    // Calcular partidos por fase
    const partidosZona = config.partidosZona + (config.parejasConBye > 0 ? 1 : 0);
    const partidosRepechaje = config.partidosRepechaje;
    
    // Calcular partidos del bracket principal
    let partidosBracket = 0;
    const detallePorFase: { fase: string; partidos: number }[] = [];
    
    // Agregar ZONA
    detallePorFase.push({ fase: 'ZONA', partidos: partidosZona });
    
    // Agregar REPECHAJE si existe
    if (partidosRepechaje > 0) {
      detallePorFase.push({ fase: 'REPECHAJE', partidos: partidosRepechaje });
    }
    
    // Calcular partidos del bracket según tamaño
    if (config.tamanoBracket >= 64) {
      const partidos = 32;
      partidosBracket += partidos;
      detallePorFase.push({ fase: '32AVOS', partidos });
    }
    if (config.tamanoBracket >= 32) {
      const partidos = 16;
      partidosBracket += partidos;
      detallePorFase.push({ fase: '16AVOS', partidos });
    }
    if (config.tamanoBracket >= 16) {
      const partidos = 8;
      partidosBracket += partidos;
      detallePorFase.push({ fase: 'OCTAVOS', partidos });
    }
    if (config.tamanoBracket >= 8) {
      const partidos = 4;
      partidosBracket += partidos;
      detallePorFase.push({ fase: 'CUARTOS', partidos });
    }
    
    // Semis y Final siempre existen
    partidosBracket += 2;
    detallePorFase.push({ fase: 'SEMIS', partidos: 2 });
    
    partidosBracket += 1;
    detallePorFase.push({ fase: 'FINAL', partidos: 1 });
    
    return {
      totalPartidos: partidosZona + partidosRepechaje + partidosBracket,
      partidosZona,
      partidosRepechaje,
      partidosBracket,
      detallePorFase,
    };
  }

  /**
   * Valida si hay suficiente disponibilidad para el torneo completo
   * Lanza excepción si no hay suficientes slots configurados
   */
  async validarDisponibilidad(
    tournamentCategoryId: string,
    totalParejas: number,
  ): Promise<{
    valido: boolean;
    slotsNecesarios: number;
    slotsDisponibles: number;
    slotsFaltantes: number;
    duracionPromedioMinutos: number;
    mensaje?: string;
    detallePorFase: { fase: string; partidos: number }[];
  }> {
    // Calcular slots necesarios
    const calculo = this.calcularSlotsNecesarios(totalParejas);
    
    // Obtener el tournamentId desde la categoría
    const categoria = await this.prisma.tournamentCategory.findUnique({
      where: { id: tournamentCategoryId },
      select: { tournamentId: true },
    });
    
    if (!categoria) {
      throw new BadRequestException('Categoría no encontrada');
    }
    
    // Obtener slots disponibles (LIBRES) del torneo
    const slotsLibres = await this.prisma.torneoSlot.findMany({
      where: { 
        disponibilidad: {
          tournamentId: categoria.tournamentId,
        },
        estado: 'LIBRE',
      },
      include: {
        disponibilidad: true,
      },
    });
    
    // Contar slots totales y calcular duración promedio
    const slotsDisponibles = slotsLibres.length;
    let minutosTotalesDisponibles = 0;
    
    for (const slot of slotsLibres) {
      // Calcular duración del slot
      const horaInicio = new Date(`2000-01-01T${slot.horaInicio}`);
      const horaFin = new Date(`2000-01-01T${slot.horaFin}`);
      const duracionMinutos = (horaFin.getTime() - horaInicio.getTime()) / (1000 * 60);
      minutosTotalesDisponibles += duracionMinutos;
    }
    
    const slotsFaltantes = Math.max(0, calculo.totalPartidos - slotsDisponibles);
    
    // Calcular duración promedio real de los slots configurados
    const duracionPromedioMinutos = slotsDisponibles > 0 
      ? Math.round(minutosTotalesDisponibles / slotsDisponibles)
      : 90;
    
    // Calcular horas necesarias usando la duración real
    const horasNecesarias = Math.ceil((slotsFaltantes * duracionPromedioMinutos) / 60);
    const horasTotalesNecesarias = Math.ceil((calculo.totalPartidos * duracionPromedioMinutos) / 60);
    const horasTotalesDisponibles = Math.ceil(minutosTotalesDisponibles / 60);
    
    return {
      valido: slotsFaltantes === 0,
      slotsNecesarios: calculo.totalPartidos,
      slotsDisponibles,
      slotsFaltantes,
      duracionPromedioMinutos,
      mensaje: slotsFaltantes > 0 
        ? `Faltan ${slotsFaltantes} slots (${horasNecesarias}h). Necesitas ${calculo.totalPartidos} slots (${horasTotalesNecesarias}h) para ${totalParejas} parejas pero tienes ${slotsDisponibles} slots (${horasTotalesDisponibles}h) configurados con duración promedio de ${duracionPromedioMinutos}min. Sugerencia: agrega ${horasNecesarias}h más (ej: ${horasNecesarias > 8 ? '2 días de 8h o 1 día de ' + horasNecesarias + 'h' : '1 día de ' + horasNecesarias + 'h'}).`
        : undefined,
      detallePorFase: calculo.detallePorFase,
    };
  }

  /**
   * Genera el bracket completo con partidos y navegación
   */
  async generarBracket(dto: GenerateBracketDto): Promise<{
    config: BracketConfigResponse;
    partidos: MatchNode[];
  }> {
    // Validar disponibilidad antes de generar
    const validacion = await this.validarDisponibilidad(
      dto.tournamentCategoryId,
      dto.totalParejas,
    );
    
    if (!validacion.valido) {
      throw new BadRequestException({
        success: false,
        message: validacion.mensaje,
        detalle: {
          slotsNecesarios: validacion.slotsNecesarios,
          slotsDisponibles: validacion.slotsDisponibles,
          slotsFaltantes: validacion.slotsFaltantes,
          partidosPorFase: validacion.detallePorFase,
        },
      });
    }
    
    const config = this.calcularConfiguracion(dto.totalParejas);
    const partidos: MatchNode[] = [];

    // IDs temporales para conectar partidos
    const generarId = () => `temp_${Math.random().toString(36).substr(2, 9)}`;

    // 1. CREAR PARTIDOS DE ZONA
    const partidosZona: MatchNode[] = [];
    for (let i = 0; i < config.partidosZona; i++) {
      const partido: MatchNode = {
        id: generarId(),
        fase: FaseBracket.ZONA,
        orden: i + 1,
        esBye: false,
        tipoEntrada1: TipoEntrada.INSCRIPCION,
        tipoEntrada2: TipoEntrada.INSCRIPCION,
      };
      partidosZona.push(partido);
      partidos.push(partido);
    }
    
    // Si hay número impar de parejas, crear un partido BYE adicional para la última pareja
    if (dto.totalParejas % 2 !== 0) {
      const partidoBye: MatchNode = {
        id: generarId(),
        fase: FaseBracket.ZONA,
        orden: config.partidosZona + 1,
        esBye: true,
        tipoEntrada1: TipoEntrada.INSCRIPCION,
        tipoEntrada2: TipoEntrada.INSCRIPCION,
      };
      partidosZona.push(partidoBye);
      partidos.push(partidoBye);
    }

    // 2. CREAR PARTIDOS DE RONDA DE AJUSTE (si aplica)
    const partidosRondaAjuste: MatchNode[] = [];
    if (config.partidosRepechaje > 0) {
      for (let i = 0; i < config.partidosRepechaje; i++) {
        const partido: MatchNode = {
          id: generarId(),
          fase: FaseBracket.REPECHAJE, // Lo llamamos REPECHAJE pero es "Ronda de Ajuste"
          orden: i + 1,
          esBye: false,
          tipoEntrada1: TipoEntrada.INSCRIPCION, // Puede ser cualquiera (ganador o perdedor de zona)
          tipoEntrada2: TipoEntrada.INSCRIPCION,
        };
        partidosRondaAjuste.push(partido);
        partidos.push(partido);
      }
    }

    // 3. CREAR BRACKET PRINCIPAL
    const partidos32avos: MatchNode[] = [];
    const partidos16avos: MatchNode[] = [];
    const partidosOctavos: MatchNode[] = [];
    const partidosCuartos: MatchNode[] = [];
    const partidosSemis: MatchNode[] = [];
    const partidosFinal: MatchNode[] = [];

    // Crear estructura según tamaño del bracket
    if (config.tamanoBracket >= 64) {
      // 32AVOS (para bracket de 64)
      for (let i = 0; i < 32; i++) {
        const partido: MatchNode = {
          id: generarId(),
          fase: FaseBracket.TREINTAYDOSAVOS,
          orden: i + 1,
          esBye: false,
        };
        partidos32avos.push(partido);
        partidos.push(partido);
      }
    }

    if (config.tamanoBracket >= 32) {
      // 16AVOS (para bracket de 32)
      for (let i = 0; i < 16; i++) {
        const partido: MatchNode = {
          id: generarId(),
          fase: FaseBracket.DIECISEISAVOS,
          orden: i + 1,
          esBye: false,
        };
        partidos16avos.push(partido);
        partidos.push(partido);
      }
    }

    if (config.tamanoBracket >= 16) {
      // OCTAVOS
      for (let i = 0; i < 8; i++) {
        const partido: MatchNode = {
          id: generarId(),
          fase: FaseBracket.OCTAVOS,
          orden: i + 1,
          esBye: false,
        };
        partidosOctavos.push(partido);
        partidos.push(partido);
      }
    }

    if (config.tamanoBracket >= 8) {
      // CUARTOS
      for (let i = 0; i < 4; i++) {
        const partido: MatchNode = {
          id: generarId(),
          fase: FaseBracket.CUARTOS,
          orden: i + 1,
          esBye: false,
        };
        partidosCuartos.push(partido);
        partidos.push(partido);
      }
    }

    // SEMIS
    for (let i = 0; i < 2; i++) {
      const partido: MatchNode = {
        id: generarId(),
        fase: FaseBracket.SEMIS,
        orden: i + 1,
        esBye: false,
      };
      partidosSemis.push(partido);
      partidos.push(partido);
    }

    // FINAL
    const partidoFinal: MatchNode = {
      id: generarId(),
      fase: FaseBracket.FINAL,
      orden: 1,
      esBye: false,
    };
    partidosFinal.push(partidoFinal);
    partidos.push(partidoFinal);

    // 4. CONECTAR NAVEGACIÓN
    this.conectarNavegacion(
      partidosZona,
      partidosRondaAjuste,
      partidos32avos,
      partidos16avos,
      partidosOctavos,
      partidosCuartos,
      partidosSemis,
      partidosFinal,
      config,
    );

    return { config, partidos };
  }

  /**
   * Fisher-Yates shuffle para aleatorizar arrays
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Conecta la navegación entre partidos con aleatoriedad
   * 
   * FLUJO SISTEMA PARAGUAYO (MEJORADO):
   * - TODOS los ganadores de ZONA → Bracket principal (posiciones aleatorias)
   * - Perdedores seleccionados ALEATORIAMENTE de ZONA → Repechaje
   * - Demás perdedores de ZONA → Bracket (posiciones aleatorias)
   * - Ganadores de Repechaje → Bracket (posiciones aleatorias)
   * - Perdedores de Repechaje → ELIMINADOS
   * 
   * La aleatoriedad evita que jugadores se enfrenten entre sí prematuramente
   * y hace el bracket más justo e impredecible.
   */
  private conectarNavegacion(
    zona: MatchNode[],
    rondaAjuste: MatchNode[],
    treintaydosavos: MatchNode[],
    dieciseisavos: MatchNode[],
    octavos: MatchNode[],
    cuartos: MatchNode[],
    semis: MatchNode[],
    final: MatchNode[],
    config: BracketConfigResponse,
  ): void {
    // Determinar primera ronda del bracket
    let primeraRonda: MatchNode[];
    if (treintaydosavos.length > 0) {
      primeraRonda = treintaydosavos;
    } else if (dieciseisavos.length > 0) {
      primeraRonda = dieciseisavos;
    } else if (octavos.length > 0) {
      primeraRonda = octavos;
    } else {
      primeraRonda = cuartos;
    }
    
    const partidosRepechaje = rondaAjuste.length;
    const slotsRepechaje = partidosRepechaje * 2;
    
    // Contar cuántos perdedores de zona tenemos
    const partidosZonaConPerdedor = zona.filter(p => !p.esBye).length;
    const perdedoresZona = partidosZonaConPerdedor; // Uno por partido (excepto BYE)
    
    // Calcular cuántos slots de repechaje llenamos con perdedores vs ganadores
    const slotsConPerdedores = Math.min(perdedoresZona, slotsRepechaje);
    const slotsConGanadores = Math.max(0, slotsRepechaje - perdedoresZona);
    
    // PREPARAR ALEATORIEDAD EN LA ASIGNACIÓN
    // Separar partidos de zona según su destino
    const partidosZonaNormales = zona.filter(p => !p.esBye);
    const partidosBye = zona.filter(p => p.esBye);
    
    // Aleatorizar el orden de los partidos de zona para asignación de destinos
    // Esto asegura que no sea siempre los "primeros" partidos los que van a repechaje
    const partidosZonaShuffled = this.shuffleArray([...partidosZonaNormales]);
    
    // Determinar cuáles partidos envían perdedores al repechaje (aleatorio)
    const indicesPerdedoresRepechaje = new Set<number>();
    for (let i = 0; i < slotsConPerdedores && i < partidosZonaShuffled.length; i++) {
      indicesPerdedoresRepechaje.add(i);
    }
    
    // Determinar cuáles ganadores van al repechaje (si aplica)
    const indicesGanadoresRepechaje = new Set<number>();
    if (slotsConGanadores > 0) {
      // Los últimos N partidos (después de los que envían perdedores a repechaje)
      for (let i = slotsConPerdedores; i < slotsConPerdedores + slotsConGanadores && i < partidosZonaShuffled.length; i++) {
        indicesGanadoresRepechaje.add(i);
      }
    }
    
    // Preparar slots del bracket principal para distribución aleatoria
    // Cada slot es una posición específica (partido + posición 1 o 2)
    const slotsBracket: { partido: MatchNode; posicion: number }[] = [];
    for (let i = 0; i < primeraRonda.length; i++) {
      slotsBracket.push({ partido: primeraRonda[i], posicion: 1 });
      slotsBracket.push({ partido: primeraRonda[i], posicion: 2 });
    }
    
    // Aleatorizar los slots del bracket para distribución equilibrada
    const slotsBracketShuffled = this.shuffleArray(slotsBracket);
    let slotIndex = 0;
    
    // ASIGNAR DESTINOS A CADA PARTIDO DE ZONA
    partidosZonaShuffled.forEach((partidoZona, index) => {
      // Determinar destino del GANADOR
      if (indicesGanadoresRepechaje.has(index)) {
        // Ganador va al repechaje
        const repechajeSlot = index - slotsConPerdedores;
        const repechajeIndex = Math.floor(repechajeSlot / 2);
        const posicionEnRepechaje = (repechajeSlot % 2) + 1;
        
        if (repechajeIndex < rondaAjuste.length) {
          const partidoRepechaje = rondaAjuste[repechajeIndex];
          partidoZona.partidoSiguienteId = partidoRepechaje.id;
          partidoZona.posicionEnSiguiente = posicionEnRepechaje;
        }
      } else {
        // Ganador va directo al bracket (slot aleatorio)
        const slot = slotsBracketShuffled[slotIndex++];
        partidoZona.partidoSiguienteId = slot.partido.id;
        partidoZona.posicionEnSiguiente = slot.posicion;
        
        if (slot.posicion === 1) {
          slot.partido.tipoEntrada1 = TipoEntrada.GANADOR_ZONA;
        } else {
          slot.partido.tipoEntrada2 = TipoEntrada.GANADOR_ZONA;
        }
      }
      
      // Determinar destino del PERDEDOR
      if (indicesPerdedoresRepechaje.has(index)) {
        // Perdedor va a repechaje
        const repechajeIndex = Math.floor(index / 2);
        const posicionEnRepechaje = (index % 2) + 1;
        
        const partidoRepechaje = rondaAjuste[repechajeIndex];
        partidoZona.partidoPerdedorSiguienteId = partidoRepechaje.id;
        partidoZona.posicionEnPerdedor = posicionEnRepechaje;
      } else {
        // Perdedor va directo al bracket (slot aleatorio)
        const slot = slotsBracketShuffled[slotIndex++];
        partidoZona.partidoPerdedorSiguienteId = slot.partido.id;
        partidoZona.posicionEnPerdedor = slot.posicion;
        
        if (slot.posicion === 1) {
          slot.partido.tipoEntrada1 = TipoEntrada.PERDEDOR_ZONA_SUERTE;
        } else {
          slot.partido.tipoEntrada2 = TipoEntrada.PERDEDOR_ZONA_SUERTE;
        }
      }
    });
    
    // ASIGNAR BYES (aleatoriamente también)
    partidosBye.forEach((partidoBye) => {
      const slot = slotsBracketShuffled[slotIndex++];
      partidoBye.partidoSiguienteId = slot.partido.id;
      partidoBye.posicionEnSiguiente = slot.posicion;
      
      if (slot.posicion === 1) {
        slot.partido.tipoEntrada1 = TipoEntrada.GANADOR_ZONA;
      } else {
        slot.partido.tipoEntrada2 = TipoEntrada.GANADOR_ZONA;
      }
    });

    // CONECTAR GANADORES DE REPECHAJE AL BRACKET (slots aleatorios restantes)
    // Reordenar los slots restantes aleatoriamente
    const slotsRestantes = slotsBracketShuffled.slice(slotIndex);
    const slotsRestantesShuffled = this.shuffleArray(slotsRestantes);
    
    rondaAjuste.forEach((partidoRepechaje, index) => {
      if (index < slotsRestantesShuffled.length) {
        const slot = slotsRestantesShuffled[index];
        partidoRepechaje.partidoSiguienteId = slot.partido.id;
        partidoRepechaje.posicionEnSiguiente = slot.posicion;
        
        if (slot.posicion === 1) {
          slot.partido.tipoEntrada1 = TipoEntrada.GANADOR_REPECHAJE;
        } else {
          slot.partido.tipoEntrada2 = TipoEntrada.GANADOR_REPECHAJE;
        }
      }
    });

    // CONECTAR BRACKET PRINCIPAL
    this.conectarEliminacionDirecta(
      treintaydosavos,
      dieciseisavos,
      octavos,
      cuartos,
      semis,
      final,
    );
  }

  /**
   * Conecta la fase de eliminación directa del bracket
   * Conecta todas las rondas en cadena: 32avos → 16avos → Octavos → Cuartos → Semis → Final
   */
  private conectarEliminacionDirecta(
    treintaydosavos: MatchNode[],
    dieciseisavos: MatchNode[],
    octavos: MatchNode[],
    cuartos: MatchNode[],
    semis: MatchNode[],
    final: MatchNode[],
  ): void {
    // Helper para conectar una ronda con la siguiente
    const conectarRonda = (rondaActual: MatchNode[], rondaSiguiente: MatchNode[]) => {
      if (rondaActual.length === 0 || rondaSiguiente.length === 0) return;
      
      rondaActual.forEach((partido, index) => {
        const parentIndex = Math.floor(index / 2);
        const parent = rondaSiguiente[parentIndex];
        
        if (parent) {
          partido.partidoSiguienteId = parent.id;
          partido.posicionEnSiguiente = (index % 2) + 1;
          
          if (!parent.partidoOrigen1Id) {
            parent.partidoOrigen1Id = partido.id;
          } else {
            parent.partidoOrigen2Id = partido.id;
          }
        }
      });
    };

    // Conectar todas las rondas en orden
    conectarRonda(treintaydosavos, dieciseisavos);  // 32avos → 16avos
    conectarRonda(dieciseisavos, octavos);          // 16avos → Octavos
    conectarRonda(octavos, cuartos);                // Octavos → Cuartos
    conectarRonda(cuartos, semis);                  // Cuartos → Semis
    conectarRonda(semis, final);                    // Semis → Final
  }

  /**
   * Guarda el bracket generado en la base de datos
   */
  async guardarBracket(
    tournamentCategoryId: string,
    config: BracketConfigResponse,
    partidos: MatchNode[],
    inscripciones: any[],
  ): Promise<string> {
    // Obtener IDs de torneo y categoría
    const categoria = await this.prisma.tournamentCategory.findUnique({
      where: { id: tournamentCategoryId },
      select: { tournamentId: true, categoryId: true },
    });

    if (!categoria) {
      throw new BadRequestException('Categoría no encontrada');
    }

    const { tournamentId, categoryId } = categoria;

    // Crear FixtureVersion
    const fixtureVersion = await this.prisma.fixtureVersion.create({
      data: {
        tournamentId,
        categoryId,
        definicion: {
          config,
          partidos: partidos.map((p) => ({
            id: p.id,
            fase: p.fase,
            orden: p.orden,
            esBye: p.esBye,
            tipoEntrada1: p.tipoEntrada1,
            tipoEntrada2: p.tipoEntrada2,
            partidoOrigen1Id: p.partidoOrigen1Id,
            partidoOrigen2Id: p.partidoOrigen2Id,
            partidoSiguienteId: p.partidoSiguienteId,
            partidoPerdedorSiguienteId: p.partidoPerdedorSiguienteId,
            posicionEnSiguiente: p.posicionEnSiguiente,
            posicionEnPerdedor: p.posicionEnPerdedor,
          })),
          inscripciones: inscripciones.map((i) => ({
            id: i.id,
            jugador1: i.jugador1,
            jugador2: i.jugador2,
          })),
        } as any,
        totalPartidos: partidos.length,
        estado: 'BORRADOR',
      },
    });

    // Mapear IDs temporales a reales
    const idMap = new Map<string, string>();

    // Preparar asignación de inscripciones a partidos de ZONA
    // Las inscripciones vienen ordenadas por el sorteo
    const inscripcionesZona = [...inscripciones]; // Copia del orden del sorteo
    let indiceInscripcion = 0;

    // Crear los partidos en orden: ZONA → RONDA AJUSTE → BRACKET
    const ordenFases = [
      FaseBracket.ZONA,
      FaseBracket.REPECHAJE,
      FaseBracket.TREINTAYDOSAVOS,
      FaseBracket.DIECISEISAVOS,
      FaseBracket.OCTAVOS,
      FaseBracket.CUARTOS,
      FaseBracket.SEMIS,
      FaseBracket.FINAL,
    ];

    for (const fase of ordenFases) {
      const partidosFase = partidos.filter((p) => p.fase === fase);
      
      for (const partido of partidosFase) {
        const createData: any = {
          tournamentId,
          categoryId,
          fixtureVersionId: fixtureVersion.id,
          ronda: partido.fase,
          numeroRonda: partido.orden,
          esBye: partido.esBye,
          tipoEntrada1: partido.tipoEntrada1,
          tipoEntrada2: partido.tipoEntrada2,
          estado: 'PROGRAMADO',
        };

        // Asignar inscripciones a partidos de ZONA
        if (fase === FaseBracket.ZONA) {
          // Siempre asignar 2 inscripciones por partido de zona (incluso si es BYE)
          // para asegurar que todas las parejas queden asignadas exactamente una vez
          const tienePareja1 = indiceInscripcion < inscripcionesZona.length;
          const tienePareja2 = indiceInscripcion + 1 < inscripcionesZona.length;
          
          if (tienePareja1) {
            createData.inscripcion1Id = inscripcionesZona[indiceInscripcion].id;
            indiceInscripcion++;
          }
          if (tienePareja2) {
            createData.inscripcion2Id = inscripcionesZona[indiceInscripcion].id;
            indiceInscripcion++;
          }
          
          // Si solo hay una pareja en este partido, es un BYE efectivo
          // La pareja pasa automáticamente
          if (tienePareja1 && !tienePareja2) {
            createData.esBye = true;
            createData.inscripcionGanadoraId = createData.inscripcion1Id;
          }
        }

        const created = await this.prisma.match.create({
          data: createData,
        });
        idMap.set(partido.id, created.id);
      }
    }

    // Actualizar referencias de navegación con IDs reales
    for (const partido of partidos) {
      const realId = idMap.get(partido.id);
      if (!realId) continue;

      const updateData: any = {};

      if (partido.partidoSiguienteId) {
        updateData.partidoSiguienteId = idMap.get(partido.partidoSiguienteId);
      }
      if (partido.partidoPerdedorSiguienteId) {
        updateData.partidoPerdedorSiguienteId = idMap.get(partido.partidoPerdedorSiguienteId);
      }
      if (partido.partidoOrigen1Id) {
        updateData.partidoOrigen1Id = idMap.get(partido.partidoOrigen1Id);
      }
      if (partido.partidoOrigen2Id) {
        updateData.partidoOrigen2Id = idMap.get(partido.partidoOrigen2Id);
      }
      if (partido.posicionEnSiguiente) {
        updateData.posicionEnSiguiente = partido.posicionEnSiguiente;
      }
      if (partido.posicionEnPerdedor) {
        updateData.posicionEnPerdedor = partido.posicionEnPerdedor;
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.match.update({
          where: { id: realId },
          data: updateData,
        });
      }
    }

    // AVANZAR GANADORES DE BYE AUTOMÁTICAMENTE
    // Los partidos BYE ya tienen ganador asignado, hay que avanzarlos al bracket
    for (const partido of partidos) {
      if (partido.esBye && partido.partidoSiguienteId) {
        const realId = idMap.get(partido.id);
        const realSiguienteId = idMap.get(partido.partidoSiguienteId);
        
        if (realId && realSiguienteId) {
          // Obtener el ganador del BYE
          const matchBye = await this.prisma.match.findUnique({
            where: { id: realId },
            select: { inscripcion1Id: true },
          });
          
          if (matchBye?.inscripcion1Id) {
            // Avanzar el ganador al bracket
            const posicion = partido.posicionEnSiguiente || 1;
            await this.prisma.match.update({
              where: { id: realSiguienteId },
              data: posicion === 1
                ? { inscripcion1Id: matchBye.inscripcion1Id, tipoEntrada1: 'GANADOR_ZONA' }
                : { inscripcion2Id: matchBye.inscripcion1Id, tipoEntrada2: 'GANADOR_ZONA' },
            });
            
            console.log(`[guardarBracket] BYE avanzado: ${matchBye.inscripcion1Id} → ${realSiguienteId}`);
          }
        }
      }
    }

    return fixtureVersion.id;
  }
}
