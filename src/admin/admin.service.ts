import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
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

    await this.prisma.suscripcion.update({
      where: { id },
      data: {
        fechaFin: nuevaFechaFin,
        fechaRenovacion: nuevaFechaFin,
      },
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

    // Cancelar suscripciones activas
    await this.prisma.suscripcion.updateMany({
      where: { userId, estado: 'ACTIVA' },
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
}