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
exports.RankingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let RankingsService = class RankingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async obtenerRankings(tipo, alcance, genero) {
        const where = {};
        if (tipo) {
            where.tipoRanking = tipo;
        }
        if (alcance) {
            where.alcance = alcance;
        }
        if (genero) {
            where.genero = genero;
        }
        const rankings = await this.prisma.ranking.findMany({
            where,
            include: {
                jugador: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        ciudad: true,
                        fotoUrl: true,
                    },
                },
            },
            orderBy: {
                posicion: 'asc',
            },
        });
        return rankings;
    }
    async obtenerRankingGlobal(genero) {
        return this.obtenerRankings('GLOBAL', undefined, genero);
    }
    async obtenerRankingPorPais(pais, genero) {
        return this.obtenerRankings('PAIS', pais, genero);
    }
    async obtenerRankingPorCiudad(ciudad, genero) {
        return this.obtenerRankings('CIUDAD', ciudad, genero);
    }
    async obtenerRankingPorCategoria(categoria, genero) {
        return this.obtenerRankings('CATEGORIA', categoria, genero);
    }
    async obtenerTop10(genero) {
        const where = { tipoRanking: 'GLOBAL' };
        if (genero) {
            where.genero = genero;
        }
        const top10 = await this.prisma.ranking.findMany({
            where,
            take: 10,
            include: {
                jugador: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        ciudad: true,
                        fotoUrl: true,
                    },
                },
            },
            orderBy: {
                posicion: 'asc',
            },
        });
        return top10;
    }
    async obtenerRankingJugador(jugadorId) {
        const rankings = await this.prisma.ranking.findMany({
            where: { jugadorId },
            include: {
                jugador: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        documento: true,
                        genero: true,
                        ciudad: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        return rankings;
    }
    async obtenerHistorialPuntos(jugadorId) {
        const historial = await this.prisma.historialPuntos.findMany({
            where: { jugadorId },
            include: {
                tournament: {
                    select: {
                        id: true,
                        nombre: true,
                        ciudad: true,
                        fechaInicio: true,
                    },
                },
                category: {
                    select: {
                        id: true,
                        nombre: true,
                    },
                },
            },
            orderBy: {
                fechaTorneo: 'desc',
            },
        });
        return historial;
    }
    async actualizarRankings(tournamentId) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                partidos: {
                    where: { ronda: { in: ['FINAL', 'SEMIFINAL', 'CUARTOS', 'OCTAVOS'] } },
                    include: {
                        category: true,
                        parejaGanadora: {
                            include: {
                                jugador1: true,
                                jugador2: true,
                            },
                        },
                        parejaPerdedora: {
                            include: {
                                jugador1: true,
                                jugador2: true,
                            },
                        },
                    },
                },
            },
        });
        if (!tournament) {
            return;
        }
        const puntosPorPosicion = {
            CAMPEON: 100,
            FINALISTA: 60,
            SEMIFINALISTA: 35,
            CUARTOS: 15,
            OCTAVOS: 8,
            PRIMERA_RONDA: 3,
        };
        for (const partido of tournament.partidos) {
            if (!partido.parejaGanadora || !partido.parejaPerdedora) {
                continue;
            }
            let puntos = 0;
            let posicion = '';
            if (partido.ronda === 'FINAL') {
                puntos = puntosPorPosicion.CAMPEON;
                posicion = 'CAMPEON';
                await this.registrarPuntos(partido.parejaGanadora, tournamentId, partido.categoryId, puntos, posicion);
                puntos = puntosPorPosicion.FINALISTA;
                posicion = 'FINALISTA';
                await this.registrarPuntos(partido.parejaPerdedora, tournamentId, partido.categoryId, puntos, posicion);
            }
            else if (partido.ronda === 'SEMIFINAL') {
                puntos = puntosPorPosicion.SEMIFINALISTA;
                posicion = 'SEMIFINALISTA';
                await this.registrarPuntos(partido.parejaPerdedora, tournamentId, partido.categoryId, puntos, posicion);
            }
            else if (partido.ronda === 'CUARTOS') {
                puntos = puntosPorPosicion.CUARTOS;
                posicion = 'CUARTOS';
                await this.registrarPuntos(partido.parejaPerdedora, tournamentId, partido.categoryId, puntos, posicion);
            }
        }
        await this.recalcularPosiciones();
        return { message: 'Rankings actualizados' };
    }
    async registrarPuntos(pareja, tournamentId, categoryId, puntos, posicion) {
        const jugadores = [pareja.jugador1, pareja.jugador2].filter(Boolean);
        for (const jugador of jugadores) {
            await this.prisma.historialPuntos.create({
                data: {
                    jugadorId: jugador.id,
                    tournamentId,
                    categoryId,
                    posicionFinal: posicion,
                    puntosGanados: puntos,
                    fechaTorneo: new Date(),
                },
            });
            await this.actualizarRankingJugador(jugador.id, puntos);
        }
    }
    async actualizarRankingJugador(jugadorId, puntosNuevos) {
        const jugador = await this.prisma.user.findUnique({
            where: { id: jugadorId },
        });
        if (!jugador) {
            return;
        }
        let ranking = await this.prisma.ranking.findFirst({
            where: {
                jugadorId,
                tipoRanking: 'GLOBAL',
                alcance: 'GLOBAL',
            },
        });
        if (ranking) {
            await this.prisma.ranking.update({
                where: { id: ranking.id },
                data: {
                    puntosTotales: ranking.puntosTotales + puntosNuevos,
                    torneosJugados: ranking.torneosJugados + 1,
                    ultimaActualizacion: new Date(),
                },
            });
        }
        else {
            await this.prisma.ranking.create({
                data: {
                    jugadorId,
                    tipoRanking: 'GLOBAL',
                    alcance: 'GLOBAL',
                    genero: jugador.genero,
                    puntosTotales: puntosNuevos,
                    posicion: 999999,
                    torneosJugados: 1,
                },
            });
        }
    }
    async recalcularPosiciones() {
        const rankingsGlobales = await this.prisma.ranking.findMany({
            where: { tipoRanking: 'GLOBAL' },
            orderBy: { puntosTotales: 'desc' },
        });
        let posicion = 1;
        for (const ranking of rankingsGlobales) {
            await this.prisma.ranking.update({
                where: { id: ranking.id },
                data: {
                    posicionAnterior: ranking.posicion,
                    posicion,
                },
            });
            posicion++;
        }
    }
    async recalcularRankings() {
        console.log('Recalculando rankings globales...');
        return { message: 'Rankings recalculados' };
    }
};
exports.RankingsService = RankingsService;
exports.RankingsService = RankingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RankingsService);
//# sourceMappingURL=rankings.service.js.map