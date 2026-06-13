import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Request,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ComisionService } from '../../common/services/comision.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// GESTIÓN DE INSCRIPCIONES DEL TORNEO (extraido verbatim de admin-torneos.controller).
// Listado, confirmar/cancelar, búsqueda de jugadores, partidos, inscripción manual
// (con creación de usuario temporal), edición y cambio de categoría.
// Mismo base path admin/torneos + guards + @Roles → URLs sin cambios.
@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminInscripcionesController {
  constructor(
    private prisma: PrismaService,
    private comisionService: ComisionService,
  ) {}

  @Get(':id/inscripciones')
  async getInscripciones(@Param('id') tournamentId: string) {
    try {
      const [inscripciones, categorias] = await Promise.all([
        this.prisma.inscripcion.findMany({
          where: { tournamentId },
          include: {
            category: true,
            jugador1: {
              select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
            },
            jugador2: {
              select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
            },
            pagos: {
              where: { estado: 'CONFIRMADO' },
            },
            controlPagos: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.tournamentCategory.findMany({
          where: { tournamentId },
          include: { category: true },
        }),
      ]);

      // Agrupar por categoría
      const porCategoria = categorias.map(cat => {
        const inscritos = inscripciones.filter(i => i.categoryId === cat.categoryId);
        return {
          categoriaId: cat.categoryId,
          categoriaNombre: cat.category.nombre,
          categoriaTipo: cat.category.tipo,
          total: inscritos.length,
          confirmadas: inscritos.filter(i => i.estado === 'CONFIRMADA').length,
          pendientes: inscritos.filter(i => i.estado === 'PENDIENTE_PAGO' || i.estado === 'PENDIENTE_CONFIRMACION').length,
          inscripciones: inscritos,
        };
      });

      // Stats globales
      const stats = {
        total: inscripciones.length,
        confirmadas: inscripciones.filter(i => i.estado === 'CONFIRMADA').length,
        pendientes: inscripciones.filter(i => i.estado === 'PENDIENTE_PAGO' || i.estado === 'PENDIENTE_CONFIRMACION').length,
        incompletas: inscripciones.filter(i => !i.jugador2Id).length,
        ingresos: inscripciones
          .filter(i => i.estado === 'CONFIRMADA')
          .reduce((sum, i: any) => {
            const pagosOnline = i.pagos?.reduce((pSum: number, p: any) => pSum + Number(p.monto || 0), 0) || 0;
            const pagosOrganizador = i.controlPagos?.reduce((pSum: number, p: any) => pSum + Number(p.monto || 0), 0) || 0;
            return sum + pagosOnline + pagosOrganizador;
          }, 0),
      };

      return {
        success: true,
        stats,
        porCategoria,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error cargando inscripciones',
        error: error.message,
      });
    }
  }

  @Put(':id/inscripciones/:inscripcionId/confirmar')
  async confirmarInscripcion(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
  ) {
    try {
      const inscripcion = await this.prisma.inscripcion.update({
        where: { id: inscripcionId, tournamentId },
        data: { estado: 'CONFIRMADA' },
      });

      await this.comisionService.recalcularComision(tournamentId);

      return {
        success: true,
        message: 'Inscripción confirmada',
        inscripcion,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error confirmando inscripción',
        error: error.message,
      });
    }
  }

  @Put(':id/inscripciones/:inscripcionId/cancelar')
  async cancelarInscripcion(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body('motivo') motivo?: string,
  ) {
    try {
      const inscripcion = await this.prisma.inscripcion.update({
        where: { id: inscripcionId, tournamentId },
        data: { estado: 'CANCELADA' },
      });

      await this.comisionService.recalcularComision(tournamentId);

      return {
        success: true,
        message: 'Inscripción cancelada',
        motivo: motivo || 'Sin motivo especificado',
        inscripcion,
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Error cancelando inscripción',
        error: error.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
  // INSCRIPCIÓN MANUAL (Organizador)
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /admin/torneos/:id/jugadores/buscar
   * Buscar jugadores para inscripción manual
   */
  @Get(':id/jugadores/buscar')
  async buscarJugadores(
    @Param('id') tournamentId: string,
    @Query('q') query: string,
  ) {
    if (!query || query.length < 2) {
      throw new BadRequestException('Mínimo 2 caracteres para buscar');
    }

    const jugadores = await this.prisma.user.findMany({
      where: {
        estado: 'ACTIVO',
        OR: [
          { nombre: { contains: query, mode: 'insensitive' } },
          { apellido: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { documento: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        telefono: true,
        documento: true,
        fotoUrl: true,
        categoriaActual: { select: { id: true, nombre: true, tipo: true } },
      },
      take: 10,
    });

    return { success: true, jugadores };
  }

  /**
   * GET /admin/torneos/:id/partidos
   * Obtener todos los partidos del torneo para programación
   */
  @Get(':id/partidos')
  async getPartidos(@Param('id') tournamentId: string) {
    const partidos = await this.prisma.match.findMany({
      where: {
        tournamentId,
        fixtureVersionId: { not: null },
      },
      include: {
        fixtureVersion: {
          include: {
            tournamentCategory: {
              include: {
                category: {
                  select: { id: true, nombre: true },
                },
              },
            },
          },
        },
        inscripcion1: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        inscripcion2: {
          include: {
            jugador1: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
            jugador2: { select: { id: true, nombre: true, apellido: true, fotoUrl: true } },
          },
        },
        torneoCancha: {
          include: {
            sedeCancha: {
              include: {
                sede: { select: { nombre: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { ronda: 'asc' },
        { numeroRonda: 'asc' },
      ],
    });

    return {
      success: true,
      partidos: partidos.map(p => ({
        id: p.id,
        fase: p.ronda,
        orden: p.numeroRonda,
        categoriaId: p.fixtureVersion?.tournamentCategory?.category?.id,
        categoriaNombre: p.fixtureVersion?.tournamentCategory?.category?.nombre,
        esBye: p.esBye,
        estado: p.estado,
        fechaProgramada: p.fechaProgramada,
        horaProgramada: p.horaProgramada,
        torneoCanchaId: p.torneoCanchaId,
        canchaNombre: p.torneoCancha?.sedeCancha?.nombre,
        sedeNombre: p.torneoCancha?.sedeCancha?.sede?.nombre,
        inscripcion1: p.inscripcion1,
        inscripcion2: p.inscripcion2,
      })),
    };
  }

  /**
   * POST /admin/torneos/:id/inscripciones/manual
   * Crear inscripción manual por organizador
   */
  @Post(':id/inscripciones/manual')
  async crearInscripcionManual(
    @Param('id') tournamentId: string,
    @Body() body: {
      categoryId: string;
      jugador1Id?: string;
      jugador1Temp?: {
        nombre: string;
        apellido: string;
        email: string;
        telefono?: string;
        documento?: string;
      };
      jugador2Id?: string;
      jugador2Temp?: {
        nombre: string;
        apellido: string;
        email: string;
        telefono?: string;
        documento?: string;
      };
      modoPago?: 'COMPLETO' | 'INDIVIDUAL';
      notas?: string;
    },
    @Request() req,
  ) {
    const {
      categoryId,
      jugador1Id,
      jugador1Temp,
      jugador2Id,
      jugador2Temp,
      modoPago = 'COMPLETO',
      notas,
    } = body;

    // Validar torneo
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { categorias: { include: { category: true } } },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Validar categoría
    const categoria = torneo.categorias.find(c => c.categoryId === categoryId);
    if (!categoria) {
      throw new BadRequestException('Categoría no válida para este torneo');
    }

    // Resolver jugador 1 (registrado o temporal)
    let jugador1IdFinal = jugador1Id;
    if (jugador1Temp) {
      // Buscar si ya existe por email
      const existente = await this.prisma.user.findUnique({
        where: { email: jugador1Temp.email },
      });
      if (existente) {
        jugador1IdFinal = existente.id;
      } else {
        // Crear usuario temporal
        const bcrypt = require('bcrypt');
        const crypto = require('crypto');
        const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
        const nuevo = await this.prisma.user.create({
          data: {
            email: jugador1Temp.email,
            password: passwordHash,
            nombre: jugador1Temp.nombre,
            apellido: jugador1Temp.apellido,
            documento: jugador1Temp.documento || `TEMP-${crypto.randomUUID().slice(0, 12)}`,
            telefono: jugador1Temp.telefono || null,
            genero: 'MASCULINO',
            estado: 'NO_VERIFICADO',

            roles: {
              create: {
                role: {
                  connect: { nombre: 'jugador' },
                },
              },
            },
          },
        });
        jugador1IdFinal = nuevo.id;
      }
    }

    if (!jugador1IdFinal) {
      throw new BadRequestException('Debe proporcionar jugador1Id o jugador1Temp');
    }

    // Verificar si jugador1 ya está inscrito
    const existeJugador1 = await this.prisma.inscripcion.findFirst({
      where: {
        tournamentId,
        categoryId,
        OR: [
          { jugador1Id: jugador1IdFinal },
          { jugador2Id: jugador1IdFinal },
        ],
        estado: { not: 'CANCELADA' },
      },
    });

    if (existeJugador1) {
      throw new BadRequestException('El jugador 1 ya está inscrito en esta categoría');
    }

    // Verificar jugador2 si existe
    let jugador2Documento = jugador2Temp?.documento || '';
    let jugador2Email = jugador2Temp?.email;

    if (jugador2Id) {
      const existeJugador2 = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId,
          OR: [
            { jugador1Id: jugador2Id },
            { jugador2Id },
          ],
          estado: { not: 'CANCELADA' },
        },
      });

      if (existeJugador2) {
        throw new BadRequestException('El jugador 2 ya está inscrito en esta categoría');
      }

      const jugador2DB = await this.prisma.user.findUnique({
        where: { id: jugador2Id },
        select: { documento: true, email: true },
      });

      if (jugador2DB) {
        jugador2Documento = jugador2DB.documento;
        jugador2Email = jugador2DB.email;
      }
    }

    // Crear inscripción
    const inscripcion = await this.prisma.inscripcion.create({
      data: {
        tournamentId,
        categoryId,
        jugador1Id: jugador1IdFinal,
        jugador2Id,
        jugador2Email,
        jugador2Documento,
        estado: 'PENDIENTE_PAGO',
        modoPago,
        notas: notas,
      },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        category: true,
      },
    });

    return {
      success: true,
      message: 'Inscripción creada correctamente',
      inscripcion,
    };
  }

  //
  // ═══════════════════════════════════════════════════════════
  // EDITAR INSCRIPCIÓN Y MOVER DE CATEGORÍA
  // ═══════════════════════════════════════════════════════════

  /**
   * PUT /admin/torneos/:id/inscripciones/:inscripcionId
   * Editar datos de una inscripción
   */
  @Put(':id/inscripciones/:inscripcionId')
  async editarInscripcion(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body() body: {
      jugador2Id?: string;
      jugador2Temp?: {
        nombre?: string;
        apellido?: string;
        email?: string;
        telefono?: string;
        documento?: string;
      };
      modoPago?: 'COMPLETO' | 'INDIVIDUAL';
      notas?: string;
    },
  ) {
    let updateData: any = {
      jugador2Id: body.jugador2Id,
      modoPago: body.modoPago,
      notas: body.notas,
    };

    if (body.jugador2Temp) {
      updateData.jugador2Email = body.jugador2Temp.email;
      updateData.jugador2Documento = body.jugador2Temp.documento;
    }

    if (body.jugador2Id && !body.jugador2Temp) {
      const jugador2DB = await this.prisma.user.findUnique({
        where: { id: body.jugador2Id },
        select: { documento: true, email: true },
      });
      if (jugador2DB) {
        updateData.jugador2Documento = jugador2DB.documento;
        updateData.jugador2Email = jugador2DB.email;
      }
    }

    const inscripcion = await this.prisma.inscripcion.update({
      where: { id: inscripcionId, tournamentId },
      data: updateData,
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        category: true,
      },
    });

    return {
      success: true,
      message: 'Inscripción actualizada',
      inscripcion,
    };
  }

  /**
   * PUT /admin/torneos/:id/inscripciones/:inscripcionId/cambiar-categoria
   * Mover inscripción a otra categoría
   */
  @Put(':id/inscripciones/:inscripcionId/cambiar-categoria')
  async cambiarCategoria(
    @Param('id') tournamentId: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body('nuevaCategoriaId') nuevaCategoriaId: string,
  ) {
    // Validar que la nueva categoría existe en el torneo
    const categoriaExiste = await this.prisma.tournamentCategory.findFirst({
      where: { tournamentId, categoryId: nuevaCategoriaId },
    });

    if (!categoriaExiste) {
      throw new BadRequestException('La categoría no existe en este torneo');
    }

    // Obtener inscripción actual
    const inscripcionActual = await this.prisma.inscripcion.findUnique({
      where: { id: inscripcionId, tournamentId },
      select: { jugador1Id: true, jugador2Id: true },
    });

    if (!inscripcionActual) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    // Verificar que ninguno de los jugadores esté ya en la nueva categoría
    if (inscripcionActual.jugador1Id) {
      const existe = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId: nuevaCategoriaId,
          OR: [
            { jugador1Id: inscripcionActual.jugador1Id },
            { jugador2Id: inscripcionActual.jugador1Id },
          ],
          estado: { not: 'CANCELADA' },
          id: { not: inscripcionId },
        },
      });
      if (existe) {
        throw new BadRequestException('El jugador 1 ya está inscrito en la categoría destino');
      }
    }

    if (inscripcionActual.jugador2Id) {
      const existe = await this.prisma.inscripcion.findFirst({
        where: {
          tournamentId,
          categoryId: nuevaCategoriaId,
          OR: [
            { jugador1Id: inscripcionActual.jugador2Id },
            { jugador2Id: inscripcionActual.jugador2Id },
          ],
          estado: { not: 'CANCELADA' },
          id: { not: inscripcionId },
        },
      });
      if (existe) {
        throw new BadRequestException('El jugador 2 ya está inscrito en la categoría destino');
      }
    }

    const inscripcion = await this.prisma.inscripcion.update({
      where: { id: inscripcionId, tournamentId },
      data: { categoryId: nuevaCategoriaId },
      include: {
        jugador1: { select: { id: true, nombre: true, apellido: true } },
        jugador2: { select: { id: true, nombre: true, apellido: true } },
        category: true,
      },
    });

    return {
      success: true,
      message: 'Inscripción movida a ' + inscripcion.category.nombre,
      inscripcion,
    };
  }
}
