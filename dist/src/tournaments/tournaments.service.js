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
exports.TournamentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TournamentsService = class TournamentsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createTournamentDto, organizadorId) {
        let fechaInicio;
        let fechaFin;
        let fechaLimite;
        try {
            fechaInicio = new Date(createTournamentDto.fechaInicio);
            fechaFin = new Date(createTournamentDto.fechaFin);
            fechaLimite = new Date(createTournamentDto.fechaLimiteInscripcion);
            if (isNaN(fechaInicio.getTime())) {
                throw new Error('Fecha de inicio inválida');
            }
            if (isNaN(fechaFin.getTime())) {
                throw new Error('Fecha de fin inválida');
            }
            if (isNaN(fechaLimite.getTime())) {
                throw new Error('Fecha límite de inscripción inválida');
            }
        }
        catch (error) {
            throw new common_1.BadRequestException(`Error en las fechas: ${error.message}`);
        }
        if (fechaFin <= fechaInicio) {
            throw new common_1.BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
        }
        if (fechaLimite >= fechaInicio) {
            throw new common_1.BadRequestException('La fecha límite de inscripción debe ser anterior a la fecha de inicio');
        }
        const categorias = await this.prisma.category.findMany({
            where: {
                id: {
                    in: createTournamentDto.categorias,
                },
            },
        });
        if (categorias.length !== createTournamentDto.categorias.length) {
            throw new common_1.BadRequestException('Una o más categorías no existen');
        }
        const existingTournament = await this.prisma.tournament.findFirst({
            where: {
                nombre: createTournamentDto.nombre,
                organizadorId: organizadorId,
            },
        });
        if (existingTournament) {
            throw new common_1.BadRequestException('Ya tienes un torneo con este nombre');
        }
        try {
            const tournament = await this.prisma.tournament.create({
                data: {
                    nombre: createTournamentDto.nombre,
                    descripcion: createTournamentDto.descripcion,
                    pais: createTournamentDto.pais,
                    region: createTournamentDto.region,
                    ciudad: createTournamentDto.ciudad,
                    fechaInicio: fechaInicio,
                    fechaFin: fechaFin,
                    fechaLimiteInscr: fechaLimite,
                    flyerUrl: createTournamentDto.flyerUrl,
                    costoInscripcion: createTournamentDto.costoInscripcion,
                    sede: createTournamentDto.sede,
                    direccion: createTournamentDto.direccion,
                    mapsUrl: createTournamentDto.mapsUrl,
                    organizadorId: organizadorId,
                    estado: 'BORRADOR',
                    categorias: {
                        create: createTournamentDto.categorias.map((categoryId) => ({
                            categoryId: categoryId,
                        })),
                    },
                    modalidades: {
                        create: createTournamentDto.modalidades.map((modalidad) => ({
                            modalidad: modalidad,
                        })),
                    },
                },
                include: {
                    categorias: {
                        include: {
                            category: true,
                        },
                    },
                    modalidades: true,
                    organizador: {
                        select: {
                            id: true,
                            nombre: true,
                            apellido: true,
                            email: true,
                        },
                    },
                },
            });
            return tournament;
        }
        catch (error) {
            if (error.code === 'P2002') {
                throw new common_1.BadRequestException('Ya existe un torneo con estos datos');
            }
            if (error.code === 'P2003') {
                throw new common_1.BadRequestException('Error de relación con categorías o modalidades');
            }
            throw new common_1.BadRequestException(`Error al crear torneo: ${error.message}`);
        }
    }
    async findAll(filters) {
        const where = {};
        if (filters?.pais) {
            where.pais = filters.pais;
        }
        if (filters?.ciudad) {
            where.ciudad = filters.ciudad;
        }
        if (filters?.estado) {
            where.estado = filters.estado;
        }
        else {
            where.estado = {
                in: ['PUBLICADO', 'EN_CURSO', 'FINALIZADO', 'PENDIENTE_APROBACION'],
            };
        }
        const tournaments = await this.prisma.tournament.findMany({
            where,
            include: {
                categorias: {
                    include: {
                        category: true,
                    },
                },
                modalidades: true,
                organizador: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                    },
                },
            },
            orderBy: {
                fechaInicio: 'asc',
            },
        });
        return tournaments;
    }
    async findOne(id) {
        const tournament = await this.prisma.tournament.findUnique({
            where: { id },
            include: {
                categorias: {
                    include: {
                        category: true,
                    },
                },
                modalidades: true,
                organizador: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        email: true,
                        telefono: true,
                    },
                },
            },
        });
        if (!tournament) {
            throw new common_1.NotFoundException('Torneo no encontrado');
        }
        return tournament;
    }
    async findMyTournaments(organizadorId) {
        return this.prisma.tournament.findMany({
            where: {
                organizadorId,
            },
            include: {
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
    }
    async update(id, updateTournamentDto, userId) {
        const tournament = await this.findOne(id);
        if (tournament.organizadorId !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para editar este torneo');
        }
        if (['FINALIZADO', 'CANCELADO'].includes(tournament.estado)) {
            throw new common_1.ForbiddenException('No se puede editar un torneo finalizado o cancelado');
        }
        if (updateTournamentDto.fechaInicio || updateTournamentDto.fechaFin || updateTournamentDto.fechaLimiteInscripcion) {
            const fechaInicio = updateTournamentDto.fechaInicio
                ? new Date(updateTournamentDto.fechaInicio)
                : tournament.fechaInicio;
            const fechaFin = updateTournamentDto.fechaFin
                ? new Date(updateTournamentDto.fechaFin)
                : tournament.fechaFin;
            const fechaLimite = updateTournamentDto.fechaLimiteInscripcion
                ? new Date(updateTournamentDto.fechaLimiteInscripcion)
                : tournament.fechaLimiteInscr;
            if (fechaFin < fechaInicio) {
                throw new common_1.BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
            }
            if (fechaLimite >= fechaInicio) {
                throw new common_1.BadRequestException('La fecha límite de inscripción debe ser anterior a la fecha de inicio');
            }
        }
        const updateData = {
            nombre: updateTournamentDto.nombre,
            descripcion: updateTournamentDto.descripcion,
            pais: updateTournamentDto.pais,
            region: updateTournamentDto.region,
            ciudad: updateTournamentDto.ciudad,
            sede: updateTournamentDto.sede,
            direccion: updateTournamentDto.direccion,
            mapsUrl: updateTournamentDto.mapsUrl,
            costoInscripcion: updateTournamentDto.costoInscripcion,
            flyerUrl: updateTournamentDto.flyerUrl,
        };
        if (updateTournamentDto.fechaInicio) {
            updateData.fechaInicio = new Date(updateTournamentDto.fechaInicio);
        }
        if (updateTournamentDto.fechaFin) {
            updateData.fechaFin = new Date(updateTournamentDto.fechaFin);
        }
        if (updateTournamentDto.fechaLimiteInscripcion) {
            updateData.fechaLimiteInscr = new Date(updateTournamentDto.fechaLimiteInscripcion);
        }
        if (updateTournamentDto.categorias) {
            await this.prisma.tournamentCategory.deleteMany({
                where: { tournamentId: id },
            });
            updateData.categorias = {
                create: updateTournamentDto.categorias.map((categoryId) => ({
                    categoryId: categoryId,
                })),
            };
        }
        if (updateTournamentDto.modalidades) {
            await this.prisma.tournamentModalidad.deleteMany({
                where: { tournamentId: id },
            });
            updateData.modalidades = {
                create: updateTournamentDto.modalidades.map((modalidad) => ({
                    modalidad: modalidad,
                })),
            };
        }
        const updated = await this.prisma.tournament.update({
            where: { id },
            data: updateData,
            include: {
                categorias: {
                    include: {
                        category: true,
                    },
                },
                modalidades: true,
                organizador: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                    },
                },
            },
        });
        return updated;
    }
    async publish(id, userId) {
        const tournament = await this.findOne(id);
        if (tournament.organizadorId !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para publicar este torneo');
        }
        if (tournament.estado !== 'BORRADOR' && tournament.estado !== 'RECHAZADO') {
            throw new common_1.BadRequestException('Solo se pueden publicar torneos en borrador o rechazados');
        }
        return this.prisma.tournament.update({
            where: { id },
            data: { estado: 'PENDIENTE_APROBACION' },
            include: {
                categorias: {
                    include: {
                        category: true,
                    },
                },
                modalidades: true,
            },
        });
    }
    async remove(id, userId) {
        const tournament = await this.findOne(id);
        if (tournament.organizadorId !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para eliminar este torneo');
        }
        if (tournament.estado !== 'BORRADOR') {
            throw new common_1.BadRequestException('Solo se pueden eliminar torneos en borrador');
        }
        await this.prisma.tournament.delete({
            where: { id },
        });
        return { message: 'Torneo eliminado exitosamente' };
    }
    async obtenerCategorias() {
        const categorias = await this.prisma.category.findMany({
            orderBy: [
                { tipo: 'asc' },
                { orden: 'desc' },
            ],
        });
        return categorias;
    }
};
exports.TournamentsService = TournamentsService;
exports.TournamentsService = TournamentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TournamentsService);
//# sourceMappingURL=tournaments.service.js.map