import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { AmericanoComunService } from './americano-comun.service';
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
    private comun: AmericanoComunService,
  ) {}

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
    await this.comun.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    await this.comun.verificarPermiso(torneoId, userId);

    await this.prisma.tournament.delete({
      where: { id: torneoId },
    });

    return { message: 'Torneo eliminado correctamente' };
  }

  async reiniciarTorneo(torneoId: string, userId: string) {
    await this.comun.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    if (torneo.formato !== 'americano') {
      throw new BadRequestException('Este torneo no es de formato americano');
    }

    await this.comun.verificarPermiso(torneoId, userId);

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

  async configurarModoJuego(torneoId: string, organizadorId: string, modoJuego: ModoJuegoConfig) {
    await this.comun.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { inscripciones: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.comun.verificarPermiso(torneoId, organizadorId);

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

    await this.comun.verificarPermiso(torneoId, organizadorId);

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
    await this.comun.validarRateLimit(torneoId);

    const torneo = await this.prisma.tournament.findUnique({
      where: { id: torneoId },
      include: { americanosRonda: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.comun.verificarPermiso(torneoId, organizadorId);

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

    await this.comun.verificarPermiso(torneoId, organizadorId);

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
