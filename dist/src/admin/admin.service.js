"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const rankings_service_1 = require("../rankings/rankings.service");
let AdminService = class AdminService {
    constructor(prisma, rankingsService) {
        this.prisma = prisma;
        this.rankingsService = rankingsService;
    }
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
    async aprobarTorneo(id) {
        const torneo = await this.prisma.tournament.findUnique({
            where: { id },
        });
        if (!torneo) {
            throw new common_1.NotFoundException('Torneo no encontrado');
        }
        await this.prisma.tournament.update({
            where: { id },
            data: {
                estado: 'PUBLICADO',
            },
        });
        return { message: 'Torneo aprobado' };
    }
    async rechazarTorneo(id, motivo) {
        const torneo = await this.prisma.tournament.findUnique({
            where: { id },
        });
        if (!torneo) {
            throw new common_1.NotFoundException('Torneo no encontrado');
        }
        await this.prisma.tournament.update({
            where: { id },
            data: {
                estado: 'RECHAZADO',
            },
        });
        return { message: 'Torneo rechazado' };
    }
    async obtenerSolicitudesOrganizador(estado) {
        const where = {};
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
    async aprobarSolicitudOrganizador(id) {
        const solicitud = await this.prisma.solicitudOrganizador.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!solicitud) {
            throw new common_1.NotFoundException('Solicitud no encontrada');
        }
        const rolOrganizador = await this.prisma.role.findUnique({
            where: { nombre: 'organizador' },
        });
        if (!rolOrganizador) {
            throw new common_1.NotFoundException('Rol organizador no encontrado');
        }
        await this.prisma.userRole.create({
            data: {
                userId: solicitud.userId,
                roleId: rolOrganizador.id,
            },
        });
        await this.prisma.solicitudOrganizador.update({
            where: { id },
            data: { estado: 'APROBADA' },
        });
        return { message: 'Solicitud aprobada' };
    }
    async rechazarSolicitudOrganizador(id, motivo) {
        const solicitud = await this.prisma.solicitudOrganizador.findUnique({
            where: { id },
        });
        if (!solicitud) {
            throw new common_1.NotFoundException('Solicitud no encontrada');
        }
        await this.prisma.solicitudOrganizador.update({
            where: { id },
            data: {
                estado: 'RECHAZADA',
                motivo,
            },
        });
        return { message: 'Solicitud rechazada' };
    }
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
    async aprobarFoto(id) {
        const foto = await this.prisma.foto.findUnique({
            where: { id },
        });
        if (!foto) {
            throw new common_1.NotFoundException('Foto no encontrada');
        }
        await this.prisma.foto.update({
            where: { id },
            data: {
                estadoModeracion: 'APROBADA',
            },
        });
        return { message: 'Foto aprobada' };
    }
    async eliminarFotoInapropiada(id, motivo) {
        const foto = await this.prisma.foto.findUnique({
            where: { id },
        });
        if (!foto) {
            throw new common_1.NotFoundException('Foto no encontrada');
        }
        await this.prisma.foto.update({
            where: { id },
            data: {
                estadoModeracion: 'RECHAZADA',
            },
        });
        await this.prisma.fotoPerfilModeracion.create({
            data: {
                userId: foto.userId,
                fotoUrl: foto.urlImagen,
                estado: 'RECHAZADA',
                motivoRechazo: motivo,
            },
        });
        return { message: 'Foto eliminada' };
    }
    async obtenerUsuarios(search, estado) {
        const where = {};
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
    async suspenderUsuario(id, motivo) {
        const usuario = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!usuario) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        await this.prisma.user.update({
            where: { id },
            data: { estado: 'SUSPENDIDO' },
        });
        return { message: 'Usuario suspendido' };
    }
    async activarUsuario(id) {
        const usuario = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!usuario) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        await this.prisma.user.update({
            where: { id },
            data: { estado: 'ACTIVO' },
        });
        return { message: 'Usuario activado' };
    }
    async obtenerReportesFotos(estado) {
        const where = {};
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
    async obtenerReportesUsuarios(estado) {
        const where = {};
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
    async resolverReporteFoto(id, accion) {
        const reporte = await this.prisma.reporteFoto.findUnique({
            where: { id },
            include: { foto: true },
        });
        if (!reporte) {
            throw new common_1.NotFoundException('Reporte no encontrado');
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
    async resolverReporteUsuario(id, accion) {
        const reporte = await this.prisma.reporte.findUnique({
            where: { id },
        });
        if (!reporte) {
            throw new common_1.NotFoundException('Reporte no encontrado');
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
    async obtenerSuscripciones(estado) {
        const where = {};
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
    async extenderSuscripcion(id, dias) {
        const suscripcion = await this.prisma.suscripcion.findUnique({
            where: { id },
        });
        if (!suscripcion) {
            throw new common_1.NotFoundException('Suscripción no encontrada');
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
    async obtenerConfiguracionPuntos() {
        const configuracion = await this.prisma.configuracionPuntos.findMany({
            orderBy: {
                puntosBase: 'desc',
            },
        });
        return configuracion;
    }
    async actualizarConfiguracionPuntos(id, data) {
        const config = await this.prisma.configuracionPuntos.findUnique({
            where: { id },
        });
        if (!config) {
            throw new common_1.NotFoundException('Configuración no encontrada');
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
    async crearCupon(data) {
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
    async desactivarCupon(id) {
        await this.prisma.cupon.update({
            where: { id },
            data: { estado: 'INACTIVO' },
        });
        return { message: 'Cupón desactivado' };
    }
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
        const suscripciones = await this.prisma.suscripcion.findMany({
            where: { estado: 'ACTIVA' },
        });
        const mrrSuscripciones = suscripciones.reduce((acc, sub) => {
            const precioMensual = sub.periodo === 'MENSUAL'
                ? sub.precio.toNumber()
                : sub.precio.toNumber() / 12;
            return acc + precioMensual;
        }, 0);
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
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rankings_service_1.RankingsService])
], AdminService);
//# sourceMappingURL=admin.service.js.map