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
exports.NotificacionesController = void 0;
const common_1 = require("@nestjs/common");
const notificaciones_service_1 = require("./notificaciones.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let NotificacionesController = class NotificacionesController {
    constructor(notificacionesService) {
        this.notificacionesService = notificacionesService;
    }
    obtenerNotificaciones(req, leida) {
        const leidaBool = leida === 'true' ? true : leida === 'false' ? false : undefined;
        return this.notificacionesService.obtenerNotificaciones(req.user.id, leidaBool);
    }
    contarNoLeidas(req) {
        return this.notificacionesService.contarNoLeidas(req.user.id);
    }
    marcarComoLeida(id, req) {
        return this.notificacionesService.marcarComoLeida(id, req.user.id);
    }
    marcarTodasComoLeidas(req) {
        return this.notificacionesService.marcarTodasComoLeidas(req.user.id);
    }
};
exports.NotificacionesController = NotificacionesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('leida')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotificacionesController.prototype, "obtenerNotificaciones", null);
__decorate([
    (0, common_1.Get)('no-leidas/count'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificacionesController.prototype, "contarNoLeidas", null);
__decorate([
    (0, common_1.Put)(':id/leer'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], NotificacionesController.prototype, "marcarComoLeida", null);
__decorate([
    (0, common_1.Put)('leer-todas'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], NotificacionesController.prototype, "marcarTodasComoLeidas", null);
exports.NotificacionesController = NotificacionesController = __decorate([
    (0, common_1.Controller)('notificaciones'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [notificaciones_service_1.NotificacionesService])
], NotificacionesController);
//# sourceMappingURL=notificaciones.controller.js.map