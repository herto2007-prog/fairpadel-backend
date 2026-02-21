import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RankingsService } from '../rankings/rankings.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private rankingsService: RankingsService,
  ) {}

  // ============ TORNEOS ============

  async obtenerTorneosPendientes() {
    const torneos = await this.prisma.tournament.findMany({
      where: {
        estado: 'PENDIENTE_APROBACION',
      },
      include: {
        organizador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
          },
        },
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

    return torneos;
  }

  async aprobarTorneo(id: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.prisma.tournament.update({
      where: { id },
      data: {
        estado: 'PUBLICADO',
      },
    });

    // TODO: Notificar al organizador

    return { message: 'Torneo aprobado' };
  }

  async rechazarTorneo(id: string, motivo: string) {
    const torneo = await this.prisma.tournament.findUnique({
      where: { id },
    });

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    await this.prisma.tournament.update({
      where: { id },
      data: {
        estado: 'RECHAZADO',
      },
    });

    // TODO: Notificar al organizador con el motivo

    return { message: 'Torneo rechazado' };
  }

  // ============ SOLICITUDES ORGANIZADOR ============

  async obtenerSolicitudesOrganizador(estado?: string) {
    const where: any = {};
    if (estado) {
      where.estado = estado;
    }

    const solicitudes = await this.prisma.solicitudOrganizador.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            ciudad: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return solicitudes;
  }

  async aprobarSolicitudOrganizador(id: string) {
    const solicitud = await this.prisma.solicitudOrganizador.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    // Buscar rol de organizador
    const rolOrganizador = await this.prisma.role.findUnique({
      where: { nombre: 'organizador' },
    });

    if (!rolOrganizador) {
      throw new NotFoundException('Rol organizador no encontrado');
    }

    // Asignar rol
    await this.prisma.userRole.create({
      data: {
        userId: solicitud.userId,
        roleId: rolOrganizador.id,
      },
    });

    // Actualizar solicitud
    await this.prisma.solicitudOrganizador.update({
      where: { id },
      data: { estado: 'APROBADA' },
    });

    // TODO: Notificar al usuario

    return { message: 'Solicitud aprobada' };
  }

  async rechazarSolicitudOrganizador(id: string, motivo: string) {
    const solicitud = await this.prisma.solicitudOrganizador.findUnique({
      where: { id },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    await this.prisma.solicitudOrganizador.update({
      where: { id },
      data: {
        estado: 'RECHAZADA',
        motivo,
      },
    });

    // TODO: Notificar al usuario con el motivo

    return { message: 'Solicitud rechazada' };
  }

  // ============ MODERACIÓN FOTOS ============

  async obtenerFotosModeracion() {
    const fotos = await this.prisma.foto.findMany({
      where: {
        estadoModeracion: 'PENDIENTE',
      },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        tournament: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return fotos;
  }

  async aprobarFoto(id: string) {
    const foto = await this.prisma.foto.findUnique({
      where: { id },
    });

    if (!foto) {
      throw new NotFoundException('Foto no encontrada');
    }

    await this.prisma.foto.update({
      where: { id },
      data: {
        estadoModeracion: 'APROBADA',
      },
    });

    return { message: 'Foto aprobada' };
  }

  async eliminarFotoInapropiada(id: string, motivo: string) {
    const foto = await this.prisma.foto.findUnique({
      where: { id },
    });

    if (!foto) {
      throw new NotFoundException('Foto no encontrada');
    }

    await this.prisma.foto.update({
      where: { id },
      data: {
        estadoModeracion: 'RECHAZADA',
      },
    });

    // Crear registro en moderación
    await this.prisma.fotoPerfilModeracion.create({
      data: {
        userId: foto.userId,
        fotoUrl: foto.urlImagen,
        estado: 'RECHAZADA',
        motivoRechazo: motivo,
      },
    });

    // TODO: Notificar al usuario

    return { message: 'Foto eliminada' };
  }

  // ============ USUARIOS ============

  async obtenerUsuarios(search?: string, estado?: string) {
    const where: any = {};

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { documento: { contains: search } },
      ];
    }

    if (estado) {
      where.estado = estado;
    }

    const usuarios = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        documento: true,
        email: true,
        telefono: true,
        ciudad: true,
        estado: true,
        esPremium: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    return usuarios;
  }

  async suspenderUsuario(id: string, motivo: string) {
    const usuario = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.user.update({
      where: { id },
      data: { estado: 'SUSPENDIDO' },
    });

    // TODO: Notificar al usuario con el motivo

    return { message: 'Usuario suspendido' };
  }

  async activarUsuario(id: string) {
    const usuario = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.user.update({
      where: { id },
      data: { estado: 'ACTIVO' },
    });

    return { message: 'Usuario activado' };
  }

  // ============ REPORTES ============

  async obtenerReportesFotos(estado?: string) {
    const where: any = {};
    if (estado) {
      where.estado = estado;
    }

    const reportes = await this.prisma.reporteFoto.findMany({
      where,
      include: {
        foto: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reportes;
  }

  async obtenerReportesUsuarios(estado?: string) {
    const where: any = {};
    if (estado) {
      where.estado = estado;
    }

    const reportes = await this.prisma.reporte.findMany({
      where,
      include: {
        reportador: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
        reportado: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reportes;
  }

  async resolverReporteFoto(id: string, accion: string) {
    const reporte = await this.prisma.reporteFoto.findUnique({
      where: { id },
      include: { foto: true },
    });

    if (!reporte) {
      throw new NotFoundException('Reporte no encontrado');
    }

    if (accion === 'ELIMINAR_FOTO') {
      await this.eliminarFotoInapropiada(reporte.fotoId, 'Reportada como inapropiada');
    }

    await this.prisma.reporteFoto.update({
      where: { id },
      data: { estado: 'APROBADA' },
    });

    return { message: 'Reporte resuelto' };
  }

  async resolverReporteUsuario(id: string, accion: string) {
    const reporte = await this.prisma.reporte.findUnique({
      where: { id },
    });

    if (!reporte) {
      throw new NotFoundException('Reporte no encontrado');
    }

    if (accion === 'SUSPENDER') {
      await this.suspenderUsuario(reporte.reportadoId, 'Reportado por múltiples usuarios');
    }

    await this.prisma.reporte.update({
      where: { id },
      data: { estado: 'APROBADA' },
    });

    return { message: 'Reporte resuelto' };
  }

  // ============ SUSCRIPCIONES ============

  async obtenerSuscripciones(estado?: string) {
    const where: any = {};
    if (estado) {
      where.estado = estado;
    }

    const suscripciones = await this.prisma.suscripcion.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return suscripciones;
  }

  async extenderSuscripcion(id: string, dias: number) {
    const suscripcion = await this.prisma.suscripcion.findUnique({
      where: { id },
    });

    if (!suscripcion) {
      throw new NotFoundException('Suscripción no encontrada');
    }

    const nuevaFechaFin = new Date(suscripcion.fechaFin);
    nuevaFechaFin.setDate(nuevaFechaFin.getDate() + dias);

    // If subscription was VENCIDA, reactivate it and set user as premium
    const updateData: any = {
      fechaFin: nuevaFechaFin,
      fechaRenovacion: nuevaFechaFin,
    };
    if (suscripcion.estado === 'VENCIDA') {
      updateData.estado = 'ACTIVA';
    }

    await this.prisma.suscripcion.update({
      where: { id },
      data: updateData,
    });

    // Ensure user is premium (especially if reactivated from VENCIDA)
    await this.prisma.user.update({
      where: { id: suscripcion.userId },
      data: { esPremium: true },
    });

    return { message: `Suscripción extendida por ${dias} días` };
  }

  // ============ CONFIGURACIÓN ============

  async obtenerConfiguracionPuntos() {
    const configuracion = await this.prisma.configuracionPuntos.findMany({
      orderBy: {
        puntosBase: 'desc',
      },
    });

    return configuracion;
  }

  async actualizarConfiguracionPuntos(id: string, data: any) {
    const config = await this.prisma.configuracionPuntos.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException('Configuración no encontrada');
    }

    await this.prisma.configuracionPuntos.update({
      where: { id },
      data: {
        puntosBase: data.puntosBase,
        multiplicador: data.multiplicador,
      },
    });

    return { message: 'Configuración actualizada' };
  }

  // ============ CUPONES ============

  async crearCupon(data: any) {
    const cupon = await this.prisma.cupon.create({
      data: {
        codigo: data.codigo,
        tipo: data.tipo,
        valor: data.valor,
        fechaInicio: new Date(data.fechaInicio),
        fechaExpiracion: new Date(data.fechaExpiracion),
        limiteUsos: data.limiteUsos,
      },
    });

    return cupon;
  }

  async obtenerCupones() {
    const cupones = await this.prisma.cupon.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return cupones;
  }

  async desactivarCupon(id: string) {
    await this.prisma.cupon.update({
      where: { id },
      data: { estado: 'INACTIVO' },
    });

    return { message: 'Cupón desactivado' };
  }

  // ============ MÉTRICAS ============

  async obtenerMetricasDashboard() {
    const totalUsuarios = await this.prisma.user.count();
    const usuariosPremium = await this.prisma.user.count({
      where: { esPremium: true },
    });
    const totalTorneos = await this.prisma.tournament.count();
    const torneosPendientes = await this.prisma.tournament.count({
      where: { estado: 'PENDIENTE_APROBACION' },
    });

    return {
      totalUsuarios,
      usuariosPremium,
      totalTorneos,
      torneosPendientes,
    };
  }

  async obtenerMetricasUsuarios() {
    const porEstado = await this.prisma.user.groupBy({
      by: ['estado'],
      _count: true,
    });

    const porGenero = await this.prisma.user.groupBy({
      by: ['genero'],
      _count: true,
    });

    return {
      porEstado,
      porGenero,
    };
  }

  async obtenerMetricasTorneos() {
    const porEstado = await this.prisma.tournament.groupBy({
      by: ['estado'],
      _count: true,
    });

    return { porEstado };
  }

  async obtenerMetricasIngresos() {
    // Calcular ingresos totales de suscripciones
    const suscripciones = await this.prisma.suscripcion.findMany({
      where: { estado: 'ACTIVA' },
    });

    const mrrSuscripciones = suscripciones.reduce((acc, sub) => {
      const precioMensual = sub.periodo === 'MENSUAL'
        ? sub.precio.toNumber()
        : sub.precio.toNumber() / 12;
      return acc + precioMensual;
    }, 0);

    // Calcular ingresos de comisiones
    const pagos = await this.prisma.pago.findMany({
      where: { estado: 'CONFIRMADO' },
    });

    const totalComisiones = pagos.reduce((acc, pago) => {
      return acc + pago.comision.toNumber();
    }, 0);

    return {
      mrr: mrrSuscripciones,
      totalComisiones,
      suscripcionesActivas: suscripciones.length,
    };
  }

  // ============ PREMIUM DASHBOARD AVANZADO ============

  /**
   * Lista todos los usuarios premium con detalles de suscripción
   */
  async obtenerUsuariosPremium(search?: string, estado?: string) {
    const where: any = { esPremium: true };

    if (search) {
      where.AND = [
        { esPremium: true },
        {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' } },
            { apellido: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { documento: { contains: search } },
          ],
        },
      ];
      delete where.esPremium;
    }

    const usuarios = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        nombre: true,
        apellido: true,
        documento: true,
        email: true,
        telefono: true,
        ciudad: true,
        genero: true,
        fotoUrl: true,
        esPremium: true,
        createdAt: true,
        suscripciones: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            plan: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Filter by subscription estado if requested
    if (estado) {
      return usuarios.filter(
        (u) => u.suscripciones.length > 0 && u.suscripciones[0].estado === estado,
      );
    }

    return usuarios;
  }

  /**
   * Dashboard completo de métricas premium
   */
  async obtenerMetricasPremium() {
    const now = new Date();
    const hace30Dias = new Date(now);
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const hace60Dias = new Date(now);
    hace60Dias.setDate(hace60Dias.getDate() - 60);

    // Conteos básicos
    const totalPremium = await this.prisma.user.count({ where: { esPremium: true } });
    const totalUsuarios = await this.prisma.user.count();
    const suscripcionesActivas = await this.prisma.suscripcion.count({ where: { estado: 'ACTIVA' } });
    const suscripcionesPendientes = await this.prisma.suscripcion.count({ where: { estado: 'PENDIENTE_PAGO' } });

    // Nuevos premium últimos 30 días
    const nuevosPremium30d = await this.prisma.suscripcion.count({
      where: {
        estado: 'ACTIVA',
        createdAt: { gte: hace30Dias },
      },
    });

    // Cancelaciones últimos 30 días
    const cancelaciones30d = await this.prisma.suscripcion.count({
      where: {
        estado: { in: ['CANCELADA', 'VENCIDA'] },
        updatedAt: { gte: hace30Dias },
      },
    });

    // Tasa de conversión (premium / total usuarios)
    const tasaConversion = totalUsuarios > 0 ? (totalPremium / totalUsuarios) * 100 : 0;

    // MRR
    const susActivas = await this.prisma.suscripcion.findMany({
      where: { estado: 'ACTIVA' },
    });
    const mrr = susActivas.reduce((acc, s) => acc + s.precio.toNumber(), 0);

    // Churn rate (cancelaciones del mes / activas al inicio del mes)
    const activasInicioMes = await this.prisma.suscripcion.count({
      where: {
        estado: 'ACTIVA',
        createdAt: { lt: hace30Dias },
      },
    });
    const churnRate = activasInicioMes > 0
      ? (cancelaciones30d / (activasInicioMes + nuevosPremium30d)) * 100
      : 0;

    // Revenue por cupón
    const conCupon = await this.prisma.suscripcion.count({
      where: {
        cuponAplicado: { not: null },
      },
    });

    // Auto-renovación activada
    const autoRenovarActivo = await this.prisma.suscripcion.count({
      where: {
        estado: 'ACTIVA',
        autoRenovar: true,
      },
    });

    // Próximos a vencer (7 días)
    const en7Dias = new Date(now);
    en7Dias.setDate(en7Dias.getDate() + 7);
    const proximosVencer = await this.prisma.suscripcion.count({
      where: {
        estado: 'ACTIVA',
        fechaFin: { lte: en7Dias, gte: now },
      },
    });

    return {
      totalPremium,
      totalUsuarios,
      tasaConversion: Math.round(tasaConversion * 100) / 100,
      suscripcionesActivas,
      suscripcionesPendientes,
      nuevosPremium30d,
      cancelaciones30d,
      mrr,
      arr: mrr * 12,
      churnRate: Math.round(churnRate * 100) / 100,
      conCupon,
      autoRenovarActivo,
      proximosVencer,
    };
  }

  /**
   * Historial de suscripciones por mes (últimos 12 meses)
   */
  async obtenerTendenciasSuscripciones() {
    const meses: {
      mes: string;
      nuevas: number;
      canceladas: number;
      ingresos: number;
    }[] = [];

    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const inicio = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fin = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const nuevas = await this.prisma.suscripcion.count({
        where: {
          createdAt: { gte: inicio, lte: fin },
          estado: { not: 'PENDIENTE_PAGO' },
        },
      });

      const canceladas = await this.prisma.suscripcion.count({
        where: {
          estado: { in: ['CANCELADA', 'VENCIDA'] },
          updatedAt: { gte: inicio, lte: fin },
        },
      });

      // Revenue del mes (suscripciones creadas ese mes)
      const susMes = await this.prisma.suscripcion.findMany({
        where: {
          createdAt: { gte: inicio, lte: fin },
          estado: { in: ['ACTIVA', 'VENCIDA', 'CANCELADA'] },
        },
      });
      const ingresos = susMes.reduce((acc, s) => acc + s.precio.toNumber(), 0);

      const mesLabel = inicio.toLocaleDateString('es-PY', {
        month: 'short',
        year: '2-digit',
      });

      meses.push({ mes: mesLabel, nuevas, canceladas, ingresos });
    }

    return meses;
  }

  /**
   * Actividad reciente premium (últimas 20 acciones)
   */
  async obtenerActividadPremium() {
    const suscripciones = await this.prisma.suscripcion.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            fotoUrl: true,
          },
        },
        plan: {
          select: {
            nombre: true,
          },
        },
      },
    });

    return suscripciones.map((s) => ({
      id: s.id,
      usuario: s.user,
      plan: s.plan?.nombre,
      estado: s.estado,
      precio: s.precio.toNumber(),
      fechaInicio: s.fechaInicio,
      fechaFin: s.fechaFin,
      autoRenovar: s.autoRenovar,
      cuponAplicado: s.cuponAplicado,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Otorgar premium manualmente a un usuario
   */
  async otorgarPremiumManual(userId: string, dias: number, motivo: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Buscar plan premium
    const plan = await this.prisma.planPremium.findFirst({
      where: { activo: true },
    });

    if (!plan) {
      throw new NotFoundException('No hay plan premium activo');
    }

    // Cancelar suscripciones activas/pendientes existentes para evitar duplicados
    await this.prisma.suscripcion.updateMany({
      where: { userId, estado: { in: ['ACTIVA', 'PENDIENTE_PAGO'] } },
      data: { estado: 'CANCELADA' },
    });

    const now = new Date();
    const fechaFin = new Date(now);
    fechaFin.setDate(fechaFin.getDate() + dias);

    // Crear suscripción cortesía
    const suscripcion = await this.prisma.suscripcion.create({
      data: {
        userId,
        planId: plan.id,
        periodo: 'MENSUAL',
        precio: 0, // Cortesía
        estado: 'ACTIVA',
        fechaInicio: now,
        fechaFin: fechaFin,
        autoRenovar: false,
        cuponAplicado: `CORTESIA_ADMIN: ${motivo}`,
      },
    });

    // Activar premium en user
    await this.prisma.user.update({
      where: { id: userId },
      data: { esPremium: true },
    });

    return {
      message: `Premium otorgado a ${user.nombre} ${user.apellido} por ${dias} días`,
      suscripcion,
    };
  }

  /**
   * Revocar premium manualmente
   */
  async revocarPremium(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Cancelar suscripciones activas y pendientes
    await this.prisma.suscripcion.updateMany({
      where: { userId, estado: { in: ['ACTIVA', 'PENDIENTE_PAGO'] } },
      data: { estado: 'CANCELADA' },
    });

    // Quitar premium
    await this.prisma.user.update({
      where: { id: userId },
      data: { esPremium: false },
    });

    return {
      message: `Premium revocado para ${user.nombre} ${user.apellido}`,
    };
  }

  /**
   * Estadísticas de cupones
   */
  async obtenerEstadisticasCupones() {
    const cupones = await this.prisma.cupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const totalCupones = cupones.length;
    const cuponesActivos = cupones.filter((c) => c.estado === 'ACTIVO').length;
    const totalUsos = cupones.reduce((acc, c) => acc + c.usosActuales, 0);
    const descuentoTotal = cupones.reduce((acc, c) => {
      if (c.tipo === 'PORCENTAJE') return acc; // Can't calculate exact amount for percentage
      return acc + c.valor.toNumber() * c.usosActuales;
    }, 0);

    // Top cupones por uso
    const topCupones = [...cupones]
      .sort((a, b) => b.usosActuales - a.usosActuales)
      .slice(0, 5)
      .map((c) => ({
        codigo: c.codigo,
        tipo: c.tipo,
        valor: c.valor.toNumber(),
        usos: c.usosActuales,
        limite: c.limiteUsos,
        estado: c.estado,
      }));

    return {
      totalCupones,
      cuponesActivos,
      totalUsos,
      descuentoTotal,
      topCupones,
    };
  }

  // ============ PROMOVER ORGANIZADOR POR DOCUMENTO ============

  async promoverOrganizadorPorDocumento(documento: string) {
    // Buscar usuario por documento
    const user = await this.prisma.user.findUnique({
      where: { documento },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        `No se encontró usuario con documento: ${documento}`,
      );
    }

    // Verificar si ya es organizador
    const yaEsOrganizador = user.roles.some(
      (ur) => ur.role.nombre === 'organizador',
    );
    if (yaEsOrganizador) {
      throw new ConflictException(
        `${user.nombre} ${user.apellido} ya tiene rol de organizador`,
      );
    }

    // Buscar rol de organizador
    const rolOrganizador = await this.prisma.role.findUnique({
      where: { nombre: 'organizador' },
    });

    if (!rolOrganizador) {
      throw new NotFoundException('Rol organizador no encontrado');
    }

    // Asignar rol
    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: rolOrganizador.id,
      },
    });

    return {
      message: `${user.nombre} ${user.apellido} ahora es organizador`,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        documento: user.documento,
      },
    };
  }

  // ============ CONFIGURACIÓN DEL SISTEMA ============

  async obtenerConfiguracionSistema() {
    return this.prisma.configuracionSistema.findMany({
      orderBy: { clave: 'asc' },
    });
  }

  async actualizarConfiguracionSistema(clave: string, valor: string) {
    const config = await this.prisma.configuracionSistema.findUnique({
      where: { clave },
    });

    if (!config) {
      throw new NotFoundException(
        `Configuración '${clave}' no encontrada`,
      );
    }

    // Validar que el valor sea numérico para comisiones
    if (clave === 'COMISION_INSCRIPCION') {
      const numVal = parseFloat(valor);
      if (isNaN(numVal) || numVal < 0 || numVal > 100) {
        throw new BadRequestException(
          'El porcentaje de comisión debe ser un número entre 0 y 100',
        );
      }
    }

    await this.prisma.configuracionSistema.update({
      where: { clave },
      data: { valor },
    });

    return { message: `Configuración '${clave}' actualizada a: ${valor}` };
  }

  async obtenerValorConfiguracion(clave: string): Promise<string | null> {
    const config = await this.prisma.configuracionSistema.findUnique({
      where: { clave },
    });
    return config?.valor ?? null;
  }

  // ═══════════════════════════════════════════
  // COMISION POR TORNEO
  // ═══════════════════════════════════════════

  async setComisionTorneo(tournamentId: string, comisionPorcentaje: number | null) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Torneo no encontrado');

    if (comisionPorcentaje !== null) {
      if (comisionPorcentaje < 0 || comisionPorcentaje > 100) {
        throw new BadRequestException('La comisión debe estar entre 0 y 100');
      }
    }

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { comisionPorcentaje },
    });

    return {
      message: comisionPorcentaje !== null
        ? `Comisión del torneo configurada a ${comisionPorcentaje}%`
        : 'Comisión del torneo eliminada (usará la configuración global)',
      comisionPorcentaje,
    };
  }

  async getComisionTorneo(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, nombre: true, comisionPorcentaje: true },
    });
    if (!tournament) throw new NotFoundException('Torneo no encontrado');

    const globalConfig = await this.prisma.configuracionSistema.findUnique({
      where: { clave: 'COMISION_INSCRIPCION' },
    });

    return {
      tournamentId: tournament.id,
      nombre: tournament.nombre,
      comisionPorcentaje: tournament.comisionPorcentaje,
      comisionGlobal: globalConfig ? parseFloat(globalConfig.valor) : 5,
      usandoGlobal: tournament.comisionPorcentaje === null,
    };
  }

  // ============ SEED TEST DATA (TEMPORAL) ============

  private readonly NOMBRES_M = [
    'Carlos','Martin','Diego','Alejandro','Fernando','Gabriel','Sebastian','Nicolas',
    'Matias','Lucas','Joaquin','Santiago','Andres','Rafael','Daniel','Pablo',
    'Emiliano','Rodrigo','Tomas','Ignacio','Facundo','Bruno','Maximiliano','Federico',
    'Agustin','Franco','Leandro','Gonzalo','Ramiro','Cristian','Marcelo','Hugo',
    'Oscar','Esteban','Victor','Adrian','Julio','Cesar','Fabian','Hernan',
    'Javier','Mauricio','Ricardo','Eduardo','Luis','Roberto','Alberto','Miguel',
    'Sergio','Antonio','Manuel','Jorge','Francisco','Raul','Enrique','Alfredo',
    'Gustavo','Walter','Ruben','Hector','Dario','Ivan','Claudio','Ariel',
    'Leonardo','Nestor','Armando','Orlando','Ernesto','Angel','Damian','Joel',
    'Lautaro','Thiago','Bautista','Benicio','Dante','Gael','Noah','Ian',
    'Elias','Ciro','Valentin','Santino','Lorenzo','Simon','Mateo','Benjamin',
    'Axel','Dylan','Alan','Kevin','Braian','Jonathan','Christian','Ezequiel',
    'Mauro','Gerardo','Nelson','Rolando','Osvaldo','Reinaldo','Anibal','Felix',
    'Pascual','Celestino','Amado','Bernardo','Isidro','Porfirio','Teofilo','Zoilo',
    'Abundio','Candido','Demetrio','Epifanio','Florentino','Genaro','Hilario','Jacinto',
    'Ladislao','Macedonio','Nicandro','Onesimo','Pancracio','Quirino','Rosendo','Silvestre',
    'Telesforo','Ubaldo','Venancio','Wilfrido','Xenon','Yosef','Zenon','Americo',
    'Baldomero','Calixto','Desiderio','Eusebio','Fulgencio','Gumersindo','Heriberto','Isidoro',
    'Jeremias','Kleber','Lazaro','Metodio','Nicanor','Olegario','Primitivo','Remigio',
  ];

  private readonly NOMBRES_F = [
    'Sofia','Valentina','Camila','Luciana','Maria','Isabella','Martina','Julieta',
    'Catalina','Florencia','Agustina','Victoria','Natalia','Carolina','Daniela','Paula',
    'Andrea','Romina','Micaela','Celeste','Antonella','Brenda','Gabriela','Fernanda',
    'Rocio','Belen','Mariana','Lorena','Carla','Silvana','Claudia','Veronica',
    'Patricia','Alejandra','Monica','Sandra','Laura','Elena','Teresa','Marta',
    'Graciela','Noemi','Silvia','Liliana','Julia','Rosa','Ana','Estela',
    'Alicia','Beatriz','Carmen','Dolores','Elvira','Fatima','Gloria','Herminia',
    'Irma','Josefina','Karina','Leticia','Magdalena','Nilda','Olga','Pilar',
    'Ramona','Soledad','Tamara','Ursula','Viviana','Ximena','Yolanda','Zulma',
    'Aida','Blanca','Concepcion','Delia','Eugenia','Francisca','Gisela','Helena',
    'Ines','Juana','Lidia','Miriam','Norma','Ofelia','Palmira','Rebeca',
    'Sara','Tania','Vanesa','Wendy','Yasmin','Zenaida','Amalia','Berta',
    'Celia','Diana','Emilia','Flavia','Gilda','Hilda','Ivana','Jessica',
    'Lilian','Milagros','Nelida','Otilia','Priscila','Rafaela','Susana','Tatiana',
    'Urania','Virginia','Wanda','Xiomara','Yesica','Zoraida','Aurora','Barbara',
    'Cristina','Dora','Elsa','Felisa','Gladys','Hortensia','Irene','Jimena',
    'Katia','Lucia','Malena','Nancy','Olivia','Penelope','Rita','Selena',
    'Teodora','Uliana','Vera','Wilma','Xenia','Yamila','Zaira','Abril',
    'Brisa','Clara','Debora','Esther','Fabiola','Guadalupe','Heidi','Iliana',
    'Jazmin','Karen','Lourdes','Mabel','Noelia','Oriana','Paloma','Ruth',
    'Samanta','Thelma','Uxia','Vilma','Yuliana','Zara','Alma','Bianca',
    'Claudina','Dalila','Edith','Fiona','Griselda','Haydee','Ileana','Juanita',
    'Kiara','Luisa','Marina','Nadia','Ornella','Perla','Raquel','Stella',
    'Trinidad','Uriel','Valeria','Waleska','Yadira','Zunilda','Adela','Benita',
    'Corina','Dominga',
  ];

  private readonly APELLIDOS = [
    'Gonzalez','Lopez','Ramirez','Benitez','Gimenez','Martinez','Rojas','Fernandez',
    'Acosta','Villalba','Gomez','Diaz','Perez','Torres','Romero','Alvarez',
    'Ruiz','Mendoza','Ortiz','Silva','Castro','Morales','Vargas','Herrera',
    'Medina','Flores','Rios','Cabrera','Sanchez','Delgado','Vera','Nunez',
    'Peralta','Ayala','Cardozo','Espinola','Duarte','Gauto','Riveros','Aquino',
    'Barrios','Centurion','Franco','Lezcano','Ojeda','Paredes','Rolon','Valenzuela',
    'Arce','Bogado','Caballero','Dominguez','Escobar','Figueredo','Garcia','Insfran',
    'Jara','Leguizamon','Maidana','Narvaez','Ocampo','Patino','Quintana','Recalde',
    'Samudio','Toledo','Urdapilleta','Velazquez','Zacarias','Aguero','Brizuela','Chamorro',
    'Echague','Fretes','Gamarra','Ibarra','Jimenez','Krivoshein','Laterza','Monges',
    'Narvaja','Otazu','Pintos','Quinonez','Romagnoli','Sanabria','Torales','Urunaga',
    'Vazquez','Yegros','Zarate','Almada','Baez','Coronel','Delvalle','Enciso',
    'Ferreira','Godoy','Huerta','Irala','Jacquet','Klein','Lugo','Maldonado',
    'Noguera','Ortigoza','Portillo','Ramoa','Saldivar','Talavera','Urbieta','Viveros',
    'Ybarra','Zaldivar','Amarilla','Britez','Cantero','Davalos','Echeverria','Fleitas',
    'Garay','Haedo','Insaurralde','Jover','Kallsen','Leiva','Montiel','Olmedo',
    'Penayo','Samaniego','Taboada','Urrutia','Yaluk','Zarza','Arguello','Bobadilla',
    'Colman','Dure','Etcheverry','Farina','Guzman','Isasi','Riquelme','Sotelo',
  ];

  private readonly CIUDADES = [
    'Asuncion','Luque','San Lorenzo','Lambare','Fernando de la Mora',
    'Capiata','Nemby','Mariano Roque Alonso','Villa Elisa','Aregua',
  ];

  async seedTestData(
    tournamentId: string,
    parejasPorCategoria: Record<string, number>,
  ) {
    // 1. Fetch tournament + categories
    const torneo = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        categorias: { include: { category: true } },
        modalidades: true,
      },
    });

    if (!torneo) throw new NotFoundException('Torneo no encontrado');

    // 2. Separate categories by gender and calculate totals
    const categoriasMasc: { tcId: string; catId: string; nombre: string; parejas: number }[] = [];
    const categoriasFem: { tcId: string; catId: string; nombre: string; parejas: number }[] = [];

    for (const tc of torneo.categorias) {
      const numParejas = parejasPorCategoria[tc.categoryId] || 0;
      if (numParejas <= 0) continue;

      const entry = { tcId: tc.id, catId: tc.categoryId, nombre: tc.category.nombre, parejas: numParejas };
      if (tc.category.tipo === 'MASCULINO') {
        categoriasMasc.push(entry);
      } else {
        categoriasFem.push(entry);
      }
    }

    const totalPlayersM = categoriasMasc.reduce((sum, c) => sum + c.parejas * 2, 0);
    const totalPlayersF = categoriasFem.reduce((sum, c) => sum + c.parejas * 2, 0);

    if (totalPlayersM + totalPlayersF === 0) {
      throw new BadRequestException('No hay parejas para crear');
    }

    // 3. Get role + hash password
    const rolJugador = await this.prisma.role.findUnique({ where: { nombre: 'jugador' } });
    if (!rolJugador) throw new BadRequestException('Rol "jugador" no encontrado');
    const passwordHash = await bcrypt.hash('test123', 10);

    const modalidad = torneo.modalidades.length > 0 ? torneo.modalidades[0].modalidad : 'TRADICIONAL';
    const monto = torneo.costoInscripcion ? Number(torneo.costoInscripcion) : 0;
    const comision = monto * 0.05;

    // 4. Create players
    let jugadoresCreados = 0;

    const crearJugadores = async (
      total: number, genero: string, docStart: number, nombres: string[],
    ): Promise<{ id: string; documento: string }[]> => {
      const players: { id: string; documento: string }[] = [];
      for (let i = 0; i < total; i++) {
        const doc = `${docStart + i}`;
        const nombre = nombres[i % nombres.length];
        const apellido = this.APELLIDOS[i % this.APELLIDOS.length];
        const suffix = i >= nombres.length ? `${Math.floor(i / nombres.length) + 1}` : '';
        const ciudad = this.CIUDADES[i % this.CIUDADES.length];

        let user = await this.prisma.user.findUnique({ where: { documento: doc } });
        if (!user) {
          user = await this.prisma.user.create({
            data: {
              documento: doc,
              nombre: nombre + suffix,
              apellido,
              genero: genero as any,
              email: `test.${genero.toLowerCase().charAt(0)}${doc}@fairpadel-test.com`,
              telefono: `+595${genero === 'MASCULINO' ? '982' : '983'}${String(i + 1).padStart(6, '0')}`,
              passwordHash,
              estado: 'ACTIVO',
              emailVerificado: true,
              ciudad,
            },
          });
          await this.prisma.userRole.create({ data: { userId: user.id, roleId: rolJugador.id } });
          jugadoresCreados++;
        }
        players.push({ id: user.id, documento: user.documento });
      }
      return players;
    };

    const hombres = totalPlayersM > 0
      ? await crearJugadores(totalPlayersM, 'MASCULINO', 4000001, this.NOMBRES_M)
      : [];
    const mujeres = totalPlayersF > 0
      ? await crearJugadores(totalPlayersF, 'FEMENINO', 5000001, this.NOMBRES_F)
      : [];

    // 5. Create pairs & inscriptions
    let parejasInscritas = 0;
    let categoriasCerradas = 0;

    const inscribirCategoria = async (
      players: { id: string; documento: string }[],
      startIdx: number,
      targetPairs: number,
      categoryId: string,
    ): Promise<number> => {
      let created = 0;
      for (let i = 0; i < targetPairs; i++) {
        const p1 = players[startIdx + i * 2];
        const p2 = players[startIdx + i * 2 + 1];
        if (!p1 || !p2) break;

        // Check duplicate
        const existing = await this.prisma.inscripcion.findFirst({
          where: {
            tournamentId,
            categoryId,
            pareja: {
              OR: [
                { jugador1Id: p1.id, jugador2Id: p2.id },
                { jugador1Id: p2.id, jugador2Id: p1.id },
              ],
            },
          },
        });
        if (existing) { created++; continue; }

        const pareja = await this.prisma.pareja.create({
          data: { jugador1Id: p1.id, jugador2Id: p2.id, jugador2Documento: p2.documento },
        });

        const inscripcion = await this.prisma.inscripcion.create({
          data: {
            tournamentId,
            parejaId: pareja.id,
            categoryId,
            modalidad: modalidad as any,
            estado: 'CONFIRMADA',
            modoPago: 'COMPLETO',
          },
        });

        if (monto > 0) {
          await this.prisma.pago.create({
            data: {
              inscripcionId: inscripcion.id,
              jugadorId: p1.id,
              metodoPago: 'EFECTIVO',
              monto,
              comision,
              estado: 'CONFIRMADO',
              fechaPago: new Date(),
              fechaConfirm: new Date(),
            },
          });
        }
        created++;
      }
      return created;
    };

    // Inscribe masculine categories
    let mIdx = 0;
    for (const cat of categoriasMasc) {
      const created = await inscribirCategoria(hombres, mIdx, cat.parejas, cat.catId);
      mIdx += cat.parejas * 2;
      parejasInscritas += created;
    }

    // Inscribe feminine categories
    let fIdx = 0;
    for (const cat of categoriasFem) {
      const created = await inscribirCategoria(mujeres, fIdx, cat.parejas, cat.catId);
      fIdx += cat.parejas * 2;
      parejasInscritas += created;
    }

    // 6. Close inscriptions
    const allCats = [...categoriasMasc, ...categoriasFem];
    for (const cat of allCats) {
      await this.prisma.tournamentCategory.update({
        where: { id: cat.tcId },
        data: { estado: 'INSCRIPCIONES_CERRADAS', inscripcionAbierta: false },
      });
      categoriasCerradas++;
    }

    return {
      jugadoresCreados,
      parejasInscritas,
      categoriasCerradas,
      totalJugadoresM: totalPlayersM,
      totalJugadoresF: totalPlayersF,
      loginEjemplo: { documento: '4000001', password: 'test123' },
    };
  }
}