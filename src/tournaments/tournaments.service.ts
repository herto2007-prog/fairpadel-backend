import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CreateTournamentDto, UpdateTournamentDto } from './dto';
import * as ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  /**
   * Genera un slug único a partir del nombre del torneo.
   * Formato: nombre-torneo-2025 (con sufijo numérico si ya existe)
   */
  private async generateSlug(nombre: string): Promise<string> {
    const year = new Date().getFullYear();
    const base = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)
      .replace(/^-|-$/g, '');
    let slug = `${base}-${year}`;
    let counter = 0;
    while (true) {
      const existing = await this.prisma.tournament.findUnique({
        where: { slug: counter === 0 ? slug : `${slug}-${counter}` },
      });
      if (!existing) return counter === 0 ? slug : `${slug}-${counter}`;
      counter++;
    }
  }

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
      const slug = await this.generateSlug(createTournamentDto.nombre);

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
          slug,
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
    circuitoId?: string;
    inscripcionesAbiertas?: boolean;
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

    if (filters?.circuitoId) {
      where.circuitoId = filters.circuitoId;
    }

    // Special filter: only tournaments with truly open inscriptions
    if (filters?.inscripcionesAbiertas) {
      where.estado = 'PUBLICADO';
      where.fechaLimiteInscr = { gte: new Date() };
    } else if (filters?.estado) {
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
        circuito: {
          select: {
            id: true,
            nombre: true,
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
        circuito: true,
      },
    });

    if (!tournament) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return tournament;
  }

  async findBySlug(slug: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        categorias: {
          include: { category: true },
        },
        modalidades: true,
        sedePrincipal: {
          include: { canchas: true },
        },
        organizador: {
          select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
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

  // ═══════════════════════════════════════════
  // BATCH CLOSE: cerrar TODAS las inscripciones de un torneo
  // ═══════════════════════════════════════════

  async cerrarTodasLasInscripciones(tournamentId: string, userId: string) {
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

    // Only close categories that are currently open AND haven't progressed past inscriptions
    const result = await this.prisma.tournamentCategory.updateMany({
      where: {
        tournamentId,
        inscripcionAbierta: true,
        estado: 'INSCRIPCIONES_ABIERTAS',
      },
      data: {
        inscripcionAbierta: false,
        estado: 'INSCRIPCIONES_CERRADAS',
      },
    });

    return {
      message: `${result.count} categoría(s) cerrada(s) exitosamente`,
      categoriasCerradas: result.count,
    };
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

  async getDashboardFinanciero(tournamentId: string, userId: string) {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      // Check admin role via user roles
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const isAdmin = userRoles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin) {
        throw new ForbiddenException('No tienes permiso para ver el dashboard financiero');
      }
    }

    // Get all inscriptions with payments, grouped by category
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId },
      include: {
        pagos: true,
        category: true,
        comprobantes: true,
      },
    });

    const costoInscripcion = tournament.costoInscripcion.toNumber();

    // Aggregate totals
    let totalRecaudado = 0;
    let totalComisiones = 0;
    let pagosConfirmados = 0;
    let pagosPendientes = 0;
    let pagosRechazados = 0;
    let inscripcionesGratis = 0;

    const porCategoria: Record<string, {
      categoryId: string;
      categoryNombre: string;
      totalInscritas: number;
      confirmadas: number;
      pendientes: number;
      rechazadas: number;
      montoRecaudado: number;
      montoComisiones: number;
    }> = {};

    for (const insc of inscripciones) {
      const catId = insc.categoryId;
      if (!porCategoria[catId]) {
        porCategoria[catId] = {
          categoryId: catId,
          categoryNombre: insc.category?.nombre || 'Sin categoría',
          totalInscritas: 0,
          confirmadas: 0,
          pendientes: 0,
          rechazadas: 0,
          montoRecaudado: 0,
          montoComisiones: 0,
        };
      }
      porCategoria[catId].totalInscritas++;

      const pagos = insc.pagos || [];
      if (pagos.length > 0) {
        // Track per-inscription: all confirmed → inscription confirmed
        const allConfirmed = pagos.every((p) => p.estado === 'CONFIRMADO');
        const anyRejected = pagos.some((p) => p.estado === 'RECHAZADO');

        for (const pago of pagos) {
          if (pago.estado === 'CONFIRMADO') {
            const monto = pago.monto.toNumber();
            const comision = pago.comision.toNumber();
            totalRecaudado += monto;
            totalComisiones += comision;
            porCategoria[catId].montoRecaudado += monto;
            porCategoria[catId].montoComisiones += comision;
          }
        }

        if (allConfirmed) {
          pagosConfirmados++;
          porCategoria[catId].confirmadas++;
        } else if (anyRejected) {
          pagosRechazados++;
          porCategoria[catId].rechazadas++;
        } else {
          pagosPendientes++;
          porCategoria[catId].pendientes++;
        }
      } else {
        // Free inscription
        inscripcionesGratis++;
        porCategoria[catId].confirmadas++;
      }
    }

    const totalNeto = totalRecaudado - totalComisiones;

    return {
      costoInscripcion,
      totalInscripciones: inscripciones.length,
      totalRecaudado,
      totalComisiones,
      totalNeto,
      pagosConfirmados,
      pagosPendientes,
      pagosRechazados,
      inscripcionesGratis,
      porCategoria: Object.values(porCategoria),
    };
  }

  async exportInscripcionesExcel(tournamentId: string, userId: string): Promise<Buffer> {
    const tournament = await this.findOne(tournamentId);

    if (tournament.organizadorId !== userId) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const isAdmin = userRoles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin) {
        throw new ForbiddenException('No tienes permiso para exportar inscripciones');
      }
    }

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId },
      include: {
        pareja: { include: { jugador1: true, jugador2: true } },
        category: true,
        pagos: true,
        comprobantes: true,
      },
      orderBy: [{ category: { nombre: 'asc' } }, { createdAt: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FairPadel';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Inscripciones');

    // Header row
    sheet.columns = [
      { header: 'Categoría', key: 'categoria', width: 22 },
      { header: 'Modalidad', key: 'modalidad', width: 14 },
      { header: 'Jugador 1', key: 'jugador1', width: 28 },
      { header: 'Doc J1', key: 'docJ1', width: 14 },
      { header: 'Jugador 2', key: 'jugador2', width: 28 },
      { header: 'Doc J2', key: 'docJ2', width: 14 },
      { header: 'Estado', key: 'estado', width: 24 },
      { header: 'Método Pago', key: 'metodoPago', width: 16 },
      { header: 'Monto', key: 'monto', width: 14 },
      { header: 'Comisión', key: 'comision', width: 14 },
      { header: 'Estado Pago', key: 'estadoPago', width: 16 },
      { header: 'Comprobante', key: 'comprobante', width: 12 },
      { header: 'Fecha Inscripción', key: 'fechaInscripcion', width: 20 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const insc of inscripciones) {
      const j1 = insc.pareja?.jugador1;
      const j2 = insc.pareja?.jugador2;
      const hasComprobante = insc.comprobantes && insc.comprobantes.length > 0;

      const pagos = insc.pagos || [];
      const totalMonto = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
      const totalComision = pagos.reduce((sum, p) => sum + Number(p.comision), 0);
      const metodos = [...new Set(pagos.map((p) => p.metodoPago))].join(', ') || '—';
      const estadoPago = pagos.length === 0
        ? 'GRATIS'
        : pagos.every((p) => p.estado === 'CONFIRMADO')
          ? 'CONFIRMADO'
          : pagos.some((p) => p.estado === 'RECHAZADO')
            ? 'RECHAZADO'
            : 'PENDIENTE';

      sheet.addRow({
        categoria: insc.category?.nombre || '—',
        modalidad: insc.modalidad,
        jugador1: j1 ? `${j1.nombre} ${j1.apellido}` : '—',
        docJ1: j1?.documento || '—',
        jugador2: j2 ? `${j2.nombre} ${j2.apellido}` : insc.pareja?.jugador2Documento || '—',
        docJ2: j2?.documento || insc.pareja?.jugador2Documento || '—',
        estado: insc.estado.replace(/_/g, ' '),
        metodoPago: metodos,
        monto: totalMonto,
        comision: totalComision,
        estadoPago: estadoPago.replace(/_/g, ' '),
        comprobante: hasComprobante ? 'Sí' : 'No',
        fechaInscripcion: insc.createdAt.toLocaleDateString('es-PY'),
      });
    }

    // Auto-filter
    sheet.autoFilter = { from: 'A1', to: `M${inscripciones.length + 1}` };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ═══════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════

  private async verifyReportAccess(tournamentId: string, userId: string) {
    const tournament = await this.findOne(tournamentId);
    if (tournament.organizadorId !== userId) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      });
      const isAdmin = userRoles.some((ur) => ur.role.nombre === 'admin');
      if (!isAdmin) {
        throw new ForbiddenException('No tienes permiso para generar reportes');
      }
    }
    return tournament;
  }

  /**
   * 7.1 — Results report: generates a PDF with bracket results per category.
   * Uses PDFKit for server-side PDF generation (A4 landscape).
   */
  async reporteResultadosPdf(tournamentId: string, userId: string): Promise<Buffer> {
    const tournament = await this.verifyReportAccess(tournamentId, userId);

    // Load all matches with pair/player data
    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
      include: {
        pareja1: { include: { jugador1: true, jugador2: true } },
        pareja2: { include: { jugador1: true, jugador2: true } },
        parejaGanadora: { include: { jugador1: true, jugador2: true } },
        category: true,
      },
      orderBy: [{ categoryId: 'asc' }, { numeroRonda: 'asc' }],
    });

    const categories = await this.prisma.tournamentCategory.findMany({
      where: { tournamentId },
      include: { category: true },
      orderBy: { category: { nombre: 'asc' } },
    });

    // Helper: format pair name
    const pairName = (pareja: any, full = false) => {
      if (!pareja) return 'BYE';
      const j1 = pareja.jugador1;
      const j2 = pareja.jugador2;
      if (full) {
        return `${j1?.nombre || ''} ${j1?.apellido || ''} / ${j2?.nombre || ''} ${j2?.apellido || ''}`;
      }
      return `${j1?.apellido || '?'} / ${j2?.apellido || '?'}`;
    };

    // Helper: format score string
    const formatScore = (m: any): string => {
      if (m.set1Pareja1 === null || m.set1Pareja2 === null) return '-';
      let s = `${m.set1Pareja1}-${m.set1Pareja2}`;
      if (m.set2Pareja1 !== null && m.set2Pareja2 !== null) {
        s += ` / ${m.set2Pareja1}-${m.set2Pareja2}`;
      }
      if (m.set3Pareja1 !== null && m.set3Pareja2 !== null) {
        s += ` / ${m.set3Pareja1}-${m.set3Pareja2}`;
      }
      return s;
    };

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });

    // Collect PDF into buffer
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // Title
    doc.fontSize(18).font('Helvetica-Bold').text(tournament.nombre, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#666666')
      .text(`${tournament.ciudad}, ${tournament.pais} | ${new Date(tournament.fechaInicio).toLocaleDateString('es-PY')} al ${new Date(tournament.fechaFin).toLocaleDateString('es-PY')}`, { align: 'center' });
    doc.moveDown(1);
    doc.fillColor('#000000');

    for (const tc of categories) {
      const catMatches = matches.filter((m) => m.categoryId === tc.categoryId);
      if (catMatches.length === 0) continue;

      // Check if we need a new page (if less than 120 points left)
      if (doc.y > doc.page.height - 120) doc.addPage();

      // Category header
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#4F46E5')
        .text(tc.category.nombre);
      doc.moveDown(0.4);
      doc.fillColor('#000000');

      // Podium: champion, finalist, semifinalists
      const finalMatch = catMatches.find((m) => m.ronda === 'FINAL');
      const semiMatches = catMatches.filter((m) => m.ronda === 'SEMIFINAL');

      if (finalMatch?.parejaGanadora) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#16a34a')
          .text(`CAMPEON: ${pairName(finalMatch.parejaGanadora, true)}`);
        doc.fillColor('#000000');

        const finalist = finalMatch.pareja1Id === finalMatch.parejaGanadoraId
          ? finalMatch.pareja2 : finalMatch.pareja1;
        if (finalist) {
          doc.fontSize(10).font('Helvetica').fillColor('#ea580c')
            .text(`FINALISTA: ${pairName(finalist, true)}`);
          doc.fillColor('#000000');
        }

        for (const semi of semiMatches) {
          if (semi.parejaGanadoraId) {
            const loser = semi.pareja1Id === semi.parejaGanadoraId ? semi.pareja2 : semi.pareja1;
            if (loser) {
              doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
                .text(`SEMIFINALISTA: ${pairName(loser, true)}`);
            }
          }
        }
        doc.fillColor('#000000');
      }

      doc.moveDown(0.5);

      // Results table
      const tableTop = doc.y;
      const colWidths = [100, 220, 80, 220];
      const colX = [40, 140, 360, 440];
      const rowH = 18;

      // Header row
      doc.fontSize(8).font('Helvetica-Bold');
      doc.rect(colX[0], tableTop, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowH).fill('#4F46E5');
      doc.fillColor('#FFFFFF');
      doc.text('Ronda', colX[0] + 4, tableTop + 4, { width: colWidths[0] - 8 });
      doc.text('Pareja 1', colX[1] + 4, tableTop + 4, { width: colWidths[1] - 8 });
      doc.text('Score', colX[2] + 4, tableTop + 4, { width: colWidths[2] - 8 });
      doc.text('Pareja 2', colX[3] + 4, tableTop + 4, { width: colWidths[3] - 8 });
      doc.fillColor('#000000');

      let currentY = tableTop + rowH;

      for (let i = 0; i < catMatches.length; i++) {
        const m = catMatches[i];

        // Check page break
        if (currentY + rowH > doc.page.height - 40) {
          doc.addPage();
          currentY = 40;
        }

        // Alternate row background
        if (i % 2 === 0) {
          doc.rect(colX[0], currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowH).fill('#f5f5f5');
          doc.fillColor('#000000');
        }

        const p1 = pairName(m.pareja1);
        const p2 = pairName(m.pareja2);
        const score = formatScore(m);
        const isP1Winner = m.parejaGanadoraId && m.parejaGanadoraId === m.pareja1Id;
        const isP2Winner = m.parejaGanadoraId && m.parejaGanadoraId === m.pareja2Id;

        doc.fontSize(8);
        doc.font('Helvetica').text(m.ronda.replace(/_/g, ' '), colX[0] + 4, currentY + 4, { width: colWidths[0] - 8 });
        doc.font(isP1Winner ? 'Helvetica-Bold' : 'Helvetica').text(p1, colX[1] + 4, currentY + 4, { width: colWidths[1] - 8 });
        doc.font('Helvetica').text(score, colX[2] + 4, currentY + 4, { width: colWidths[2] - 8 });
        doc.font(isP2Winner ? 'Helvetica-Bold' : 'Helvetica').text(p2, colX[3] + 4, currentY + 4, { width: colWidths[3] - 8 });

        currentY += rowH;
      }

      // Draw bottom border
      doc.moveTo(colX[0], currentY).lineTo(colX[0] + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY).stroke('#cccccc');
      doc.y = currentY + 15;
      doc.moveDown(0.5);
    }

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
      .text(`Generado por FairPadel - ${new Date().toLocaleDateString('es-PY')}`, 40, doc.page.height - 30, { align: 'center' });

    doc.end();

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }

  /**
   * 7.2 — Financial report: generates an Excel with income breakdown.
   */
  async reporteFinancieroExcel(tournamentId: string, userId: string): Promise<Buffer> {
    const tournament = await this.verifyReportAccess(tournamentId, userId);
    const dashboard = await this.getDashboardFinanciero(tournamentId, userId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FairPadel';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Reporte Financiero');

    // Tournament header
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = `Reporte Financiero — ${tournament.nombre}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `${tournament.ciudad}, ${tournament.pais} | ${new Date(tournament.fechaInicio).toLocaleDateString('es-PY')} - ${new Date(tournament.fechaFin).toLocaleDateString('es-PY')}`;
    sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

    // Summary
    sheet.getCell('A4').value = 'Resumen Financiero';
    sheet.getCell('A4').font = { bold: true, size: 12 };

    const summaryData = [
      ['Total Inscripciones', dashboard.totalInscripciones],
      ['Costo por Inscripción', dashboard.costoInscripcion],
      ['Total Recaudado', dashboard.totalRecaudado],
      ['Total Comisiones', dashboard.totalComisiones],
      ['Total Neto', dashboard.totalNeto],
      ['Pagos Confirmados', dashboard.pagosConfirmados],
      ['Pagos Pendientes', dashboard.pagosPendientes],
      ['Pagos Rechazados', dashboard.pagosRechazados],
      ['Inscripciones Gratis', dashboard.inscripcionesGratis],
    ];

    let row = 5;
    for (const [label, value] of summaryData) {
      sheet.getCell(`A${row}`).value = label as string;
      sheet.getCell(`A${row}`).font = { bold: true };
      sheet.getCell(`B${row}`).value = typeof value === 'number' ? value : Number(value);
      if (typeof value === 'number' && (label as string).includes('Recaudado') || (label as string).includes('Comisiones') || (label as string).includes('Neto') || (label as string).includes('Costo')) {
        sheet.getCell(`B${row}`).numFmt = '#,##0';
      }
      row++;
    }

    // Per-category breakdown
    row += 2;
    sheet.getCell(`A${row}`).value = 'Desglose por Categoría';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    sheet.getRow(row).values = ['Categoría', 'Inscriptas', 'Confirmadas', 'Pendientes', 'Rechazadas', 'Recaudado', 'Comisiones'];
    sheet.getRow(row).font = { bold: true };
    sheet.getRow(row).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    sheet.getRow(row).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row++;

    for (const cat of dashboard.porCategoria) {
      sheet.getRow(row).values = [
        cat.categoryNombre,
        cat.totalInscritas,
        cat.confirmadas,
        cat.pendientes,
        cat.rechazadas,
        cat.montoRecaudado,
        cat.montoComisiones,
      ];
      row++;
    }

    // Column widths
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 15;
    sheet.getColumn(7).width = 15;

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * 7.3 — Attendance report: generates an Excel listing players per category.
   */
  async reporteAsistenciaExcel(tournamentId: string, userId: string): Promise<Buffer> {
    const tournament = await this.verifyReportAccess(tournamentId, userId);

    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId, estado: 'CONFIRMADA' },
      include: {
        pareja: { include: { jugador1: true, jugador2: true } },
        category: true,
      },
      orderBy: [{ category: { nombre: 'asc' } }, { createdAt: 'asc' }],
    });

    // Get match results for individual stats
    const matches = await this.prisma.match.findMany({
      where: { tournamentId, parejaGanadoraId: { not: null } },
      select: { pareja1Id: true, pareja2Id: true, parejaGanadoraId: true, categoryId: true },
    });

    // Build win/loss map per pareja
    const parejaStats: Record<string, { played: number; won: number }> = {};
    for (const m of matches) {
      if (m.pareja1Id) {
        if (!parejaStats[m.pareja1Id]) parejaStats[m.pareja1Id] = { played: 0, won: 0 };
        parejaStats[m.pareja1Id].played++;
        if (m.parejaGanadoraId === m.pareja1Id) parejaStats[m.pareja1Id].won++;
      }
      if (m.pareja2Id) {
        if (!parejaStats[m.pareja2Id]) parejaStats[m.pareja2Id] = { played: 0, won: 0 };
        parejaStats[m.pareja2Id].played++;
        if (m.parejaGanadoraId === m.pareja2Id) parejaStats[m.pareja2Id].won++;
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FairPadel';
    const sheet = workbook.addWorksheet('Asistencia');

    sheet.columns = [
      { header: 'Categoría', key: 'categoria', width: 22 },
      { header: 'Jugador 1', key: 'jugador1', width: 28 },
      { header: 'Doc J1', key: 'docJ1', width: 14 },
      { header: 'Jugador 2', key: 'jugador2', width: 28 },
      { header: 'Doc J2', key: 'docJ2', width: 14 },
      { header: 'Partidos', key: 'partidos', width: 12 },
      { header: 'Ganados', key: 'ganados', width: 12 },
      { header: 'Efectividad', key: 'efectividad', width: 14 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const insc of inscripciones) {
      const j1 = insc.pareja?.jugador1;
      const j2 = insc.pareja?.jugador2;
      const stats = parejaStats[insc.parejaId] || { played: 0, won: 0 };
      const efectividad = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

      sheet.addRow({
        categoria: insc.category?.nombre || '—',
        jugador1: j1 ? `${j1.nombre} ${j1.apellido}` : '—',
        docJ1: j1?.documento || '—',
        jugador2: j2 ? `${j2.nombre} ${j2.apellido}` : '—',
        docJ2: j2?.documento || '—',
        partidos: stats.played,
        ganados: stats.won,
        efectividad: `${efectividad}%`,
      });
    }

    sheet.autoFilter = { from: 'A1', to: `H${inscripciones.length + 1}` };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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

    // Notificar jugadores afectados (fire-and-forget)
    if (inscripcionesActivas.length > 0) {
      setImmediate(async () => {
        try {
          // Get unique player IDs from cancelled inscriptions
          const inscripcionesConJugadores = await this.prisma.inscripcion.findMany({
            where: {
              tournamentId: id,
              estado: 'CANCELADA',
            },
            include: {
              pareja: { select: { jugador1Id: true, jugador2Id: true } },
            },
          });

          const jugadorIds = new Set<string>();
          for (const insc of inscripcionesConJugadores) {
            if (insc.pareja?.jugador1Id) jugadorIds.add(insc.pareja.jugador1Id);
            if (insc.pareja?.jugador2Id) jugadorIds.add(insc.pareja.jugador2Id);
          }

          for (const jugadorId of jugadorIds) {
            try {
              await this.notificacionesService.notificarTorneoCancelado(jugadorId, {
                torneoNombre: tournament.nombre,
                motivo,
              });
            } catch (e) {
              this.logger.error(`Error notificando cancelación a ${jugadorId}: ${e.message}`);
            }
          }
        } catch (e) {
          this.logger.error(`Error notificando cancelación torneo: ${e.message}`);
        }
      });
    }

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