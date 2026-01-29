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
exports.NotificacionesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const email_service_1 = require("./email.service");
const sms_service_1 = require("./sms.service");
let NotificacionesService = class NotificacionesService {
    constructor(prisma, emailService, smsService) {
        this.prisma = prisma;
        this.emailService = emailService;
        this.smsService = smsService;
    }
    async crearNotificacion(userId, tipo, contenido, enviarEmail = false, enviarSms = false) {
        const notificacion = await this.prisma.notificacion.create({
            data: {
                userId,
                tipo: tipo,
                contenido,
            },
        });
        const usuario = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (enviarEmail) {
            await this.emailService.enviarNotificacion(usuario.email, usuario.nombre, contenido);
        }
        if (enviarSms && usuario.esPremium) {
            await this.smsService.enviarNotificacion(usuario.telefono, contenido);
        }
        return notificacion;
    }
    async obtenerNotificaciones(userId, leida) {
        const where = { userId };
        if (leida !== undefined) {
            where.leida = leida;
        }
        const notificaciones = await this.prisma.notificacion.findMany({
            where,
            orderBy: {
                createdAt: 'desc',
            },
            take: 50,
        });
        return notificaciones;
    }
    async contarNoLeidas(userId) {
        const count = await this.prisma.notificacion.count({
            where: {
                userId,
                leida: false,
            },
        });
        return { count };
    }
    async marcarComoLeida(id, userId) {
        const notificacion = await this.prisma.notificacion.findUnique({
            where: { id },
        });
        if (!notificacion) {
            throw new common_1.NotFoundException('Notificación no encontrada');
        }
        if (notificacion.userId !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para marcar esta notificación');
        }
        return this.prisma.notificacion.update({
            where: { id },
            data: { leida: true },
        });
    }
    async marcarTodasComoLeidas(userId) {
        await this.prisma.notificacion.updateMany({
            where: {
                userId,
                leida: false,
            },
            data: {
                leida: true,
            },
        });
        return { message: 'Todas las notificaciones marcadas como leídas' };
    }
    async notificarInscripcionConfirmada(userId, torneoNombre) {
        return this.crearNotificacion(userId, 'INSCRIPCION', `Tu inscripción al torneo "${torneoNombre}" ha sido confirmada`, true, false);
    }
    async notificarPagoConfirmado(userId, torneoNombre) {
        return this.crearNotificacion(userId, 'PAGO', `Tu pago para el torneo "${torneoNombre}" fue confirmado exitosamente`, true, true);
    }
    async notificarResultadoPartido(userId, resultado) {
        return this.crearNotificacion(userId, 'PARTIDO', resultado, true, false);
    }
    async notificarCambioRanking(userId, posicionNueva) {
        return this.crearNotificacion(userId, 'RANKING', `Tu ranking ha cambiado. Ahora estás en la posición #${posicionNueva}`, true, false);
    }
    async notificarNuevoSeguidor(userId, seguidorNombre) {
        return this.crearNotificacion(userId, 'SOCIAL', `${seguidorNombre} comenzó a seguirte`, false, false);
    }
    async notificarNuevoMensaje(userId, remitenteNombre) {
        return this.crearNotificacion(userId, 'MENSAJE', `Nuevo mensaje de ${remitenteNombre}`, true, false);
    }
    async recordatorioPartido(userId, detalles) {
        return this.crearNotificacion(userId, 'PARTIDO', `Recordatorio: ${detalles}`, true, true);
    }
};
exports.NotificacionesService = NotificacionesService;
exports.NotificacionesService = NotificacionesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_service_1.EmailService,
        sms_service_1.SmsService])
], NotificacionesService);
//# sourceMappingURL=notificaciones.service.js.map