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
    // 16+ parejas → Bracket de 16 (Octavos)
    const objetivoBracket = totalParejas <= 15 ? 8 : 16;

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
   * Genera el bracket completo con partidos y navegación
   */
  async generarBracket(dto: GenerateBracketDto): Promise<{
    config: BracketConfigResponse;
    partidos: MatchNode[];
  }> {
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
    const partidosOctavos: MatchNode[] = [];
    const partidosCuartos: MatchNode[] = [];
    const partidosSemis: MatchNode[] = [];
    const partidosFinal: MatchNode[] = [];

    // Crear estructura según tamaño del bracket
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
      partidosOctavos,
      partidosCuartos,
      partidosSemis,
      partidosFinal,
      config,
    );

    return { config, partidos };
  }

  /**
   * Conecta la navegación entre partidos
   * 
   * FLUJO:
   * - Zona → (para algunos) Ronda de Ajuste → Bracket
   * - Zona → (para otros) Directo al Bracket
   * - Ronda de Ajuste → Ganadores al Bracket, Perdedores ELIMINADOS
   */
  private conectarNavegacion(
    zona: MatchNode[],
    rondaAjuste: MatchNode[],
    octavos: MatchNode[],
    cuartos: MatchNode[],
    semis: MatchNode[],
    final: MatchNode[],
    config: BracketConfigResponse,
  ): void {
    // Los partidos de primera ronda del bracket principal
    const primeraRonda = octavos.length > 0 ? octavos : cuartos;
    
    const totalParejas = config.totalParejas;
    const objetivoBracket = config.tamanoBracket;
    const parejasEnRondaAjuste = config.parejasEnRepechaje;
    
    // Distribución de parejas después de zona:
    // - parejasEnRondaAjuste: juegan ronda de ajuste (mix de ganadores y perdedores de zona)
    // - (totalParejas - parejasEnRondaAjuste): van directo al bracket
    
    const parejasDirectoAlBracket = totalParejas - parejasEnRondaAjuste;
    
    // Seleccionamos qué parejas van a ronda de ajuste
    // Estrategia: seleccionamos las primeras N parejas de la zona (mix aleatorio)
    // En la práctica se hace sorteo, aquí marcamos las conexiones
    
    // 1. CONECTAR PAREJAS A RONDA DE AJUSTE
    // Las primeras 'parejasEnRondaAjuste' parejas de la zona van a ronda de ajuste
    for (let i = 0; i < parejasEnRondaAjuste; i++) {
      const partidoZonaIndex = Math.floor(i / 2);
      const posicionEnPartido = (i % 2) + 1; // 1 o 2
      
      if (zona[partidoZonaIndex]) {
        const partidoRondaAjusteIndex = Math.floor(i / 2);
        
        if (rondaAjuste[partidoRondaAjusteIndex]) {
          // El ganador de zona va a ronda de ajuste
          zona[partidoZonaIndex].partidoSiguienteId = rondaAjuste[partidoRondaAjusteIndex].id;
          zona[partidoZonaIndex].posicionEnSiguiente = posicionEnPartido;
        }
      }
    }

    // 2. CONECTAR GANADORES DE RONDA DE AJUSTE AL BRACKET
    rondaAjuste.forEach((partidoAjuste, index) => {
      const targetIndex = index % primeraRonda.length;
      const targetPartido = primeraRonda[targetIndex];
      
      partidoAjuste.partidoSiguienteId = targetPartido.id;
      partidoAjuste.posicionEnSiguiente = (index % 2) + 1;
      
      if (!targetPartido.tipoEntrada1) {
        targetPartido.tipoEntrada1 = TipoEntrada.GANADOR_REPECHAJE;
        targetPartido.partidoOrigen1Id = partidoAjuste.id;
      } else {
        targetPartido.tipoEntrada2 = TipoEntrada.GANADOR_REPECHAJE;
        targetPartido.partidoOrigen2Id = partidoAjuste.id;
      }
    });

    // 3. CONECTAR PAREJAS QUE VAN DIRECTO AL BRACKET
    // Las que no jugaron ronda de ajuste
    const parejasDirectas = zona.slice(Math.ceil(parejasEnRondaAjuste / 2));
    parejasDirectas.forEach((partidoZona, index) => {
      const targetIndex = (rondaAjuste.length + index) % primeraRonda.length;
      const targetPartido = primeraRonda[targetIndex];
      
      partidoZona.partidoSiguienteId = targetPartido.id;
      partidoZona.posicionEnSiguiente = 1;
      
      if (!targetPartido.tipoEntrada1) {
        targetPartido.tipoEntrada1 = TipoEntrada.GANADOR_ZONA;
        targetPartido.partidoOrigen1Id = partidoZona.id;
      } else {
        targetPartido.tipoEntrada2 = TipoEntrada.GANADOR_ZONA;
        targetPartido.partidoOrigen2Id = partidoZona.id;
      }
    });

    // 4. CONECTAR BRACKET PRINCIPAL
    this.conectarEliminacionDirecta(primeraRonda, cuartos, semis, final);
  }

  /**
   * Conecta la fase de eliminación directa del bracket
   */
  private conectarEliminacionDirecta(
    primeraRonda: MatchNode[],
    cuartos: MatchNode[],
    semis: MatchNode[],
    final: MatchNode[],
  ): void {
    // Primera ronda → Cuartos
    if (cuartos.length > 0 && primeraRonda.length > 0) {
      primeraRonda.forEach((partido, index) => {
        const parentIndex = Math.floor(index / 2);
        const parent = cuartos[parentIndex];
        
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
    }

    // Cuartos → Semis
    cuartos.forEach((partido, index) => {
      const parentIndex = Math.floor(index / 2);
      const parent = semis[parentIndex];
      
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

    // Semis → Final
    semis.forEach((partido, index) => {
      const parent = final[0];
      
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

      if (Object.keys(updateData).length > 0) {
        await this.prisma.match.update({
          where: { id: realId },
          data: updateData,
        });
      }
    }

    return fixtureVersion.id;
  }
}
