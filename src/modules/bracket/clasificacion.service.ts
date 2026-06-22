import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramacionService } from '../programacion/programacion.service';
import { construirOrigenLabels, FASE_LEGIBLE } from './bracket-labels';
import { ReaccionesFeedService } from './reacciones-feed.service';
import { esReaccionable } from './reacciones-feed.util';

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
    private reaccionesService: ReaccionesFeedService,
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

  /**
   * AGENDA PROYECTADA del jugador logueado.
   * Para cada inscripción activa en torneos con cuadro, traza:
   *  - próximo partido (real),
   *  - camino "si ganás" siguiendo partidoSiguienteId hasta la final,
   *  - bifurcación "si perdés" (repechaje) vía partidoPerdedorSiguienteId.
   * Los horarios futuros son PREVISTOS (el cuadro es determinístico).
   */
  async obtenerAgendaJugador(userId: string) {
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: {
        OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
        estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO'] },
      },
      include: {
        category: { select: { nombre: true } },
        tournament: { select: { id: true, nombre: true } },
      },
    });

    const cancha = {
      include: { sedeCancha: { include: { sede: { select: { nombre: true } } } } },
    };
    const apellidoSel = { select: { apellido: true } };
    const inscSel = {
      select: { id: true, jugador1: apellidoSel, jugador2: apellidoSel },
    };

    const agendas: any[] = [];

    for (const insc of inscripciones) {
      const matches = await this.prisma.match.findMany({
        where: { fixtureVersion: { tournamentId: insc.tournamentId, categoryId: insc.categoryId } },
        include: { torneoCancha: cancha, inscripcion1: inscSel, inscripcion2: inscSel },
      });
      if (matches.length === 0) continue;

      const byId = new Map<string, any>(matches.map((m) => [m.id, m]));
      const origenLabels = construirOrigenLabels(matches as any);

      const FINALIZADOS = ['FINALIZADO', 'WO', 'RETIRADO', 'DESCALIFICADO'];
      const sus = (matches as any[]).filter(
        (m) => m.inscripcion1Id === insc.id || m.inscripcion2Id === insc.id,
      );

      // Rival de un partido visto desde el lado del jugador (1 o 2).
      const rivalDe = (m: any, ladoJugador: number | null): string | null => {
        if (!ladoJugador) return null;
        const otro = ladoJugador === 1 ? 2 : 1;
        const inscOtro = otro === 1 ? m.inscripcion1 : m.inscripcion2;
        if (inscOtro) {
          return `${inscOtro.jugador1.apellido}/${inscOtro.jugador2?.apellido ?? ''}`.replace(/\/$/, '');
        }
        const lab = origenLabels.get(m.id);
        return otro === 1 ? lab?.origen1 ?? null : lab?.origen2 ?? null;
      };

      const nodo = (m: any, ladoJugador: number | null) => ({
        fase: FASE_LEGIBLE[m.ronda] || m.ronda,
        fecha: m.fechaProgramada,
        hora: m.horaProgramada,
        cancha: m.torneoCancha?.sedeCancha?.nombre ?? null,
        sede: m.torneoCancha?.sedeCancha?.sede?.nombre ?? null,
        rival: rivalDe(m, ladoJugador),
        programado: !!(m.fechaProgramada && m.horaProgramada),
      });

      const ladoEn = (m: any) => (m.inscripcion1Id === insc.id ? 1 : m.inscripcion2Id === insc.id ? 2 : null);

      // Próximo partido = el primero NO finalizado del jugador (por fecha/hora).
      const pendientes = sus
        .filter((m) => !FINALIZADOS.includes(m.estado))
        .sort((a, b) =>
          (a.fechaProgramada || '9').localeCompare(b.fechaProgramada || '9') ||
          (a.horaProgramada || '9').localeCompare(b.horaProgramada || '9'),
        );
      const actual = pendientes[0] || null;

      // Camino "si ganás": seguir partidoSiguienteId desde el actual.
      const siGanas: any[] = [];
      let cur = actual;
      const visto = new Set<string>();
      while (cur?.partidoSiguienteId && !visto.has(cur.partidoSiguienteId)) {
        visto.add(cur.partidoSiguienteId);
        const next = byId.get(cur.partidoSiguienteId);
        if (!next) break;
        siGanas.push(nodo(next, cur.posicionEnSiguiente ?? null));
        cur = next;
      }

      // Bifurcación "si perdés": repechaje (partidoPerdedorSiguienteId del actual).
      let siPerdes: any = null;
      if (actual?.partidoPerdedorSiguienteId) {
        const rep = byId.get(actual.partidoPerdedorSiguienteId);
        if (rep) siPerdes = nodo(rep, actual.posicionEnPerdedor ?? null);
      }

      agendas.push({
        torneo: { id: insc.tournament.id, nombre: insc.tournament.nombre },
        categoria: insc.category?.nombre ?? null,
        inscripcionId: insc.id,
        estado: insc.estadoClasificacion || 'PENDIENTE',
        mensaje: this.generarMensajeEstado(insc.estadoClasificacion as EstadoClasificacion),
        proximoPartido: actual ? nodo(actual, ladoEn(actual)) : null,
        siGanas,
        siPerdes,
      });
    }

    return agendas;
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

  /**
   * FEED SOCIAL del jugador (Fase B). Junta la actividad de SU MUNDO de pádel,
   * ordenada por fecha. Sembrado por categoría/ciudad para que nunca esté vacío
   * aunque siga a pocos jugadores; los seguidos suman la capa social real.
   * Fuentes: resultados recientes en su categoría + torneos nuevos en su ciudad +
   * inscripciones recientes de jugadores que sigue.
   */
  async obtenerFeedJugador(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { categoriaActualId: true, ciudad: true },
    });
    if (!user) return [];

    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // últimos 30 días

    const seguidos = await this.prisma.seguimiento.findMany({
      where: { seguidorId: userId },
      select: { seguidoId: true },
    });
    const seguidoIds = seguidos.map((s) => s.seguidoId);

    const nombrePareja = (insc: any): string => {
      if (!insc) return 'Una pareja';
      const j1 = insc.jugador1 ? `${insc.jugador1.nombre} ${insc.jugador1.apellido}` : '';
      const j2 = insc.jugador2 ? `${insc.jugador2.nombre} ${insc.jugador2.apellido}` : '';
      return [j1, j2].filter(Boolean).join(' / ') || 'Una pareja';
    };

    const items: Array<{
      id: string;
      tipo: string;
      fecha: Date;
      titulo: string;
      detalle: string;
      link: string | null;
      duenos: string[];
      fotoUrl?: string | null;
      autorId?: string;
      autorNombre?: string;
      autorFotoUrl?: string | null;
    }> = [];

    // 1) Resultados recientes en tu categoría (prueba social / comparación)
    if (user.categoriaActualId) {
      const matches = await this.prisma.match.findMany({
        where: {
          categoryId: user.categoriaActualId,
          estado: 'FINALIZADO',
          inscripcionGanadoraId: { not: null },
          updatedAt: { gte: desde },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          id: true, ronda: true, updatedAt: true,
          tournament: { select: { nombre: true, slug: true } },
          inscripcionGanadora: {
            select: {
              jugador1Id: true,
              jugador2Id: true,
              jugador1: { select: { nombre: true, apellido: true } },
              jugador2: { select: { nombre: true, apellido: true } },
            },
          },
        },
      });
      for (const m of matches) {
        const g = m.inscripcionGanadora;
        items.push({
          id: `r-${m.id}`,
          tipo: 'resultado',
          fecha: m.updatedAt,
          titulo: `${nombrePareja(m.inscripcionGanadora)} ganó en ${m.tournament?.nombre ?? 'un torneo'}`,
          detalle: `${m.ronda} · tu categoría`,
          link: m.tournament?.slug ? `/t/${m.tournament.slug}` : null,
          duenos: [g?.jugador1Id, g?.jugador2Id].filter((x): x is string => !!x),
        });
      }
    }

    // 2) Torneos nuevos en tu ciudad (descubrir / FOMO)
    if (user.ciudad) {
      const torneos = await this.prisma.tournament.findMany({
        where: { estado: 'PUBLICADO', ciudad: user.ciudad, createdAt: { gte: desde } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, nombre: true, slug: true, ciudad: true, createdAt: true },
      });
      for (const t of torneos) {
        items.push({
          id: `t-${t.id}`,
          tipo: 'torneo_nuevo',
          fecha: t.createdAt,
          titulo: `Nuevo torneo en ${t.ciudad}: ${t.nombre}`,
          detalle: 'Inscripciones abiertas',
          link: `/t/${t.slug}`,
          duenos: [],
        });
      }
    }

    // 3) Inscripciones recientes de jugadores que seguís (capa social real)
    if (seguidoIds.length > 0) {
      const inscripciones = await this.prisma.inscripcion.findMany({
        where: {
          OR: [{ jugador1Id: { in: seguidoIds } }, { jugador2Id: { in: seguidoIds } }],
          estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO'] },
          createdAt: { gte: desde },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true, createdAt: true, jugador1Id: true, jugador2Id: true,
          jugador1: { select: { nombre: true, apellido: true } },
          jugador2: { select: { nombre: true, apellido: true } },
          tournament: { select: { nombre: true, slug: true } },
          category: { select: { nombre: true } },
        },
      });
      for (const i of inscripciones) {
        const seg = seguidoIds.includes(i.jugador1Id) ? i.jugador1 : i.jugador2;
        const nombre = seg ? `${seg.nombre} ${seg.apellido}` : 'Alguien que seguís';
        items.push({
          id: `i-${i.id}`,
          tipo: 'inscripcion_seguido',
          fecha: i.createdAt,
          titulo: `${nombre} se inscribió a ${i.tournament?.nombre ?? 'un torneo'}`,
          detalle: i.category?.nombre ?? '',
          link: i.tournament?.slug ? `/t/${i.tournament.slug}` : null,
          duenos: [i.jugador1Id, i.jugador2Id].filter((x): x is string => !!x),
        });
      }
    }

    // 4) Publicaciones del jugador y de quienes sigue (posts con foto)
    const autoresIds = [userId, ...seguidoIds];
    const publicaciones = await this.prisma.publicacionFeed.findMany({
      where: { userId: { in: autoresIds }, createdAt: { gte: desde } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        contenido: true,
        createdAt: true,
        userId: true,
        foto: { select: { urlImagen: true } },
        user: { select: { nombre: true, apellido: true, fotoUrl: true } },
      },
    });
    for (const p of publicaciones) {
      items.push({
        id: `p-${p.id}`,
        tipo: 'publicacion',
        fecha: p.createdAt,
        titulo: `${p.user?.nombre ?? ''} ${p.user?.apellido ?? ''}`.trim() || 'Jugador',
        detalle: p.contenido ?? '',
        link: null,
        duenos: [p.userId],
        fotoUrl: p.foto?.urlImagen ?? null,
        autorId: p.userId,
        autorNombre: `${p.user?.nombre ?? ''} ${p.user?.apellido ?? ''}`.trim(),
        autorFotoUrl: p.user?.fotoUrl ?? null,
      });
    }

    const top = items
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .slice(0, 15);

    // Reacciones: contador (público) + si yo ya reaccioné, en lote para los ítems reaccionables.
    const idsReaccionables = top.filter((it) => esReaccionable(it.id)).map((it) => it.id);
    const resumen = await this.reaccionesService.resumen(idsReaccionables, userId);

    return top.map((it) => {
      const { duenos, fecha, ...resto } = it;
      const r = resumen.get(it.id);
      return {
        ...resto,
        fecha: fecha.toISOString(),
        reaccionable: esReaccionable(it.id),
        reaccionesCount: r?.count ?? 0,
        yaReaccione: r?.yaReaccione ?? false,
        esDueno: duenos.includes(userId), // puede ver quiénes reaccionaron
      };
    });
  }
}
