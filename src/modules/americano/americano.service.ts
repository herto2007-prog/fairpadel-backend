import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAmericanoTorneoDto } from './dto/create-americano-torneo.dto';
import { InscribirJugadorAmericanoDto } from './dto/inscribir-jugador.dto';

export interface ConfigAmericano {
  numRondas: number;
  puntosPorVictoria: number;
  puntosPorDerrota: number;
  gamesPorSet: number;
  rondaActual: number;
  visibilidad: string; // 'publico' | 'privado'
}

const DEFAULT_CONFIG: ConfigAmericano = {
  numRondas: 4,
  puntosPorVictoria: 3,
  puntosPorDerrota: 1,
  gamesPorSet: 6,
  rondaActual: 0,
  visibilidad: 'publico',
};

@Injectable()
export class AmericanoService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // TORNEO AMERICANO
  // ═══════════════════════════════════════════════════════════════════════════════

  async crearTorneo(organizadorId: string, dto: CreateAmericanoTorneoDto) {
    const config: ConfigAmericano = {
      numRondas: dto.numRondas ?? DEFAULT_CONFIG.numRondas,
      puntosPorVictoria: dto.puntosPorVictoria ?? DEFAULT_CONFIG.puntosPorVictoria,
      puntosPorDerrota: dto.puntosPorDerrota ?? DEFAULT_CONFIG.puntosPorDerrota,
      gamesPorSet: dto.gamesPorSet ?? DEFAULT_CONFIG.gamesPorSet,
      rondaActual: 0,
      visibilidad: dto.visibilidad ?? DEFAULT_CONFIG.visibilidad,
    };

    const data: any = {
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      fechaLimiteInscr: dto.fechaLimiteInscripcion ?? dto.fechaInicio,
      ciudad: dto.ciudad,
      region: dto.ciudad,
      pais: dto.pais ?? 'Paraguay',
      organizadorId,
      estado: 'BORRADOR',
      costoInscripcion: 0, // AMERICANO ES GRATIS
      formato: 'americano',
      configAmericano: config as any,
      flyerUrl: dto.flyerUrl ?? '',
      minutosPorPartido: 30,
    };

    if (dto.sedeId) {
      data.sedeId = dto.sedeId;
    }

    const torneo = await this.prisma.tournament.create({ data });

    return torneo;
  }

  async findById(torneoId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: {
        organizador: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
        sedePrincipal: true,
        americanosRonda: {
          orderBy: { numero: 'asc' },
          include: {
            parejas: {
              include: {
                jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
                jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
              },
            },
          },
        },
        _count: {
          select: { inscripciones: true },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    return torneo;
  }

  async listarTorneosActivos(userId?: string) {
    const where: any = {
      formato: 'americano',
      estado: { in: ['BORRADOR', 'PUBLICADO', 'EN_CURSO'] },
    };

    // Si no hay usuario autenticado, solo mostrar públicos
    // Si hay usuario, mostrar públicos + privados propios
    if (!userId) {
      where.configAmericano = { path: ['visibilidad'], equals: 'publico' };
    } else {
      where.OR = [
        { configAmericano: { path: ['visibilidad'], equals: 'publico' } },
        { organizadorId: userId },
      ];
    }

    return this.prisma.tournament.findMany({
      where,
      include: {
        organizador: { select: { id: true, nombre: true, apellido: true } },
        sedePrincipal: { select: { id: true, nombre: true } },
        _count: { select: { inscripciones: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // INSCRIPCIONES
  // ═══════════════════════════════════════════════════════════════════════════════

  async inscribirJugador(torneoId: string, dto: InscribirJugadorAmericanoDto) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    // Verificar que el jugador existe
    const jugador = await this.prisma.user.findUnique({
      where: { id: dto.jugadorId },
    });

    if (!jugador) {
      throw new NotFoundException('Jugador no encontrado');
    }

    // Verificar que no esté ya inscrito
    const existente = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId: torneoId,
        jugador1Id: dto.jugadorId,
      },
    });

    if (existente) {
      throw new BadRequestException('El jugador ya está inscrito en este torneo');
    }

    // Para americano, usamos la primera categoría disponible o una default
    // En un torneo americano típicamente no hay categorías fijas, todos juegan juntos
    const categoria = await this.prisma.category.findFirst({
      orderBy: { orden: 'asc' },
    });

    if (!categoria) {
      throw new BadRequestException('No hay categorías configuradas');
    }

    // Crear inscripción individual (jugador2Id = null para americano)
    const inscripcion = await this.prisma.inscripcion.create({
      data: {
        tournamentId: torneoId,
        categoryId: categoria.id,
        jugador1Id: dto.jugadorId,
        jugador2Documento: jugador.documento,
        estado: 'CONFIRMADA', // Americano no requiere pago
        estadoClasificacion: 'PENDIENTE',
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
      },
    });

    return inscripcion;
  }

  async listarInscripciones(torneoId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return this.prisma.inscripcion.findMany({
      where: { tournamentId: torneoId },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true, categoriaActual: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async eliminarInscripcion(torneoId: string, jugadorId: string, organizadorId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permisos para este torneo');
    }

    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId: torneoId,
        jugador1Id: jugadorId,
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    await this.prisma.inscripcion.delete({
      where: { id: inscripcion.id },
    });

    return { message: 'Inscripción eliminada' };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RONDAS Y PAREJAS
  // ═══════════════════════════════════════════════════════════════════════════════

  async iniciarPrimeraRonda(torneoId: string, organizadorId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: {
        inscripciones: {
          where: { estado: 'CONFIRMADA' },
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true } },
          },
        },
        americanosRonda: true,
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permisos para este torneo');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    const jugadores = torneo.inscripciones.map(i => i.jugador1);

    if (jugadores.length < 4) {
      throw new BadRequestException('Se necesitan al menos 4 jugadores para iniciar');
    }

    if (torneo.americanosRonda.length > 0) {
      throw new BadRequestException('Ya existe al menos una ronda iniciada');
    }

    // Crear ronda 1
    const ronda = await this.prisma.americanoRonda.create({
      data: {
        numero: 1,
        torneoId,
        estado: 'EN_JUEGO',
      },
    });

    // Generar parejas aleatorias (sin repetir compañero - en ronda 1 todos son nuevos)
    const parejas = this.generarParejasAleatorias(jugadores.map(j => j.id));

    // Guardar parejas
    for (const [j1, j2] of parejas) {
      await this.prisma.americanoParejaRonda.create({
        data: {
          rondaId: ronda.id,
          jugador1Id: j1,
          jugador2Id: j2,
        },
      });
    }

    // Inicializar puntajes en 0 para todos los jugadores
    for (const j of jugadores) {
      await this.prisma.americanoPuntaje.create({
        data: {
          torneoId,
          rondaId: ronda.id,
          jugadorId: j.id,
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

    // Actualizar config del torneo
    const config = (torneo.configAmericano as any as ConfigAmericano) ?? DEFAULT_CONFIG;
    config.rondaActual = 1;

    await this.prisma.tournament.update({
      where: { id: torneoId },
      data: {
        estado: 'EN_CURSO',
        configAmericano: config as any,
      },
    });

    return this.getRondaConParejas(ronda.id);
  }

  async generarSiguienteRonda(torneoId: string, organizadorId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: {
        americanosRonda: {
          orderBy: { numero: 'desc' },
          take: 1,
          include: {
            puntajes: {
              orderBy: [
                { puntos: 'desc' },
                { diferenciaGames: 'desc' },
                { gamesGanados: 'desc' },
              ],
              include: {
                jugador: { select: { id: true, nombre: true, apellido: true } },
              },
            },
            parejas: true,
          },
        },
        inscripciones: {
          where: { estado: 'CONFIRMADA' },
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true } },
          },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permisos para este torneo');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    const ultimaRonda = torneo.americanosRonda[0];
    if (!ultimaRonda) {
      throw new BadRequestException('No hay rondas iniciadas. Use iniciarPrimeraRonda primero.');
    }

    if (ultimaRonda.estado !== 'FINALIZADA') {
      throw new BadRequestException('La ronda anterior debe estar finalizada');
    }

    const config = (torneo.configAmericano as any as ConfigAmericano) ?? DEFAULT_CONFIG;
    const nuevaRondaNumero = ultimaRonda.numero + 1;

    if (nuevaRondaNumero > config.numRondas) {
      throw new BadRequestException('Todas las rondas configuradas ya fueron jugadas');
    }

    // Obtener jugadores ordenados por ranking de la ronda anterior
    const ranking = ultimaRonda.puntajes.map(p => ({
      jugadorId: p.jugadorId,
      puntos: p.puntos,
      diferenciaGames: p.diferenciaGames,
    }));

    // Obtener historial de parejas para evitar repetir compañeros
    const historialParejas = await this.obtenerHistorialParejas(torneoId);

    // Generar nuevas parejas (1ro con último, evitando repetir compañeros)
    const nuevaParejas = this.generarParejasPorRanking(
      ranking.map(r => r.jugadorId),
      historialParejas,
    );

    // Crear nueva ronda
    const nuevaRonda = await this.prisma.americanoRonda.create({
      data: {
        numero: nuevaRondaNumero,
        torneoId,
        estado: 'EN_JUEGO',
      },
    });

    // Guardar parejas
    for (const [j1, j2] of nuevaParejas) {
      await this.prisma.americanoParejaRonda.create({
        data: {
          rondaId: nuevaRonda.id,
          jugador1Id: j1,
          jugador2Id: j2,
        },
      });
    }

    // Inicializar puntajes en 0 para esta ronda (o acumular? En americano típicamente se muestra ranking acumulado)
    // Vamos a crear un nuevo registro por ronda para trackear progreso
    for (const jugador of torneo.inscripciones.map(i => i.jugador1)) {
      await this.prisma.americanoPuntaje.create({
        data: {
          torneoId,
          rondaId: nuevaRonda.id,
          jugadorId: jugador.id,
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

    // Actualizar config
    config.rondaActual = nuevaRondaNumero;
    await this.prisma.tournament.update({
      where: { id: torneoId },
      data: { configAmericano: config as any },
    });

    return this.getRondaConParejas(nuevaRonda.id);
  }

  async finalizarRonda(torneoId: string, rondaId: string, organizadorId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permisos para este torneo');
    }

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

  async getClasificacionTorneo(torneoId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: {
        americanosRonda: {
          include: {
            puntajes: {
              include: {
                jugador: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Calcular clasificación acumulada sumando todas las rondas
    const acumulado = new Map<string, {
      jugadorId: string;
      nombre: string;
      apellido: string;
      fotoUrl: string | null;
      puntosTotal: number;
      partidosJugados: number;
      partidosGanados: number;
      partidosPerdidos: number;
      setsGanados: number;
      setsPerdidos: number;
      gamesGanados: number;
      gamesPerdidos: number;
      diferenciaGames: number;
    }>();

    for (const ronda of torneo.americanosRonda) {
      for (const p of ronda.puntajes) {
        const j = p.jugador;
        if (!acumulado.has(j.id)) {
          acumulado.set(j.id, {
            jugadorId: j.id,
            nombre: j.nombre,
            apellido: j.apellido,
            fotoUrl: j.fotoUrl,
            puntosTotal: 0,
            partidosJugados: 0,
            partidosGanados: 0,
            partidosPerdidos: 0,
            setsGanados: 0,
            setsPerdidos: 0,
            gamesGanados: 0,
            gamesPerdidos: 0,
            diferenciaGames: 0,
          });
        }
        const entry = acumulado.get(j.id)!;
        entry.puntosTotal += p.puntos;
        entry.partidosJugados += p.partidosJugados;
        entry.partidosGanados += p.partidosGanados;
        entry.partidosPerdidos += p.partidosPerdidos;
        entry.setsGanados += p.setsGanados;
        entry.setsPerdidos += p.setsPerdidos;
        entry.gamesGanados += p.gamesGanados;
        entry.gamesPerdidos += p.gamesPerdidos;
        entry.diferenciaGames += p.diferenciaGames;
      }
    }

    return Array.from(acumulado.values()).sort((a, b) => {
      if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
      if (b.diferenciaGames !== a.diferenciaGames) return b.diferenciaGames - a.diferenciaGames;
      return b.gamesGanados - a.gamesGanados;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RESULTADOS
  // ═══════════════════════════════════════════════════════════════════════════════

  async registrarResultado(
    torneoId: string,
    rondaId: string,
    parejaAId: string,
    parejaBId: string,
    sets: { gamesEquipoA: number; gamesEquipoB: number }[],
    organizadorId: string,
  ) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permisos para este torneo');
    }

    const ronda = await this.prisma.americanoRonda.findUnique({
      where: { id: rondaId },
      include: {
        parejas: {
          include: {
            jugador1: true,
            jugador2: true,
          },
        },
      },
    });

    if (!ronda || ronda.torneoId !== torneoId) {
      throw new NotFoundException('Ronda no encontrada');
    }

    if (ronda.estado !== 'EN_JUEGO') {
      throw new BadRequestException('La ronda no está en juego');
    }

    const parejaA = ronda.parejas.find(p => p.id === parejaAId);
    const parejaB = ronda.parejas.find(p => p.id === parejaBId);

    if (!parejaA || !parejaB) {
      throw new BadRequestException('Parejas no encontradas en esta ronda');
    }

    // Validar sets
    if (!sets || sets.length < 1) {
      throw new BadRequestException('Se requiere al menos un set');
    }

    const config = (torneo.configAmericano as any as ConfigAmericano) ?? DEFAULT_CONFIG;
    const gamesPorSet = config.gamesPorSet;

    let setsGanadosA = 0;
    let setsGanadosB = 0;
    let gamesTotalA = 0;
    let gamesTotalB = 0;

    for (const set of sets) {
      gamesTotalA += set.gamesEquipoA;
      gamesTotalB += set.gamesEquipoB;
      if (set.gamesEquipoA > set.gamesEquipoB) {
        setsGanadosA++;
      } else if (set.gamesEquipoB > set.gamesEquipoA) {
        setsGanadosB++;
      }
    }

    const ganoA = setsGanadosA > setsGanadosB;

    // Actualizar puntajes de los 4 jugadores
    const jugadoresA = [parejaA.jugador1Id, parejaA.jugador2Id];
    const jugadoresB = [parejaB.jugador1Id, parejaB.jugador2Id];

    for (const jugadorId of [...jugadoresA, ...jugadoresB]) {
      const puntaje = await this.prisma.americanoPuntaje.findUnique({
        where: {
          rondaId_jugadorId: {
            rondaId,
            jugadorId,
          },
        },
      });

      if (!puntaje) continue;

      const esEquipoA = jugadoresA.includes(jugadorId);
      const gano = esEquipoA ? ganoA : !ganoA;
      const puntosPartido = gano ? config.puntosPorVictoria : config.puntosPorDerrota;
      const gamesGanados = esEquipoA ? gamesTotalA : gamesTotalB;
      const gamesPerdidos = esEquipoA ? gamesTotalB : gamesTotalA;
      const setsG = esEquipoA ? setsGanadosA : setsGanadosB;
      const setsP = esEquipoA ? setsGanadosB : setsGanadosA;

      await this.prisma.americanoPuntaje.update({
        where: { id: puntaje.id },
        data: {
          puntos: puntaje.puntos + puntosPartido,
          partidosJugados: puntaje.partidosJugados + 1,
          partidosGanados: gano ? puntaje.partidosGanados + 1 : puntaje.partidosGanados,
          partidosPerdidos: !gano ? puntaje.partidosPerdidos + 1 : puntaje.partidosPerdidos,
          setsGanados: puntaje.setsGanados + setsG,
          setsPerdidos: puntaje.setsPerdidos + setsP,
          gamesGanados: puntaje.gamesGanados + gamesGanados,
          gamesPerdidos: puntaje.gamesPerdidos + gamesPerdidos,
          diferenciaGames: puntaje.diferenciaGames + (gamesGanados - gamesPerdidos),
        },
      });
    }

    return {
      message: 'Resultado registrado',
      ganador: ganoA ? 'Equipo A' : 'Equipo B',
      setsGanadosA,
      setsGanadosB,
      gamesTotalA,
      gamesTotalB,
    };
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

    // Si hay jugador impar, no se empareja (queda con bye)
    // En el futuro podemos manejar bye
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

  private generarParejasPorRanking(
    jugadoresOrdenados: string[],
    historialParejas: Set<string>,
  ): [string, string][] {
    // Estrategia: "serpiente" - 1ro con último, 2do con penúltimo, etc.
    // Si ya jugaron juntos, intentar swap simple
    const n = jugadoresOrdenados.length;
    const parejas: [string, string][] = [];
    const usados = new Set<number>();

    for (let i = 0; i < n / 2; i++) {
      let idxA = i;
      let idxB = n - 1 - i;

      // Si ya fueron pareja, intentar encontrar alternativa
      const key = [jugadoresOrdenados[idxA], jugadoresOrdenados[idxB]].sort().join('-');
      if (historialParejas.has(key)) {
        // Buscar swap con algún índice no usado
        let encontrado = false;
        for (let swap = i + 1; swap < n - 1 - i && !encontrado; swap++) {
          if (!usados.has(swap) && !usados.has(n - 1 - swap)) {
            const newKey = [jugadoresOrdenados[idxA], jugadoresOrdenados[swap]].sort().join('-');
            if (!historialParejas.has(newKey)) {
              idxB = swap;
              encontrado = true;
            }
          }
        }
      }

      parejas.push([jugadoresOrdenados[idxA], jugadoresOrdenados[idxB]]);
      usados.add(idxA);
      usados.add(idxB);
    }

    return parejas;
  }
}
