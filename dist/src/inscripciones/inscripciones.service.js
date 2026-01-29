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
exports.InscripcionesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const parejas_service_1 = require("../parejas/parejas.service");
let InscripcionesService = class InscripcionesService {
    constructor(prisma, parejasService) {
        this.prisma = prisma;
        this.parejasService = parejasService;
    }
    async create(createInscripcionDto, userId) {
        const { tournamentId, categoryId, modalidad, jugador2Documento, metodoPago, } = createInscripcionDto;
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                categorias: true,
                modalidades: true,
            },
        });
        if (!tournament) {
            throw new common_1.NotFoundException('Torneo no encontrado');
        }
        if (tournament.estado !== 'PUBLICADO') {
            throw new common_1.BadRequestException('El torneo no acepta inscripciones');
        }
        if (new Date() > tournament.fechaLimiteInscr) {
            throw new common_1.BadRequestException('La fecha límite de inscripción ha vencido');
        }
        const categoriaExiste = tournament.categorias.some((c) => c.categoryId === categoryId);
        if (!categoriaExiste) {
            throw new common_1.BadRequestException('Categoría no disponible en este torneo');
        }
        const modalidadExiste = tournament.modalidades.some((m) => m.modalidad === modalidad);
        if (!modalidadExiste) {
            throw new common_1.BadRequestException('Modalidad no disponible en este torneo');
        }
        const jugador1 = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        const pareja = await this.parejasService.create({ jugador2Documento }, userId);
        const jugador2 = await this.prisma.user.findUnique({
            where: { documento: jugador2Documento },
        });
        if (jugador2) {
            if (modalidad === 'TRADICIONAL') {
                if (jugador1.genero !== jugador2.genero) {
                    throw new common_1.BadRequestException('En modalidad Tradicional, ambos jugadores deben ser del mismo género');
                }
            }
            if (modalidad === 'MIXTO') {
                if (jugador1.genero === jugador2.genero) {
                    throw new common_1.BadRequestException('En modalidad Mixto, los jugadores deben ser de géneros diferentes');
                }
            }
        }
        const inscripcionExistente = await this.prisma.inscripcion.findFirst({
            where: {
                tournamentId,
                parejaId: pareja.id,
            },
        });
        if (inscripcionExistente) {
            throw new common_1.BadRequestException('Esta pareja ya está inscrita en el torneo');
        }
        const inscripcion = await this.prisma.inscripcion.create({
            data: {
                tournamentId,
                parejaId: pareja.id,
                categoryId,
                modalidad,
                estado: tournament.costoInscripcion.toNumber() === 0
                    ? 'CONFIRMADA'
                    : metodoPago === 'EFECTIVO'
                        ? 'PENDIENTE_PAGO_PRESENCIAL'
                        : 'PENDIENTE_PAGO',
            },
            include: {
                pareja: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                tournament: true,
                category: true,
            },
        });
        if (tournament.costoInscripcion.toNumber() === 0) {
            return inscripcion;
        }
        const comision = tournament.costoInscripcion.toNumber() * 0.05;
        const monto = tournament.costoInscripcion.toNumber();
        await this.prisma.pago.create({
            data: {
                inscripcionId: inscripcion.id,
                metodoPago: metodoPago,
                monto,
                comision,
                estado: 'PENDIENTE',
            },
        });
        return inscripcion;
    }
    async findOne(id) {
        const inscripcion = await this.prisma.inscripcion.findUnique({
            where: { id },
            include: {
                pareja: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                tournament: true,
                category: true,
                pago: true,
                comprobantes: true,
            },
        });
        if (!inscripcion) {
            throw new common_1.NotFoundException('Inscripción no encontrada');
        }
        return inscripcion;
    }
    async findByUser(userId) {
        const inscripciones = await this.prisma.inscripcion.findMany({
            where: {
                pareja: {
                    OR: [{ jugador1Id: userId }, { jugador2Id: userId }],
                },
            },
            include: {
                pareja: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                tournament: true,
                category: true,
                pago: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return inscripciones;
    }
    async findByTournament(tournamentId, estado) {
        const where = { tournamentId };
        if (estado) {
            where.estado = estado;
        }
        const inscripciones = await this.prisma.inscripcion.findMany({
            where,
            include: {
                pareja: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                category: true,
                pago: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return inscripciones;
    }
    async cancelar(id, userId) {
        const inscripcion = await this.findOne(id);
        if (inscripcion.pareja.jugador1Id !== userId &&
            inscripcion.pareja.jugador2Id !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para cancelar esta inscripción');
        }
        if (!['PENDIENTE_PAGO', 'PENDIENTE_CONFIRMACION', 'PENDIENTE_PAGO_PRESENCIAL'].includes(inscripcion.estado)) {
            throw new common_1.BadRequestException('No se puede cancelar esta inscripción');
        }
        return this.prisma.inscripcion.update({
            where: { id },
            data: { estado: 'CANCELADA' },
        });
    }
    async subirComprobante(inscripcionId, comprobanteUrl) {
        const inscripcion = await this.findOne(inscripcionId);
        if (inscripcion.estado !== 'PENDIENTE_PAGO') {
            throw new common_1.BadRequestException('Esta inscripción no requiere comprobante');
        }
        await this.prisma.comprobantePago.create({
            data: {
                inscripcionId,
                url: comprobanteUrl,
                estado: 'PENDIENTE',
            },
        });
        return this.prisma.inscripcion.update({
            where: { id: inscripcionId },
            data: { estado: 'PENDIENTE_CONFIRMACION' },
        });
    }
    async confirmarPago(inscripcionId) {
        return this.prisma.inscripcion.update({
            where: { id: inscripcionId },
            data: { estado: 'CONFIRMADA' },
        });
    }
    async rechazarComprobante(inscripcionId, motivo) {
        await this.prisma.comprobantePago.updateMany({
            where: { inscripcionId },
            data: {
                estado: 'RECHAZADA',
                motivoRechazo: motivo,
            },
        });
        return this.prisma.inscripcion.update({
            where: { id: inscripcionId },
            data: { estado: 'RECHAZADA' },
        });
    }
};
exports.InscripcionesService = InscripcionesService;
exports.InscripcionesService = InscripcionesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        parejas_service_1.ParejasService])
], InscripcionesService);
//# sourceMappingURL=inscripciones.service.js.map