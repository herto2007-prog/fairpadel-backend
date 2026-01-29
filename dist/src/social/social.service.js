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
exports.SocialService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SocialService = class SocialService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async seguir(seguidorId, seguidoId) {
        if (seguidorId === seguidoId) {
            throw new common_1.BadRequestException('No puedes seguirte a ti mismo');
        }
        const usuarioASeguir = await this.prisma.user.findUnique({
            where: { id: seguidoId },
        });
        if (!usuarioASeguir) {
            throw new common_1.NotFoundException('Usuario no encontrado');
        }
        const yaLoSigue = await this.prisma.seguimiento.findUnique({
            where: {
                seguidorId_seguidoId: {
                    seguidorId,
                    seguidoId,
                },
            },
        });
        if (yaLoSigue) {
            throw new common_1.BadRequestException('Ya sigues a este usuario');
        }
        const seguimiento = await this.prisma.seguimiento.create({
            data: {
                seguidorId,
                seguidoId,
            },
        });
        return { message: 'Ahora sigues a este usuario', seguimiento };
    }
    async dejarDeSeguir(seguidorId, seguidoId) {
        const seguimiento = await this.prisma.seguimiento.findUnique({
            where: {
                seguidorId_seguidoId: {
                    seguidorId,
                    seguidoId,
                },
            },
        });
        if (!seguimiento) {
            throw new common_1.NotFoundException('No sigues a este usuario');
        }
        await this.prisma.seguimiento.delete({
            where: {
                id: seguimiento.id,
            },
        });
        return { message: 'Dejaste de seguir a este usuario' };
    }
    async obtenerSeguidores(userId) {
        const seguidores = await this.prisma.seguimiento.findMany({
            where: { seguidoId: userId },
            include: {
                seguidor: {
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
                createdAt: 'desc',
            },
        });
        return seguidores.map((s) => s.seguidor);
    }
    async obtenerSiguiendo(userId) {
        const siguiendo = await this.prisma.seguimiento.findMany({
            where: { seguidorId: userId },
            include: {
                seguido: {
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
                createdAt: 'desc',
            },
        });
        return siguiendo.map((s) => s.seguido);
    }
    async obtenerSugerencias(userId) {
        const usuario = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        const sugerencias = await this.prisma.user.findMany({
            where: {
                id: { not: userId },
                ciudad: usuario.ciudad,
                genero: usuario.genero,
                estado: 'ACTIVO',
            },
            take: 10,
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
        return sugerencias;
    }
    async enviarMensaje(remitenteId, dto) {
        const { destinatarioId, contenido } = dto;
        const remitente = await this.prisma.user.findUnique({
            where: { id: remitenteId },
        });
        if (!remitente.esPremium) {
            throw new common_1.ForbiddenException('Debes ser Premium para enviar mensajes');
        }
        const destinatario = await this.prisma.user.findUnique({
            where: { id: destinatarioId },
        });
        if (!destinatario) {
            throw new common_1.NotFoundException('Destinatario no encontrado');
        }
        const mensaje = await this.prisma.mensajePrivado.create({
            data: {
                remitenteId,
                destinatarioId,
                contenido,
            },
            include: {
                remitente: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
                destinatario: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        return mensaje;
    }
    async obtenerConversaciones(userId) {
        const mensajes = await this.prisma.mensajePrivado.findMany({
            where: {
                OR: [
                    { remitenteId: userId },
                    { destinatarioId: userId },
                ],
            },
            include: {
                remitente: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
                destinatario: {
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
        const conversacionesMap = new Map();
        for (const mensaje of mensajes) {
            const otroUsuarioId = mensaje.remitenteId === userId
                ? mensaje.destinatarioId
                : mensaje.remitenteId;
            if (!conversacionesMap.has(otroUsuarioId)) {
                const otroUsuario = mensaje.remitenteId === userId
                    ? mensaje.destinatario
                    : mensaje.remitente;
                conversacionesMap.set(otroUsuarioId, {
                    usuario: otroUsuario,
                    ultimoMensaje: mensaje,
                });
            }
        }
        return Array.from(conversacionesMap.values());
    }
    async obtenerMensajes(userId, otroUserId) {
        const mensajes = await this.prisma.mensajePrivado.findMany({
            where: {
                OR: [
                    { remitenteId: userId, destinatarioId: otroUserId },
                    { remitenteId: otroUserId, destinatarioId: userId },
                ],
            },
            include: {
                remitente: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
                destinatario: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        return mensajes;
    }
    async marcarComoLeido(mensajeId, userId) {
        const mensaje = await this.prisma.mensajePrivado.findUnique({
            where: { id: mensajeId },
        });
        if (!mensaje) {
            throw new common_1.NotFoundException('Mensaje no encontrado');
        }
        if (mensaje.destinatarioId !== userId) {
            throw new common_1.ForbiddenException('No puedes marcar este mensaje como leído');
        }
        return this.prisma.mensajePrivado.update({
            where: { id: mensajeId },
            data: { leido: true },
        });
    }
    async enviarSolicitudJugar(emisorId, dto) {
        const { receptorId, fechaPropuesta, hora, lugar, mensaje } = dto;
        const emisor = await this.prisma.user.findUnique({
            where: { id: emisorId },
        });
        if (!emisor.esPremium) {
            throw new common_1.ForbiddenException('Debes ser Premium para enviar solicitudes');
        }
        const receptor = await this.prisma.user.findUnique({
            where: { id: receptorId },
        });
        if (!receptor) {
            throw new common_1.NotFoundException('Receptor no encontrado');
        }
        const solicitud = await this.prisma.solicitudJugar.create({
            data: {
                emisorId,
                receptorId,
                fechaPropuesta: new Date(fechaPropuesta),
                hora,
                lugar,
                mensaje,
            },
            include: {
                emisor: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
                receptor: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        return solicitud;
    }
    async obtenerSolicitudesRecibidas(userId) {
        return this.prisma.solicitudJugar.findMany({
            where: {
                receptorId: userId,
                estado: 'PENDIENTE',
            },
            include: {
                emisor: {
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
    }
    async obtenerSolicitudesEnviadas(userId) {
        return this.prisma.solicitudJugar.findMany({
            where: { emisorId: userId },
            include: {
                receptor: {
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
    }
    async aceptarSolicitud(solicitudId, userId) {
        const solicitud = await this.prisma.solicitudJugar.findUnique({
            where: { id: solicitudId },
        });
        if (!solicitud) {
            throw new common_1.NotFoundException('Solicitud no encontrada');
        }
        if (solicitud.receptorId !== userId) {
            throw new common_1.ForbiddenException('No puedes aceptar esta solicitud');
        }
        return this.prisma.solicitudJugar.update({
            where: { id: solicitudId },
            data: { estado: 'APROBADA' },
        });
    }
    async rechazarSolicitud(solicitudId, userId) {
        const solicitud = await this.prisma.solicitudJugar.findUnique({
            where: { id: solicitudId },
        });
        if (!solicitud) {
            throw new common_1.NotFoundException('Solicitud no encontrada');
        }
        if (solicitud.receptorId !== userId) {
            throw new common_1.ForbiddenException('No puedes rechazar esta solicitud');
        }
        return this.prisma.solicitudJugar.update({
            where: { id: solicitudId },
            data: { estado: 'RECHAZADA' },
        });
    }
    async bloquear(bloqueadorId, bloqueadoId) {
        if (bloqueadorId === bloqueadoId) {
            throw new common_1.BadRequestException('No puedes bloquearte a ti mismo');
        }
        const yaBloquedo = await this.prisma.bloqueo.findUnique({
            where: {
                bloqueadorId_bloqueadoId: {
                    bloqueadorId,
                    bloqueadoId,
                },
            },
        });
        if (yaBloquedo) {
            throw new common_1.BadRequestException('Ya has bloqueado a este usuario');
        }
        return this.prisma.bloqueo.create({
            data: {
                bloqueadorId,
                bloqueadoId,
            },
        });
    }
    async desbloquear(bloqueadorId, bloqueadoId) {
        const bloqueo = await this.prisma.bloqueo.findUnique({
            where: {
                bloqueadorId_bloqueadoId: {
                    bloqueadorId,
                    bloqueadoId,
                },
            },
        });
        if (!bloqueo) {
            throw new common_1.NotFoundException('No has bloqueado a este usuario');
        }
        await this.prisma.bloqueo.delete({
            where: { id: bloqueo.id },
        });
        return { message: 'Usuario desbloqueado' };
    }
    async obtenerBloqueados(userId) {
        const bloqueos = await this.prisma.bloqueo.findMany({
            where: { bloqueadorId: userId },
            include: {
                bloqueado: {
                    select: {
                        id: true,
                        nombre: true,
                        apellido: true,
                        fotoUrl: true,
                    },
                },
            },
        });
        return bloqueos.map((b) => b.bloqueado);
    }
    async reportar(reportadorId, reportadoId, data) {
        const reporte = await this.prisma.reporte.create({
            data: {
                reportadorId,
                reportadoId,
                motivo: data.motivo,
                descripcion: data.descripcion,
            },
        });
        return { message: 'Reporte enviado', reporte };
    }
    async buscarJugadores(query, ciudad, genero) {
        const where = {
            estado: 'ACTIVO',
            OR: [
                { nombre: { contains: query, mode: 'insensitive' } },
                { apellido: { contains: query, mode: 'insensitive' } },
                { documento: { contains: query } },
            ],
        };
        if (ciudad) {
            where.ciudad = ciudad;
        }
        if (genero) {
            where.genero = genero;
        }
        const jugadores = await this.prisma.user.findMany({
            where,
            take: 20,
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
        return jugadores;
    }
};
exports.SocialService = SocialService;
exports.SocialService = SocialService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SocialService);
//# sourceMappingURL=social.service.js.map