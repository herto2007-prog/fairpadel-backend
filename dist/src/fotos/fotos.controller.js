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
exports.FotosController = void 0;
const common_1 = require("@nestjs/common");
const fotos_service_1 = require("./fotos.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let FotosController = class FotosController {
    constructor(fotosService) {
        this.fotosService = fotosService;
    }
    subirFoto(dto, req) {
        return this.fotosService.subirFoto(req.user.userId, dto);
    }
    listarFotos(userId, tournamentId, tipo) {
        return this.fotosService.obtenerFotos({ userId, tournamentId, tipo });
    }
    obtenerFoto(id) {
        return this.fotosService.obtenerFotoDetalle(id);
    }
    actualizarFoto(id, body, req) {
        return this.fotosService.actualizarFoto(id, body, req.user.userId);
    }
    eliminarFoto(id, req) {
        return this.fotosService.eliminarFoto(id, req.user.userId);
    }
    darLike(id, req) {
        return this.fotosService.darLike(id, req.user.userId);
    }
    obtenerLikes(id) {
        return this.fotosService.obtenerLikes(id);
    }
    comentar(id, body, req) {
        return this.fotosService.comentar(id, req.user.userId, body.contenido);
    }
    obtenerComentarios(id) {
        return this.fotosService.obtenerComentarios(id);
    }
    eliminarComentario(comentarioId, req) {
        return this.fotosService.eliminarComentario(comentarioId, req.user.userId);
    }
    reportarFoto(id, body, req) {
        return this.fotosService.reportarFoto(id, req.user.userId, body.motivo);
    }
};
exports.FotosController = FotosController;
__decorate([
    (0, common_1.Post)('subir'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "subirFoto", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('userId')),
    __param(1, (0, common_1.Query)('tournamentId')),
    __param(2, (0, common_1.Query)('tipo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "listarFotos", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "obtenerFoto", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "actualizarFoto", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "eliminarFoto", null);
__decorate([
    (0, common_1.Post)(':id/like'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "darLike", null);
__decorate([
    (0, common_1.Get)(':id/likes'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "obtenerLikes", null);
__decorate([
    (0, common_1.Post)(':id/comentar'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "comentar", null);
__decorate([
    (0, common_1.Get)(':id/comentarios'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "obtenerComentarios", null);
__decorate([
    (0, common_1.Delete)('comentarios/:comentarioId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('comentarioId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "eliminarComentario", null);
__decorate([
    (0, common_1.Post)(':id/reportar'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], FotosController.prototype, "reportarFoto", null);
exports.FotosController = FotosController = __decorate([
    (0, common_1.Controller)('fotos'),
    __metadata("design:paramtypes", [fotos_service_1.FotosService])
], FotosController);
//# sourceMappingURL=fotos.controller.js.map