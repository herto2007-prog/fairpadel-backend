import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { CreateAmericanoTorneoDto } from './dto/create-americano-torneo.dto';
import { InscribirJugadorAmericanoDto } from './dto/inscribir-jugador.dto';

export interface ModoJuegoConfig {
  tipoInscripcion: 'individual' | 'parejasFijas';
  rotacion: 'automatica' | 'manual';
  sistemaPuntos: 'games' | 'sets' | 'partido' | 'diferencia' | 'puntosFijos';
  formatoPartido: 'tiempo' | 'games' | 'mejorDe3Sets' | 'puntosFijos';
  valorObjetivo: number;
  conTieBreak?: boolean;
  categorias: 'sin' | 'con';
  numRondas: number | string; // número o 'automatico'
  canchasSimultaneas?: number;
  premios?: { puesto: string; descripcion: string }[];
  formatoAmericano?: 'clasico' | 'parejasSinCat' | 'parejasConCat' | 'porCategorias' | 'sumas' | 'mixto';
  generosHabilitados?: string[];
  categoriasHabilitadas?: string[];
  combinacionesSuma?: any[];
  combinacionesMixto?: any[];
}

interface StatsPartido {
  ganoA: boolean;
  setsGanadosA: number;
  setsGanadosB: number;
  gamesTotalA: number;
  gamesTotalB: number;
  puntosA?: number;
  puntosB?: number;
}

export interface ConfigAmericano {
  visibilidad: string;
  limiteInscripciones?: number;
  modoJuegoConfigurado: boolean;
  modoJuego?: ModoJuegoConfig;
  rondaActual: number;
  inscripcionesAbiertas: boolean;
  tipoInscripcion: 'individual' | 'parejasFijas';
  // NUEVO: Configuración de formatos americanos avanzados
  formatoAmericano?: 'clasico' | 'parejasSinCat' | 'parejasConCat' | 'porCategorias' | 'sumas' | 'mixto';
  generosHabilitados?: string[];
  categoriasHabilitadas?: string[];
  combinacionesSuma?: any[];
  combinacionesMixto?: any[];
}

@Injectable()
export class AmericanoService {
  constructor(
    private prisma: PrismaService,
    private tournamentsService: TournamentsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // PERMISOS
  // ═══════════════════════════════════════════════════════════════════════════════

  private async verificarPermiso(torneoId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    const roles = user?.roles.map((ur) => ur.role.nombre) ?? [];
    const puede = await this.tournamentsService.puedeGestionarTorneo(torneoId, userId, roles);
    if (!puede) {
      throw new ForbiddenException('No tenés permisos para este torneo');
    }
  }

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
    await this.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    await this.verificarPermiso(torneoId, userId);

    await this.prisma.tournament.delete({
      where: { id: torneoId },
    });

    return { message: 'Torneo eliminado correctamente' };
  }

  async reiniciarTorneo(torneoId: string, userId: string) {
    await this.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    await this.verificarPermiso(torneoId, userId);

    await this.prisma.$transaction(async (tx) => {
      // Eliminar todas las rondas (cascade: elimina parejas y partidos)
      await tx.americanoRonda.deleteMany({
        where: { torneoId },
      });

      // Eliminar todos los puntajes del torneo
      await tx.americanoPuntaje.deleteMany({
        where: { torneoId },
      });

      // Resetear config
      const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
      config.rondaActual = 0;

      await tx.tournament.update({
        where: { id: torneoId },
        data: {
          estado: 'PUBLICADO',
          configAmericano: config as any,
        },
      });
    });

    return { message: 'Torneo reiniciado correctamente. Podés volver a iniciar la primera ronda.' };
  }

  private async validarRateLimit(torneoId: string, segundos = 3) {
    const torneo = await this.prisma.tournament.findUnique({ where: { id: torneoId } });
    if (torneo?.ultimaAccionEn) {
      const diff = Date.now() - new Date(torneo.ultimaAccionEn).getTime();
      if (diff < segundos * 1000) {
        throw new BadRequestException('Acción demasiado rápida. Esperá unos segundos.');
      }
    }
    await this.prisma.tournament.update({
      where: { id: torneoId },
      data: { ultimaAccionEn: new Date() },
    });
  }

