import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { CreateSedeCanchaDto } from './dto/create-sede-cancha.dto';
import { UpdateSedeCanchaDto } from './dto/update-sede-cancha.dto';
import { ConfigurarTorneoCanchasDto } from './dto/configurar-torneo-canchas.dto';

@Injectable()
export class SedesService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  // CRUD DE SEDES
  // ═══════════════════════════════════════════════════════

  /**
   * Crear una nueva sede
   */
  async createSede(dto: CreateSedeDto) {
    return this.prisma.sede.create({
      data: {
        nombre: dto.nombre,
        ciudad: dto.ciudad,
        direccion: dto.direccion,
        mapsUrl: dto.mapsUrl,
        telefono: dto.telefono,
        logoUrl: dto.logoUrl,
        imagenFondo: dto.imagenFondo,
        horarioAtencion: dto.horarioAtencion,
        contactoEncargado: dto.contactoEncargado,
        canvasWidth: dto.canvasWidth || 800,
        canvasHeight: dto.canvasHeight || 600,
        activo: true,
      },
      include: {
        canchas: true,
      },
    });
  }

  /**
   * Obtener todas las sedes con filtros opcionales
   */
  async findAllSedes(filters: { ciudad?: string; activo?: boolean }) {
    const where: any = {};

    if (filters.ciudad) {
      where.ciudad = {
        contains: filters.ciudad,
        mode: 'insensitive',
      };
    }

    if (filters.activo !== undefined) {
      where.activo = filters.activo;
    }

    return this.prisma.sede.findMany({
      where,
      include: {
        canchas: {
          where: { activa: true },
          orderBy: { nombre: 'asc' },
        },
        _count: {
          select: {
            canchas: true,
            torneosPrincipal: true,
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Obtener una sede por ID con todas sus canchas
   */
  async findOneSede(id: string) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
      include: {
        canchas: {
          orderBy: { nombre: 'asc' },
        },
        torneosPrincipal: {
          select: {
            id: true,
            nombre: true,
            fechaInicio: true,
            estado: true,
          },
          orderBy: { fechaInicio: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            canchas: true,
            torneosPrincipal: true,
            torneoSedes: true,
          },
        },
      },
    });

    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }

    return sede;
  }

  /**
   * Actualizar una sede
   */
  async updateSede(id: string, dto: UpdateSedeDto) {
    // Verificar que existe
    await this.findOneSede(id);

    return this.prisma.sede.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        ciudad: dto.ciudad,
        direccion: dto.direccion,
        mapsUrl: dto.mapsUrl,
        telefono: dto.telefono,
        logoUrl: dto.logoUrl,
        imagenFondo: dto.imagenFondo,
        horarioAtencion: dto.horarioAtencion,
        contactoEncargado: dto.contactoEncargado,
        canvasWidth: dto.canvasWidth,
        canvasHeight: dto.canvasHeight,
        activo: dto.activo,
      },
      include: {
        canchas: true,
      },
    });
  }

  /**
   * Eliminar una sede (soft delete - desactivar)
   */
  async deleteSede(id: string) {
    // Verificar que existe
    await this.findOneSede(id);

    // Verificar si tiene torneos activos
    const torneosActivos = await this.prisma.tournament.count({
      where: {
        sedeId: id,
        estado: {
          in: ['PUBLICADO', 'EN_CURSO'],
        },
      },
    });

    if (torneosActivos > 0) {
      throw new BadRequestException(
        `No se puede eliminar la sede porque tiene ${torneosActivos} torneo(s) activo(s)`,
      );
    }

    // Soft delete - solo desactivar
    return this.prisma.sede.update({
      where: { id },
      data: { activo: false },
    });
  }

  // ═══════════════════════════════════════════════════════
  // CRUD DE CANCHAS
  // ═══════════════════════════════════════════════════════

  /**
   * Crear una cancha en una sede
   */
  async createCancha(sedeId: string, dto: CreateSedeCanchaDto) {
    // Verificar que la sede existe
    await this.findOneSede(sedeId);

    return this.prisma.sedeCancha.create({
      data: {
        sedeId,
        nombre: dto.nombre,
        tipo: dto.tipo,
        posicionX: dto.posicionX || 0,
        posicionY: dto.posicionY || 0,
        ancho: dto.ancho || 100,
        alto: dto.alto || 150,
        rotacion: dto.rotacion || 0,
        imagenUrl: dto.imagenUrl,
        activa: true,
      },
    });
  }

  /**
   * Obtener todas las canchas de una sede
   */
  async findAllCanchas(sedeId: string) {
    // Verificar que la sede existe
    await this.findOneSede(sedeId);

    return this.prisma.sedeCancha.findMany({
      where: { sedeId },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Actualizar una cancha
   */
  async updateCancha(
    sedeId: string,
    canchaId: string,
    dto: UpdateSedeCanchaDto,
  ) {
    // Verificar que la cancha existe y pertenece a la sede
    const cancha = await this.prisma.sedeCancha.findFirst({
      where: { id: canchaId, sedeId },
    });

    if (!cancha) {
      throw new NotFoundException(
        `Cancha con ID ${canchaId} no encontrada en la sede ${sedeId}`,
      );
    }

    return this.prisma.sedeCancha.update({
      where: { id: canchaId },
      data: {
        nombre: dto.nombre,
        tipo: dto.tipo,
        posicionX: dto.posicionX,
        posicionY: dto.posicionY,
        ancho: dto.ancho,
        alto: dto.alto,
        rotacion: dto.rotacion,
        imagenUrl: dto.imagenUrl,
        activa: dto.activa,
      },
    });
  }

  /**
   * Eliminar una cancha (soft delete)
   */
  async deleteCancha(sedeId: string, canchaId: string) {
    // Verificar que la cancha existe y pertenece a la sede
    const cancha = await this.prisma.sedeCancha.findFirst({
      where: { id: canchaId, sedeId },
    });

    if (!cancha) {
      throw new NotFoundException(
        `Cancha con ID ${canchaId} no encontrada en la sede ${sedeId}`,
      );
    }

    // Verificar si tiene partidos programados
    const partidosProgramados = await this.prisma.match.count({
      where: {
        torneoCancha: {
          sedeCanchaId: canchaId,
        },
        estado: {
          in: ['PROGRAMADO', 'EN_JUEGO'],
        },
      },
    });

    if (partidosProgramados > 0) {
      throw new BadRequestException(
        `No se puede eliminar la cancha porque tiene ${partidosProgramados} partido(s) programado(s)`,
      );
    }

    // Soft delete
    return this.prisma.sedeCancha.update({
      where: { id: canchaId },
      data: { activa: false },
    });
  }

  /**
   * Actualizar múltiples canchas a la vez (para el canvas visual)
   */
  async updateCanchasBulk(sedeId: string, canchas: UpdateSedeCanchaDto[]) {
    // Verificar que la sede existe
    await this.findOneSede(sedeId);

    const updates = canchas.map((cancha) =>
      this.prisma.sedeCancha.update({
        where: { id: cancha.id },
        data: {
          nombre: cancha.nombre,
          tipo: cancha.tipo,
          posicionX: cancha.posicionX,
          posicionY: cancha.posicionY,
          ancho: cancha.ancho,
          alto: cancha.alto,
          rotacion: cancha.rotacion,
          imagenUrl: cancha.imagenUrl,
          activa: cancha.activa,
        },
      }),
    );

    return this.prisma.$transaction(updates);
  }

  // ═══════════════════════════════════════════════════════
  // CONFIGURACIÓN DE CANCHAS PARA TORNEOS
  // ═══════════════════════════════════════════════════════

  /**
   * Configurar las canchas y horarios para un torneo
   */
  async configurarTorneoCanchas(
    tournamentId: string,
    dto: ConfigurarTorneoCanchasDto,
  ) {
    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!torneo) {
      throw new NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
    }

    // Eliminar configuración anterior (si existe)
    await this.prisma.torneoCancha.deleteMany({
      where: { tournamentId },
    });

    // Crear las nuevas configuraciones
    const torneoCanchas = [];

    for (const canchaConfig of dto.canchas) {
      // Verificar que la cancha existe
      const cancha = await this.prisma.sedeCancha.findUnique({
        where: { id: canchaConfig.sedeCanchaId },
      });

      if (!cancha) {
        throw new NotFoundException(
          `Cancha con ID ${canchaConfig.sedeCanchaId} no encontrada`,
        );
      }

      const horariosData = (canchaConfig.horarios || []).map((h) => ({
        fecha: new Date(h.fecha),
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
      }));

      // Crear TorneoCancha con sus horarios
      const torneoCancha = await this.prisma.torneoCancha.create({
        data: {
          tournamentId,
          sedeCanchaId: canchaConfig.sedeCanchaId,
          ...(horariosData.length > 0
            ? { horarios: { create: horariosData } }
            : {}),
        },
        include: {
          sedeCancha: {
            include: {
              sede: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          horarios: true,
        },
      });

      torneoCanchas.push(torneoCancha);
    }

    return {
      message: 'Configuración de canchas guardada exitosamente',
      canchasConfiguradas: torneoCanchas,
    };
  }

  /**
   * Obtener la configuración de canchas de un torneo
   */
  async getTorneoCanchas(tournamentId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        sedePrincipal: {
          include: {
            canchas: {
              where: { activa: true },
            },
          },
        },
        torneoSedes: {
          include: {
            sede: {
              include: {
                canchas: {
                  where: { activa: true },
                },
              },
            },
          },
        },
        torneoCanchas: {
          include: {
            sedeCancha: {
              include: {
                sede: {
                  select: {
                    id: true,
                    nombre: true,
                  },
                },
              },
            },
            horarios: {
              orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
            },
          },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
    }

    return {
      torneo: {
        id: torneo.id,
        nombre: torneo.nombre,
        fechaInicio: torneo.fechaInicio,
        fechaFin: torneo.fechaFin,
      },
      sedePrincipal: torneo.sedePrincipal,
      sedesAdicionales: torneo.torneoSedes.map((ts) => ts.sede),
      canchasConfiguradas: torneo.torneoCanchas,
    };
  }

  /**
   * Agregar una sede adicional a un torneo
   */
  async agregarSedeATorneo(tournamentId: string, sedeId: string) {
    // Verificar que el torneo existe
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!torneo) {
      throw new NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
    }

    // Verificar que la sede existe
    await this.findOneSede(sedeId);

    // Verificar si ya está vinculada
    const existente = await this.prisma.torneoSede.findUnique({
      where: {
        tournamentId_sedeId: {
          tournamentId,
          sedeId,
        },
      },
    });

    if (existente) {
      throw new ConflictException('Esta sede ya está vinculada al torneo');
    }

    // Verificar si es la sede principal
    if (torneo.sedeId === sedeId) {
      throw new ConflictException('Esta sede ya es la sede principal del torneo');
    }

    return this.prisma.torneoSede.create({
      data: {
        tournamentId,
        sedeId,
      },
      include: {
        sede: {
          include: {
            canchas: {
              where: { activa: true },
            },
          },
        },
      },
    });
  }

  /**
   * Remover una sede adicional de un torneo
   */
  async removerSedeDeTorneo(tournamentId: string, sedeId: string) {
    // Verificar que existe la relación
    const relacion = await this.prisma.torneoSede.findUnique({
      where: {
        tournamentId_sedeId: {
          tournamentId,
          sedeId,
        },
      },
    });

    if (!relacion) {
      throw new NotFoundException(
        'Esta sede no está vinculada como sede adicional al torneo',
      );
    }

    // Eliminar canchas configuradas de esta sede para este torneo
    const canchasDeEstaSede = await this.prisma.sedeCancha.findMany({
      where: { sedeId },
      select: { id: true },
    });

    const canchaIds = canchasDeEstaSede.map((c) => c.id);

    await this.prisma.torneoCancha.deleteMany({
      where: {
        tournamentId,
        sedeCanchaId: {
          in: canchaIds,
        },
      },
    });

    // Eliminar la relación
    return this.prisma.torneoSede.delete({
      where: {
        tournamentId_sedeId: {
          tournamentId,
          sedeId,
        },
      },
    });
  }

  /**
   * Obtener todas las sedes vinculadas a un torneo
   */
  async getSedesDeTorneo(tournamentId: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        sedePrincipal: {
          include: {
            canchas: {
              where: { activa: true },
              orderBy: { nombre: 'asc' },
            },
          },
        },
        torneoSedes: {
          include: {
            sede: {
              include: {
                canchas: {
                  where: { activa: true },
                  orderBy: { nombre: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!torneo) {
      throw new NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
    }

    const sedes = [];

    // Agregar sede principal
    if (torneo.sedePrincipal) {
      sedes.push({
        ...torneo.sedePrincipal,
        esPrincipal: true,
      });
    }

    // Agregar sedes adicionales
    for (const ts of torneo.torneoSedes) {
      sedes.push({
        ...ts.sede,
        esPrincipal: false,
      });
    }

    return sedes;
  }
}
