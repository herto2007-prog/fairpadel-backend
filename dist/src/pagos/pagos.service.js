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
exports.PagosService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bancard_service_1 = require("./bancard.service");
let PagosService = class PagosService {
    constructor(prisma, bancardService) {
        this.prisma = prisma;
        this.bancardService = bancardService;
    }
    async createBancardCheckout(inscripcionId) {
        const inscripcion = await this.prisma.inscripcion.findUnique({
            where: { id: inscripcionId },
            include: {
                pago: true,
                tournament: true,
                pareja: {
                    include: {
                        jugador1: true,
                    },
                },
            },
        });
        if (!inscripcion) {
            throw new common_1.NotFoundException('Inscripción no encontrada');
        }
        if (!inscripcion.pago) {
            throw new common_1.BadRequestException('No hay pago pendiente para esta inscripción');
        }
        if (inscripcion.pago.estado !== 'PENDIENTE') {
            throw new common_1.BadRequestException('El pago ya fue procesado');
        }
        const transactionId = `FP-${Date.now()}-${inscripcionId.substring(0, 8)}`;
        await this.prisma.pago.update({
            where: { id: inscripcion.pago.id },
            data: { transactionId },
        });
        const checkoutUrl = await this.bancardService.createCheckout({
            transactionId,
            amount: inscripcion.pago.monto.toNumber(),
            description: `Inscripción ${inscripcion.tournament.nombre}`,
            returnUrl: `${process.env.FRONTEND_URL}/pago/confirmacion`,
            cancelUrl: `${process.env.FRONTEND_URL}/pago/cancelado`,
        });
        return {
            checkoutUrl,
            transactionId,
        };
    }
    async confirmBancardPayment(transactionId) {
        const pago = await this.prisma.pago.findFirst({
            where: { transactionId },
            include: {
                inscripcion: true,
            },
        });
        if (!pago) {
            throw new common_1.NotFoundException('Pago no encontrado');
        }
        const paymentStatus = await this.bancardService.verifyPayment(transactionId);
        if (paymentStatus.status === 'success') {
            await this.prisma.pago.update({
                where: { id: pago.id },
                data: {
                    estado: 'CONFIRMADO',
                    fechaPago: new Date(),
                    fechaConfirm: new Date(),
                },
            });
            await this.prisma.inscripcion.update({
                where: { id: pago.inscripcionId },
                data: { estado: 'CONFIRMADA' },
            });
            return {
                success: true,
                message: 'Pago confirmado exitosamente',
            };
        }
        return {
            success: false,
            message: 'Pago no confirmado',
        };
    }
    async handleBancardWebhook(webhookData) {
        const isValid = this.bancardService.validateWebhook(webhookData);
        if (!isValid) {
            throw new common_1.BadRequestException('Webhook inválido');
        }
        const { transactionId, status } = webhookData;
        const pago = await this.prisma.pago.findFirst({
            where: { transactionId },
        });
        if (!pago) {
            throw new common_1.NotFoundException('Pago no encontrado');
        }
        if (status === 'success') {
            await this.prisma.pago.update({
                where: { id: pago.id },
                data: {
                    estado: 'CONFIRMADO',
                    fechaPago: new Date(),
                    fechaConfirm: new Date(),
                },
            });
            await this.prisma.inscripcion.update({
                where: { id: pago.inscripcionId },
                data: { estado: 'CONFIRMADA' },
            });
        }
        return { received: true };
    }
    async findByInscripcion(inscripcionId) {
        const pago = await this.prisma.pago.findFirst({
            where: { inscripcionId },
            include: {
                inscripcion: {
                    include: {
                        tournament: true,
                        pareja: {
                            include: {
                                jugador1: true,
                                jugador2: true,
                            },
                        },
                    },
                },
            },
        });
        if (!pago) {
            throw new common_1.NotFoundException('Pago no encontrado');
        }
        return pago;
    }
    async confirmarPagoPresencial(inscripcionId) {
        const inscripcion = await this.prisma.inscripcion.findUnique({
            where: { id: inscripcionId },
            include: { pago: true },
        });
        if (!inscripcion) {
            throw new common_1.NotFoundException('Inscripción no encontrada');
        }
        await this.prisma.pago.update({
            where: { id: inscripcion.pago.id },
            data: {
                estado: 'CONFIRMADO',
                fechaPago: new Date(),
                fechaConfirm: new Date(),
            },
        });
        return this.prisma.inscripcion.update({
            where: { id: inscripcionId },
            data: { estado: 'CONFIRMADA' },
        });
    }
};
exports.PagosService = PagosService;
exports.PagosService = PagosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bancard_service_1.BancardService])
], PagosService);
//# sourceMappingURL=pagos.service.js.map