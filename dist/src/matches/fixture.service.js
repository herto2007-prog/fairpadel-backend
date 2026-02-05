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
exports.FixtureService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let FixtureService = class FixtureService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generarFixtureCompleto(tournamentId) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                categorias: {
                    include: {
                        category: true,
                    },
                },
                inscripciones: {
                    where: { estado: 'CONFIRMADA' },
                    include: {
                        pareja: true,
                        category: true,
                    },
                },
                torneoCanchas: {
                    include: {
                        sedeCancha: {
                            include: {
                                sede: true,
                            },
                        },
                        horarios: true,
                    },
                },
            },
        });
        if (!tournament) {
            throw new common_1.BadRequestException('Torneo no encontrado');
        }
        if (tournament.estado !== 'PUBLICADO') {
            throw new common_1.BadRequestException('El torneo debe estar en estado PUBLICADO');
        }
        await this.prisma.tournament.update({
            where: { id: tournamentId },
            data: { estado: 'EN_CURSO' },
        });
        const fixtures = [];
        for (const categoriaRelacion of tournament.categorias) {
            const inscripcionesCategoria = tournament.inscripciones.filter((i) => i.categoryId === categoriaRelacion.categoryId);
            if (inscripcionesCategoria.length === 0) {
                continue;
            }
            const fixtureCategoria = await this.generarFixturePorCategoria(tournamentId, categoriaRelacion.categoryId, inscripcionesCategoria, tournament.torneoCanchas);
            fixtures.push(fixtureCategoria);
        }
        return {
            tournamentId,
            fixtures,
            message: 'Fixture generado exitosamente',
        };
    }
    async generarFixturePorCategoria(tournamentId, categoryId, inscripciones, torneoCanchas) {
        const parejas = inscripciones.map((i) => i.pareja);
        const numParejas = parejas.length;
        if (numParejas === 0) {
            return null;
        }
        const parejasAleatorias = this.shuffleArray([...parejas]);
        const numPartidosTotal = this.calcularNumeroPartidos(numParejas);
        const rondas = this.generarRondas(parejasAleatorias);
        const partidos = [];
        let numeroRonda = 1;
        for (const ronda of rondas) {
            for (const enfrentamiento of ronda.enfrentamientos) {
                const partido = await this.prisma.match.create({
                    data: {
                        tournamentId,
                        categoryId,
                        ronda: ronda.nombre,
                        numeroRonda,
                        pareja1Id: enfrentamiento.pareja1?.id || null,
                        pareja2Id: enfrentamiento.pareja2?.id || null,
                        estado: 'PROGRAMADO',
                    },
                });
                partidos.push(partido);
                numeroRonda++;
            }
        }
        if (torneoCanchas.length > 0) {
            await this.asignarCanchasYHorarios(partidos, torneoCanchas);
        }
        await this.generarPartidoUbicacion(tournamentId, categoryId, partidos);
        return {
            categoryId,
            numParejas,
            rondas: rondas.map((r) => ({
                nombre: r.nombre,
                numPartidos: r.enfrentamientos.length,
            })),
            partidos,
        };
    }
    generarRondas(parejas) {
        const numParejas = parejas.length;
        const rondas = [];
        let numRondas = Math.ceil(Math.log2(numParejas));
        let capacidad = Math.pow(2, numRondas);
        const primeraRonda = {
            nombre: this.getNombreRonda(numRondas),
            enfrentamientos: [],
        };
        for (let i = 0; i < capacidad / 2; i++) {
            const pareja1 = parejas[i * 2] || null;
            const pareja2 = parejas[i * 2 + 1] || null;
            primeraRonda.enfrentamientos.push({
                pareja1,
                pareja2,
            });
        }
        rondas.push(primeraRonda);
        for (let r = numRondas - 1; r > 0; r--) {
            const ronda = {
                nombre: this.getNombreRonda(r),
                enfrentamientos: [],
            };
            const numEnfrentamientos = Math.pow(2, r - 1);
            for (let i = 0; i < numEnfrentamientos; i++) {
                ronda.enfrentamientos.push({
                    pareja1: null,
                    pareja2: null,
                });
            }
            rondas.push(ronda);
        }
        return rondas;
    }
    getNombreRonda(nivel) {
        const nombres = {
            1: 'FINAL',
            2: 'SEMIFINAL',
            3: 'CUARTOS',
            4: 'OCTAVOS',
            5: 'DIECISEISAVOS',
        };
        return nombres[nivel] || `RONDA_${nivel}`;
    }
    calcularNumeroPartidos(numParejas) {
        return numParejas - 1 + 1;
    }
    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }
    async asignarCanchasYHorarios(partidos, torneoCanchas) {
        const horarios = torneoCanchas.flatMap((tc) => (tc.horarios || []).map((h) => ({ ...h, torneoCanchaId: tc.id })));
        if (torneoCanchas.length === 0 || horarios.length === 0) {
            return;
        }
        horarios.sort((a, b) => {
            const fechaA = new Date(a.fecha + ' ' + a.horaInicio);
            const fechaB = new Date(b.fecha + ' ' + b.horaInicio);
            return fechaA.getTime() - fechaB.getTime();
        });
        let horarioIndex = 0;
        let canchaIndex = 0;
        for (const partido of partidos) {
            if (horarioIndex >= horarios.length) {
                break;
            }
            const horario = horarios[horarioIndex];
            const torneoCancha = torneoCanchas[canchaIndex];
            await this.prisma.match.update({
                where: { id: partido.id },
                data: {
                    torneoCanchaId: torneoCancha.id,
                    fechaProgramada: horario.fecha,
                    horaProgramada: horario.horaInicio,
                    horaFinEstimada: this.calcularHoraFin(horario.horaInicio, 90),
                },
            });
            canchaIndex++;
            if (canchaIndex >= torneoCanchas.length) {
                canchaIndex = 0;
                horarioIndex++;
            }
        }
    }
    calcularHoraFin(horaInicio, duracionMinutos) {
        const [horas, minutos] = horaInicio.split(':').map(Number);
        const totalMinutos = horas * 60 + minutos + duracionMinutos;
        const nuevasHoras = Math.floor(totalMinutos / 60);
        const nuevosMinutos = totalMinutos % 60;
        return `${String(nuevasHoras).padStart(2, '0')}:${String(nuevosMinutos).padStart(2, '0')}`;
    }
    async generarPartidoUbicacion(tournamentId, categoryId, partidos) {
        const semifinales = partidos.filter((p) => p.ronda === 'SEMIFINAL');
        if (semifinales.length !== 2) {
            return;
        }
        await this.prisma.match.create({
            data: {
                tournamentId,
                categoryId,
                ronda: 'UBICACION',
                numeroRonda: partidos.length + 1,
                pareja1Id: null,
                pareja2Id: null,
                estado: 'PROGRAMADO',
            },
        });
    }
    async obtenerFixture(tournamentId, categoryId) {
        const where = { tournamentId };
        if (categoryId) {
            where.categoryId = categoryId;
        }
        const partidos = await this.prisma.match.findMany({
            where,
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
                parejaGanadora: {
                    include: {
                        jugador1: true,
                        jugador2: true,
                    },
                },
                torneoCancha: {
                    include: {
                        sedeCancha: {
                            include: {
                                sede: true,
                            },
                        },
                    },
                },
            },
            orderBy: [
                { numeroRonda: 'asc' },
            ],
        });
        const fixturePorCategoria = {};
        for (const partido of partidos) {
            const catId = partido.categoryId;
            if (!fixturePorCategoria[catId]) {
                fixturePorCategoria[catId] = {
                    category: partido.category,
                    rondas: {},
                };
            }
            if (!fixturePorCategoria[catId].rondas[partido.ronda]) {
                fixturePorCategoria[catId].rondas[partido.ronda] = [];
            }
            fixturePorCategoria[catId].rondas[partido.ronda].push(partido);
        }
        return fixturePorCategoria;
    }
};
exports.FixtureService = FixtureService;
exports.FixtureService = FixtureService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FixtureService);
//# sourceMappingURL=fixture.service.js.map