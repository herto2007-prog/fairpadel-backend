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
exports.MatchesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let MatchesService = class MatchesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findOne(id) {
        const match = await this.prisma.match.findUnique({
            where: { id },
            include: {
                tournament: true,
                category: true,
                pareja1: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                pareja2: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                parejaGanadora: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                cancha: {
                    include: {
                        complejo: true,
                    },
                },
            },
        });
        if (!match) {
            throw new common_1.NotFoundException('Partido no encontrado');
        }
        return match;
    }
    async cargarResultado(id, dto) {
        const match = await this.findOne(id);
        if (match.estado === 'FINALIZADO') {
            throw new common_1.BadRequestException('Este partido ya tiene resultado cargado');
        }
        const { set1Pareja1, set1Pareja2, set2Pareja1, set2Pareja2, set3Pareja1, set3Pareja2, esWalkOver, parejaGanadoraId, observaciones, } = dto;
        let ganadorId;
        let perdedorId;
        if (esWalkOver) {
            ganadorId = parejaGanadoraId;
            perdedorId = ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;
            await this.prisma.match.update({
                where: { id },
                data: {
                    estado: 'WO',
                    parejaGanadoraId: ganadorId,
                    parejaPerdedoraId: perdedorId,
                    observaciones: observaciones || 'Walk Over',
                },
            });
        }
        else {
            this.validarMarcador(set1Pareja1, set1Pareja2, set2Pareja1, set2Pareja2, set3Pareja1, set3Pareja2);
            let setsGanadosP1 = 0;
            let setsGanadosP2 = 0;
            if (set1Pareja1 > set1Pareja2)
                setsGanadosP1++;
            else
                setsGanadosP2++;
            if (set2Pareja1 > set2Pareja2)
                setsGanadosP1++;
            else
                setsGanadosP2++;
            if (set3Pareja1 !== null && set3Pareja2 !== null) {
                if (set3Pareja1 > set3Pareja2)
                    setsGanadosP1++;
                else
                    setsGanadosP2++;
            }
            ganadorId = setsGanadosP1 > setsGanadosP2 ? match.pareja1Id : match.pareja2Id;
            perdedorId = ganadorId === match.pareja1Id ? match.pareja2Id : match.pareja1Id;
            await this.prisma.match.update({
                where: { id },
                data: {
                    set1Pareja1,
                    set1Pareja2,
                    set2Pareja1,
                    set2Pareja2,
                    set3Pareja1,
                    set3Pareja2,
                    estado: 'FINALIZADO',
                    parejaGanadoraId: ganadorId,
                    parejaPerdedoraId: perdedorId,
                    observaciones,
                },
            });
        }
        if (match.partidoSiguienteId) {
            await this.avanzarGanador(match.partidoSiguienteId, ganadorId, match.numeroRonda);
        }
        return this.findOne(id);
    }
    validarMarcador(s1p1, s1p2, s2p1, s2p2, s3p1, s3p2) {
        const games = [s1p1, s1p2, s2p1, s2p2];
        if (s3p1 !== null)
            games.push(s3p1);
        if (s3p2 !== null)
            games.push(s3p2);
        for (const g of games) {
            if (g < 0 || g > 7) {
                throw new common_1.BadRequestException('Los games deben estar entre 0 y 7');
            }
        }
        const validarSet = (p1, p2) => {
            const diff = Math.abs(p1 - p2);
            if (p1 === 6 && p2 <= 4)
                return true;
            if (p2 === 6 && p1 <= 4)
                return true;
            if (p1 === 7 && (p2 === 5 || p2 === 6))
                return true;
            if (p2 === 7 && (p1 === 5 || p1 === 6))
                return true;
            return false;
        };
        if (!validarSet(s1p1, s1p2)) {
            throw new common_1.BadRequestException('Marcador inválido en set 1');
        }
        if (!validarSet(s2p1, s2p2)) {
            throw new common_1.BadRequestException('Marcador inválido en set 2');
        }
        if (s3p1 !== null && s3p2 !== null) {
            if (!validarSet(s3p1, s3p2)) {
                throw new common_1.BadRequestException('Marcador inválido en set 3');
            }
        }
    }
    async avanzarGanador(partidoSiguienteId, ganadorId, rondaAnterior) {
        const partidoSiguiente = await this.prisma.match.findUnique({
            where: { id: partidoSiguienteId },
        });
        const campo = rondaAnterior % 2 === 0 ? 'pareja1Id' : 'pareja2Id';
        await this.prisma.match.update({
            where: { id: partidoSiguienteId },
            data: { [campo]: ganadorId },
        });
    }
    async reprogramar(id, data) {
        const match = await this.findOne(id);
        if (match.estado === 'FINALIZADO') {
            throw new common_1.BadRequestException('No se puede reprogramar un partido finalizado');
        }
        return this.prisma.match.update({
            where: { id },
            data: {
                fechaProgramada: new Date(data.fechaProgramada),
                horaProgramada: data.horaProgramada,
                canchaId: data.canchaId || match.canchaId,
            },
        });
    }
    async obtenerPartidosPendientes(tournamentId) {
        return this.prisma.match.findMany({
            where: {
                tournamentId,
                estado: { in: ['PROGRAMADO', 'EN_JUEGO'] },
            },
            include: {
                category: true,
                pareja1: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                pareja2: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                cancha: {
                    include: {
                        complejo: true,
                    },
                },
            },
            orderBy: [
                { fechaProgramada: 'asc' },
                { horaProgramada: 'asc' },
            ],
        });
    }
};
exports.MatchesService = MatchesService;
exports.MatchesService = MatchesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MatchesService);
//# sourceMappingURL=matches.service.js.map