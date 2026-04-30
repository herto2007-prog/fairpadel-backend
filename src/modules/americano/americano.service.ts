import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAmericanoTorneoDto } from './dto/create-americano-torneo.dto';
import { InscribirJugadorAmericanoDto } from './dto/inscribir-jugador.dto';

export interface ModoJuegoConfig {
  tipoInscripcion: 'individual' | 'parejasFijas';
  rotacion: 'automatica' | 'manual';
  sistemaPuntos: 'games' | 'sets' | 'partido' | 'diferencia';
  formatoPartido: 'tiempo' | 'games' | 'mejorDe3Sets';
  valorObjetivo: number;
  conTieBreak?: boolean;
  categorias: 'sin' | 'con';
  numRondas: number | string; // número o 'automatico'
  canchasSimultaneas?: number;
  premios?: { puesto: string; descripcion: string }[];
}

export interface ConfigAmericano {
  visibilidad: string;
  limiteInscripciones?: number;
  modoJuegoConfigurado: boolean;
  modoJuego?: ModoJuegoConfig;
  rondaActual: number;
  inscripcionesAbiertas: boolean;
  tipoInscripcion: 'individual' | 'parejasFijas';
}

@Injectable()
export class AmericanoService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // TORNEO AMERICANO
  // ═══════════════════════════════════════════════════════════════════════════════

  async crearTorneo(organizadorId: string, dto: CreateAmericanoTorneoDto) {
    const config: ConfigAmericano = {
      visibilidad: dto.visibilidad ?? 'publico',
      limiteInscripciones: dto.limiteInscripciones,
      modoJuegoConfigurado: false,
      rondaActual: 0,
      inscripcionesAbiertas: true,
      tipoInscripcion: dto.tipoInscripcion ?? 'individual',
    };

    const data: any = {
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      fechaInicio: dto.fecha,
      fechaFin: dto.fecha,
      fechaLimiteInscr: dto.fecha,
      ciudad: dto.ciudad,
      region: dto.ciudad,
      pais: 'Paraguay',
      organizadorId,
      estado: 'PUBLICADO',
      costoInscripcion: 0, // AMERICANO ES GRATIS
      formato: 'americano',
      configAmericano: config as any,
      flyerUrl: '',
    };

    const torneo = await this.prisma.tournament.create({ data });

    return torneo;
  }

  async eliminarTorneo(torneoId: string, userId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    // Verificar si es el organizador o un admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    const isAdmin = user?.roles.some((ur) => ur.role.nombre === 'admin');

    if (torneo.organizadorId !== userId && !isAdmin) {
      throw new ForbiddenException('No tenés permisos para eliminar este torneo');
    }

    await this.prisma.tournament.delete({
      where: { id: torneoId },
    });

    return { message: 'Torneo eliminado correctamente' };
  }

  async reiniciarTorneo(torneoId: string, userId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    // Verificar si es el organizador o un admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    const isAdmin = user?.roles.some((ur) => ur.role.nombre === 'admin');

    if (torneo.organizadorId !== userId && !isAdmin) {
      throw new ForbiddenException('No tenés permisos para reiniciar este torneo');
    }

    // Eliminar todas las rondas (cascade: elimina parejas y partidos)
    await this.prisma.americanoRonda.deleteMany({
      where: { torneoId },
    });

    // Eliminar todos los puntajes del torneo (por si quedan con rondaId null)
    await this.prisma.americanoPuntaje.deleteMany({
      where: { torneoId },
    });

    // Resetear config
    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    config.rondaActual = 0;

    await this.prisma.tournament.update({
      where: { id: torneoId },
      data: {
        estado: 'PUBLICADO',
        configAmericano: config as any,
      },
    });

    return { message: 'Torneo reiniciado correctamente. Podés volver a iniciar la primera ronda.' };
  }

  async configurarModoJuego(torneoId: string, organizadorId: string, modoJuego: ModoJuegoConfig) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
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

    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    config.modoJuegoConfigurado = true;
    config.modoJuego = modoJuego;
    config.inscripcionesAbiertas = false; // Al configurar el modo, se cierran las inscripciones

    await this.prisma.tournament.update({
      where: { id: torneoId },
      data: { configAmericano: config as any },
    });

    return { message: 'Modo de juego configurado' };
  }

  async cerrarInscripciones(torneoId: string, organizadorId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tenés permisos para este torneo');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    config.inscripcionesAbiertas = false;

    await this.prisma.tournament.update({
      where: { id: torneoId },
      data: { configAmericano: config as any },
    });

    return { message: 'Inscripciones cerradas' };
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
        organizador: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
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

    const config = torneo.configAmericano as unknown as ConfigAmericano | null;

    // Verificar que las inscripciones estén abiertas
    if (config && config.inscripcionesAbiertas === false) {
      throw new BadRequestException('Las inscripciones para este torneo están cerradas');
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

    // Si es parejas fijas, validar jugador2
    let jugador2Id: string | null = null;
    if (config?.tipoInscripcion === 'parejasFijas') {
      if (!dto.jugador2Id) {
        throw new BadRequestException('En torneos por parejas fijas debés indicar a tu compañero');
      }
      if (dto.jugador2Id === dto.jugadorId) {
        throw new BadRequestException('No podés ser tu propio compañero');
      }
      const jugador2 = await this.prisma.user.findUnique({
        where: { id: dto.jugador2Id },
      });
      if (!jugador2) {
        throw new NotFoundException('Compañero no encontrado');
      }
      // Verificar que el compañero no esté ya inscrito
      const existente2 = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId: torneoId,
          OR: [
            { jugador1Id: dto.jugador2Id },
            { jugador2Id: dto.jugador2Id },
          ],
        },
      });
      if (existente2) {
        throw new BadRequestException('Tu compañero ya está inscrito en este torneo');
      }
      jugador2Id = dto.jugador2Id;
    }

    // Para americano, usamos la primera categoría disponible o una default
    const categoria = await this.prisma.category.findFirst({
      orderBy: { orden: 'asc' },
    });

    if (!categoria) {
      throw new BadRequestException('No hay categorías configuradas');
    }

    const inscripcion = await this.prisma.inscripcion.create({
      data: {
        tournamentId: torneoId,
        categoryId: categoria.id,
        jugador1Id: dto.jugadorId,
        jugador2Id: jugador2Id ?? undefined,
        jugador2Documento: jugador.documento,
        estado: 'CONFIRMADA',
        estadoClasificacion: 'PENDIENTE',
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
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
            jugador2: { select: { id: true, nombre: true, apellido: true } },
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

    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    const esParejasFijas = config.tipoInscripcion === 'parejasFijas';

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

    let parejasCreadas: { id: string; jugador1Id: string; jugador2Id: string }[] = [];

    if (esParejasFijas) {
      // Usar las parejas definidas en las inscripciones
      const inscripcionesConPareja = torneo.inscripciones.filter(i => i.jugador2Id);
      if (inscripcionesConPareja.length < 2) {
        throw new BadRequestException('Se necesitan al menos 2 parejas completas para iniciar (parejas fijas)');
      }
      if (inscripcionesConPareja.length !== torneo.inscripciones.length) {
        throw new BadRequestException('Todos los inscriptos deben tener un companero asignado (parejas fijas)');
      }
      for (const insc of inscripcionesConPareja) {
        const p = await this.prisma.americanoParejaRonda.create({
          data: {
            rondaId: ronda.id,
            jugador1Id: insc.jugador1Id,
            jugador2Id: insc.jugador2Id!,
          },
        });
        parejasCreadas.push({ id: p.id, jugador1Id: insc.jugador1Id, jugador2Id: insc.jugador2Id! });
      }
    } else {
      // Generar parejas aleatorias (sin repetir companero)
      const parejasJugadores = this.generarParejasAleatorias(jugadores.map(j => j.id));
      for (const [j1, j2] of parejasJugadores) {
        const p = await this.prisma.americanoParejaRonda.create({
          data: {
            rondaId: ronda.id,
            jugador1Id: j1,
            jugador2Id: j2,
          },
        });
        parejasCreadas.push({ id: p.id, jugador1Id: j1, jugador2Id: j2 });
      }
    }

    // Crear partidos emparejando parejas entre si
    const canchasSimultaneas = config.modoJuego?.canchasSimultaneas ?? 1;
    await this.crearPartidosDeRonda(ronda.id, parejasCreadas, canchasSimultaneas);

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
            partidos: true,
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

    // Permitir generar siguiente ronda si está finalizada o queda 1 partido pendiente
    const partidos = ultimaRonda.partidos ?? [];
    const partidosFinalizados = partidos.filter(p => p.estado === 'FINALIZADO').length;
    const puedeGenerarSiguiente = ultimaRonda.estado === 'FINALIZADA' || (partidos.length > 0 && partidos.length - partidosFinalizados <= 1);

    if (!puedeGenerarSiguiente) {
      throw new BadRequestException('La ronda anterior debe estar finalizada o quedar solo 1 partido pendiente');
    }

    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    const nuevaRondaNumero = ultimaRonda.numero + 1;

    const numRondasConfig = config.modoJuego?.numRondas ?? 4;
    const numRondasMax = numRondasConfig === 'automatico' ? 999 : (typeof numRondasConfig === 'number' ? numRondasConfig : 4);

    if (nuevaRondaNumero > numRondasMax) {
      throw new BadRequestException('Todas las rondas configuradas ya fueron jugadas');
    }

// Si es parejas fijas, mantener las mismas parejas que en la primera ronda
    let nuevaParejas: [string, string][] = [];
    let parejasRondaAnterior: { id: string; jugador1Id: string; jugador2Id: string }[] = [];

    if (config.tipoInscripcion === 'parejasFijas') {
      // Obtener parejas de la primera ronda (o de inscripciones)
      const primeraRonda = await this.prisma.americanoRonda.findFirst({
        where: { torneoId },
        orderBy: { numero: 'asc' },
        include: { parejas: true },
      });
      if (primeraRonda) {
        for (const par of primeraRonda.parejas) {
          nuevaParejas.push([par.jugador1Id, par.jugador2Id]);
          parejasRondaAnterior.push(par);
        }
      }
    } else {
      // Obtener jugadores ordenados por ranking de la ronda anterior
      const ranking = ultimaRonda.puntajes.map(p => ({
        jugadorId: p.jugadorId,
        puntos: p.puntos,
        diferenciaGames: p.diferenciaGames,
      }));

      // Obtener historial de parejas para evitar repetir companeros
      const historialParejas = await this.obtenerHistorialParejas(torneoId);

      // Generar nuevas parejas (1ro con ultimo, evitando repetir companeros)
      nuevaParejas = this.generarParejasPorRanking(
        ranking.map(r => r.jugadorId),
        historialParejas,
      );
    }

// Crear nueva ronda
    const nuevaRonda = await this.prisma.americanoRonda.create({
      data: {
        numero: nuevaRondaNumero,
        torneoId,
        estado: 'EN_JUEGO',
      },
    });

    // Guardar parejas y obtener IDs
    const parejasCreadas: { id: string; jugador1Id: string; jugador2Id: string }[] = [];
    for (const [j1, j2] of nuevaParejas) {
      const p = await this.prisma.americanoParejaRonda.create({
        data: {
          rondaId: nuevaRonda.id,
          jugador1Id: j1,
          jugador2Id: j2,
        },
      });
      parejasCreadas.push({ id: p.id, jugador1Id: j1, jugador2Id: j2 });
    }

    // Crear partidos
    const canchasSimultaneas = config.modoJuego?.canchasSimultaneas ?? 1;
    await this.crearPartidosDeRonda(nuevaRonda.id, parejasCreadas, canchasSimultaneas);

    // Inicializar puntajes para esta ronda ACUMULANDO los de rondas anteriores
    // En americano los games se acumulan entre rondas
    const puntajesAnteriores = await this.prisma.americanoPuntaje.findMany({
      where: { torneoId, rondaId: ultimaRonda.id },
    });

    const acumuladoPorJugador = new Map<string, {
      puntos: number; partidosJugados: number; partidosGanados: number;
      partidosPerdidos: number; setsGanados: number; setsPerdidos: number;
      gamesGanados: number; gamesPerdidos: number; diferenciaGames: number;
    }>();

    for (const p of puntajesAnteriores) {
      acumuladoPorJugador.set(p.jugadorId, {
        puntos: p.puntos,
        partidosJugados: p.partidosJugados,
        partidosGanados: p.partidosGanados,
        partidosPerdidos: p.partidosPerdidos,
        setsGanados: p.setsGanados,
        setsPerdidos: p.setsPerdidos,
        gamesGanados: p.gamesGanados,
        gamesPerdidos: p.gamesPerdidos,
        diferenciaGames: p.diferenciaGames,
      });
    }

    for (const jugador of torneo.inscripciones.map(i => i.jugador1)) {
      const acum = acumuladoPorJugador.get(jugador.id);
      await this.prisma.americanoPuntaje.create({
        data: {
          torneoId,
          rondaId: nuevaRonda.id,
          jugadorId: jugador.id,
          puntos: acum?.puntos ?? 0,
          partidosJugados: acum?.partidosJugados ?? 0,
          partidosGanados: acum?.partidosGanados ?? 0,
          partidosPerdidos: acum?.partidosPerdidos ?? 0,
          setsGanados: acum?.setsGanados ?? 0,
          setsPerdidos: acum?.setsPerdidos ?? 0,
          gamesGanados: acum?.gamesGanados ?? 0,
          gamesPerdidos: acum?.gamesPerdidos ?? 0,
          diferenciaGames: acum?.diferenciaGames ?? 0,
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
    // SISTEMA: GAMES ACUMULADOS
    // Cada jugador suma los games que ganó en el partido como puntos
    // Buscar y actualizar el partido correspondiente
    const partido = await this.prisma.americanoPartido.findFirst({
      where: {
        rondaId,
        OR: [
          { parejaAId, parejaBId },
          { parejaAId: parejaBId, parejaBId: parejaAId },
        ],
      },
    });

    if (partido) {
      await this.prisma.americanoPartido.update({
        where: { id: partido.id },
        data: {
          estado: 'FINALIZADO',
          sets: sets as any,
        },
      });
    }

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
      const gamesGanadosPartido = esEquipoA ? gamesTotalA : gamesTotalB;
      const gamesPerdidosPartido = esEquipoA ? gamesTotalB : gamesTotalA;
      const setsG = esEquipoA ? setsGanadosA : setsGanadosB;
      const setsP = esEquipoA ? setsGanadosB : setsGanadosA;

      // En americano, los PUNTOS = GAMES GANADOS acumulados
      const puntosNuevos = gamesGanadosPartido;

      await this.prisma.americanoPuntaje.update({
        where: { id: puntaje.id },
        data: {
          puntos: puntaje.puntos + puntosNuevos,
          partidosJugados: puntaje.partidosJugados + 1,
          partidosGanados: gano ? puntaje.partidosGanados + 1 : puntaje.partidosGanados,
          partidosPerdidos: !gano ? puntaje.partidosPerdidos + 1 : puntaje.partidosPerdidos,
          setsGanados: puntaje.setsGanados + setsG,
          setsPerdidos: puntaje.setsPerdidos + setsP,
          gamesGanados: puntaje.gamesGanados + gamesGanadosPartido,
          gamesPerdidos: puntaje.gamesPerdidos + gamesPerdidosPartido,
          diferenciaGames: puntaje.diferenciaGames + (gamesGanadosPartido - gamesPerdidosPartido),
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

    if (partidosData.length > 0) {
      await this.prisma.americanoPartido.createMany({ data: partidosData });
    }
  }
}
