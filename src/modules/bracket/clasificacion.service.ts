import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramacionService } from '../programacion/programacion.service';

export type EstadoClasificacion = 
  | 'PENDIENTE' 
  | 'CLASIFICADO_DIRECTO' 
  | 'REPECHAJE' 
  | 'EN_BRACKET' 
  | 'ELIMINADO';

interface ConfigClasificacion {
  totalParejas: number;
  slotsDirectos: number;
  slotsRepechaje: number;
  eliminacionesNecesarias: number;
}

@Injectable()
export class ClasificacionService {
  constructor(
    private prisma: PrismaService,
    private programacionService: ProgramacionService,
  ) {}

  /**
   * Recalcula los estados de clasificación de todas las inscripciones de una categoría
   * Se ejecuta cada vez que termina un partido de ZONA o REPECHAJE
   */
  async recalcularEstados(
    tournamentId: string,
    categoryId: string,
  ): Promise<void> {
    console.log(`[ClasificacionService] Recalculando estados para cat ${categoryId}`);

    // 1. Obtener config del bracket desde el fixture
    const config = await this.obtenerConfigClasificacion(tournamentId, categoryId);
    if (!config) {
      console.log(`[ClasificacionService] No se encontró config para cat ${categoryId}`);
      return;
    }

    // 2. Obtener todos los partidos de ZONA terminados
    const partidosZona = await this.prisma.match.findMany({
      where: {
        fixtureVersion: {
          tournamentId,
          categoryId,
        },
        ronda: 'ZONA',
        estado: { in: ['FINALIZADO', 'WO', 'RETIRADO', 'DESCALIFICADO'] },
        inscripcionGanadoraId: { not: null },
      },
      orderBy: {
        horaFinReal: 'asc', // Orden de finalización
      },
      include: {
        inscripcionGanadora: true,
        inscripcionPerdedora: true,
      },
    });

    // 3. Obtener partidos de REPECHAJE terminados
    const partidosRepechaje = await this.prisma.match.findMany({
      where: {
        fixtureVersion: {
          tournamentId,
          categoryId,
        },
        ronda: 'REPECHAJE',
        estado: { in: ['FINALIZADO', 'WO', 'RETIRADO', 'DESCALIFICADO'] },
        inscripcionGanadoraId: { not: null },
      },
      include: {
        inscripcionGanadora: true,
        inscripcionPerdedora: true,
      },
    });

    // 4. Calcular posiciones
    const ganadoresZona = partidosZona.map(p => ({
      inscripcionId: p.inscripcionGanadoraId!,
      horaFin: p.horaFinReal,
    }));

    const perdedoresZona = partidosZona
      .filter(p => p.inscripcionPerdedoraId)
      .map(p => ({
        inscripcionId: p.inscripcionPerdedoraId!,
        horaFin: p.horaFinReal,
      }));

    // 5. Asignar estados a ganadores de ZONA
    for (let i = 0; i < ganadoresZona.length; i++) {
      const { inscripcionId } = ganadoresZona[i];
      const posicion = i + 1; // 1-based

      let estado: EstadoClasificacion;
      let ronda: string;

      if (posicion <= config.slotsDirectos) {
        estado = 'CLASIFICADO_DIRECTO';
        ronda = 'OCTAVOS'; // O la primera ronda del bracket
      } else if (posicion <= config.slotsDirectos + config.slotsRepechaje) {
        estado = 'REPECHAJE';
        ronda = 'REPECHAJE';
      } else {
        // No debería pasar, pero por seguridad
        estado = 'ELIMINADO';
        ronda = 'ZONA';
      }

      await this.actualizarEstadoInscripcion(inscripcionId, estado, posicion, ronda);

      // Si clasificó directo, programar su partido de bracket automáticamente
      if (estado === 'CLASIFICADO_DIRECTO') {
        await this.programarPartidoBracket(tournamentId, inscripcionId, categoryId);
      }
    }

    // 6. Asignar estados a perdedores de ZONA → van a REPECHAJE
    for (const perdedor of perdedoresZona) {
      // Verificar si ya perdió en repechaje
      const perdioRepechaje = partidosRepechaje.some(
        p => p.inscripcionPerdedoraId === perdedor.inscripcionId
      );

      if (perdioRepechaje) {
        await this.actualizarEstadoInscripcion(
          perdedor.inscripcionId,
          'ELIMINADO',
          null,
          'REPECHAJE',
        );
      } else {
        await this.actualizarEstadoInscripcion(
          perdedor.inscripcionId,
          'REPECHAJE',
          null,
          'REPECHAJE',
        );
      }
    }

    // 7. Procesar ganadores de REPECHAJE → pasan al bracket
    for (const partido of partidosRepechaje) {
      if (partido.inscripcionGanadoraId) {
        await this.actualizarEstadoInscripcion(
          partido.inscripcionGanadoraId,
          'EN_BRACKET',
          null,
          'OCTAVOS', // O la ronda que corresponda
        );

        // Programar su partido de bracket
        await this.programarPartidoBracket(
          tournamentId,
          partido.inscripcionGanadoraId,
          categoryId,
        );
      }
    }

    console.log(`[ClasificacionService] Estados actualizados para cat ${categoryId}`);
  }

