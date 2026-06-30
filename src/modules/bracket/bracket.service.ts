import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GenerateBracketDto,
  BracketConfigResponse,
  FaseBracket,
  TipoEntrada,
  MatchNode,
} from './dto/generate-bracket.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { planificarCuadro } from './cuadro-planner';
import { grafoAMatchNodes, configDesdePlan } from './grafo-a-matchnodes';

@Injectable()
export class BracketService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

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
    // Motor v2: la estructura la decide el planificador puro (zona cortesía,
    // llave = potencia de 2 más cercana, ronda solo de perdedores, byes a los
    // mejores). Ver cuadro-planner.ts / cuadro-grafo.ts.
    return configDesdePlan(planificarCuadro(totalParejas));
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
    const plan = planificarCuadro(totalParejas);

    // ZONA (incluye el partido bye de la pareja impar) y RONDA (solo perdedores).
    const partidosZona = plan.zonaPartidos + (plan.zonaBye ? 1 : 0);
    const partidosRepechaje = plan.rondaPartidos;

    const detallePorFase: { fase: string; partidos: number }[] = [
      { fase: 'ZONA', partidos: partidosZona },
    ];
    if (partidosRepechaje > 0) {
      detallePorFase.push({ fase: 'REPECHAJE', partidos: partidosRepechaje });
    }

    // Nombres de display de las fases de llave (continuidad con el front).
    const NOMBRE_FASE: Record<string, string> = {
      TREINTAYDOSAVOS: '32AVOS', DIECISEISAVOS: '16AVOS',
      OCTAVOS: 'OCTAVOS', CUARTOS: 'CUARTOS', SEMIS: 'SEMIS', FINAL: 'FINAL',
    };
    // Los byes de llave colapsan partidos de la 1ª ronda (los mejores pasan directo).
    let partidosBracket = 0;
    plan.fasesLlave.forEach((f, i) => {
      const jugados = i === 0 ? f.partidos - plan.byesLlave : f.partidos;
      partidosBracket += jugados;
      detallePorFase.push({ fase: NOMBRE_FASE[f.fase] || f.fase, partidos: jugados });
    });

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

    // Motor v2: la estructura (zona, ronda solo de perdedores, llave con byes a
    // los mejores) y los enlaces los arma el grafo puro; acá solo se traduce a la
    // forma que consume guardarBracket. Ver cuadro-planner / cuadro-grafo / grafo-a-matchnodes.
    return grafoAMatchNodes(dto.totalParejas);
  }

  /**
   * Guarda el bracket generado en la base de datos
   * MVP: Ahora acepta slots para asignar programación automática
   */
  async guardarBracket(
    tournamentCategoryId: string,
    config: BracketConfigResponse,
    partidos: MatchNode[],
    inscripciones: any[],
    slots?: { fecha: string; horaInicio: string; horaFin: string; torneoCanchaId: string; fase: string; ordenPartido: number }[],
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
    // MVP: Liberar slots del bracket anterior si existe
    const categoriaActual = await this.prisma.tournamentCategory.findUnique({
      where: { id: tournamentCategoryId },
      select: { fixtureVersionId: true },
    });
    
    if (categoriaActual?.fixtureVersionId) {
      const partidosAnteriores = await this.prisma.match.findMany({
        where: { fixtureVersionId: categoriaActual.fixtureVersionId },
        select: { torneoCanchaId: true, fechaProgramada: true, horaProgramada: true },
      });
      
      for (const partido of partidosAnteriores) {
        if (partido.torneoCanchaId && partido.fechaProgramada && partido.horaProgramada) {
          // FIX: fechaProgramada ahora es String YYYY-MM-DD
          const fechaNormalizada = partido.fechaProgramada;
          
          const slotLiberado = await this.prisma.torneoSlot.updateMany({
            where: {
              torneoCanchaId: partido.torneoCanchaId,
              disponibilidad: {
                fecha: fechaNormalizada,
              },
              horaInicio: partido.horaProgramada,
              estado: 'OCUPADO',
            },
            data: { estado: 'LIBRE', matchId: null },
          });
        }
      }
    }

    // MVP: Si no hay slots, los partidos se crearán sin programación
    // Los slots serán asignados posteriormente por asignarSlots()
    if (!slots || slots.length === 0) {
      // No asignar slots automáticamente - se asignarán después
      slots = [];
    }

    // Calcular siguiente número de versión
    const ultimaVersion = await this.prisma.fixtureVersion.findFirst({
      where: { tournamentId, categoryId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nuevaVersion = (ultimaVersion?.version || 0) + 1;
    // Crear FixtureVersion
    const fixtureVersion = await this.prisma.fixtureVersion.create({
      data: {
        tournamentId,
        categoryId,
        version: nuevaVersion,
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

        // MVP: Asignar slot (cancha y horario) si está disponible y NO es BYE
        // Buscar slot por fase y orden del partido
        if (!partido.esBye && slots && slots.length > 0) {
          const slot = slots.find(s => s.fase === partido.fase && s.ordenPartido === partido.orden);
          
          if (slot) {
            createData.torneoCanchaId = slot.torneoCanchaId;
            // FIX: fechaProgramada ahora es String YYYY-MM-DD directamente
            createData.fechaProgramada = slot.fecha;
            createData.horaProgramada = slot.horaInicio;
            createData.horaFinEstimada = slot.horaFin;
          }
        }

        const created = await this.prisma.match.create({
          data: createData,
        });
        idMap.set(partido.id, created.id);

        // ACTUALIZAR SLOT con matchId para poder liberarlo al re-sortear
        if (!partido.esBye && createData.fechaProgramada && createData.horaProgramada) {
          await this.prisma.torneoSlot.updateMany({
            where: {
              torneoCanchaId: createData.torneoCanchaId,
              disponibilidad: {
                fecha: createData.fechaProgramada,
                tournamentId,
              },
              horaInicio: createData.horaProgramada,
            },
            data: {
              matchId: created.id,
              estado: 'OCUPADO',
            },
          });
        }

        // Notificar programación del partido si tiene slot asignado (y no es BYE)
        if (!partido.esBye && createData.fechaProgramada && createData.horaProgramada) {
          await this.notificacionesService.notificarPartidoProgramado(created.id);
        }
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
            
          }
        }
      }
    }

    // Verificar partidos creados
    const partidosCreados = await this.prisma.match.count({
      where: { fixtureVersionId: fixtureVersion.id }
    });
    return fixtureVersion.id;
  }
}
