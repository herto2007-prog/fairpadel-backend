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
exports.SuscripcionesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bancard_service_1 = require("../pagos/bancard.service");
let SuscripcionesService = class SuscripcionesService {
    constructor(prisma, bancardService) {
        this.prisma = prisma;
        this.bancardService = bancardService;
    }
    async obtenerPlanes() {
        const planes = await this.prisma.planPremium.findMany({
            where: { activo: true },
            orderBy: {
                precioMensual: 'asc',
            },
        });
        return planes;
    }
    async crearSuscripcion(dto, userId) {
        const { planId, periodo, cuponCodigo } = dto;
        const plan = await this.prisma.planPremium.findUnique({
            where: { id: planId },
        });
        if (!plan) {
            throw new common_1.NotFoundException('Plan no encontrado');
        }
        const suscripcionActiva = await this.prisma.suscripcion.findFirst({
            where: {
                userId,
                estado: 'ACTIVA',
            },
        });
        if (suscripcionActiva) {
            throw new common_1.BadRequestException('Ya tienes una suscripción activa');
        }
        let precio = periodo === 'MENSUAL' ? plan.precioMensual : plan.precioAnual;
        if (cuponCodigo) {
            const cupon = await this.validarCupon(cuponCodigo);
            if (cupon.valido) {
                const precioConDescuento = this.aplicarDescuento(precio.toNumber(), cupon);
            }
        }
        const fechaInicio = new Date();
        const fechaFin = new Date();
        if (periodo === 'MENSUAL') {
            fechaFin.setMonth(fechaFin.getMonth() + 1);
        }
        else {
            fechaFin.setFullYear(fechaFin.getFullYear() + 1);
        }
        const suscripcion = await this.prisma.suscripcion.create({
            data: {
                userId,
                planId,
                periodo: periodo,
                precio,
                estado: 'PENDIENTE_PAGO',
                fechaInicio,
                fechaFin,
                fechaRenovacion: fechaFin,
                cuponAplicado: cuponCodigo || null,
            },
        });
        const transactionId = `SUB-${Date.now()}-${suscripcion.id.substring(0, 8)}`;
        const checkoutUrl = await this.bancardService.createCheckout({
            transactionId,
            amount: precio.toNumber(),
            description: `Suscripción ${plan.nombre} - ${periodo}`,
            returnUrl: `${process.env.FRONTEND_URL}/suscripcion/confirmacion`,
            cancelUrl: `${process.env.FRONTEND_URL}/suscripcion/cancelado`,
        });
        return {
            suscripcion,
            checkoutUrl,
            transactionId,
        };
    }
    async obtenerSuscripcionActiva(userId) {
        const suscripcion = await this.prisma.suscripcion.findFirst({
            where: {
                userId,
                estado: 'ACTIVA',
            },
            include: {
                plan: true,
            },
        });
        return suscripcion;
    }
    async cancelarSuscripcion(userId) {
        const suscripcion = await this.obtenerSuscripcionActiva(userId);
        if (!suscripcion) {
            throw new common_1.NotFoundException('No tienes una suscripción activa');
        }
        await this.prisma.suscripcion.update({
            where: { id: suscripcion.id },
            data: {
                autoRenovar: false,
                estado: 'CANCELADA',
            },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { esPremium: false },
        });
        return { message: 'Suscripción cancelada' };
    }
    async reactivarSuscripcion(userId) {
        const suscripcion = await this.prisma.suscripcion.findFirst({
            where: {
                userId,
                estado: 'CANCELADA',
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        if (!suscripcion) {
            throw new common_1.NotFoundException('No tienes una suscripción cancelada');
        }
        await this.prisma.suscripcion.update({
            where: { id: suscripcion.id },
            data: {
                autoRenovar: true,
                estado: 'ACTIVA',
            },
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { esPremium: true },
        });
        return { message: 'Suscripción reactivada' };
    }
    async confirmarPagoSuscripcion(suscripcionId) {
        const suscripcion = await this.prisma.suscripcion.findUnique({
            where: { id: suscripcionId },
        });
        if (!suscripcion) {
            throw new common_1.NotFoundException('Suscripción no encontrada');
        }
        await this.prisma.suscripcion.update({
            where: { id: suscripcionId },
            data: { estado: 'ACTIVA' },
        });
        await this.prisma.user.update({
            where: { id: suscripcion.userId },
            data: { esPremium: true },
        });
        return { message: 'Suscripción activada' };
    }
    async validarCupon(codigo) {
        const cupon = await this.prisma.cupon.findUnique({
            where: { codigo },
        });
        if (!cupon) {
            return { valido: false, mensaje: 'Cupón no encontrado' };
        }
        const ahora = new Date();
        if (ahora < cupon.fechaInicio || ahora > cupon.fechaExpiracion) {
            return { valido: false, mensaje: 'Cupón expirado' };
        }
        if (cupon.usosActuales >= cupon.limiteUsos) {
            return { valido: false, mensaje: 'Cupón agotado' };
        }
        if (cupon.estado !== 'ACTIVO') {
            return { valido: false, mensaje: 'Cupón inactivo' };
        }
        return {
            valido: true,
            cupon,
            mensaje: 'Cupón válido',
        };
    }
    aplicarDescuento(precio, cupon) {
        if (cupon.tipo === 'PORCENTAJE') {
            const descuento = (precio * cupon.valor.toNumber()) / 100;
            return precio - descuento;
        }
        else {
            return precio - cupon.valor.toNumber();
        }
    }
    async renovarSuscripcionesVencidas() {
        const ahora = new Date();
        const suscripcionesVencidas = await this.prisma.suscripcion.findMany({
            where: {
                estado: 'ACTIVA',
                fechaFin: {
                    lte: ahora,
                },
                autoRenovar: true,
            },
            include: {
                plan: true,
                user: true,
            },
        });
        for (const suscripcion of suscripcionesVencidas) {
            await this.prisma.suscripcion.update({
                where: { id: suscripcion.id },
                data: { estado: 'VENCIDA' },
            });
            await this.prisma.user.update({
                where: { id: suscripcion.userId },
                data: { esPremium: false },
            });
        }
        return { procesadas: suscripcionesVencidas.length };
    }
};
exports.SuscripcionesService = SuscripcionesService;
exports.SuscripcionesService = SuscripcionesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bancard_service_1.BancardService])
], SuscripcionesService);
//# sourceMappingURL=suscripciones.service.js.map