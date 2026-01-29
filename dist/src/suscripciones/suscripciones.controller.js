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
exports.SuscripcionesController = void 0;
const common_1 = require("@nestjs/common");
const suscripciones_service_1 = require("./suscripciones.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const dto_1 = require("./dto");
let SuscripcionesController = class SuscripcionesController {
    constructor(suscripcionesService) {
        this.suscripcionesService = suscripcionesService;
    }
    obtenerPlanes() {
        return this.suscripcionesService.obtenerPlanes();
    }
    crearSuscripcion(dto, req) {
        return this.suscripcionesService.crearSuscripcion(dto, req.user.id);
    }
    obtenerMiSuscripcion(req) {
        return this.suscripcionesService.obtenerSuscripcionActiva(req.user.id);
    }
    cancelarSuscripcion(req) {
        return this.suscripcionesService.cancelarSuscripcion(req.user.id);
    }
    reactivarSuscripcion(req) {
        return this.suscripcionesService.reactivarSuscripcion(req.user.id);
    }
    validarCupon(body) {
        return this.suscripcionesService.validarCupon(body.codigo);
    }
};
exports.SuscripcionesController = SuscripcionesController;
__decorate([
    (0, common_1.Get)('planes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SuscripcionesController.prototype, "obtenerPlanes", null);
__decorate([
    (0, common_1.Post)('crear'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateSuscripcionDto, Object]),
    __metadata("design:returntype", void 0)
], SuscripcionesController.prototype, "crearSuscripcion", null);
__decorate([
    (0, common_1.Get)('mi-suscripcion'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuscripcionesController.prototype, "obtenerMiSuscripcion", null);
__decorate([
    (0, common_1.Put)('cancelar'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuscripcionesController.prototype, "cancelarSuscripcion", null);
__decorate([
    (0, common_1.Put)('reactivar'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuscripcionesController.prototype, "reactivarSuscripcion", null);
__decorate([
    (0, common_1.Post)('validar-cupon'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuscripcionesController.prototype, "validarCupon", null);
exports.SuscripcionesController = SuscripcionesController = __decorate([
    (0, common_1.Controller)('suscripciones'),
    __metadata("design:paramtypes", [suscripciones_service_1.SuscripcionesService])
], SuscripcionesController);
//# sourceMappingURL=suscripciones.controller.js.map