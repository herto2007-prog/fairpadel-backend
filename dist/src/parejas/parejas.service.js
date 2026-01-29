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
exports.ParejasService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ParejasService = class ParejasService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createParejaDto, jugador1Id) {
        const { jugador2Documento } = createParejaDto;
        const jugador2 = await this.prisma.user.findUnique({
            where: { documento: jugador2Documento },
        });
        const jugador1 = await this.prisma.user.findUnique({
            where: { id: jugador1Id },
        });
        if (jugador1.documento === jugador2Documento) {
            throw new common_1.BadRequestException('No puedes crear una pareja contigo mismo');
        }
        const pareja = await this.prisma.pareja.create({
            data: {
                jugador1Id,
                jugador2Id: jugador2?.id || null,
                jugador2Documento,
            },
            include: {
                jugador1: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        fotoUrl: true,
                    },
                },
                jugador2: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        return pareja;
    }
    async findOne(id) {
        const pareja = await this.prisma.pareja.findUnique({
            where: { id },
            include: {
                jugador1: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        fotoUrl: true,
                    },
                },
                jugador2: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        if (!pareja) {
            throw new common_1.NotFoundException('Pareja no encontrada');
        }
        return pareja;
    }
    async findByUser(userId) {
        const parejas = await this.prisma.pareja.findMany({
            where: {
                OR: [
                    { jugador1Id: userId },
                    { jugador2Id: userId },
                ],
            },
            include: {
                jugador1: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        fotoUrl: true,
                    },
                },
                jugador2: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        return parejas;
    }
    async buscarJugadorPorDocumento(documento) {
        const jugador = await this.prisma.user.findUnique({
            where: { documento },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                documento: true,
                genero: true,
                ciudad: true,
                fotoUrl: true,
            },
        });
        if (!jugador) {
            return {
                encontrado: false,
                mensaje: 'Jugador no registrado. La pareja se activará cuando este jugador se registre.',
            };
        }
        return {
            encontrado: true,
            jugador,
        };
    }
};
exports.ParejasService = ParejasService;
exports.ParejasService = ParejasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ParejasService);
//# sourceMappingURL=parejas.service.js.map