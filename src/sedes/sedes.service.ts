import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSedeDto } from './dto/create-sede.dto';
import { UpdateSedeDto } from './dto/update-sede.dto';
import { CreateSedeCanchaDto } from './dto/create-sede-cancha.dto';
import { UpdateSedeCanchaDto } from './dto/update-sede-cancha.dto';
import { ConfigurarTorneoCanchasDto } from './dto/configurar-torneo-canchas.dto';
import { TournamentStatus } from '@prisma/client';

// Non-terminal tournament states that prevent sede deletion
const ACTIVE_TOURNAMENT_STATES: TournamentStatus[] = [
  TournamentStatus.BORRADOR,
  TournamentStatus.PENDIENTE_APROBACION,
  TournamentStatus.PUBLICADO,
  TournamentStatus.EN_CURSO,
];

@Injectable()
export class SedesService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  /**
   * Verify the requesting user is the tournament organizer or an admin
   */
  private async verifyTournamentOwnership(
    tournamentId: string,
    userId: string,
    roles: string[],
  ) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, organizadorId: true, nombre: true },
    });

    if (!torneo) {
      throw new NotFoundException(
        `Torneo con ID ${tournamentId} no encontrado`,
      );
    }

    const isAdmin = roles.includes('admin');
    if (!isAdmin && torneo.organizadorId !== userId) {
      throw new ForbiddenException(
        'No tienes permisos para modificar este torneo',
      );
    }

    return torneo;
  }

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
  async findAllSedes(filters: {
    ciudad?: string;
    nombre?: string;
    activo?: boolean;
  }) {
    const where: any = {};

    if (filters.ciudad) {
      where.ciudad = {
        contains: filters.ciudad,
        mode: 'insensitive',
      };
    }

    if (filters.nombre) {
      where.nombre = {
        contains: filters.nombre,
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
   * Desactivar una sede (soft delete)
   */
  async deleteSede(id: string) {
    // Verificar que existe
    await this.findOneSede(id);

    // Verificar si tiene torneos en cualquier estado activo (no terminal)
    const torneosActivos = await this.prisma.tournament.count({
      where: {
        sedeId: id,
        estado: {
          in: ACTIVE_TOURNAMENT_STATES,
        },
      },
    });

    if (torneosActivos > 0) {
      throw new BadRequestException(
        `No se puede desactivar la sede porque tiene ${torneosActivos} torneo(s) activo(s). Finalice o cancele los torneos primero.`,
      );
    }

    // Soft delete
    return this.prisma.sede.update({
      where: { id },
      data: { activo: false },
    });
  }

  /**
   * Reactivar una sede desactivada
   */
  async reactivarSede(id: string) {
    const sede = await this.prisma.sede.findUnique({
      where: { id },
    });

    if (!sede) {
      throw new NotFoundException(`Sede con ID ${id} no encontrada`);
    }

    if (sede.activo) {
      throw new BadRequestException('La sede ya esta activa');
    }

    return this.prisma.sede.update({
      where: { id },
      data: { activo: true },
      include: { canchas: true },
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
   * @param includeInactive - If true, includes inactive canchas (for admin view)
   */
  async findAllCanchas(sedeId: string, includeInactive = false) {
    // Verificar que la sede existe
    await this.findOneSede(sedeId);

    const where: any = { sedeId };
    if (!includeInactive) {
      where.activa = true;
    }

    return this.prisma.sedeCancha.findMany({
      where,
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
   * Desactivar una cancha (soft delete)
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

    // Verificar si tiene partidos programados o en juego
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
        `No se puede desactivar la cancha porque tiene ${partidosProgramados} partido(s) programado(s) o en juego`,
      );
    }

    // Soft delete
    return this.prisma.sedeCancha.update({
      where: { id: canchaId },
      data: { activa: false },
    });
  }

  /**
   * Actualizar multiples canchas a la vez (para el canvas visual)
   * Validates that ALL canchas belong to the specified sede
   */
  async updateCanchasBulk(sedeId: string, canchas: UpdateSedeCanchaDto[]) {
    if (!canchas || canchas.length === 0) {
      throw new BadRequestException('Debe enviar al menos una cancha');
    }

    // Verificar que la sede existe
    await this.findOneSede(sedeId);

    // Verify ALL cancha IDs belong to this sede
    const canchaIds = canchas
      .filter((c) => c.id)
      .map((c) => c.id as string);

    if (canchaIds.length !== canchas.length) {
      throw new BadRequestException(
        'Todas las canchas deben incluir un ID valido',
      );
    }

    const existingCanchas = await this.prisma.sedeCancha.findMany({
      where: {
        id: { in: canchaIds },
        sedeId,
      },
      select: { id: true },
    });

    const existingIds = new Set(existingCanchas.map((c) => c.id));
    const invalidIds = canchaIds.filter((id) => !existingIds.has(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Las siguientes canchas no pertenecen a esta sede: ${invalidIds.join(', ')}`,
      );
    }

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
  // CONFIGURACION DE CANCHAS PARA TORNEOS
  // ═══════════════════════════════════════════════════════

  /**
   * Configurar las canchas y horarios para un torneo
   * Wrapped in a transaction for atomicity
   */
  async configurarTorneoCanchas(
    tournamentId: string,
    dto: ConfigurarTorneoCanchasDto,
    userId: string,
    roles: string[],
  ) {
    // Verify ownership
    await this.verifyTournamentOwnership(tournamentId, userId, roles);

    if (!dto.canchas || dto.canchas.length === 0) {
      throw new BadRequestException(
        'Debe configurar al menos una cancha para el torneo',
      );
    }

    // Get tournament's linked sedes (principal + additional)
    const torneoData = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        sedeId: true,
        torneoSedes: { select: { sedeId: true } },
      },
    });

    const linkedSedeIds = new Set<string>();
    if (torneoData?.sedeId) linkedSedeIds.add(torneoData.sedeId);
    torneoData?.torneoSedes.forEach((ts) => linkedSedeIds.add(ts.sedeId));

    // Check for existing matches before deleting config
    const matchesOnCanchas = await this.prisma.match.count({
      where: {
        torneoCancha: { tournamentId },
        estado: { in: ['PROGRAMADO', 'EN_JUEGO'] },
      },
    });

    if (matchesOnCanchas > 0) {
      throw new BadRequestException(
        `No se puede reconfigurar las canchas porque hay ${matchesOnCanchas} partido(s) programado(s) o en juego`,
      );
    }

    // Validate all cancha IDs and their ownership
    const sedeCanchaIds = dto.canchas.map((c) => c.sedeCanchaId);
    const canchasDb = await this.prisma.sedeCancha.findMany({
      where: { id: { in: sedeCanchaIds }, activa: true },
      select: { id: true, sedeId: true },
    });

    const canchaMap = new Map(canchasDb.map((c) => [c.id, c]));
    for (const canchaConfig of dto.canchas) {
      const cancha = canchaMap.get(canchaConfig.sedeCanchaId);
      if (!cancha) {
        throw new NotFoundException(
          `Cancha con ID ${canchaConfig.sedeCanchaId} no encontrada o esta inactiva`,
        );
      }
      if (!linkedSedeIds.has(cancha.sedeId)) {
        throw new BadRequestException(
          `La cancha ${canchaConfig.sedeCanchaId} no pertenece a una sede vinculada a este torneo`,
        );
      }

      // Validate horario times
      for (const h of canchaConfig.horarios || []) {
        if (h.horaInicio >= h.horaFin) {
          throw new BadRequestException(
            `La hora de inicio (${h.horaInicio}) debe ser anterior a la hora de fin (${h.horaFin})`,
          );
        }
      }
    }

    // Execute in transaction
    return this.prisma.$transaction(
      async (tx) => {
        // Delete previous configuration (cascade deletes horarios)
        await tx.torneoCanchaHorario.deleteMany({
          where: { torneoCancha: { tournamentId } },
        });
        await tx.torneoCancha.deleteMany({
          where: { tournamentId },
        });

        // Create new configurations
        const torneoCanchas = [];
        for (const canchaConfig of dto.canchas) {
          const horariosData = (canchaConfig.horarios || []).map((h) => ({
            fecha: new Date(h.fecha),
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
          }));

          const torneoCancha = await tx.torneoCancha.create({
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
                    select: { id: true, nombre: true },
                  },
                },
              },
              horarios: true,
            },
          });
          torneoCanchas.push(torneoCancha);
        }

        return {
          message: 'Configuracion de canchas guardada exitosamente',
          canchasConfiguradas: torneoCanchas,
        };
      },
      { timeout: 15000 },
    );
  }

  /**
   * Obtener la configuracion de canchas de un torneo
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
      throw new NotFoundException(
        `Torneo con ID ${tournamentId} no encontrado`,
      );
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
  async agregarSedeATorneo(
    tournamentId: string,
    sedeId: string,
    userId: string,
    roles: string[],
  ) {
    // Verify ownership
    await this.verifyTournamentOwnership(tournamentId, userId, roles);

    // Verificar que la sede existe y esta activa
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
    });

    if (!sede) {
      throw new NotFoundException(`Sede con ID ${sedeId} no encontrada`);
    }

    if (!sede.activo) {
      throw new BadRequestException(
        'No se puede vincular una sede inactiva al torneo',
      );
    }

    // Verificar si ya esta vinculada
    const existente = await this.prisma.torneoSede.findUnique({
      where: {
        tournamentId_sedeId: {
          tournamentId,
          sedeId,
        },
      },
    });

    if (existente) {
      throw new ConflictException('Esta sede ya esta vinculada al torneo');
    }

    // Check if it's the main sede
    const torneoFull = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { sedeId: true },
    });

    if (torneoFull?.sedeId === sedeId) {
      throw new ConflictException(
        'Esta sede ya es la sede principal del torneo',
      );
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
  async removerSedeDeTorneo(
    tournamentId: string,
    sedeId: string,
    userId: string,
    roles: string[],
  ) {
    // Verify ownership
    await this.verifyTournamentOwnership(tournamentId, userId, roles);

    // Verificar que existe la relacion
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
        'Esta sede no esta vinculada como sede adicional al torneo',
      );
    }

    // Check for matches on canchas of this sede before removing
    const canchasDeEstaSede = await this.prisma.sedeCancha.findMany({
      where: { sedeId },
      select: { id: true },
    });
    const canchaIds = canchasDeEstaSede.map((c) => c.id);

    if (canchaIds.length > 0) {
      const matchesOnCanchas = await this.prisma.match.count({
        where: {
          torneoCancha: {
            tournamentId,
            sedeCanchaId: { in: canchaIds },
          },
          estado: { in: ['PROGRAMADO', 'EN_JUEGO'] },
        },
      });

      if (matchesOnCanchas > 0) {
        throw new BadRequestException(
          `No se puede remover esta sede porque tiene ${matchesOnCanchas} partido(s) programado(s) en sus canchas`,
        );
      }
    }

    // Remove in transaction: canchas config + sede relation
    return this.prisma.$transaction(async (tx) => {
      if (canchaIds.length > 0) {
        // Delete horarios first
        await tx.torneoCanchaHorario.deleteMany({
          where: {
            torneoCancha: {
              tournamentId,
              sedeCanchaId: { in: canchaIds },
            },
          },
        });
        // Delete cancha configs
        await tx.torneoCancha.deleteMany({
          where: {
            tournamentId,
            sedeCanchaId: { in: canchaIds },
          },
        });
      }

      // Delete the sede relation
      return tx.torneoSede.delete({
        where: {
          tournamentId_sedeId: {
            tournamentId,
            sedeId,
          },
        },
      });
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
      throw new NotFoundException(
        `Torneo con ID ${tournamentId} no encontrado`,
      );
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
