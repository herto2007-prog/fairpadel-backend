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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialController = void 0;
const common_1 = require("@nestjs/common");
const social_service_1 = require("./social.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const dto_1 = require("./dto");
let SocialController = class SocialController {
    constructor(socialService) {
        this.socialService = socialService;
    }
    seguir(userId, req) {
        return this.socialService.seguir(req.user.id, userId);
    }
    dejarDeSeguir(userId, req) {
        return this.socialService.dejarDeSeguir(req.user.id, userId);
    }
    obtenerSeguidores(userId) {
        return this.socialService.obtenerSeguidores(userId);
    }
    obtenerSiguiendo(userId) {
        return this.socialService.obtenerSiguiendo(userId);
    }
    obtenerSugerencias(req) {
        return this.socialService.obtenerSugerencias(req.user.id);
    }
    enviarMensaje(dto, req) {
        return this.socialService.enviarMensaje(req.user.id, dto);
    }
    obtenerConversaciones(req) {
        return this.socialService.obtenerConversaciones(req.user.id);
    }
    obtenerMensajes(otroUserId, req) {
        return this.socialService.obtenerMensajes(req.user.id, otroUserId);
    }
    marcarComoLeido(mensajeId, req) {
        return this.socialService.marcarComoLeido(mensajeId, req.user.id);
    }
    enviarSolicitudJugar(dto, req) {
        return this.socialService.enviarSolicitudJugar(req.user.id, dto);
    }
    obtenerSolicitudesRecibidas(req) {
        return this.socialService.obtenerSolicitudesRecibidas(req.user.id);
    }
    obtenerSolicitudesEnviadas(req) {
        return this.socialService.obtenerSolicitudesEnviadas(req.user.id);
    }
    aceptarSolicitud(solicitudId, req) {
        return this.socialService.aceptarSolicitud(solicitudId, req.user.id);
    }
    rechazarSolicitud(solicitudId, req) {
        return this.socialService.rechazarSolicitud(solicitudId, req.user.id);
    }
    bloquear(userId, req) {
        return this.socialService.bloquear(req.user.id, userId);
    }
    desbloquear(userId, req) {
        return this.socialService.desbloquear(req.user.id, userId);
    }
    obtenerBloqueados(req) {
        return this.socialService.obtenerBloqueados(req.user.id);
    }
    reportar(userId, body, req) {
        return this.socialService.reportar(req.user.id, userId, body);
    }
    buscarJugadores(query, ciudad, genero) {
        return this.socialService.buscarJugadores(query, ciudad, genero);
    }
};
exports.SocialController = SocialController;
__decorate([
    (0, common_1.Post)('seguir/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "seguir", null);
__decorate([
    (0, common_1.Delete)('seguir/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "dejarDeSeguir", null);
__decorate([
    (0, common_1.Get)('seguidores/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "obtenerSeguidores", null);
__decorate([
    (0, common_1.Get)('siguiendo/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "obtenerSiguiendo", null);
__decorate([
    (0, common_1.Get)('sugerencias'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "obtenerSugerencias", null);
__decorate([
    (0, common_1.Post)('mensajes'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.MensajeDto, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "enviarMensaje", null);
__decorate([
    (0, common_1.Get)('mensajes/conversaciones'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "obtenerConversaciones", null);
__decorate([
    (0, common_1.Get)('mensajes/conversacion/:otroUserId'),
    __param(0, (0, common_1.Param)('otroUserId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "obtenerMensajes", null);
__decorate([
    (0, common_1.Post)('mensajes/:mensajeId/leer'),
    __param(0, (0, common_1.Param)('mensajeId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "marcarComoLeido", null);
__decorate([
    (0, common_1.Post)('solicitudes-jugar'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SolicitudJugarDto, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "enviarSolicitudJugar", null);
__decorate([
    (0, common_1.Get)('solicitudes-jugar/recibidas'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "obtenerSolicitudesRecibidas", null);
__decorate([
    (0, common_1.Get)('solicitudes-jugar/enviadas'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "obtenerSolicitudesEnviadas", null);
__decorate([
    (0, common_1.Post)('solicitudes-jugar/:solicitudId/aceptar'),
    __param(0, (0, common_1.Param)('solicitudId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "aceptarSolicitud", null);
__decorate([
    (0, common_1.Post)('solicitudes-jugar/:solicitudId/rechazar'),
    __param(0, (0, common_1.Param)('solicitudId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "rechazarSolicitud", null);
__decorate([
    (0, common_1.Post)('bloquear/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "bloquear", null);
__decorate([
    (0, common_1.Delete)('bloquear/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "desbloquear", null);
__decorate([
    (0, common_1.Get)('bloqueados'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "obtenerBloqueados", null);
__decorate([
    (0, common_1.Post)('reportar/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "reportar", null);
__decorate([
    (0, common_1.Get)('buscar-jugadores'),
    __param(0, (0, common_1.Query)('q')),
    __param(1, (0, common_1.Query)('ciudad')),
    __param(2, (0, common_1.Query)('genero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SocialController.prototype, "buscarJugadores", null);
exports.SocialController = SocialController = __decorate([
    (0, common_1.Controller)('social'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [social_service_1.SocialService])
], SocialController);
//# sourceMappingURL=social.controller.js.map