  /**
   * Obtiene la configuración de clasificación desde la definición del bracket
   */
  private async obtenerConfigClasificacion(
    tournamentId: string,
    categoryId: string,
  ): Promise<ConfigClasificacion | null> {
    const fixtureVersion = await this.prisma.fixtureVersion.findFirst({
      where: {
        tournamentId,
        categoryId,
      },
      select: {
        definicion: true,
      },
    });

    if (!fixtureVersion?.definicion) {
      return null;
    }

    const definicion = fixtureVersion.definicion as any;
    const config = definicion.config;

    if (!config) {
      return null;
    }

    return {
      totalParejas: config.totalParejas || 0,
      slotsDirectos: config.ganadoresZona || 0,
      slotsRepechaje: config.ganadoresRepechaje || 0,
      eliminacionesNecesarias: config.perdedoresDirectos || 0,
    };
  }

  /**
   * Actualiza el estado de clasificación de una inscripción
   */
  private async actualizarEstadoInscripcion(
    inscripcionId: string,
    estado: EstadoClasificacion,
    posicion: number | null,
    ronda: string,
  ): Promise<void> {
    await this.prisma.inscripcion.update({
      where: { id: inscripcionId },
      data: {
        estadoClasificacion: estado,
        posicionClasificacion: posicion,
        rondaClasificacion: ronda,
      },
    });
  }

  /**
   * Programa automáticamente el partido de bracket para un clasificado
   */
  private async programarPartidoBracket(
    tournamentId: string,
    inscripcionId: string,
    categoryId: string,
  ): Promise<void> {
    try {
      // Buscar el partido del bracket donde está asignada esta inscripción
      const partido = await this.prisma.match.findFirst({
        where: {
          fixtureVersion: {
            tournamentId,
            categoryId,
          },
          ronda: { not: 'ZONA' },
          OR: [
            { inscripcion1Id: inscripcionId },
            { inscripcion2Id: inscripcionId },
          ],
          // No programado aún
          torneoCanchaId: null,
        },
      });

      if (!partido) {
        return; // Ya programado o no tiene partido asignado
      }

      // Verificar si el partido está completo (tiene ambas parejas)
      if (!partido.inscripcion1Id || !partido.inscripcion2Id) {
        return; // Esperar a que se complete el partido
      }

      // Programar automáticamente
      const resultado = await this.programacionService.programarPartidoAutomatico(
        tournamentId,
        partido.id,
      );

      if (resultado.success) {
        console.log(`[ClasificacionService] Partido ${partido.id} programado automáticamente`, {
          fecha: resultado.asignacion?.fecha,
          hora: resultado.asignacion?.horaInicio,
        });
      }
    } catch (error) {
      console.error(`[ClasificacionService] Error programando partido:`, error);
      // No lanzar error para no interrumpir el flujo
    }
  }

