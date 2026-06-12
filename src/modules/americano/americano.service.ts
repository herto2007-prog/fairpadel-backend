import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { AmericanoComunService } from './americano-comun.service';
import { CreateAmericanoTorneoDto } from './dto/create-americano-torneo.dto';

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

}
