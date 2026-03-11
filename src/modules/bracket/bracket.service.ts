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
   * Calcula la configuración óptima del bracket según cantidad de parejas
   */
  calcularConfiguracion(totalParejas: number): BracketConfigResponse {
    if (totalParejas < 3) {
      throw new BadRequestException('Mínimo 3 parejas para generar bracket');
    }

    // Determinar tamaño del bracket principal (potencia de 2)
    const potencias = [4, 8, 16, 32, 64];
    const tamanoBracket = potencias.find((p) => p >= totalParejas) || 64;

    // Calcular BYEs (si es impar, uno tiene BYE)
    let parejasConBye = 0;
    let parejasQueJueganZona = totalParejas;

    if (totalParejas % 2 !== 0) {
      parejasConBye = 1;
      parejasQueJueganZona = totalParejas - 1;
    }

    // Zona: mitad ganan, mitad pierden
    const partidosZona = parejasQueJueganZona / 2;
    const ganadoresZona = partidosZona;
    const perdedoresZona = partidosZona;

    // Calcular repechaje
    // Necesitamos: ganadoresZona + ganadoresRepechaje + parejasConBye + perdedoresDirectos = tamanoBracket
    const lugaresRestantes = tamanoBracket - ganadoresZona - parejasConBye;

    // En repechaje entran el doble de los lugares restantes
    let parejasEnRepechaje = Math.min(perdedoresZona, lugaresRestantes * 2);

    // Ajustar a par
    if (parejasEnRepechaje % 2 !== 0) {
      parejasEnRepechaje--;
    }

    const ganadoresRepechaje = parejasEnRepechaje / 2;
    const partidosRepechaje = parejasEnRepechaje / 2;

    // Los perdedores que no entran al repechaje van directo al bracket
    const perdedoresDirectos = perdedoresZona - parejasEnRepechaje;

    // Verificación
    const totalEnBracket =
      ganadoresZona + ganadoresRepechaje + parejasConBye + perdedoresDirectos;

    if (totalEnBracket !== tamanoBracket) {
      // Ajuste: si no cierra, aumentar BYEs
      const faltan = tamanoBracket - totalEnBracket;
      parejasConBye += faltan;
    }

    // Determinar fases del bracket
    const fases: FaseBracket[] = [FaseBracket.ZONA];
    if (parejasEnRepechaje > 0) {
      fases.push(FaseBracket.REPECHAJE);
    }

    if (tamanoBracket >= 16) fases.push(FaseBracket.OCTAVOS);
    if (tamanoBracket >= 8) fases.push(FaseBracket.CUARTOS);
    fases.push(FaseBracket.SEMIS, FaseBracket.FINAL);

    return {
      totalParejas,
      tamanoBracket,
      parejasConBye,
      partidosZona,
      parejasEnRepechaje,
      partidosRepechaje,
      ganadoresZona,
      ganadoresRepechaje,
      perdedoresDirectos,
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

    // 2. CREAR PARTIDOS DE REPECHAJE (si aplica)
    const partidosRepechaje: MatchNode[] = [];
    if (config.parejasEnRepechaje > 0) {
      for (let i = 0; i < config.partidosRepechaje; i++) {
        const partido: MatchNode = {
          id: generarId(),
          fase: FaseBracket.REPECHAJE,
          orden: i + 1,
          esBye: false,
          tipoEntrada1: TipoEntrada.PERDEDOR_ZONA,
          tipoEntrada2: TipoEntrada.PERDEDOR_ZONA,
        };
        partidosRepechaje.push(partido);
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
      partidosRepechaje,
      partidosOctavos,
      partidosCuartos,
      partidosSemis,
      partidosFinal,
      config,
    );

    return { config, partidos };
  }

  /**
   * Conecta la navegación entre partidos (quién va a dónde)
   */
  private conectarNavegacion(
    zona: MatchNode[],
    repechaje: MatchNode[],
    octavos: MatchNode[],
    cuartos: MatchNode[],
    semis: MatchNode[],
    final: MatchNode[],
    config: BracketConfigResponse,
  ): void {
    // Esta es una implementación simplificada
    // En la versión real, se conecta:
    // - Ganadores de zona → Octavos/Cuartos
    // - Ganadores de repechaje → Octavos
    // - Perdedores de zona → Repechaje (los seleccionados)
    // - Ganadores de octavos → Cuartos
    // - Ganadores de cuartos → Semis
    // - Ganadores de semis → Final
    
    // Por ahora, dejamos la estructura base lista para implementar
  }

  /**
   * Guarda el bracket generado en la base de datos
   */
  async guardarBracket(
    tournamentCategoryId: string,
    config: BracketConfigResponse,
    partidos: MatchNode[],
  ): Promise<void> {
    // Crear FixtureVersion
    const fixtureVersion = await this.prisma.fixtureVersion.create({
      data: {
        tournamentId: '', // Se obtiene del tournamentCategory
        categoryId: '', // Se obtiene del tournamentCategory
        definicion: { config, partidos } as any,
        totalPartidos: partidos.length,
        estado: 'BORRADOR',
      },
    });

    // Crear los partidos (matches)
    for (const partido of partidos) {
      await this.prisma.match.create({
        data: {
          tournamentId: '', // Se obtiene del tournamentCategory
          categoryId: '', // Se obtiene del tournamentCategory
          fixtureVersionId: fixtureVersion.id,
          ronda: partido.fase,
          numeroRonda: partido.orden,
          esBye: partido.esBye,
          tipoEntrada1: partido.tipoEntrada1,
          tipoEntrada2: partido.tipoEntrada2,
          partidoOrigen1Id: partido.partidoOrigen1Id,
          partidoOrigen2Id: partido.partidoOrigen2Id,
          partidoSiguienteId: partido.partidoSiguienteId,
          partidoPerdedorSiguienteId: partido.partidoPerdedorSiguienteId,
          posicionEnSiguiente: partido.posicionEnSiguiente,
          posicionEnPerdedor: partido.posicionEnPerdedor,
          estado: 'PROGRAMADO',
        },
      });
    }
  }
}