  /**
   * Obtiene el estado de clasificación de una inscripción específica
   */
  async obtenerEstadoInscripcion(inscripcionId: string) {
    const inscripcion = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true } },
        category: { select: { id: true, nombre: true } },
        tournament: { select: { id: true, nombre: true } },
      },
    });

    if (!inscripcion) {
      return null;
    }

    // Buscar próximo partido programado
    const proximoPartido = await this.prisma.match.findFirst({
      where: {
        fixtureVersion: {
          tournamentId: inscripcion.tournamentId,
          categoryId: inscripcion.categoryId,
        },
        OR: [
          { inscripcion1Id: inscripcionId },
          { inscripcion2Id: inscripcionId },
        ],
        torneoCanchaId: { not: null },
        fechaProgramada: { not: null },
        horaProgramada: { not: null },
        estado: 'PROGRAMADO',
      },
      include: {
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: { select: { nombre: true } },
              },
            },
          },
        },
      },
      orderBy: {
        fechaProgramada: 'asc',
      },
    });

    return {
      inscripcion: {
        id: inscripcion.id,
        jugadores: `${inscripcion.jugador1.apellido} ${inscripcion.jugador1.nombre.charAt(0)}. / ${inscripcion.jugador2?.apellido || ''} ${inscripcion.jugador2?.nombre.charAt(0) || ''}`,
      },
      estado: inscripcion.estadoClasificacion || 'PENDIENTE',
      posicion: inscripcion.posicionClasificacion,
      ronda: inscripcion.rondaClasificacion,
      mensaje: this.generarMensajeEstado(inscripcion.estadoClasificacion as EstadoClasificacion),
      proximoPartido: proximoPartido ? {
        fecha: proximoPartido.fechaProgramada,
        hora: proximoPartido.horaProgramada,
        cancha: proximoPartido.torneoCancha?.sedeCancha.nombre,
        sede: proximoPartido.torneoCancha?.sedeCancha.sede.nombre,
        fase: proximoPartido.ronda,
      } : null,
    };
  }

  /**
   * Obtiene el estado de clasificación de todas las inscripciones de una categoría
   */
  async obtenerEstadosCategoria(tournamentId: string, categoryId: string) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId,
        categoryId,
        estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO'] },
      },
      include: {
        jugador1: { select: { nombre: true, apellido: true } },
        jugador2: { select: { nombre: true, apellido: true } },
      },
      orderBy: [
        { estadoClasificacion: 'asc' },
        { posicionClasificacion: 'asc' },
      ],
    });

    return inscripciones.map(i => ({
      id: i.id,
      jugadores: `${i.jugador1.apellido} ${i.jugador1.nombre.charAt(0)}. / ${i.jugador2?.apellido || ''} ${i.jugador2?.nombre.charAt(0) || ''}`,
      estado: i.estadoClasificacion || 'PENDIENTE',
      posicion: i.posicionClasificacion,
      ronda: i.rondaClasificacion,
      mensaje: this.generarMensajeEstado(i.estadoClasificacion as EstadoClasificacion),
    }));
  }

  private generarMensajeEstado(estado: EstadoClasificacion | null): string {
    switch (estado) {
      case 'CLASIFICADO_DIRECTO':
        return '✅ Pasaste directo al bracket';
      case 'REPECHAJE':
        return '⚠️ Vas a jugar repechaje';
      case 'EN_BRACKET':
        return '🎾 Estás en el bracket principal';
      case 'ELIMINADO':
        return '❌ Eliminado';
      default:
        return '⏳ Esperando resultados';
    }
  }
}
