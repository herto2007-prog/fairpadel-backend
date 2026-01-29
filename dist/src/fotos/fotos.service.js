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
exports.FotosService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const cloudinary_service_1 = require("./cloudinary.service");
let FotosService = class FotosService {
    constructor(prisma, cloudinary) {
        this.prisma = prisma;
        this.cloudinary = cloudinary;
    }
    async subirFoto(userId, data) {
        const usuario = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!usuario) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        if (!usuario.esPremium) {
            const fotosActuales = await this.prisma.foto.count({
                where: { userId },
            });
            if (fotosActuales >= 6) {
                throw new common_1.BadRequestException('Has alcanzado el límite de 6 fotos. Hazte Premium para fotos ilimitadas');
            }
        }
        const resultado = {
            url: `https://fake-cloudinary.com/fotos/${Date.now()}.jpg`,
            thumbnail: `https://fake-cloudinary.com/fotos/thumb_${Date.now()}.jpg`,
        };
        const foto = await this.prisma.foto.create({
            data: {
                userId,
                urlImagen: resultado.url,
                urlThumbnail: resultado.thumbnail,
                descripcion: data.descripcion,
                tournamentId: data.tournamentId,
                tipo: data.tipo || 'PERSONAL',
                estadoModeracion: 'PENDIENTE',
            },
        });
        return foto;
    }
    async obtenerFotos(filtros) {
        const where = {
            estadoModeracion: 'APROBADA',
        };
        if (filtros.userId) {
            where.userId = filtros.userId;
        }
        if (filtros.tournamentId) {
            where.tournamentId = filtros.tournamentId;
        }
        if (filtros.tipo) {
            where.tipo = filtros.tipo;
        }
        const fotos = await this.prisma.foto.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 50,
        });
        return fotos;
    }
    async obtenerFotoDetalle(id) {
        const foto = await this.prisma.foto.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        if (!foto) {
            throw new common_1.NotFoundException('Foto no encontrada');
        }
        return foto;
    }
    async actualizarFoto(id, data, userId) {
        const foto = await this.prisma.foto.findUnique({
            where: { id },
        });
        if (!foto) {
            throw new common_1.NotFoundException('Foto no encontrada');
        }
        if (foto.userId !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para editar esta foto');
        }
        const fotoActualizada = await this.prisma.foto.update({
            where: { id },
            data: {
                descripcion: data.descripcion,
            },
        });
        return fotoActualizada;
    }
    async eliminarFoto(id, userId) {
        const foto = await this.prisma.foto.findUnique({
            where: { id },
        });
        if (!foto) {
            throw new common_1.NotFoundException('Foto no encontrada');
        }
        if (foto.userId !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para eliminar esta foto');
        }
        await this.prisma.foto.delete({
            where: { id },
        });
        return { message: 'Foto eliminada' };
    }
    async darLike(fotoId, userId) {
        const likeExistente = await this.prisma.like.findFirst({
            where: {
                fotoId,
                userId,
            },
        });
        if (likeExistente) {
            await this.prisma.like.delete({
                where: { id: likeExistente.id },
            });
            await this.prisma.foto.update({
                where: { id: fotoId },
                data: {
                    likesCount: {
                        decrement: 1,
                    },
                },
            });
            return { message: 'Like eliminado' };
        }
        await this.prisma.like.create({
            data: {
                fotoId,
                userId,
            },
        });
        await this.prisma.foto.update({
            where: { id: fotoId },
            data: {
                likesCount: {
                    increment: 1,
                },
            },
        });
        return { message: 'Like agregado' };
    }
    async obtenerLikes(fotoId) {
        const likes = await this.prisma.like.findMany({
            where: { fotoId },
            include: {
                user: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        return likes;
    }
    async comentar(fotoId, userId, contenido) {
        const comentario = await this.prisma.comentario.create({
            data: {
                fotoId,
                userId,
                contenido,
            },
        });
        await this.prisma.foto.update({
            where: { id: fotoId },
            data: {
                comentariosCount: {
                    increment: 1,
                },
            },
        });
        return comentario;
    }
    async obtenerComentarios(fotoId) {
        const comentarios = await this.prisma.comentario.findMany({
            where: { fotoId },
            include: {
                user: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return comentarios;
    }
    async eliminarComentario(comentarioId, userId) {
        const comentario = await this.prisma.comentario.findUnique({
            where: { id: comentarioId },
        });
        if (!comentario) {
            throw new common_1.NotFoundException('Comentario no encontrado');
        }
        if (comentario.userId !== userId) {
            throw new common_1.ForbiddenException('No tienes permiso para eliminar este comentario');
        }
        await this.prisma.comentario.delete({
            where: { id: comentarioId },
        });
        await this.prisma.foto.update({
            where: { id: comentario.fotoId },
            data: {
                comentariosCount: {
                    decrement: 1,
                },
            },
        });
        return { message: 'Comentario eliminado' };
    }
    async reportarFoto(fotoId, userId, motivo) {
        await this.prisma.reporteFoto.create({
            data: {
                fotoId,
                userId,
                motivo,
            },
        });
        return { message: 'Foto reportada. Un administrador la revisará' };
    }
};
exports.FotosService = FotosService;
exports.FotosService = FotosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cloudinary_service_1.CloudinaryService])
], FotosService);
//# sourceMappingURL=fotos.service.js.map