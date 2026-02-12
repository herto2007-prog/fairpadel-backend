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