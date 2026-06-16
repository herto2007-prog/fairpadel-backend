import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TorneoGestionGuard } from '../../common/guards/torneo-gestion.guard';

class SubirComprobanteDto {
  @IsString()
  comprobanteUrl: string;

  @IsString()
  @IsOptional()
  notas?: string;
}

// DETALLE / COMISIÓN / ESTADO / OVERVIEW DEL TORNEO (extraido verbatim de
// admin-torneos.controller). Lecturas pesadas del dashboard del organizador
// + subida de comprobante de comisión.
// Mismo base path admin/torneos + guards + @Roles → URLs sin cambios.
// TorneoGestionGuard a nivel controller: toda ruta tiene :id (el torneo),
// así solo admin / dueño / coorganizador pueden operar (evita IDOR entre organizadores).
@Controller('admin/torneos')
@UseGuards(JwtAuthGuard, RolesGuard, TorneoGestionGuard)
@Roles('admin', 'organizador')
export class AdminTorneoOverviewController {
  constructor(private prisma: PrismaService) {}

  @Get(':id/detalle')
  async getDetalleCompleto(@Param('id') id: string) {
    const [torneo, comision, checklist, configComision] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id },
        include: {
          organizador: {
            select: { id: true, nombre: true, apellido: true, email: true, telefono: true },
          },
          categorias: { include: { category: true } },
          modalidades: { include: { modalidadConfig: true } },
          sedePrincipal: true,
          _count: { select: { inscripciones: true } },
        },
      }),
      this.prisma.torneoComision.findUnique({
        where: { tournamentId: id },
      }),
      this.prisma.checklistItem.findMany({
        where: { tournamentId: id },
        orderBy: { orden: 'asc' },
      }),
      this.prisma.fairpadelConfig.findUnique({
        where: { clave: 'COMISION_POR_JUGADOR' },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // Calcular estadísticas
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { tournamentId: id },
      select: { estado: true },
    });

    const stats = {
      total: inscripciones.length,
      confirmadas: inscripciones.filter(i => i.estado === 'CONFIRMADA').length,
      pendientesPago: inscripciones.filter(i => i.estado === 'PENDIENTE_PAGO').length,
    };

    const comisionPorJugador = parseInt(configComision?.valor || '0');
    const montoEstimado = stats.confirmadas * 2 * comisionPorJugador;

    return {
      ...torneo,
      comision: {
        ...comision,
        montoEstimado,
        comisionPorJugador,
      },
      checklist,
      stats,
    };
  }

  @Post(':id/comision/comprobante')
  async subirComprobante(
    @Param('id') tournamentId: string,
    @Body() dto: SubirComprobanteDto,
  ) {
    const comision = await this.prisma.torneoComision.update({
      where: { tournamentId },
      data: {
        comprobanteUrl: dto.comprobanteUrl,
        comprobanteNotas: dto.notas,
        estado: 'PENDIENTE_VERIFICACION',
      },
    });

    return {
      success: true,
      message: 'Comprobante subido. Pendiente de verificación por admin.',
      comision,
    };
  }

  @Get(':id/estado')
  async verificarEstado(@Param('id') tournamentId: string) {
    const [torneo, comision, configRonda] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { estado: true, nombre: true },
      }),
      this.prisma.torneoComision.findUnique({
        where: { tournamentId },
      }),
      this.prisma.fairpadelConfig.findUnique({
        where: { clave: 'RONDA_BLOQUEO_PAGO' },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    const rondaBloqueo = configRonda?.valor || 'CUARTOS';

    return {
      torneo: {
        nombre: torneo.nombre,
        estado: torneo.estado,
      },
      bloqueo: {
        activo: comision?.bloqueoActivo || false,
        rondaBloqueo,
        comisionEstado: comision?.estado || 'PENDIENTE',
        montoPagado: comision?.montoPagado || 0,
        montoEstimado: comision?.montoEstimado || 0,
      },
      mensaje: comision?.bloqueoActivo
        ? `Torneo bloqueado. Para continuar a semifinales, regulariza el pago de comisión.`
        : 'Torneo activo',
    };
  }

  // // OVERVIEW / DASHBOARD DEL TORNEO
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /admin/torneos/:id/overview
   * Resumen ejecutivo del torneo con progreso y tareas pendientes
   */
  @Get(':id/overview')
  async getOverview(@Param('id') tournamentId: string) {
    const [
      torneo,
      inscripciones,
      categorias,
      comision,
      checklist,
      fixtureVersions,
      disponibilidad,
    ] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          id: true,
          nombre: true,
          slug: true,
          estado: true,
          fechaInicio: true,
          fechaFin: true,
          // @ts-ignore
          fechaFinales: true,
          fechaLimiteInscr: true,
          ciudad: true,
          costoInscripcion: true,
          flyerUrl: true,
          sedeId: true,
          // @ts-ignore - campos nuevos en schema
          canchasFinales: true,
          // @ts-ignore
          horaInicioFinales: true,
          // @ts-ignore
          horaFinFinales: true,
          sedePrincipal: true,
          categorias: { include: { category: true } },
          modalidades: { include: { modalidadConfig: true } },
          organizador: {
            select: { id: true, nombre: true, apellido: true, email: true },
          },
        },
      }),
      this.prisma.inscripcion.findMany({
        where: { tournamentId },
        include: {
          category: true,
          pagos: { where: { estado: 'CONFIRMADO' } },
          controlPagos: true,
        },
      }),
      this.prisma.tournamentCategory.findMany({
        where: { tournamentId },
        include: { category: true },
      }),
      this.prisma.torneoComision.findUnique({
        where: { tournamentId },
      }),
      this.prisma.checklistItem.findMany({
        where: { tournamentId },
      }),
      this.prisma.fixtureVersion.findMany({
        where: { tournamentId },
      }),
      this.prisma.torneoDisponibilidadDia.findMany({
        where: { tournamentId },
      }),
    ]);

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    // FIX: fechas son String YYYY-MM-DD, calcular días diferente
    const hoy = new Date().toISOString().split('T')[0];
    const fechaInicio = torneo.fechaInicio;
    const fechaLimite = torneo.fechaLimiteInscr;

    // Función helper para calcular diferencia de días entre strings YYYY-MM-DD
    const diasEntre = (fecha1: string, fecha2: string): number => {
      const d1 = new Date(fecha1 + 'T12:00:00');
      const d2 = new Date(fecha2 + 'T12:00:00');
      return Math.ceil((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Casting a string porque Prisma types aún no están actualizados
    const diasHastaInicio = fechaInicio ? diasEntre((fechaInicio as unknown) as string, hoy) : null;
    const diasHastaCierre = fechaLimite ? diasEntre((fechaLimite as unknown) as string, hoy) : null;

    const inscripcionesStats = {
      total: inscripciones.length,
      confirmadas: inscripciones.filter(i => i.estado === 'CONFIRMADA').length,
      pendientesPago: inscripciones.filter(i => i.estado === 'PENDIENTE_PAGO').length,
      pendientesConfirmacion: inscripciones.filter(i => i.estado === 'PENDIENTE_CONFIRMACION').length,
      incompletas: inscripciones.filter(i => !i.jugador2Id).length,
      ingresos: inscripciones
        .filter(i => i.estado === 'CONFIRMADA')
        .reduce((sum, i: any) => {
          const pagosOnline = i.pagos?.reduce((pSum: number, p: any) => pSum + Number(p.monto || 0), 0) || 0;
          const pagosOrganizador = i.controlPagos?.reduce((pSum: number, p: any) => pSum + Number(p.monto || 0), 0) || 0;
          return sum + pagosOnline + pagosOrganizador;
        }, 0),
    };

    const inscripcionesPorCategoria = categorias.map(cat => {
      const insc = inscripciones.filter(i => i.categoryId === cat.categoryId);
      return {
        categoriaId: cat.categoryId,
        nombre: cat.category.nombre,
        tipo: cat.category.tipo,
        total: insc.length,
        confirmadas: insc.filter(i => i.estado === 'CONFIRMADA').length,
        pendientes: insc.filter(i => i.estado === 'PENDIENTE_PAGO' || i.estado === 'PENDIENTE_CONFIRMACION').length,
      };
    });

    const checklistTotal = checklist.length || 10;
    const checklistCompletados = checklist.filter(c => c.completado).length;
    const checklistProgress = Math.round((checklistCompletados / checklistTotal) * 100);

    const tareasPendientes: any[] = [];

    if (!torneo.flyerUrl) {
      tareasPendientes.push({
        id: 'flyer',
        tipo: 'advertencia',
        titulo: 'Subir flyer del torneo',
        descripcion: 'Un buen flyer atrae mas inscripciones',
        accion: { texto: 'Subir flyer', link: 'configuracion' },
      });
    }

    // @ts-ignore - sedeId viene del schema pero Prisma client local no lo reconoce
    if (!torneo.sedeId) {
      tareasPendientes.push({
        id: 'sede',
        tipo: 'urgente',
        titulo: 'Asignar sede principal',
        descripcion: 'Los jugadores necesitan saber donde jugar',
        accion: { texto: 'Asignar sede', link: 'disponibilidad' },
      });
    }

    if (comision?.bloqueoActivo) {
      tareasPendientes.push({
        id: 'comision',
        tipo: 'urgente',
        titulo: 'Pagar comision para desbloquear',
        descripcion: `Debes pagar Gs. ${comision.montoEstimado?.toLocaleString('es-PY')} para acceder al fixture`,
        accion: { texto: 'Pagar comision', link: 'comision' },
      });
    }

    const tieneFixture = fixtureVersions.length > 0;
    if (!tieneFixture && inscripcionesStats.confirmadas >= 4) {
      tareasPendientes.push({
        id: 'fixture',
        tipo: diasHastaInicio && diasHastaInicio <= 2 ? 'urgente' : 'advertencia',
        titulo: 'Sortear fixture',
        descripcion: `Tienes ${inscripcionesStats.confirmadas} inscripciones confirmadas. Es hora de sortear!`,
        accion: { texto: 'Sortear', link: 'bracket' },
      });
    }

    if (tieneFixture && disponibilidad.length === 0) {
      tareasPendientes.push({
        id: 'disponibilidad',
        tipo: diasHastaInicio && diasHastaInicio <= 3 ? 'urgente' : 'advertencia',
        titulo: 'Configurar disponibilidad de canchas',
        descripcion: 'Necesitas definir cuando y donde se juegan los partidos',
        accion: { texto: 'Configurar', link: 'disponibilidad' },
      });
    }

    if (diasHastaCierre !== null && diasHastaCierre <= 2 && diasHastaCierre > 0) {
      tareasPendientes.push({
        id: 'cierre',
        tipo: 'info',
        titulo: 'Cierre de inscripciones proximo',
        descripcion: `Faltan ${diasHastaCierre} dias para cerrar inscripciones`,
        accion: { texto: 'Ver inscripciones', link: 'inscripciones' },
      });
    }

    if (inscripcionesStats.pendientesPago > 0) {
      tareasPendientes.push({
        id: 'pendientes',
        tipo: 'advertencia',
        titulo: `${inscripcionesStats.pendientesPago} inscripciones pendientes de pago`,
        descripcion: 'Algunos jugadores completaron el registro pero no pagaron',
        accion: { texto: 'Revisar', link: 'inscripciones' },
      });
    }

    const requisitos = [
      { nombre: 'flyer', completado: !!torneo.flyerUrl, peso: 12 },
      // @ts-ignore - sedeId viene del schema
      { nombre: 'sede', completado: !!(torneo as any).sedeId, peso: 18 },
      { nombre: 'fixture', completado: tieneFixture, peso: 30 },
      { nombre: 'disponibilidad', completado: disponibilidad.length > 0, peso: 23 },
      { nombre: 'inscripciones', completado: inscripcionesStats.confirmadas >= 4, peso: 17 },
    ];

    const progresoGeneral = Math.round(
      requisitos.reduce((acc, r) => acc + (r.completado ? r.peso : 0), 0)
    );

    let estadoTorneo: 'configuracion' | 'inscripciones' | 'sorteo' | 'programacion' | 'en_curso' | 'finalizado';
    if (torneo.estado === 'FINALIZADO') {
      estadoTorneo = 'finalizado';
    } else if (fechaInicio && ((fechaInicio as unknown) as string) <= hoy) {
      estadoTorneo = 'en_curso';
    } else if (tieneFixture && disponibilidad.length > 0) {
      estadoTorneo = 'programacion';
    } else if (tieneFixture) {
      estadoTorneo = 'sorteo';
    } else if (torneo.estado === 'PUBLICADO') {
      estadoTorneo = 'inscripciones';
    } else {
      estadoTorneo = 'configuracion';
    }

    return {
      success: true,
      data: {
        torneo: {
          id: torneo.id,
          nombre: torneo.nombre,
          slug: torneo.slug,
          estado: torneo.estado,
          estadoProceso: estadoTorneo,
          fechaInicio: torneo.fechaInicio,
          fechaFin: torneo.fechaFin,
          // @ts-ignore
          fechaFinales: torneo.fechaFinales,
          fechaLimiteInscr: torneo.fechaLimiteInscr,
          // @ts-ignore
          canchasFinales: torneo.canchasFinales,
          // @ts-ignore
          horaInicioFinales: torneo.horaInicioFinales,
          // @ts-ignore
          horaFinFinales: torneo.horaFinFinales,
          ciudad: torneo.ciudad,
          // @ts-ignore
          costoInscripcion: Number(torneo.costoInscripcion ?? 0),
          flyerUrl: torneo.flyerUrl,
          // @ts-ignore
          sede: torneo.sedePrincipal,
          diasHastaInicio,
          diasHastaCierre,
        },
        progreso: {
          general: progresoGeneral,
          checklist: checklistProgress,
          detalle: requisitos,
        },
        inscripciones: {
          ...inscripcionesStats,
          porCategoria: inscripcionesPorCategoria,
        },
        comision: comision ? {
          estado: comision.estado,
          bloqueoActivo: comision.bloqueoActivo,
          montoEstimado: comision.montoEstimado,
          montoPagado: comision.montoPagado,
        } : null,
        tareasPendientes: tareasPendientes.slice(0, 5),
        linkPublico: `/t/${torneo.slug}`,
      },
    };
  }
}
