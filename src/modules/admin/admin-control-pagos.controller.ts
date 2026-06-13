import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// CONTROL DE PAGOS DEL ORGANIZADOR (extraido verbatim de admin-torneos.controller).
// Sistema paralelo de registro manual de pagos (efectivo/transferencia),
// no relacionado con pagos premium ni Bancard.
@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'organizador')
export class AdminControlPagosController {
  constructor(
    private prisma: PrismaService,
    private tournamentsService: TournamentsService,
  ) {}

  /**
   * GET /admin/torneos/:id/control-pagos
   * Listar estado de pagos individual por jugador
   */
  @Get(':id/control-pagos')
  async listarControlPagos(
    @Param('id') tournamentId: string,
    @Request() req: any,
    @Query('filtro') filtro?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    // Verificar que el usuario es organizador del torneo
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizadorId: true, costoInscripcion: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const puede = await this.tournamentsService.puedeGestionarTorneo(tournamentId, req.user.userId, req.user.roles);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso para ver este torneo');
    }

    const costoInscripcion = Number(torneo.costoInscripcion || 0);

    // Obtener todas las inscripciones con sus pagos
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId },
      include: {
        category: true,
        jugador1: {
          select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
        },
        jugador2: {
          select: { id: true, nombre: true, apellido: true, telefono: true, email: true },
        },
        controlPagos: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transformar a vista por jugador individual
    const jugadores: any[] = [];
    
    for (const insc of inscripciones) {
      // Jugador 1 siempre existe
      const pagosJ1 = insc.controlPagos.filter(p => p.jugadorId === insc.jugador1Id);
      const totalPagadoJ1 = pagosJ1.reduce((sum, p) => sum + p.monto, 0);
      const debeJ1 = Math.max(0, costoInscripcion / 2 - totalPagadoJ1);

      jugadores.push({
        inscripcionId: insc.id,
        jugadorId: insc.jugador1.id,
        jugadorNombre: `${insc.jugador1.nombre} ${insc.jugador1.apellido}`,
        jugadorTelefono: insc.jugador1.telefono,
        jugadorEmail: insc.jugador1.email,
        parejaNombre: insc.jugador2 ? `${insc.jugador2.nombre} ${insc.jugador2.apellido}` : 'Sin pareja',
        categoriaId: insc.category.id,
        categoriaNombre: insc.category.nombre,
        estadoInscripcion: insc.estado,
        costoIndividual: costoInscripcion / 2,
        totalPagado: totalPagadoJ1,
        debe: debeJ1,
        estaAlDia: debeJ1 === 0,
        pagos: pagosJ1.map(p => ({
          id: p.id,
          monto: p.monto,
          metodo: p.metodo,
          fecha: p.fecha,
          nota: p.nota,
        })),
      });

      // Jugador 2 (si existe y ya aceptó)
      if (insc.jugador2) {
        const pagosJ2 = insc.controlPagos.filter(p => p.jugadorId === insc.jugador2!.id);
        const totalPagadoJ2 = pagosJ2.reduce((sum, p) => sum + p.monto, 0);
        const debeJ2 = Math.max(0, costoInscripcion / 2 - totalPagadoJ2);

        jugadores.push({
          inscripcionId: insc.id,
          jugadorId: insc.jugador2.id,
          jugadorNombre: `${insc.jugador2.nombre} ${insc.jugador2.apellido}`,
          jugadorTelefono: insc.jugador2.telefono,
          jugadorEmail: insc.jugador2.email,
          parejaNombre: `${insc.jugador1.nombre} ${insc.jugador1.apellido}`,
          categoriaId: insc.category.id,
          categoriaNombre: insc.category.nombre,
          estadoInscripcion: insc.estado,
          costoIndividual: costoInscripcion / 2,
          totalPagado: totalPagadoJ2,
          debe: debeJ2,
          estaAlDia: debeJ2 === 0,
          pagos: pagosJ2.map(p => ({
            id: p.id,
            monto: p.monto,
            metodo: p.metodo,
            fecha: p.fecha,
            nota: p.nota,
          })),
        });
      }
    }

    // Aplicar filtros
    let filtrados = jugadores;

    if (categoriaId && categoriaId !== 'todas') {
      filtrados = filtrados.filter(j => j.categoriaId === categoriaId);
    }

    if (filtro === 'deudores') {
      filtrados = filtrados.filter(j => j.debe > 0);
    } else if (filtro === 'pagados') {
      filtrados = filtrados.filter(j => j.debe === 0);
    }

    if (busqueda) {
      const term = busqueda.toLowerCase();
      filtrados = filtrados.filter(j => 
        j.jugadorNombre.toLowerCase().includes(term) ||
        j.parejaNombre.toLowerCase().includes(term)
      );
    }

    // Calcular totales
    const totalCobrado = filtrados.reduce((sum, j) => sum + j.totalPagado, 0);
    const totalDeben = filtrados.reduce((sum, j) => sum + j.debe, 0);

    return {
      success: true,
      stats: {
        totalJugadores: filtrados.length,
        totalCobrado,
        totalDeben,
        alDia: filtrados.filter(j => j.estaAlDia).length,
        deudores: filtrados.filter(j => !j.estaAlDia).length,
      },
      jugadores: filtrados,
    };
  }

  /**
   * POST /admin/torneos/:id/control-pagos
   * Registrar un pago de un jugador
   */
  @Post(':id/control-pagos')
  async registrarPago(
    @Param('id') tournamentId: string,
    @Request() req: any,
    @Body() body: { inscripcionId: string; jugadorId: string; monto: number; metodo: 'EFECTIVO' | 'TRANSFERENCIA'; fecha: string; nota?: string },
  ) {
    // Verificar organizador
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizadorId: true, costoInscripcion: true },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const puede = await this.tournamentsService.puedeGestionarTorneo(tournamentId, req.user.userId, req.user.roles);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso');
    }

    // Verificar que la inscripción existe y pertenece al torneo
    const inscripcion = await this.prisma.inscripcion.findFirst({
      where: { 
        id: body.inscripcionId,
        tournamentId,
      },
    });

    if (!inscripcion) {
      throw new NotFoundException('Inscripción no encontrada');
    }

    // Crear el pago
    const pago = await this.prisma.controlPagoOrganizador.create({
      data: {
        inscripcionId: body.inscripcionId,
        jugadorId: body.jugadorId,
        monto: body.monto,
        metodo: body.metodo,
        fecha: body.fecha,
        nota: body.nota,
        registradoPor: req.user.userId,
      },
    });

    return {
      success: true,
      message: 'Pago registrado correctamente',
      pago: {
        id: pago.id,
        monto: pago.monto,
        metodo: pago.metodo,
        fecha: pago.fecha,
        nota: pago.nota,
      },
    };
  }

  /**
   * DELETE /admin/torneos/:id/control-pagos/:pagoId
   * Eliminar un pago registrado (en caso de error)
   */
  @Delete(':id/control-pagos/:pagoId')
  async eliminarPago(
    @Param('id') tournamentId: string,
    @Param('pagoId') pagoId: string,
    @Request() req: any,
  ) {
    // Verificar organizador
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizadorId: true },
    });

    const puede = await this.tournamentsService.puedeGestionarTorneo(tournamentId, req.user.userId, req.user.roles);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso');
    }

    // Verificar que el pago existe y pertenece a una inscripción del torneo
    const pago = await this.prisma.controlPagoOrganizador.findFirst({
      where: {
        id: pagoId,
        inscripcion: { tournamentId },
      },
    });

    if (!pago) {
      throw new NotFoundException('Pago no encontrado');
    }

    await this.prisma.controlPagoOrganizador.delete({
      where: { id: pagoId },
    });

    return {
      success: true,
      message: 'Pago eliminado correctamente',
    };
  }

  /**
   * PUT /admin/torneos/:id/control-pagos/:pagoId
   * Editar un pago registrado
   */
  @Put(':id/control-pagos/:pagoId')
  async editarPago(
    @Param('id') tournamentId: string,
    @Param('pagoId') pagoId: string,
    @Request() req: any,
    @Body() body: { monto: number; metodo: 'EFECTIVO' | 'TRANSFERENCIA'; fecha: string; nota?: string },
  ) {
    // Verificar organizador
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizadorId: true },
    });

    const puede = await this.tournamentsService.puedeGestionarTorneo(tournamentId, req.user.userId, req.user.roles);
    if (!puede) {
      throw new ForbiddenException('No tienes permiso');
    }

    // Verificar que el pago existe y pertenece a una inscripción del torneo
    const pagoExistente = await this.prisma.controlPagoOrganizador.findFirst({
      where: {
        id: pagoId,
        inscripcion: { tournamentId },
      },
    });

    if (!pagoExistente) {
      throw new NotFoundException('Pago no encontrado');
    }

    // Actualizar el pago
    const pago = await this.prisma.controlPagoOrganizador.update({
      where: { id: pagoId },
      data: {
        monto: body.monto,
        metodo: body.metodo,
        fecha: body.fecha,
        nota: body.nota,
      },
    });

    return {
      success: true,
      message: 'Pago actualizado correctamente',
      pago: {
        id: pago.id,
        monto: pago.monto,
        metodo: pago.metodo,
        fecha: pago.fecha,
        nota: pago.nota,
      },
    };
  }
}