  async configurarModoJuego(torneoId: string, organizadorId: string, modoJuego: ModoJuegoConfig) {
    await this.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { inscripciones: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.verificarPermiso(torneoId, organizadorId);

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    // Bloquear cambio de configuración si ya hay inscripciones
    if (torneo.inscripciones.length > 0) {
      throw new BadRequestException('No se puede modificar la configuración porque ya existen inscripciones. Reiniciá el torneo para cambiar el formato.');
    }

    const configActual = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    const cambiaAParejasFijas = modoJuego.tipoInscripcion === 'parejasFijas' && configActual.tipoInscripcion !== 'parejasFijas';
    if (cambiaAParejasFijas && torneo.inscripciones.length > 0) {
      const sinPareja = torneo.inscripciones.filter(i => !i.jugador2Id);
      if (sinPareja.length > 0) {
        throw new BadRequestException(`No se puede cambiar a parejas fijas porque ${sinPareja.length} inscripto(s) no tienen compañero asignado. Eliminá esas inscripciones o hacé que se inscriban con pareja.`);
      }
    }

    const config = configActual;
    config.modoJuegoConfigurado = true;
    config.modoJuego = modoJuego;
    config.tipoInscripcion = modoJuego.tipoInscripcion; // SINCRONIZAR
    config.inscripcionesAbiertas = false; // Al configurar el modo, se cierran las inscripciones

    // Guardar configuración de formatos americanos avanzados
    if (modoJuego.formatoAmericano) config.formatoAmericano = modoJuego.formatoAmericano;
    if (modoJuego.generosHabilitados) config.generosHabilitados = modoJuego.generosHabilitados;
    if (modoJuego.categoriasHabilitadas) config.categoriasHabilitadas = modoJuego.categoriasHabilitadas;
    if (modoJuego.combinacionesSuma) config.combinacionesSuma = modoJuego.combinacionesSuma;
    if (modoJuego.combinacionesMixto) config.combinacionesMixto = modoJuego.combinacionesMixto;

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

    await this.verificarPermiso(torneoId, organizadorId);

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

  async reabrirInscripciones(torneoId: string, organizadorId: string) {
    await this.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { americanosRonda: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.verificarPermiso(torneoId, organizadorId);

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    // No permitir reabrir si ya hay rondas en juego o finalizadas
    const hayRondasActivas = torneo.americanosRonda.some(
      r => r.estado === 'EN_JUEGO' || r.estado === 'FINALIZADA',
    );
    if (hayRondasActivas) {
      throw new BadRequestException('No se pueden reabrir inscripciones porque ya hay rondas iniciadas.');
    }

    const config = (torneo.configAmericano as unknown as ConfigAmericano) ?? { rondaActual: 0, visibilidad: 'publico', modoJuegoConfigurado: false, inscripcionesAbiertas: true, tipoInscripcion: 'individual' };
    config.inscripcionesAbiertas = true;

    await this.prisma.tournament.update({
      where: { id: torneoId },
      data: { configAmericano: config as any },
    });

    return { message: 'Inscripciones reabiertas' };
  }

  async findById(torneoId: string, userId?: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: {
        organizador: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
        coorganizadores: { select: { userId: true } },
        sedePrincipal: true,
        americanosGrupo: {
          select: { id: true, nombre: true, tipo: true },
          orderBy: { nombre: 'asc' },
        },
        americanosRonda: {
          orderBy: { numero: 'asc' },
          include: {
            grupo: { select: { id: true, nombre: true, tipo: true } },
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

    const puedeGestionar = userId
      ? await this.tournamentsService.puedeGestionarTorneo(torneoId, userId)
      : false;

    return { ...torneo, puedeGestionar };
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

    const configRaw = torneo.configAmericano as unknown as ConfigAmericano | null;
    const config: ConfigAmericano = configRaw ?? {
      visibilidad: 'publico',
      modoJuegoConfigurado: false,
      rondaActual: 0,
      inscripcionesAbiertas: true,
      tipoInscripcion: 'individual',
    };
    const formatoAmericano = config.formatoAmericano ?? 'clasico';

    // Verificar que las inscripciones estén abiertas
    if (config.inscripcionesAbiertas === false) {
      throw new BadRequestException('Las inscripciones para este torneo están cerradas');
    }

    // Buscar jugador principal (con categoría para validaciones)
    const jugador = await this.prisma.user.findUnique({
      where: { id: dto.jugadorId },
      include: { categoriaActual: true },
    });

    if (!jugador) {
      throw new NotFoundException('Jugador no encontrado');
    }

    // Buscar compañero si aplica
    let companero = null;
    if (dto.jugador2Id) {
      companero = await this.prisma.user.findUnique({
        where: { id: dto.jugador2Id },
        include: { categoriaActual: true },
      });
      if (!companero) {
        throw new NotFoundException('Compañero no encontrado');
      }
    }

    // Validar perfil según formato
    this.validarPerfilPorFormato(jugador, companero, formatoAmericano, config);

    // Validar duplicados de inscripción
    await this.validarDuplicadosInscripcion(torneoId, dto.jugadorId, dto.jugador2Id);

    // Determinar categoría para la inscripción
    let categoryId = dto.categoryId || jugador.categoriaActualId;
    let categoriaSeleccionada = null;

    if (dto.categoryId) {
      // Validar que la categoría elegida exista y esté habilitada para el torneo
      categoriaSeleccionada = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!categoriaSeleccionada) {
        throw new BadRequestException('Categoría seleccionada no encontrada');
      }
      const catHabilitada = await this.validarCategoriaHabilitadaInferior(
        categoriaSeleccionada.nombre,
        config.categoriasHabilitadas,
      );
      if (!catHabilitada) {
        throw new BadRequestException(`Categoría ${categoriaSeleccionada.nombre} no está habilitada para este torneo`);
      }
      // Validar que el jugador sea elegible para esta categoría (su categoría <= categoría elegida)
      if (jugador.categoriaActual) {
        const esElegible = await this.esCategoriaInferiorOIgual(
          jugador.categoriaActual.nombre,
          categoriaSeleccionada.nombre,
        );
        if (!esElegible) {
          throw new BadRequestException(
            `No podés inscribirte en ${categoriaSeleccionada.nombre} porque tu categoría actual (${jugador.categoriaActual.nombre}) es superior`,
          );
        }
      }
      // Si hay pareja, validar que también sea elegible
      if (companero?.categoriaActual) {
        const esElegible = await this.esCategoriaInferiorOIgual(
          companero.categoriaActual.nombre,
          categoriaSeleccionada.nombre,
        );
        if (!esElegible) {
          throw new BadRequestException(
            `Tu compañero no puede jugar en ${categoriaSeleccionada.nombre} porque su categoría actual (${companero.categoriaActual.nombre}) es superior`,
          );
        }
      }
    }

    if (!categoryId) {
      const defaultCat = await this.prisma.category.findFirst({ orderBy: { orden: 'asc' } });
      if (!defaultCat) {
        throw new BadRequestException('No hay categorías configuradas');
      }
      categoryId = defaultCat.id;
    }

    // Determinar grupo según formato
    const grupo = await this.determinarGrupoAmericano(
      torneoId, formatoAmericano, config, jugador, companero, dto.categoryId,
    );

    const inscripcion = await this.prisma.inscripcion.create({
      data: {
        tournamentId: torneoId,
        categoryId,
        jugador1Id: dto.jugadorId,
        jugador2Id: dto.jugador2Id ?? undefined,
        jugador2Documento: jugador.documento,
        estado: 'CONFIRMADA',
        estadoClasificacion: 'PENDIENTE',
        grupoId: grupo.id,
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
        grupo: true,
      },
    });

    return {
      inscripcion,
      grupoAsignado: { id: grupo.id, nombre: grupo.nombre },
    };
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
        jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true, categoriaActual: true, genero: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true, categoriaActual: true, genero: true } },
        grupo: { select: { id: true, nombre: true, tipo: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getCategoriasHabilitadas(torneoId: string, userId?: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    const configRaw = torneo.configAmericano as unknown as ConfigAmericano | null;
    const config: ConfigAmericano = configRaw ?? {
      visibilidad: 'publico',
      modoJuegoConfigurado: false,
      rondaActual: 0,
      inscripcionesAbiertas: true,
      tipoInscripcion: 'individual',
    };

    let categorias: Array<{ id: string; nombre: string; orden: number; tipo: string }> = [];

    if (config.categoriasHabilitadas && config.categoriasHabilitadas.length > 0) {
      categorias = await this.prisma.category.findMany({
        where: { nombre: { in: config.categoriasHabilitadas } },
        orderBy: { orden: 'asc' },
        select: { id: true, nombre: true, orden: true, tipo: true },
      });
    } else {
      categorias = await this.prisma.category.findMany({
        orderBy: { orden: 'asc' },
        select: { id: true, nombre: true, orden: true, tipo: true },
      });
    }

    let usuario = null;
    if (userId) {
      usuario = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { categoriaActual: true },
      });
    }

    const resultado = await Promise.all(
      categorias.map(async (cat) => {
        if (!usuario?.categoriaActual) {
          return { ...cat, elegible: true };
        }
        const esElegible = await this.esCategoriaInferiorOIgual(
          usuario.categoriaActual.nombre,
          cat.nombre,
        );
        return {
          ...cat,
          elegible: esElegible,
          razon: esElegible ? undefined : `Tu categoría actual (${usuario.categoriaActual.nombre}) no te permite jugar en ${cat.nombre}`,
        };
      }),
    );

    return { success: true, categorias: resultado };
  }

  async eliminarInscripcion(torneoId: string, jugadorId: string, organizadorId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { americanosRonda: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.verificarPermiso(torneoId, organizadorId);

    // No permitir eliminar si ya se iniciaron rondas
    if (torneo.americanosRonda.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar inscripciones porque ya se iniciaron rondas. ' +
        'Reiniciá el torneo si necesitás modificar los inscriptos.'
      );
    }

    // Buscar inscripción por jugador1Id O jugador2Id
    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId: torneoId,
        OR: [
          { jugador1Id: jugadorId },
          { jugador2Id: jugadorId },
        ],
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
    await this.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { americanosGrupo: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.verificarPermiso(torneoId, organizadorId);

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
    await this.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { americanosGrupo: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.verificarPermiso(torneoId, organizadorId);

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
    await this.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.verificarPermiso(torneoId, organizadorId);

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

  async getClasificacionTorneo(torneoId: string, grupoId?: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: {
        americanosRonda: {
          where: grupoId ? { grupoId } : undefined,
          include: {
            puntajes: {
              include: {
                jugador: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
              },
            },
            grupo: true,
          },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (grupoId) {
      // Clasificación de un grupo específico
      const rondasDelGrupo = torneo.americanosRonda.filter(r => r.grupoId === grupoId);
      const ultimaRonda = rondasDelGrupo.sort((a, b) => b.numero - a.numero)[0];
      if (!ultimaRonda) return [];

      return ultimaRonda.puntajes.map((p) => ({
        jugadorId: p.jugador.id,
        nombre: p.jugador.nombre,
        apellido: p.jugador.apellido,
        fotoUrl: p.jugador.fotoUrl,
        puntosTotal: p.puntos,
        partidosJugados: p.partidosJugados,
        partidosGanados: p.partidosGanados,
        partidosPerdidos: p.partidosPerdidos,
        setsGanados: p.setsGanados,
        setsPerdidos: p.setsPerdidos,
        gamesGanados: p.gamesGanados,
        gamesPerdidos: p.gamesPerdidos,
        diferenciaGames: p.diferenciaGames,
      })).sort((a, b) => {
        if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
        if (b.diferenciaGames !== a.diferenciaGames) return b.diferenciaGames - a.diferenciaGames;
        return b.gamesGanados - a.gamesGanados;
      });
    }

    // Clasificación de todos los grupos (devolver agrupado)
    const clasificacionesPorGrupo = new Map<string, { grupoId: string; grupoNombre: string; puntajes: any[] }>();

    for (const ronda of torneo.americanosRonda) {
      if (!ronda.grupoId || !ronda.grupo) continue;
      const key = ronda.grupoId;
      if (!clasificacionesPorGrupo.has(key)) {
        clasificacionesPorGrupo.set(key, { grupoId: key, grupoNombre: ronda.grupo.nombre, puntajes: [] });
      }
      // Solo nos quedamos con la última ronda de cada grupo (mayor numero)
      const actual = clasificacionesPorGrupo.get(key)!;
      if (!actual.puntajes.length || ronda.numero > torneo.americanosRonda.find(r => r.grupoId === key && r.puntajes.length > 0)?.numero!) {
        actual.puntajes = ronda.puntajes.map((p) => ({
          jugadorId: p.jugador.id,
          nombre: p.jugador.nombre,
          apellido: p.jugador.apellido,
          fotoUrl: p.jugador.fotoUrl,
          puntosTotal: p.puntos,
          partidosJugados: p.partidosJugados,
          partidosGanados: p.partidosGanados,
          partidosPerdidos: p.partidosPerdidos,
          setsGanados: p.setsGanados,
          setsPerdidos: p.setsPerdidos,
          gamesGanados: p.gamesGanados,
          gamesPerdidos: p.gamesPerdidos,
          diferenciaGames: p.diferenciaGames,
        })).sort((a: any, b: any) => {
          if (b.puntosTotal !== a.puntosTotal) return b.puntosTotal - a.puntosTotal;
          if (b.diferenciaGames !== a.diferenciaGames) return b.diferenciaGames - a.diferenciaGames;
          return b.gamesGanados - a.gamesGanados;
        });
      }
    }

    // Elegir la ronda con mayor numero por grupo
    const resultado: { grupoId: string; grupoNombre: string; clasificacion: any[] }[] = [];
    for (const [grupoIdKey, data] of clasificacionesPorGrupo) {
      resultado.push({
        grupoId: grupoIdKey,
        grupoNombre: data.grupoNombre,
        clasificacion: data.puntajes,
      });
    }

    // Si hay un solo grupo, devolver plano para compatibilidad con frontend legacy
    if (resultado.length === 1) {
      return resultado[0].clasificacion;
    }

    return resultado;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // RESULTADOS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Stats normalizados de un partido, independientemente del formato.
   */
  private calcularStatsSets(sets: { gamesEquipoA: number; gamesEquipoB: number }[]) {
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

    return { setsGanadosA, setsGanadosB, gamesTotalA, gamesTotalB, ganoA: setsGanadosA > setsGanadosB };
  }

  private calcularPuntosSegunSistema(
    stats: { ganoA: boolean; gamesTotalA: number; gamesTotalB: number; setsGanadosA: number; setsGanadosB: number; puntosA?: number; puntosB?: number },
    esEquipoA: boolean,
    sistemaPuntos: string,
  ): number {
    switch (sistemaPuntos) {
      case 'games':
        return esEquipoA ? stats.gamesTotalA : stats.gamesTotalB;
      case 'sets':
        return esEquipoA ? stats.setsGanadosA : stats.setsGanadosB;
      case 'partido':
        return esEquipoA ? (stats.ganoA ? 1 : 0) : (stats.ganoA ? 0 : 1);
      case 'diferencia':
        return esEquipoA
          ? stats.gamesTotalA - stats.gamesTotalB
          : stats.gamesTotalB - stats.gamesTotalA;
      case 'puntosFijos':
        return esEquipoA ? (stats.puntosA ?? 0) : (stats.puntosB ?? 0);
      default:
        // Fallback a games para backward compatibility
        return esEquipoA ? stats.gamesTotalA : stats.gamesTotalB;
    }
  }

  async registrarResultado(
    torneoId: string,
    rondaId: string,
    parejaAId: string,
    parejaBId: string,
    sets: { gamesEquipoA: number; gamesEquipoB: number }[] | undefined,
    puntosA: number | undefined,
    puntosB: number | undefined,
    organizadorId: string,
  ) {
    await this.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.verificarPermiso(torneoId, organizadorId);

    const config = (torneo.configAmericano ?? {}) as unknown as ConfigAmericano;
    const modoJuego = config.modoJuego;
    const sistemaPuntos = modoJuego?.sistemaPuntos ?? 'games';
    const formatoPartido = modoJuego?.formatoPartido ?? 'mejorDe3Sets';
    const valorObjetivo = modoJuego?.valorObjetivo ?? 0;

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

    const parejaA = ronda.parejas.find(p => p.id === parejaAId);
    const parejaB = ronda.parejas.find(p => p.id === parejaBId);

    if (!parejaA || !parejaB) {
      throw new BadRequestException('Parejas no encontradas en esta ronda');
    }

    // Validar entrada según formato de partido
    let statsNuevos: StatsPartido;
    let setsAGuardar: any;

    if (formatoPartido === 'puntosFijos') {
      if (puntosA === undefined || puntosB === undefined) {
        throw new BadRequestException('Se requieren puntosA y puntosB para el formato puntos fijos');
      }
      if (puntosA + puntosB !== valorObjetivo) {
        throw new BadRequestException(`La suma de puntos debe ser exactamente ${valorObjetivo}`);
      }
      if (puntosA < 0 || puntosB < 0) {
        throw new BadRequestException('Los puntos no pueden ser negativos');
      }
      statsNuevos = {
        ganoA: puntosA > puntosB,
        setsGanadosA: 0,
        setsGanadosB: 0,
        gamesTotalA: puntosA,
        gamesTotalB: puntosB,
        puntosA,
        puntosB,
      };
      setsAGuardar = { puntosA, puntosB };
    } else {
      // Formatos tradicionales con sets
      if (!sets || sets.length < 1) {
        throw new BadRequestException('Se requiere al menos un set');
      }
      statsNuevos = this.calcularStatsSets(sets);
      setsAGuardar = sets;
    }

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

    if (!partido) {
      throw new BadRequestException('No se encontró el partido entre estas parejas en esta ronda');
    }

    const esEdicion = partido.estado === 'FINALIZADO';

    // Si es nuevo registro (no edición), validar que ronda esté EN_JUEGO
    if (!esEdicion && ronda.estado !== 'EN_JUEGO') {
      throw new BadRequestException('La ronda no está en juego');
    }

    // Determinar sistema y stats previos para edición
    let sistemaPuntosOriginal: string | null = null;
    let statsPrevios: StatsPartido | null = null;

    if (esEdicion) {
      // Sistema persistido en el partido (crítico para revertir correctamente)
      sistemaPuntosOriginal = partido.sistemaPuntos ?? null;

      if (!sistemaPuntosOriginal) {
        // Backward compatibility: datos antiguos no tienen sistemaPuntos guardado.
        // Inferimos del formato de los sets almacenados.
        if (partido.sets && Array.isArray(partido.sets)) {
          sistemaPuntosOriginal = 'games';
          statsPrevios = this.calcularStatsSets(partido.sets as { gamesEquipoA: number; gamesEquipoB: number }[]);
        } else if (partido.sets && typeof partido.sets === 'object' && 'puntosA' in (partido.sets as any)) {
          sistemaPuntosOriginal = 'puntosFijos';
          const prev = partido.sets as { puntosA: number; puntosB: number };
          statsPrevios = {
            ganoA: prev.puntosA > prev.puntosB,
            setsGanadosA: 0,
            setsGanadosB: 0,
            gamesTotalA: prev.puntosA,
            gamesTotalB: prev.puntosB,
            puntosA: prev.puntosA,
            puntosB: prev.puntosB,
          };
        }
      } else {
        // Tenemos sistemaPuntos guardado: recalcular stats desde los sets almacenados
        if (partido.sets && Array.isArray(partido.sets)) {
          statsPrevios = this.calcularStatsSets(partido.sets as { gamesEquipoA: number; gamesEquipoB: number }[]);
        } else if (partido.sets && typeof partido.sets === 'object' && 'puntosA' in (partido.sets as any)) {
          const prev = partido.sets as { puntosA: number; puntosB: number };
          statsPrevios = {
            ganoA: prev.puntosA > prev.puntosB,
            setsGanadosA: 0,
            setsGanadosB: 0,
            gamesTotalA: prev.puntosA,
            gamesTotalB: prev.puntosB,
            puntosA: prev.puntosA,
            puntosB: prev.puntosB,
          };
        }
      }
    }

    const jugadoresA = [parejaA.jugador1Id, parejaA.jugador2Id];
    const jugadoresB = [parejaB.jugador1Id, parejaB.jugador2Id];

    await this.prisma.$transaction(async (tx) => {
      await tx.americanoPartido.update({
        where: { id: partido.id },
        data: {
          estado: 'FINALIZADO',
          sets: setsAGuardar as any,
          sistemaPuntos,
          formatoPartido,
        },
      });

      for (const jugadorId of [...jugadoresA, ...jugadoresB]) {
        const puntaje = await tx.americanoPuntaje.findUnique({
          where: {
            rondaId_jugadorId: {
              rondaId,
              jugadorId,
            },
          },
        });

        if (!puntaje) continue;

        const esEquipoA = jugadoresA.includes(jugadorId);

        // Si es edición, revertir valores anteriores
        if (statsPrevios && sistemaPuntosOriginal) {
          const ganoPrev = esEquipoA ? statsPrevios.ganoA : !statsPrevios.ganoA;
          const gamesGanadosPrev = esEquipoA ? statsPrevios.gamesTotalA : statsPrevios.gamesTotalB;
          const gamesPerdidosPrev = esEquipoA ? statsPrevios.gamesTotalB : statsPrevios.gamesTotalA;
          const setsGPrev = esEquipoA ? statsPrevios.setsGanadosA : statsPrevios.setsGanadosB;
          const setsPPrev = esEquipoA ? statsPrevios.setsGanadosB : statsPrevios.setsGanadosA;

          // Revertir PUNTOS usando el sistema original
          const puntosRevertidos = this.calcularPuntosSegunSistema(
            statsPrevios,
            esEquipoA,
            sistemaPuntosOriginal,
          );
          puntaje.puntos -= puntosRevertidos;

          // Revertir estadísticas secundarias (siempre iguales sin importar el sistema)
          puntaje.partidosJugados -= 1;
          puntaje.partidosGanados -= ganoPrev ? 1 : 0;
          puntaje.partidosPerdidos -= !ganoPrev ? 1 : 0;
          puntaje.setsGanados -= setsGPrev;
          puntaje.setsPerdidos -= setsPPrev;
          puntaje.gamesGanados -= gamesGanadosPrev;
          puntaje.gamesPerdidos -= gamesPerdidosPrev;
          puntaje.diferenciaGames -= (gamesGanadosPrev - gamesPerdidosPrev);
        }

        // Aplicar nuevos valores
        const gano = esEquipoA ? statsNuevos.ganoA : !statsNuevos.ganoA;
        const gamesGanadosPartido = esEquipoA ? statsNuevos.gamesTotalA : statsNuevos.gamesTotalB;
        const gamesPerdidosPartido = esEquipoA ? statsNuevos.gamesTotalB : statsNuevos.gamesTotalA;
        const setsG = esEquipoA ? statsNuevos.setsGanadosA : statsNuevos.setsGanadosB;
        const setsP = esEquipoA ? statsNuevos.setsGanadosB : statsNuevos.setsGanadosA;

        // Calcular puntos según sistema ACTUAL
        const puntosNuevos = this.calcularPuntosSegunSistema(statsNuevos, esEquipoA, sistemaPuntos);

        await tx.americanoPuntaje.update({
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
    });

    return {
      message: esEdicion ? 'Resultado actualizado' : 'Resultado registrado',
      ganador: statsNuevos.ganoA ? 'Equipo A' : 'Equipo B',
      setsGanadosA: statsNuevos.setsGanadosA,
      setsGanadosB: statsNuevos.setsGanadosB,
      gamesTotalA: statsNuevos.gamesTotalA,
      gamesTotalB: statsNuevos.gamesTotalB,
    };
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

  // ═══════════════════════════════════════════════════════════════════════════════
  // HELPERS DE INSCRIPCIÓN POR FORMATO AMERICANO
  // ═══════════════════════════════════════════════════════════════════════════════

  private validarPerfilPorFormato(
    jugador: any,
    companero: any,
    formato: string,
    config: ConfigAmericano,
  ) {
    const requiereGenero = (u: any, ctx: string) => {
      if (!u.genero) {
        throw new UnprocessableEntityException({
          message: `Perfil incompleto: género requerido${ctx ? ` (${ctx})` : ''}`,
          code: 'PERFIL_INCOMPLETO_GENERO',
        });
      }
    };
    const requiereCategoria = (u: any, ctx: string) => {
      if (!u.categoriaActualId) {
        throw new UnprocessableEntityException({
          message: `Perfil incompleto: categoría requerida${ctx ? ` (${ctx})` : ''}`,
          code: 'PERFIL_INCOMPLETO_CATEGORIA',
        });
      }
    };

    switch (formato) {
      case 'clasico':
        // Sin validaciones específicas
        break;

      case 'parejasSinCat':
        requiereGenero(jugador, 'jugador');
        if (companero) requiereGenero(companero, 'compañero');
        break;

      case 'parejasConCat':
        requiereGenero(jugador, 'jugador');
        requiereCategoria(jugador, 'jugador');
        if (companero) {
          requiereGenero(companero, 'compañero');
          requiereCategoria(companero, 'compañero');
        }
        break;

      case 'porCategorias':
        requiereCategoria(jugador, 'jugador');
        if (config.generosHabilitados && config.generosHabilitados.length > 0) {
          requiereGenero(jugador, 'jugador');
        }
        break;

      case 'sumas':
        requiereCategoria(jugador, 'jugador');
        if (companero) requiereCategoria(companero, 'compañero');
        break;

      case 'mixto':
        requiereGenero(jugador, 'jugador');
        requiereCategoria(jugador, 'jugador');
        if (companero) {
          requiereGenero(companero, 'compañero');
          requiereCategoria(companero, 'compañero');
        }
        break;
    }
  }

  private async validarDuplicadosInscripcion(torneoId: string, jugadorId: string, companeroId?: string) {
    const existente = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId: torneoId,
        OR: [
          { jugador1Id: jugadorId },
          { jugador2Id: jugadorId },
        ],
      },
    });
    if (existente) {
      throw new BadRequestException('El jugador ya está inscrito en este torneo');
    }

    if (companeroId) {
      if (companeroId === jugadorId) {
        throw new BadRequestException('No podés ser tu propio compañero');
      }
      const existente2 = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId: torneoId,
          OR: [
            { jugador1Id: companeroId },
            { jugador2Id: companeroId },
          ],
        },
      });
      if (existente2) {
        throw new BadRequestException('Tu compañero ya está inscrito en este torneo');
      }
    }
  }

  private readonly PESOS_CATEGORIA: Record<string, number> = {
    '1RA': 10, '1ra': 10, 'Primera': 10, 'PRIMERA': 10,
    '2DA': 9, '2da': 9, 'Segunda': 9, 'SEGUNDA': 9,
    '3RA': 8, '3ra': 8, 'Tercera': 8, 'TERCERA': 8,
    '4TA': 7, '4ta': 7, 'Cuarta': 7, 'CUARTA': 7,
    '5TA': 6, '5ta': 6, 'Quinta': 6, 'QUINTA': 6,
    '6TA': 5, '6ta': 5, 'Sexta': 5, 'SEXTA': 5,
    '7MA': 4, '7ma': 4, 'Septima': 4, 'SEPTIMA': 4,
    'Principiante': 2, 'PRINCIPIANTE': 2, 'principiante': 2,
  };

  private obtenerPesoCategoria(nombre: string): number | null {
    // Prioridad 1: mapa estático de pesos
    if (this.PESOS_CATEGORIA[nombre] !== undefined) {
      return this.PESOS_CATEGORIA[nombre];
    }
    // Fallback: extraer número romano/ordinal del nombre
    const match = nombre.match(/(\d+)[°ªºRAra]?/);
    if (match) {
      return 11 - parseInt(match[1], 10); // 1RA → 10, 2DA → 9, etc.
    }
    return null;
  }

  private async esCategoriaInferiorOIgual(
    categoriaJugador: string,
    categoriaHabilitada: string,
  ): Promise<boolean> {
    const pesoJugador = this.obtenerPesoCategoria(categoriaJugador);
    const pesoHabilitada = this.obtenerPesoCategoria(categoriaHabilitada);
    if (pesoJugador !== null && pesoHabilitada !== null) {
      return pesoJugador <= pesoHabilitada;
    }
    // Fallback a comparación por orden de DB
    const [catJ, catH] = await Promise.all([
      this.prisma.category.findUnique({ where: { nombre: categoriaJugador } }),
      this.prisma.category.findUnique({ where: { nombre: categoriaHabilitada } }),
    ]);
    if (!catJ || !catH) return false;
    return catJ.orden >= catH.orden; // orden mayor = categoría inferior
  }

  private async validarCategoriaHabilitadaInferior(
    categoriaNombre: string,
    categoriasHabilitadas?: string[],
  ): Promise<boolean> {
    if (!categoriasHabilitadas || categoriasHabilitadas.length === 0) return true;
    if (categoriasHabilitadas.includes(categoriaNombre)) return true;

    // Debe ser inferior o igual a AL MENOS UNA de las habilitadas
    for (const habilitada of categoriasHabilitadas) {
      const esInferiorOIgual = await this.esCategoriaInferiorOIgual(categoriaNombre, habilitada);
      if (esInferiorOIgual) return true;
    }
    return false;
  }

  private async determinarGrupoAmericano(
    torneoId: string,
    formato: string,
    config: ConfigAmericano,
    jugador: any,
    companero: any,
    categoriaSeleccionadaId?: string,
  ): Promise<any> {
    switch (formato) {
      case 'clasico': {
        let grupo = await this.prisma.americanoGrupo.findFirst({
          where: { torneoId, tipo: 'DEFAULT' },
        });
        if (!grupo) {
          grupo = await this.prisma.americanoGrupo.create({
            data: { torneoId, nombre: 'General', tipo: 'DEFAULT', config: {} },
          });
        }
        return grupo;
      }

      case 'parejasSinCat': {
        const genero = jugador.genero;
        if (config.generosHabilitados && Array.isArray(config.generosHabilitados)) {
          if (!config.generosHabilitados.includes(genero)) {
            throw new BadRequestException(`Género ${genero} no habilitado para este torneo`);
          }
          if (companero && !config.generosHabilitados.includes(companero.genero)) {
            throw new BadRequestException(`Género del compañero no habilitado para este torneo`);
          }
        }
        if (companero && jugador.genero !== companero.genero) {
          throw new BadRequestException('Ambos jugadores deben tener el mismo género');
        }
        const nombreGrupo = genero === 'MASCULINO' ? 'Masculino' : 'Femenino';
        let grupo = await this.prisma.americanoGrupo.findFirst({
          where: { torneoId, tipo: 'GENERO', nombre: nombreGrupo },
        });
        if (!grupo) {
          grupo = await this.prisma.americanoGrupo.create({
            data: { torneoId, nombre: nombreGrupo, tipo: 'GENERO', config: { genero } },
          });
        }
        return grupo;
      }

      case 'parejasConCat': {
        const genero = jugador.genero;
        if (config.generosHabilitados && Array.isArray(config.generosHabilitados)) {
          if (!config.generosHabilitados.includes(genero)) {
            throw new BadRequestException(`Género ${genero} no habilitado para este torneo`);
          }
          if (companero && !config.generosHabilitados.includes(companero.genero)) {
            throw new BadRequestException(`Género del compañero no habilitado para este torneo`);
          }
        }
        if (companero && jugador.genero !== companero.genero) {
          throw new BadRequestException('Ambos jugadores deben tener el mismo género');
        }

        const catId = categoriaSeleccionadaId ?? jugador.categoriaActualId;
        const catJugador = await this.prisma.category.findUnique({ where: { id: catId } });
        const catCompanero = companero
          ? await this.prisma.category.findUnique({ where: { id: categoriaSeleccionadaId ?? companero.categoriaActualId } })
          : null;
        if (!catJugador) throw new BadRequestException('Categoría del jugador no encontrada');
        if (companero && (!catCompanero || catJugador.id !== catCompanero.id)) {
          throw new BadRequestException('Ambos jugadores deben tener la misma categoría');
        }

        const catValida = await this.validarCategoriaHabilitadaInferior(
          catJugador.nombre,
          config.categoriasHabilitadas,
        );
        if (!catValida) {
          throw new BadRequestException(`Categoría ${catJugador.nombre} no está habilitada para este torneo`);
        }

        const nombreGrupo = catJugador.nombre;
        let grupo = await this.prisma.americanoGrupo.findFirst({
          where: { torneoId, tipo: 'CATEGORIA_GENERO', nombre: nombreGrupo },
        });
        if (!grupo) {
          grupo = await this.prisma.americanoGrupo.create({
            data: {
              torneoId,
              nombre: nombreGrupo,
              tipo: 'CATEGORIA_GENERO',
              config: { genero, categoria: catJugador.nombre, categoriaId: catJugador.id },
            },
          });
        }
        return grupo;
      }

      case 'porCategorias': {
        const catId = categoriaSeleccionadaId ?? jugador.categoriaActualId;
        const catJugador = await this.prisma.category.findUnique({ where: { id: catId } });
        if (!catJugador) throw new BadRequestException('Categoría del jugador no encontrada');

        const catValida = await this.validarCategoriaHabilitadaInferior(
          catJugador.nombre,
          config.categoriasHabilitadas,
        );
        if (!catValida) {
          throw new BadRequestException(`Categoría ${catJugador.nombre} no está habilitada para este torneo`);
        }

        if (config.generosHabilitados && config.generosHabilitados.length > 0) {
          if (!config.generosHabilitados.includes(jugador.genero)) {
            throw new BadRequestException(`Género ${jugador.genero} no habilitado para este torneo`);
          }
        }

        const nombreGrupo = catJugador.nombre;
        let tipoGrupo = 'CATEGORIA';
        let grupoConfig: any = { categoria: catJugador.nombre, categoriaId: catJugador.id };

        if (config.generosHabilitados && config.generosHabilitados.length > 0) {
          tipoGrupo = 'CATEGORIA_GENERO';
          grupoConfig.genero = jugador.genero;
        }

        let grupo = await this.prisma.americanoGrupo.findFirst({
          where: { torneoId, tipo: tipoGrupo, nombre: nombreGrupo },
        });
        if (!grupo) {
          grupo = await this.prisma.americanoGrupo.create({
            data: { torneoId, nombre: nombreGrupo, tipo: tipoGrupo, config: grupoConfig },
          });
        }
        return grupo;
      }

      case 'sumas': {
        const catJugador = await this.prisma.category.findUnique({ where: { id: jugador.categoriaActualId } });
        const catCompanero = companero
          ? await this.prisma.category.findUnique({ where: { id: companero.categoriaActualId } })
          : null;
        if (!catJugador) throw new BadRequestException('Categoría del jugador no encontrada');
        if (companero && !catCompanero) throw new BadRequestException('Categoría del compañero no encontrada');

        const cats = [catJugador.nombre, catCompanero?.nombre].filter(Boolean).sort();
        const comboKey = cats.join(' + ');

        const combos = config.combinacionesSuma ?? [];
        const comboValida = combos.some((c: any) => {
          if (typeof c === 'string') {
            const parts = c.split(/\+|\/|,/).map((s: string) => s.trim());
            const sorted = parts.sort();
            return JSON.stringify(sorted) === JSON.stringify(cats);
          }
          if (typeof c === 'object' && c.cat1 && c.cat2) {
            const sorted = [c.cat1.trim(), c.cat2.trim()].sort();
            return JSON.stringify(sorted) === JSON.stringify(cats);
          }
          return false;
        });

        if (!comboValida) {
          throw new BadRequestException(`La combinación ${comboKey} no está habilitada para este torneo`);
        }

        let grupo = await this.prisma.americanoGrupo.findFirst({
          where: { torneoId, tipo: 'COMBINACION', nombre: comboKey },
        });
        if (!grupo) {
          grupo = await this.prisma.americanoGrupo.create({
            data: { torneoId, nombre: comboKey, tipo: 'COMBINACION', config: { categorias: cats } },
          });
        }
        return grupo;
      }

      case 'mixto': {
        const generos = [jugador.genero, companero?.genero].filter(Boolean);
        const mascCount = generos.filter((g) => g === 'MASCULINO').length;
        const femCount = generos.filter((g) => g === 'FEMENINO').length;
        if (mascCount !== 1 || femCount !== 1) {
          throw new BadRequestException('El formato mixto requiere exactamente 1 jugador masculino y 1 femenino');
        }

        const catJugador = await this.prisma.category.findUnique({ where: { id: jugador.categoriaActualId } });
        const catCompanero = companero
          ? await this.prisma.category.findUnique({ where: { id: companero.categoriaActualId } })
          : null;
        if (!catJugador) throw new BadRequestException('Categoría del jugador no encontrada');
        if (companero && !catCompanero) throw new BadRequestException('Categoría del compañero no encontrada');

        const mujer = jugador.genero === 'FEMENINO' ? jugador : companero;
        const hombre = jugador.genero === 'MASCULINO' ? jugador : companero;
        const catMujer = await this.prisma.category.findUnique({ where: { id: mujer.categoriaActualId } });
        const catHombre = await this.prisma.category.findUnique({ where: { id: hombre.categoriaActualId } });
        if (!catMujer || !catHombre) throw new BadRequestException('Categorías no encontradas');

        const combosMixto = config.combinacionesMixto ?? [];
        const comboValida = combosMixto.some((c: any) => {
          if (typeof c === 'string') {
            const parts = c.split(/\/|,/).map((s: string) => s.trim());
            const femPart = parts.find((p: string) => p.toUpperCase().startsWith('F'));
            const mascPart = parts.find((p: string) => p.toUpperCase().startsWith('M'));
            const femCat = femPart ? femPart.replace(/^F[-\s]*/i, '').trim() : '';
            const mascCat = mascPart ? mascPart.replace(/^M[-\s]*/i, '').trim() : '';
            return femCat === catMujer.nombre && mascCat === catHombre.nombre;
          }
          if (typeof c === 'object' && c.categoriaMujer && c.categoriaHombre) {
            return c.categoriaMujer === catMujer.nombre && c.categoriaHombre === catHombre.nombre;
          }
          return false;
        });

        if (!comboValida) {
          throw new BadRequestException(
            `La combinación F-${catMujer.nombre} / M-${catHombre.nombre} no está habilitada para este torneo`,
          );
        }

        const nombreGrupo = `F-${catMujer.nombre} / M-${catHombre.nombre}`;
        let grupo = await this.prisma.americanoGrupo.findFirst({
          where: { torneoId, tipo: 'COMBINACION_MIXTA', nombre: nombreGrupo },
        });
        if (!grupo) {
          grupo = await this.prisma.americanoGrupo.create({
            data: {
              torneoId,
              nombre: nombreGrupo,
              tipo: 'COMBINACION_MIXTA',
              config: { categoriaMujer: catMujer.nombre, categoriaHombre: catHombre.nombre },
            },
          });
        }
        return grupo;
      }

      default:
        throw new BadRequestException(`Formato americano no reconocido: ${formato}`);
    }
  }
}
