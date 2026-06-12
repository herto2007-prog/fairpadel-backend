import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AmericanoComunService } from './americano-comun.service';
import { ConfigAmericano } from './americano.service';

@Injectable()
export class AmericanoRondasService {
  constructor(
    private prisma: PrismaService,
    private comun: AmericanoComunService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // RONDAS Y PAREJAS
  // ═══════════════════════════════════════════════════════════════════════════════

  async iniciarPrimeraRonda(torneoId: string, organizadorId: string) {
    await this.comun.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { americanosGrupo: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.comun.verificarPermiso(torneoId, organizadorId);

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    const formatoAmericano = config.formatoAmericano ?? 'clasico';
    const esFormatoIndividual = ['clasico', 'porCategorias'].includes(formatoAmericano);
    const esFormatoParejas = ['parejasSinCat', 'parejasConCat', 'sumas', 'mixto'].includes(formatoAmericano);

    // Validar que no existan rondas previas
    const rondasPrevias = await this.prisma.americanoRonda.count({ where: { torneoId } });
    if (rondasPrevias > 0) {
      throw new BadRequestException('Ya existen rondas iniciadas');
    }

    // Obtener inscripciones con grupo
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId: torneoId, estado: 'CONFIRMADA' },
      include: { jugador1: true, jugador2: true, grupo: true },
    });

    // Agrupar inscripciones por grupo
    const inscripcionesPorGrupo = new Map<string, typeof inscripciones>();
    for (const insc of inscripciones) {
      if (!insc.grupoId) continue;
      if (!inscripcionesPorGrupo.has(insc.grupoId)) {
        inscripcionesPorGrupo.set(insc.grupoId, []);
      }
      inscripcionesPorGrupo.get(insc.grupoId)!.push(insc);
    }

    // Validar mínimos por grupo
    const gruposFaltantes: { nombre: string; inscriptos: number; minimo: number }[] = [];
    for (const [grupoId, inscs] of inscripcionesPorGrupo) {
      if (esFormatoIndividual) {
        if (inscs.length < 4) {
          gruposFaltantes.push({ nombre: inscs[0].grupo!.nombre, inscriptos: inscs.length, minimo: 4 });
        }
      } else {
        const numParejas = inscs.filter(i => i.jugador2Id).length;
        if (numParejas < 2) {
          gruposFaltantes.push({ nombre: inscs[0].grupo!.nombre, inscriptos: numParejas, minimo: 2 });
        }
      }
    }

    if (gruposFaltantes.length > 0) {
      throw new BadRequestException({
        message: 'Algunos grupos no alcanzan el mínimo de inscriptos para iniciar',
        code: 'GRUPOS_INSUFICIENTES',
        grupos: gruposFaltantes,
      });
    }

    // Si es automático, calcular y fijar el máximo de rondas
    const numRondasMax = await this.getNumRondasMax(torneoId, config);
    if (config.modoJuego && config.modoJuego.numRondas === 'automatico') {
      config.modoJuego.numRondas = numRondasMax;
    }

