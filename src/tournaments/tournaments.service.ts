import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  BadRequestException 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto, UpdateTournamentDto } from './dto';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async create(createTournamentDto: CreateTournamentDto, organizadorId: string) {
    // Premium gating: free organizers can have max 1 active tournament
    const organizador = await this.prisma.user.findUnique({ where: { id: organizadorId } });
    if (!organizador.esPremium) {
      const torneosActivos = await this.prisma.tournament.count({
        where: {
          organizadorId,
          estado: { in: ['BORRADOR', 'PENDIENTE_APROBACION', 'PUBLICADO', 'EN_CURSO'] },
        },
      });
      if (torneosActivos >= 1) {
        throw new ForbiddenException(
          'Necesitas FairPadel Premium para crear más de un torneo activo a la vez',
        );
      }
      // Free: max 12 categories
      if (createTournamentDto.categorias && createTournamentDto.categorias.length > 12) {
        throw new ForbiddenException(
          'Necesitas FairPadel Premium para usar más de 12 categorías',
        );
      }
    }

    let fechaInicio: Date;
    let fechaFin: Date;
    let fechaLimite: Date;

    try {
      fechaInicio = new Date(createTournamentDto.fechaInicio);
      fechaFin = new Date(createTournamentDto.fechaFin);
      fechaLimite = new Date(createTournamentDto.fechaLimiteInscripcion);

      if (isNaN(fechaInicio.getTime())) {
        throw new Error('Fecha de inicio inválida');
      }
      if (isNaN(fechaFin.getTime())) {
        throw new Error('Fecha de fin inválida');
      }
      if (isNaN(fechaLimite.getTime())) {
        throw new Error('Fecha límite de inscripción inválida');
      }
    } catch (error) {
      throw new BadRequestException(`Error en las fechas: ${error.message}`);
    }

    if (fechaFin <= fechaInicio) {
      throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
    }

    if (fechaLimite >= fechaInicio) {
      throw new BadRequestException('La fecha límite de inscripción debe ser anterior a la fecha de inicio');
    }

    const categorias = await this.prisma.category.findMany({
      where: {
        id: {
          in: createTournamentDto.categorias,
        },
      },
    });

    if (categorias.length !== createTournamentDto.categorias.length) {
      throw new BadRequestException('Una o más categorías no existen');
    }

    const existingTournament = await this.prisma.tournament.findFirst({
      where: {
        nombre: createTournamentDto.nombre,
        organizadorId: organizadorId,
      },
    });

    if (existingTournament) {
      throw new BadRequestException('Ya tienes un torneo con este nombre');
    }

    try {
      const tournament = await this.prisma.tournament.create({
        data: {
          nombre: createTournamentDto.nombre,
          descripcion: createTournamentDto.descripcion,
          pais: createTournamentDto.pais,
          region: createTournamentDto.region,
          ciudad: createTournamentDto.ciudad,
          fechaInicio: fechaInicio,
          fechaFin: fechaFin,
          fechaLimiteInscr: fechaLimite,
          flyerUrl: createTournamentDto.flyerUrl,
          costoInscripcion: createTournamentDto.costoInscripcion,
          sedeId: createTournamentDto.sedeId || undefined,
          minutosPorPartido: createTournamentDto.minutosPorPartido || 60,
          sede: createTournamentDto.sede,
          direccion: createTournamentDto.direccion,
          mapsUrl: createTournamentDto.mapsUrl,
          organizadorId: organizadorId,
          estado: 'BORRADOR',
          categorias: {
            create: createTournamentDto.categorias.map((categoryId) => ({
              categoryId: categoryId,
            })),
          },
          modalidades: {
            create: createTournamentDto.modalidades.map((modalidad) => ({
              modalidad: modalidad,
            })),
          },
        },
        include: {
          categorias: {
            include: {
              category: true,
            },
          },
          modalidades: true,
          organizador: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
            },
          },
        },
      });

      return tournament;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Ya existe un torneo con estos datos');
      }
      if (error.code === 'P2003') {
        throw new BadRequestException('Error de relación con categorías o modalidades');
      }
      throw new BadRequestException(`Error al crear torneo: ${error.message}`);
    }
  }

  async findAll(filters?: {
    pais?: string;
    ciudad?: string;
    estado?: string;
    nombre?: string;
  }) {
    const where: any = {};

    if (filters?.pais) {
      where.pais = filters.pais;
    }

    if (filters?.ciudad) {
      where.ciudad = filters.ciudad;
    }

    if (filters?.nombre) {
      where.nombre = { contains: filters.nombre, mode: 'insensitive' };
    }

    if (filters?.estado) {
      where.estado = filters.estado;
    } else {
      where.estado = {
        in: ['PUBLICADO', 'EN_CURSO', 'FINALIZADO', 'PENDIENTE_APROBACION'],
      };
    }

    const tournaments = await this.prisma.tournament.findMany({
      where,
      include: {
        categorias: {
          include: {
            category: true,
          },
        },
        modalidades: true,
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
      orderBy: {
        fechaInicio: 'asc',
      },
    });

    return tournaments;
  }

  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        categorias: {
          include: {
            category: true,
          },
        },
        modalidades: true,
        sedePrincipal: {
          include: {
            canchas: true,
          },
        },
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return tournament;
  }

  async findMyTournaments(organizadorId: string) {
    return this.prisma.tournament.findMany({
      where: {
        organizadorId,
      },
      include: {
        categorias: {
          include: {
            category: true,
          },
        },
        modalidades: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(id: string, updateTournamentDto: UpdateTournamentDto, userId: string) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para editar este torneo');
    }

    if (['FINALIZADO', 'CANCELADO'].includes(tournament.estado)) {
      throw new ForbiddenException('No se puede editar un torneo finalizado o cancelado');
    }

    if (updateTournamentDto.fechaInicio || updateTournamentDto.fechaFin || updateTournamentDto.fechaLimiteInscripcion) {
      const fechaInicio = updateTournamentDto.fechaInicio 
        ? new Date(updateTournamentDto.fechaInicio) 
        : tournament.fechaInicio;
      const fechaFin = updateTournamentDto.fechaFin 
        ? new Date(updateTournamentDto.fechaFin) 
        : tournament.fechaFin;
      const fechaLimite = updateTournamentDto.fechaLimiteInscripcion 
        ? new Date(updateTournamentDto.fechaLimiteInscripcion) 
        : tournament.fechaLimiteInscr;

      if (fechaFin < fechaInicio) {
        throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
      }

      if (fechaLimite >= fechaInicio) {
        throw new BadRequestException('La fecha límite de inscripción debe ser anterior a la fecha de inicio');
      }
    }

    const updateData: any = {
      nombre: updateTournamentDto.nombre,
      descripcion: updateTournamentDto.descripcion,
      pais: updateTournamentDto.pais,
      region: updateTournamentDto.region,
      ciudad: updateTournamentDto.ciudad,
      sedeId: updateTournamentDto.sedeId,
      minutosPorPartido: updateTournamentDto.minutosPorPartido,
      sede: updateTournamentDto.sede,
      direccion: updateTournamentDto.direccion,
      mapsUrl: updateTournamentDto.mapsUrl,
      costoInscripcion: updateTournamentDto.costoInscripcion,
      habilitarBancard: updateTournamentDto.habilitarBancard,
      flyerUrl: updateTournamentDto.flyerUrl,
    };

    if (updateTournamentDto.fechaInicio) {
      updateData.fechaInicio = new Date(updateTournamentDto.fechaInicio);
    }
    if (updateTournamentDto.fechaFin) {
      updateData.fechaFin = new Date(updateTournamentDto.fechaFin);
    }
    if (updateTournamentDto.fechaLimiteInscripcion) {
      updateData.fechaLimiteInscr = new Date(updateTournamentDto.fechaLimiteInscripcion);
    }

    if (updateTournamentDto.categorias) {
      await this.prisma.tournamentCategory.deleteMany({
        where: { tournamentId: id },
      });

      updateData.categorias = {
        create: updateTournamentDto.categorias.map((categoryId) => ({
          categoryId: categoryId,
        })),
      };
    }

    if (updateTournamentDto.modalidades) {
      await this.prisma.tournamentModalidad.deleteMany({
        where: { tournamentId: id },
      });

      updateData.modalidades = {
        create: updateTournamentDto.modalidades.map((modalidad) => ({
          modalidad: modalidad,
        })),
      };
    }

    const updated = await this.prisma.tournament.update({
      where: { id },
      data: updateData,
      include: {
        categorias: {
          include: {
            category: true,
          },
        },
        modalidades: true,
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
    });

    return updated;
  }

  async publish(id: string, userId: string) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para publicar este torneo');
    }

    if (tournament.estado !== 'BORRADOR' && tournament.estado !== 'RECHAZADO') {
      throw new BadRequestException('Solo se pueden publicar torneos en borrador o rechazados');
    }

    return this.prisma.tournament.update({
      where: { id },
      data: { estado: 'PENDIENTE_APROBACION' },
      include: {
        categorias: {
          include: {
            category: true,
          },
        },
        modalidades: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este torneo');
    }

    if (tournament.estado !== 'BORRADOR') {
      throw new BadRequestException('Solo se pueden eliminar torneos en borrador');
    }

    await this.prisma.tournament.delete({
      where: { id },
    });

    return { message: 'Torneo eliminado exitosamente' };
  }

  async obtenerCategorias() {
    const categorias = await this.prisma.category.findMany({
      orderBy: [
        { tipo: 'asc' },
        { orden: 'desc' },
      ],
    });
    return categorias;
  }

  async toggleInscripcionCategoria(tournamentId: string, tournamentCategoryId: string, userId: string) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para modificar este torneo');
    }

    const tournamentCategory = await this.prisma.tournamentCategory.findFirst({
      where: { id: tournamentCategoryId, tournamentId },
    });

    if (!tournamentCategory) {
      throw new NotFoundException('Categoría del torneo no encontrada');
    }

    // No permitir toggle si la categoría ya tiene sorteo realizado
    if (
      ['SORTEO_REALIZADO', 'EN_CURSO', 'FINALIZADA'].includes(
        tournamentCategory.estado,
      )
    ) {
      throw new BadRequestException(
        'No se puede reabrir inscripciones de una categoría que ya tiene sorteo',
      );
    }

    const newInscripcionAbierta = !tournamentCategory.inscripcionAbierta;
    const newEstado = newInscripcionAbierta
      ? 'INSCRIPCIONES_ABIERTAS'
      : 'INSCRIPCIONES_CERRADAS';

    return this.prisma.tournamentCategory.update({
      where: { id: tournamentCategoryId },
      data: {
        inscripcionAbierta: newInscripcionAbierta,
        estado: newEstado as any,
      },
      include: { category: true },
    });
  }

  async getStats(tournamentId: string, userId: string) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para ver las estadísticas de este torneo');
    }

    const [inscripcionesCount, partidosCount, canchasCount, inscripcionesPorCategoria] = await Promise.all([
      this.prisma.inscripcion.count({ where: { tournamentId } }),
      this.prisma.match.count({ where: { tournamentId } }),
      this.prisma.torneoCancha.count({ where: { tournamentId } }),
      this.prisma.inscripcion.groupBy({
        by: ['categoryId'],
        where: { tournamentId },
        _count: { id: true },
      }),
    ]);

    const categorias = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId },
      include: { category: true },
    });

    const categoriasConStats = categorias.map((tc) => {
      const stats = inscripcionesPorCategoria.find((i) => i.categoryId === tc.categoryId);
      return {
        ...tc,
        inscripcionesCount: stats?._count?.id || 0,
      };
    });

    return {
      inscripcionesTotal: inscripcionesCount,
      partidosTotal: partidosCount,
      canchasConfiguradas: canchasCount,
      categorias: categoriasConStats,
    };
  }

  async getPelotasRonda(tournamentId: string, userId: string) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para ver esta configuración');
    }

    return this.prisma.torneoPelotasRonda.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updatePelotasRonda(
    tournamentId: string,
    rondas: { ronda: string; cantidadPelotas: number }[],
    userId: string,
  ) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para modificar esta configuración');
    }

    // Eliminar configuración anterior
    await this.prisma.torneoPelotasRonda.deleteMany({
      where: { tournamentId },
    });

    // Crear nuevas configuraciones
    const creadas = await Promise.all(
      rondas.map((r) =>
        this.prisma.torneoPelotasRonda.create({
          data: {
            tournamentId,
            ronda: r.ronda,
            cantidadPelotas: r.cantidadPelotas,
          },
        }),
      ),
    );

    return creadas;
  }

  // ═══════════════════════════════════════════
  // AYUDANTES
  // ═══════════════════════════════════════════

  async getAyudantes(tournamentId: string, userId: string) {
    await this.findOne(tournamentId); // Verifica existencia

    return this.prisma.torneoAyudante.findMany({
      where: { tournamentId },
      include: { user: { select: { id: true, nombre: true, apellido: true, documento: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addAyudante(
    tournamentId: string,
    data: { documento: string; nombre?: string; rol?: string },
    userId: string,
  ) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para modificar este torneo');
    }

    // Premium gating: ayudantes require premium
    const organizador = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!organizador.esPremium) {
      throw new ForbiddenException('Necesitas FairPadel Premium para agregar ayudantes');
    }

    // Buscar usuario por documento
    const matchedUser = await this.prisma.user.findFirst({
      where: { documento: data.documento },
    });

    return this.prisma.torneoAyudante.create({
      data: {
        tournamentId,
        documento: data.documento,
        nombre: data.nombre || (matchedUser ? `${matchedUser.nombre} ${matchedUser.apellido}` : null),
        userId: matchedUser?.id || null,
        rol: data.rol || 'ayudante',
      },
      include: { user: { select: { id: true, nombre: true, apellido: true, documento: true, email: true } } },
    });
  }

  // ═══════════════════════════════════════════
  // FINALIZACIÓN DE TORNEO
  // ═══════════════════════════════════════════

  async finalizarTorneo(id: string, userId: string) {
    const tournament = await this.findOne(id);

    if (tournament.organizadorId !== userId) {
      // Check if user is admin
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const isAdmin = userRoles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin) {
        throw new ForbiddenException('No tienes permiso para finalizar este torneo');
      }
    }

    if (tournament.estado === 'FINALIZADO') {
      throw new BadRequestException('Este torneo ya está finalizado');
    }

    if (tournament.estado !== 'EN_CURSO') {
      throw new BadRequestException('Solo se pueden finalizar torneos en curso');
    }

    // Verificar que TODAS las categorías estén finalizadas
    const categorias = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId: id },
      include: { category: true },
    });

    const noFinalizadas = categorias.filter((tc) => tc.estado !== 'FINALIZADA');
    if (noFinalizadas.length > 0) {
      const nombres = noFinalizadas.map((tc) => tc.category.nombre).join(', ');
      throw new BadRequestException(
        `No se puede finalizar: las siguientes categorías no están finalizadas: ${nombres}`,
      );
    }

    // Transicionar torneo → FINALIZADO
    await this.prisma.tournament.update({
      where: { id },
      data: { estado: 'FINALIZADO' },
    });

    return {
      message: 'Torneo finalizado exitosamente',
      categoriasFinalizadas: categorias.length,
    };
  }

  // ═══════════════════════════════════════════
  // FLYER
  // ═══════════════════════════════════════════

  async updateFlyerUrl(id: string, flyerUrl: string) {
    return this.prisma.tournament.update({
      where: { id },
      data: { flyerUrl },
    });
  }

  // ═══════════════════════════════════════════
  // CANCELAR TORNEO
  // ═══════════════════════════════════════════

  async cancelarTorneo(id: string, userId: string, motivo: string) {
    const tournament = await this.findOne(id);

    // Solo organizador dueño o admin
    if (tournament.organizadorId !== userId) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const isAdmin = userRoles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin) {
        throw new ForbiddenException('No tienes permiso para cancelar este torneo');
      }
    }

    // Solo se puede cancelar si no está EN_CURSO o FINALIZADO
    const estadosPermitidos = ['BORRADOR', 'PENDIENTE_APROBACION', 'PUBLICADO', 'RECHAZADO'];
    if (!estadosPermitidos.includes(tournament.estado)) {
      throw new BadRequestException(
        `No se puede cancelar un torneo en estado ${tournament.estado}. Solo se permite cancelar torneos en estado: ${estadosPermitidos.join(', ')}`,
      );
    }

    // Cancelar todas las inscripciones confirmadas
    const inscripcionesActivas = await this.prisma.inscripcion.findMany({
      where: {
        tournamentId: id,
        estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO_PRESENCIAL'] },
      },
    });

    if (inscripcionesActivas.length > 0) {
      await this.prisma.inscripcion.updateMany({
        where: {
          tournamentId: id,
          estado: { in: ['CONFIRMADA', 'PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO_PRESENCIAL'] },
        },
        data: { estado: 'CANCELADA' },
      });
    }

    // Actualizar estado del torneo
    await this.prisma.tournament.update({
      where: { id },
      data: { estado: 'CANCELADO' },
    });

    return {
      message: 'Torneo cancelado exitosamente',
      motivo,
      inscripcionesCanceladas: inscripcionesActivas.length,
    };
  }

  async removeAyudante(tournamentId: string, ayudanteId: string, userId: string) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      throw new ForbiddenException('No tienes permiso para modificar este torneo');
    }

    await this.prisma.torneoAyudante.delete({
      where: { id: ayudanteId },
    });

    return { deleted: true };
  }

  // ═══════════════════════════════════════════
  // CUENTAS BANCARIAS (para transferencias)
  // ═══════════════════════════════════════════

  async getCuentasBancarias(tournamentId: string) {
    await this.findOne(tournamentId); // Verifica existencia

    return this.prisma.cuentaBancaria.findMany({
      where: { tournamentId, activa: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCuentaBancaria(
    tournamentId: string,
    data: {
      banco: string;
      titular: string;
      cedulaRuc: string;
      nroCuenta?: string;
      aliasSpi?: string;
      telefonoComprobante?: string;
    },
    userId: string,
  ) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      // Check if user is admin
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const isAdmin = userRoles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin) {
        throw new ForbiddenException('No tienes permiso para modificar este torneo');
      }
    }

    // Premium gating: free organizers can have max 1 bank account
    const organizador = await this.prisma.user.findUnique({ where: { id: tournament.organizadorId } });
    if (!organizador.esPremium) {
      const cuentasActivas = await this.prisma.cuentaBancaria.count({
        where: { tournamentId, activa: true },
      });
      if (cuentasActivas >= 1) {
        throw new ForbiddenException(
          'Necesitas FairPadel Premium para agregar más de una cuenta bancaria',
        );
      }
    }

    return this.prisma.cuentaBancaria.create({
      data: {
        tournamentId,
        banco: data.banco,
        titular: data.titular,
        cedulaRuc: data.cedulaRuc,
        nroCuenta: data.nroCuenta || null,
        aliasSpi: data.aliasSpi || null,
        telefonoComprobante: data.telefonoComprobante || null,
      },
    });
  }

  async updateCuentaBancaria(
    tournamentId: string,
    cuentaId: string,
    data: {
      banco?: string;
      titular?: string;
      cedulaRuc?: string;
      nroCuenta?: string;
      aliasSpi?: string;
      telefonoComprobante?: string;
      activa?: boolean;
    },
    userId: string,
  ) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const isAdmin = userRoles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin) {
        throw new ForbiddenException('No tienes permiso para modificar este torneo');
      }
    }

    const cuenta = await this.prisma.cuentaBancaria.findFirst({
      where: { id: cuentaId, tournamentId },
    });

    if (!cuenta) {
      throw new NotFoundException('Cuenta bancaria no encontrada');
    }

    return this.prisma.cuentaBancaria.update({
      where: { id: cuentaId },
      data,
    });
  }

  async deleteCuentaBancaria(tournamentId: string, cuentaId: string, userId: string) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const isAdmin = userRoles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin) {
        throw new ForbiddenException('No tienes permiso para modificar este torneo');
      }
    }

    const cuenta = await this.prisma.cuentaBancaria.findFirst({
      where: { id: cuentaId, tournamentId },
    });

    if (!cuenta) {
      throw new NotFoundException('Cuenta bancaria no encontrada');
    }

    await this.prisma.cuentaBancaria.delete({
      where: { id: cuentaId },
    });

    return { deleted: true };
  }
}