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
exports.SedesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SedesService = class SedesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createSede(dto) {
        return this.prisma.sede.create({
            data: {
                nombre: dto.nombre,
                ciudad: dto.ciudad,
                direccion: dto.direccion,
                mapsUrl: dto.mapsUrl,
                telefono: dto.telefono,
                logoUrl: dto.logoUrl,
                imagenFondo: dto.imagenFondo,
                horarioAtencion: dto.horarioAtencion,
                contactoEncargado: dto.contactoEncargado,
                canvasWidth: dto.canvasWidth || 800,
                canvasHeight: dto.canvasHeight || 600,
                activo: true,
            },
            include: {
                canchas: true,
            },
        });
    }
    async findAllSedes(filters) {
        const where = {};
        if (filters.ciudad) {
            where.ciudad = {
                contains: filters.ciudad,
                mode: 'insensitive',
            };
        }
        if (filters.activo !== undefined) {
            where.activo = filters.activo;
        }
        return this.prisma.sede.findMany({
            where,
            include: {
                canchas: {
                    where: { activa: true },
                    orderBy: { nombre: 'asc' },
                },
                _count: {
                    select: {
                        canchas: true,
                        torneosPrincipal: true,
                    },
                },
            },
            orderBy: { nombre: 'asc' },
        });
    }
    async findOneSede(id) {
        const sede = await this.prisma.sede.findUnique({
            where: { id },
            include: {
                canchas: {
                    orderBy: { nombre: 'asc' },
                },
                torneosPrincipal: {
                    select: {
                        id: true,
                        nombre: true,
                        fechaInicio: true,
                        estado: true,
                    },
                    orderBy: { fechaInicio: 'desc' },
                    take: 10,
                },
                _count: {
                    select: {
                        canchas: true,
                        torneosPrincipal: true,
                        torneoSedes: true,
                    },
                },
            },
        });
        if (!sede) {
            throw new common_1.NotFoundException(`Sede con ID ${id} no encontrada`);
        }
        return sede;
    }
    async updateSede(id, dto) {
        await this.findOneSede(id);
        return this.prisma.sede.update({
            where: { id },
            data: {
                nombre: dto.nombre,
                ciudad: dto.ciudad,
                direccion: dto.direccion,
                mapsUrl: dto.mapsUrl,
                telefono: dto.telefono,
                logoUrl: dto.logoUrl,
                imagenFondo: dto.imagenFondo,
                horarioAtencion: dto.horarioAtencion,
                contactoEncargado: dto.contactoEncargado,
                canvasWidth: dto.canvasWidth,
                canvasHeight: dto.canvasHeight,
                activo: dto.activo,
            },
            include: {
                canchas: true,
            },
        });
    }
    async deleteSede(id) {
        await this.findOneSede(id);
        const torneosActivos = await this.prisma.tournament.count({
            where: {
                sedeId: id,
                estado: {
                    in: ['PUBLICADO', 'EN_CURSO'],
                },
            },
        });
        if (torneosActivos > 0) {
            throw new common_1.BadRequestException(`No se puede eliminar la sede porque tiene ${torneosActivos} torneo(s) activo(s)`);
        }
        return this.prisma.sede.update({
            where: { id },
            data: { activo: false },
        });
    }
    async createCancha(sedeId, dto) {
        await this.findOneSede(sedeId);
        return this.prisma.sedeCancha.create({
            data: {
                sedeId,
                nombre: dto.nombre,
                tipo: dto.tipo,
                posicionX: dto.posicionX || 0,
                posicionY: dto.posicionY || 0,
                ancho: dto.ancho || 100,
                alto: dto.alto || 150,
                rotacion: dto.rotacion || 0,
                imagenUrl: dto.imagenUrl,
                activa: true,
            },
        });
    }
    async findAllCanchas(sedeId) {
        await this.findOneSede(sedeId);
        return this.prisma.sedeCancha.findMany({
            where: { sedeId },
            orderBy: { nombre: 'asc' },
        });
    }
    async updateCancha(sedeId, canchaId, dto) {
        const cancha = await this.prisma.sedeCancha.findFirst({
            where: { id: canchaId, sedeId },
        });
        if (!cancha) {
            throw new common_1.NotFoundException(`Cancha con ID ${canchaId} no encontrada en la sede ${sedeId}`);
        }
        return this.prisma.sedeCancha.update({
            where: { id: canchaId },
            data: {
                nombre: dto.nombre,
                tipo: dto.tipo,
                posicionX: dto.posicionX,
                posicionY: dto.posicionY,
                ancho: dto.ancho,
                alto: dto.alto,
                rotacion: dto.rotacion,
                imagenUrl: dto.imagenUrl,
                activa: dto.activa,
            },
        });
    }
    async deleteCancha(sedeId, canchaId) {
        const cancha = await this.prisma.sedeCancha.findFirst({
            where: { id: canchaId, sedeId },
        });
        if (!cancha) {
            throw new common_1.NotFoundException(`Cancha con ID ${canchaId} no encontrada en la sede ${sedeId}`);
        }
        const partidosProgramados = await this.prisma.match.count({
            where: {
                torneoCancha: {
                    sedeCanchaId: canchaId,
                },
                estado: {
                    in: ['PROGRAMADO', 'EN_JUEGO'],
                },
            },
        });
        if (partidosProgramados > 0) {
            throw new common_1.BadRequestException(`No se puede eliminar la cancha porque tiene ${partidosProgramados} partido(s) programado(s)`);
        }
        return this.prisma.sedeCancha.update({
            where: { id: canchaId },
            data: { activa: false },
        });
    }
    async updateCanchasBulk(sedeId, canchas) {
        await this.findOneSede(sedeId);
        const updates = canchas.map((cancha) => this.prisma.sedeCancha.update({
            where: { id: cancha.id },
            data: {
                nombre: cancha.nombre,
                tipo: cancha.tipo,
                posicionX: cancha.posicionX,
                posicionY: cancha.posicionY,
                ancho: cancha.ancho,
                alto: cancha.alto,
                rotacion: cancha.rotacion,
                imagenUrl: cancha.imagenUrl,
                activa: cancha.activa,
            },
        }));
        return this.prisma.$transaction(updates);
    }
    async configurarTorneoCanchas(tournamentId, dto) {
        const torneo = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
        });
        if (!torneo) {
            throw new common_1.NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
        }
        await this.prisma.torneoCancha.deleteMany({
            where: { tournamentId },
        });
        const torneoCanchas = [];
        for (const canchaConfig of dto.canchas) {
            const cancha = await this.prisma.sedeCancha.findUnique({
                where: { id: canchaConfig.sedeCanchaId },
            });
            if (!cancha) {
                throw new common_1.NotFoundException(`Cancha con ID ${canchaConfig.sedeCanchaId} no encontrada`);
            }
            const torneoCancha = await this.prisma.torneoCancha.create({
                data: {
                    tournamentId,
                    sedeCanchaId: canchaConfig.sedeCanchaId,
                    horarios: {
                        create: canchaConfig.horarios.map((h) => ({
                            fecha: new Date(h.fecha),
                            horaInicio: h.horaInicio,
                            horaFin: h.horaFin,
                        })),
                    },
                },
                include: {
                    sedeCancha: {
                        include: {
                            sede: {
                                select: {
                                    id: true,
                                    nombre: true,
                                },
                            },
                        },
                    },
                    horarios: true,
                },
            });
            torneoCanchas.push(torneoCancha);
        }
        return {
            message: 'Configuración de canchas guardada exitosamente',
            torneoCanchas,
        };
    }
    async getTorneoCanchas(tournamentId) {
        const torneo = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                sedePrincipal: {
                    include: {
                        canchas: {
                            where: { activa: true },
                        },
                    },
                },
                torneoSedes: {
                    include: {
                        sede: {
                            include: {
                                canchas: {
                                    where: { activa: true },
                                },
                            },
                        },
                    },
                },
                torneoCanchas: {
                    include: {
                        sedeCancha: {
                            include: {
                                sede: {
                                    select: {
                                        id: true,
                                        nombre: true,
                                    },
                                },
                            },
                        },
                        horarios: {
                            orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
                        },
                    },
                },
            },
        });
        if (!torneo) {
            throw new common_1.NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
        }
        return {
            torneo: {
                id: torneo.id,
                nombre: torneo.nombre,
                fechaInicio: torneo.fechaInicio,
                fechaFin: torneo.fechaFin,
            },
            sedePrincipal: torneo.sedePrincipal,
            sedesAdicionales: torneo.torneoSedes.map((ts) => ts.sede),
            canchasConfiguradas: torneo.torneoCanchas,
        };
    }
    async agregarSedeATorneo(tournamentId, sedeId) {
        const torneo = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
        });
        if (!torneo) {
            throw new common_1.NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
        }
        await this.findOneSede(sedeId);
        const existente = await this.prisma.torneoSede.findUnique({
            where: {
                tournamentId_sedeId: {
                    tournamentId,
                    sedeId,
                },
            },
        });
        if (existente) {
            throw new common_1.ConflictException('Esta sede ya está vinculada al torneo');
        }
        if (torneo.sedeId === sedeId) {
            throw new common_1.ConflictException('Esta sede ya es la sede principal del torneo');
        }
        return this.prisma.torneoSede.create({
            data: {
                tournamentId,
                sedeId,
            },
            include: {
                sede: {
                    include: {
                        canchas: {
                            where: { activa: true },
                        },
                    },
                },
            },
        });
    }
    async removerSedeDeTorneo(tournamentId, sedeId) {
        const relacion = await this.prisma.torneoSede.findUnique({
            where: {
                tournamentId_sedeId: {
                    tournamentId,
                    sedeId,
                },
            },
        });
        if (!relacion) {
            throw new common_1.NotFoundException('Esta sede no está vinculada como sede adicional al torneo');
        }
        const canchasDeEstaSede = await this.prisma.sedeCancha.findMany({
            where: { sedeId },
            select: { id: true },
        });
        const canchaIds = canchasDeEstaSede.map((c) => c.id);
        await this.prisma.torneoCancha.deleteMany({
            where: {
                tournamentId,
                sedeCanchaId: {
                    in: canchaIds,
                },
            },
        });
        return this.prisma.torneoSede.delete({
            where: {
                tournamentId_sedeId: {
                    tournamentId,
                    sedeId,
                },
            },
        });
    }
    async getSedesDeTorneo(tournamentId) {
        const torneo = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            include: {
                sedePrincipal: {
                    include: {
                        canchas: {
                            where: { activa: true },
                            orderBy: { nombre: 'asc' },
                        },
                    },
                },
                torneoSedes: {
                    include: {
                        sede: {
                            include: {
                                canchas: {
                                    where: { activa: true },
                                    orderBy: { nombre: 'asc' },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!torneo) {
            throw new common_1.NotFoundException(`Torneo con ID ${tournamentId} no encontrado`);
        }
        const sedes = [];
        if (torneo.sedePrincipal) {
            sedes.push({
                ...torneo.sedePrincipal,
                esPrincipal: true,
            });
        }
        for (const ts of torneo.torneoSedes) {
            sedes.push({
                ...ts.sede,
                esPrincipal: false,
            });
        }
        return sedes;
    }
};
exports.SedesService = SedesService;
exports.SedesService = SedesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SedesService);
//# sourceMappingURL=sedes.service.js.map