    const canchasSimultaneas = config.modoJuego?.canchasSimultaneas ?? 1;
    const rondasCreadas: any[] = [];
    const todosLosPartidos: { rondaId: string; parejaAId: string; parejaBId: string; cancha: number; estado: string }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const [grupoId, inscs] of inscripcionesPorGrupo) {
        // Crear ronda 1 para este grupo
        const ronda = await tx.americanoRonda.create({
          data: { numero: 1, torneoId, grupoId, estado: 'EN_JUEGO' },
        });
        rondasCreadas.push(ronda);

        let parejasCreadas: { id: string; jugador1Id: string; jugador2Id: string }[] = [];
        let parejaByeId: string | null = null;

        if (esFormatoParejas) {
          // Usar las parejas definidas en las inscripciones del grupo
          const inscripcionesConPareja = inscs
            .filter(i => i.jugador2Id)
            .sort((a, b) => a.jugador1Id.localeCompare(b.jugador1Id));

          // Bye rotativo: si impar, la primera pareja descansa en ronda 1
          if (inscripcionesConPareja.length % 2 === 1) {
            const byeIndex = 0; // (numeroRonda - 1) % N = 0
            parejaByeId = inscripcionesConPareja[byeIndex].id;
          }

          for (const insc of inscripcionesConPareja) {
            const p = await tx.americanoParejaRonda.create({
              data: {
                rondaId: ronda.id,
                jugador1Id: insc.jugador1Id,
                jugador2Id: insc.jugador2Id!,
              },
            });
            parejasCreadas.push({ id: p.id, jugador1Id: insc.jugador1Id, jugador2Id: insc.jugador2Id! });
          }

          // Excluir pareja en bye del emparejamiento de partidos
          if (parejaByeId) {
            parejasCreadas = parejasCreadas.filter(p => p.id !== parejaByeId);
          }
        } else {
          // Generar parejas aleatorias (sin repetir companero)
          const jugadoresIds = inscs.map(i => i.jugador1Id).sort();

          // Bye rotativo: si impar, el primero descansa en ronda 1
          let jugadorBye: string | null = null;
          if (jugadoresIds.length % 2 === 1) {
            const byeIndex = 0; // (numeroRonda - 1) % N = 0
            jugadorBye = jugadoresIds.splice(byeIndex, 1)[0];
          }

          const parejasJugadores = this.generarParejasAleatorias(jugadoresIds);
          for (const [j1, j2] of parejasJugadores) {
            const p = await tx.americanoParejaRonda.create({
              data: {
                rondaId: ronda.id,
                jugador1Id: j1,
                jugador2Id: j2,
              },
            });
            parejasCreadas.push({ id: p.id, jugador1Id: j1, jugador2Id: j2 });
          }
        }

        // Acumular partidos para asignación global de canchas
        for (let i = 0; i < parejasCreadas.length; i += 2) {
          if (i + 1 < parejasCreadas.length) {
            todosLosPartidos.push({
              rondaId: ronda.id,
              parejaAId: parejasCreadas[i].id,
              parejaBId: parejasCreadas[i + 1].id,
              cancha: 0, // se asigna luego
              estado: 'PENDIENTE',
            });
          }
        }

        // Inicializar puntajes en 0 para todos los jugadores del grupo
        const jugadoresDelGrupo = esFormatoParejas
          ? inscs.flatMap(i => [i.jugador1Id, i.jugador2Id].filter(Boolean))
          : inscs.map(i => i.jugador1Id);
        const uniqueJugadores = [...new Set(jugadoresDelGrupo)];
        for (const jugadorId of uniqueJugadores) {
          await tx.americanoPuntaje.create({
            data: {
              torneoId,
              rondaId: ronda.id,
              grupoId,
              jugadorId,
              puntos: 0,
              partidosJugados: 0,
              partidosGanados: 0,
              partidosPerdidos: 0,
              setsGanados: 0,
              setsPerdidos: 0,
              gamesGanados: 0,
              gamesPerdidos: 0,
              diferenciaGames: 0,
            },
          });
        }
      }

      // Asignar canchas globalmente entre todos los grupos
      for (let i = 0; i < todosLosPartidos.length; i++) {
        todosLosPartidos[i].cancha = (Math.floor(i / 2) % canchasSimultaneas) + 1;
      }

      if (todosLosPartidos.length > 0) {
        await tx.americanoPartido.createMany({ data: todosLosPartidos });
      }

      // Actualizar config del torneo
      config.rondaActual = 1;
      await tx.tournament.update({
        where: { id: torneoId },
        data: {
          estado: 'EN_CURSO',
          configAmericano: config as any,
        },
      });
    });

    const rondasCompletas = await Promise.all(
      rondasCreadas.map(r => this.getRondaConParejas(r.id)),
    );
    return rondasCompletas;
  }

  async generarSiguienteRonda(torneoId: string, organizadorId: string) {
    await this.comun.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { americanosGrupo: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.comun.verificarPermiso(torneoId, organizadorId);

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    const formatoAmericano = config.formatoAmericano ?? 'clasico';
    const esFormatoIndividual = ['clasico', 'porCategorias'].includes(formatoAmericano);
    const esFormatoParejas = ['parejasSinCat', 'parejasConCat', 'sumas', 'mixto'].includes(formatoAmericano);

    // Obtener grupos con su última ronda e inscripciones
    const grupos = await this.prisma.americanoGrupo.findMany({
      where: { torneoId },
      include: {
        rondas: { orderBy: { numero: 'desc' }, take: 1, include: { partidos: true } },
        inscripciones: { where: { estado: 'CONFIRMADA' }, include: { jugador1: true, jugador2: true } },
      },
    });

    if (grupos.length === 0) {
      throw new BadRequestException('No hay grupos configurados para este torneo');
    }

    // Validar que todos los grupos tengan al menos una ronda
    const gruposSinRonda = grupos.filter(g => g.rondas.length === 0);
    if (gruposSinRonda.length > 0) {
      throw new BadRequestException({
        message: 'Algunos grupos no tienen rondas iniciadas',
        grupos: gruposSinRonda.map(g => g.nombre),
      });
    }

    // Verificar que la última ronda de cada grupo esté lista para siguiente
    const gruposNoListos = grupos.filter(g => {
      const ultima = g.rondas[0];
      const partidosFinalizados = ultima.partidos.filter(p => p.estado === 'FINALIZADO').length;
      return ultima.estado !== 'FINALIZADA' && (ultima.partidos.length - partidosFinalizados > 1);
    });

    if (gruposNoListos.length > 0) {
      throw new BadRequestException({
        message: 'Algunos grupos tienen rondas sin finalizar',
        grupos: gruposNoListos.map(g => g.nombre),
      });
    }

    const nuevaRondaNumero = grupos[0].rondas[0].numero + 1;
    const numRondasMax = await this.getNumRondasMax(torneoId, config);

    if (nuevaRondaNumero > numRondasMax) {
      throw new BadRequestException(`Todas las rondas posibles ya fueron jugadas. Máximo: ${numRondasMax} rondas.`);
    }

    const canchasSimultaneas = config.modoJuego?.canchasSimultaneas ?? 1;
    const rondasCreadas: any[] = [];
    const todosLosPartidos: { rondaId: string; parejaAId: string; parejaBId: string; cancha: number; estado: string }[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const grupo of grupos) {
        const ultimaRonda = grupo.rondas[0];

        // Crear nueva ronda para este grupo
        const nuevaRonda = await tx.americanoRonda.create({
          data: {
            numero: nuevaRondaNumero,
            torneoId,
            grupoId: grupo.id,
            estado: 'EN_JUEGO',
          },
        });
        rondasCreadas.push(nuevaRonda);

        let parejasCreadas: { id: string; jugador1Id: string; jugador2Id: string }[] = [];

        if (esFormatoParejas) {
          // Obtener parejas de la primera ronda del grupo
          const primeraRonda = await tx.americanoRonda.findFirst({
            where: { torneoId, grupoId: grupo.id },
            orderBy: { numero: 'asc' },
            include: { parejas: true },
          });
          if (!primeraRonda) continue;

          const parejasIds = primeraRonda.parejas.map(p => p.id);
          const enfrentamientos = this.roundRobinParejas(parejasIds, nuevaRondaNumero);

          for (const [idA, idB] of enfrentamientos) {
            const parA = primeraRonda.parejas.find(p => p.id === idA)!;
            const parB = primeraRonda.parejas.find(p => p.id === idB)!;
            const pA = await tx.americanoParejaRonda.create({
              data: { rondaId: nuevaRonda.id, jugador1Id: parA.jugador1Id, jugador2Id: parA.jugador2Id },
            });
            const pB = await tx.americanoParejaRonda.create({
              data: { rondaId: nuevaRonda.id, jugador1Id: parB.jugador1Id, jugador2Id: parB.jugador2Id },
            });
            parejasCreadas.push(pA, pB);
            todosLosPartidos.push({
              rondaId: nuevaRonda.id,
              parejaAId: pA.id,
              parejaBId: pB.id,
              cancha: 0,
              estado: 'PENDIENTE',
            });
          }
        } else {
          // Individuales: ranking del grupo + serpiente
          const puntajesAnteriores = await tx.americanoPuntaje.findMany({
            where: { torneoId, rondaId: ultimaRonda.id, grupoId: grupo.id },
            orderBy: [{ puntos: 'desc' }, { diferenciaGames: 'desc' }, { gamesGanados: 'desc' }],
          });
          const rankingIds = puntajesAnteriores.map(p => p.jugadorId);

          // Bye rotativo solo si hay número impar de jugadores
          let jugadoresSinBye = rankingIds;
          if (rankingIds.length % 2 === 1) {
            const byeIndex = (nuevaRondaNumero - 1) % rankingIds.length;
            jugadoresSinBye = rankingIds.filter((_, idx) => idx !== byeIndex);
          }

          const historialParejas = await this.obtenerHistorialParejasPorGrupo(grupo.id);
          const parejasJugadores = this.generarParejasPorRanking(jugadoresSinBye, historialParejas);

          for (const [j1, j2] of parejasJugadores) {
            const p = await tx.americanoParejaRonda.create({
              data: { rondaId: nuevaRonda.id, jugador1Id: j1, jugador2Id: j2 },
            });
            parejasCreadas.push({ id: p.id, jugador1Id: j1, jugador2Id: j2 });
          }

          for (let i = 0; i < parejasCreadas.length; i += 2) {
            if (i + 1 < parejasCreadas.length) {
              todosLosPartidos.push({
                rondaId: nuevaRonda.id,
                parejaAId: parejasCreadas[i].id,
                parejaBId: parejasCreadas[i + 1].id,
                cancha: 0,
                estado: 'PENDIENTE',
              });
            }
          }
        }

        // Inicializar puntajes acumulados para esta ronda
        const jugadoresDelGrupo = esFormatoParejas
          ? grupo.inscripciones.flatMap(i => [i.jugador1Id, i.jugador2Id].filter(Boolean))
          : grupo.inscripciones.map(i => i.jugador1Id);
        const uniqueJugadores = [...new Set(jugadoresDelGrupo)];

        for (const jugadorId of uniqueJugadores) {
          const puntajeAnterior = await tx.americanoPuntaje.findFirst({
            where: { torneoId, rondaId: ultimaRonda.id, jugadorId, grupoId: grupo.id },
          });

          await tx.americanoPuntaje.create({
            data: {
              torneoId,
              rondaId: nuevaRonda.id,
              grupoId: grupo.id,
              jugadorId,
              puntos: puntajeAnterior?.puntos ?? 0,
              partidosJugados: puntajeAnterior?.partidosJugados ?? 0,
              partidosGanados: puntajeAnterior?.partidosGanados ?? 0,
              partidosPerdidos: puntajeAnterior?.partidosPerdidos ?? 0,
              setsGanados: puntajeAnterior?.setsGanados ?? 0,
              setsPerdidos: puntajeAnterior?.setsPerdidos ?? 0,
              gamesGanados: puntajeAnterior?.gamesGanados ?? 0,
              gamesPerdidos: puntajeAnterior?.gamesPerdidos ?? 0,
              diferenciaGames: puntajeAnterior?.diferenciaGames ?? 0,
            },
          });
        }
      }

      // Asignar canchas globalmente entre todos los grupos
      for (let i = 0; i < todosLosPartidos.length; i++) {
        todosLosPartidos[i].cancha = (Math.floor(i / 2) % canchasSimultaneas) + 1;
      }

      if (todosLosPartidos.length > 0) {
        await tx.americanoPartido.createMany({ data: todosLosPartidos });
      }

      // Actualizar config
      config.rondaActual = nuevaRondaNumero;
      await tx.tournament.update({
        where: { id: torneoId },
        data: { configAmericano: config as any },
      });
    });

    const rondasCompletas = await Promise.all(
      rondasCreadas.map(r => this.getRondaConParejas(r.id)),
    );
    return rondasCompletas;
  }

  async finalizarRonda(torneoId: string, rondaId: string, organizadorId: string) {
    await this.comun.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.comun.verificarPermiso(torneoId, organizadorId);

    const ronda = await this.prisma.americanoRonda.findUnique({
      where: { id: rondaId },
      include: { puntajes: true },
    });

    if (!ronda || ronda.torneoId !== torneoId) {
      throw new NotFoundException('Ronda no encontrada');
    }

    // Calcular posiciones finales de la ronda
    const puntajesOrdenados = ronda.puntajes.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.diferenciaGames !== a.diferenciaGames) return b.diferenciaGames - a.diferenciaGames;
      return b.gamesGanados - a.gamesGanados;
    });

    for (let i = 0; i < puntajesOrdenados.length; i++) {
      await this.prisma.americanoPuntaje.update({
        where: { id: puntajesOrdenados[i].id },
        data: { posicion: i + 1 },
      });
    }

    await this.prisma.americanoRonda.update({
      where: { id: rondaId },
      data: { estado: 'FINALIZADA' },
    });

    // Verificar si es la última ronda de TODOS los grupos
    const rondasActivas = await this.prisma.americanoRonda.count({
      where: { torneoId, estado: { in: ['EN_JUEGO', 'PENDIENTE'] } },
    });

    if (rondasActivas === 0) {
      await this.prisma.tournament.update({
        where: { id: torneoId },
        data: { estado: 'FINALIZADO' },
      });
    }

    return { message: 'Ronda finalizada' };
  }

  async getRondaConParejas(rondaId: string) {
    return this.prisma.americanoRonda.findUnique({
      where: { id: rondaId },
      include: {
        parejas: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        partidos: {
          include: {
            parejaA: {
              include: {
                jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
                jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
              },
            },
            parejaB: {
              include: {
                jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
                jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
              },
            },
          },
        },
        puntajes: {
          include: {
            jugador: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
          orderBy: [
            { puntos: 'desc' },
            { diferenciaGames: 'desc' },
          ],
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // CÁLCULO DE RONDAS MÁXIMAS (MODO AUTOMÁTICO)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Calcula el máximo de rondas posibles sin repetir compañeros/enfrentamientos.
   * 
   * Matemática:
   * - N entidades (jugadores individuales o parejas fijas)
   * - En cada ronda se forman floor(N/2) parejas/enfrentamientos
   * - Total de combinaciones únicas = C(N,2) = N*(N-1)/2
   * - Máximo rondas = C(N,2) / floor(N/2)
   * 
   * Simplificado:
   * - N par → N-1
   * - N impar → N
   */
  private calcularRondasMaximas(numEntidades: number): number {
    if (numEntidades < 2) return 0;
    return numEntidades % 2 === 0 ? numEntidades - 1 : numEntidades;
  }

  private async getNumRondasMax(torneoId: string, config: ConfigAmericano): Promise<number> {
    const numRondasConfig = config.modoJuego?.numRondas;
    if (numRondasConfig !== 'automatico') {
      return typeof numRondasConfig === 'number' ? numRondasConfig : parseInt(numRondasConfig as string, 10) || 4;
    }

    // Modo automático: calcular según inscripciones por grupo (usar el mínimo para que todos puedan completar)
    const grupos = await this.prisma.americanoGrupo.findMany({
      where: { torneoId },
      include: { inscripciones: { where: { estado: 'CONFIRMADA' } } },
    });

    const formatoAmericano = config.formatoAmericano ?? 'clasico';
    const esFormatoParejas = ['parejasSinCat', 'parejasConCat', 'sumas', 'mixto'].includes(formatoAmericano);
    let minRondas = Infinity;

    for (const grupo of grupos) {
      const numEntidades = esFormatoParejas
        ? grupo.inscripciones.filter(i => i.jugador2Id).length
        : grupo.inscripciones.length;
      const maxRondasGrupo = this.calcularRondasMaximas(numEntidades);
      if (maxRondasGrupo < minRondas) minRondas = maxRondasGrupo;
    }

    return minRondas === Infinity ? 0 : minRondas;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ALGORITMOS DE PAREJAS
  // ═══════════════════════════════════════════════════════════════════════════════

  private generarParejasAleatorias(jugadores: string[]): [string, string][] {
    // Fisher-Yates shuffle
    const shuffled = [...jugadores];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const parejas: [string, string][] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      parejas.push([shuffled[i], shuffled[i + 1]]);
    }

    // Si hay jugador impar, queda con bye (no se empareja consigo mismo)
    return parejas;
  }

  private async obtenerHistorialParejas(torneoId: string): Promise<Set<string>> {
    const parejas = await this.prisma.americanoParejaRonda.findMany({
      where: {
        ronda: { torneoId },
      },
      select: { jugador1Id: true, jugador2Id: true },
    });

    const historial = new Set<string>();
    for (const p of parejas) {
      const key = [p.jugador1Id, p.jugador2Id].sort().join('-');
      historial.add(key);
    }
    return historial;
  }

  private async obtenerHistorialParejasPorGrupo(grupoId: string): Promise<Set<string>> {
    const parejas = await this.prisma.americanoParejaRonda.findMany({
      where: {
        ronda: { grupoId },
      },
      select: { jugador1Id: true, jugador2Id: true },
    });

    const historial = new Set<string>();
    for (const p of parejas) {
      const key = [p.jugador1Id, p.jugador2Id].sort().join('-');
      historial.add(key);
    }
    return historial;
  }

  private generarParejasPorRanking(
    jugadoresOrdenados: string[],
    historialParejas: Set<string>,
  ): [string, string][] {
    // Estrategia: "serpiente" - 1ro con último, 2do con penúltimo, etc.
    // Si ya jugaron juntos, intentar swap simple
    const n = jugadoresOrdenados.length;
    const parejas: [string, string][] = [];
    const usados = new Set<number>();

    for (let i = 0; i < Math.floor(n / 2); i++) {
      let idxA = i;
      let idxB = n - 1 - i;

      // Evitar emparejar un jugador consigo mismo (número impar de jugadores)
      if (idxA === idxB) continue;

      // Si ya fueron pareja, intentar encontrar alternativa
      const key = [jugadoresOrdenados[idxA], jugadoresOrdenados[idxB]].sort().join('-');
      if (historialParejas.has(key)) {
        // Buscar swap con algún índice no usado
        let encontrado = false;
        for (let swap = i + 1; swap < n && !encontrado; swap++) {
          if (!usados.has(swap) && swap !== idxA) {
            const newKey = [jugadoresOrdenados[idxA], jugadoresOrdenados[swap]].sort().join('-');
            if (!historialParejas.has(newKey)) {
              idxB = swap;
              encontrado = true;
            }
          }
        }
        // Si no se encontró alternativa, se agotaron las combinaciones posibles
        if (!encontrado) {
          throw new BadRequestException(
            'No hay más combinaciones de parejas posibles sin repetir compañeros. ' +
            'El torneo ha alcanzado el máximo de rondas según el número de jugadores.'
          );
        }
      }

      parejas.push([jugadoresOrdenados[idxA], jugadoresOrdenados[idxB]]);
      usados.add(idxA);
      usados.add(idxB);
    }

    return parejas;
  }

  private async crearPartidosDeRonda(
    rondaId: string,
    parejas: { id: string; jugador1Id: string; jugador2Id: string }[],
    canchasSimultaneas: number,
    tx?: any,
  ) {
    if (parejas.length < 2) return;

    // Emparejar parejas: 0 vs 1, 2 vs 3, etc.
    const partidosData: { rondaId: string; parejaAId: string; parejaBId: string; cancha: number; estado: string }[] = [];
    for (let i = 0; i < parejas.length; i += 2) {
      if (i + 1 < parejas.length) {
        const cancha = (Math.floor(i / 2) % canchasSimultaneas) + 1;
        partidosData.push({
          rondaId,
          parejaAId: parejas[i].id,
          parejaBId: parejas[i + 1].id,
          cancha,
          estado: 'PENDIENTE',
        });
      }
    }

    const prismaClient = tx || this.prisma;
    if (partidosData.length > 0) {
      await prismaClient.americanoPartido.createMany({ data: partidosData });
    }
  }

  /**
   * Round-robin circular para parejas fijas.
   * Si N es impar, se agrega un BYE y una pareja descansa por ronda.
   */
  private roundRobinParejas(parejasIds: string[], rondaNumero: number): [string, string][] {
    const n = parejasIds.length;
    if (n < 2) return [];

    const ids = [...parejasIds];
    if (n % 2 === 1) ids.push('BYE');

    const m = ids.length; // ahora es par
    const numRondas = m - 1;
    const rondaIndex = (rondaNumero - 1) % numRondas;

    // Rotar: fijar el primero, rotar el resto rondaIndex veces hacia la derecha
    const cabeza = ids[0];
    const cola = ids.slice(1);
    const rotada = [...cola.slice(-rondaIndex), ...cola.slice(0, -rondaIndex)];
    const orden = [cabeza, ...rotada];

    const enfrentamientos: [string, string][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = orden[i];
      const b = orden[m - 1 - i];
      if (a !== 'BYE' && b !== 'BYE') {
        enfrentamientos.push([a, b]);
      }
    }
    return enfrentamientos;
  }
}
