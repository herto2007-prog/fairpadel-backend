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
exports.PagosController = void 0;
const common_1 = require("@nestjs/common");
const pagos_service_1 = require("./pagos.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let PagosController = class PagosController {
    constructor(pagosService) {
        this.pagosService = pagosService;
    }
    createCheckout(body) {
        return this.pagosService.createBancardCheckout(body.inscripcionId);
    }
    confirmPayment(body) {
        return this.pagosService.confirmBancardPayment(body.transactionId);
    }
    handleWebhook(body) {
        return this.pagosService.handleBancardWebhook(body);
    }
    findByInscripcion(inscripcionId) {
        return this.pagosService.findByInscripcion(inscripcionId);
    }
};
exports.PagosController = PagosController;
__decorate([
    (0, common_1.Post)('bancard/checkout'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PagosController.prototype, "createCheckout", null);
__decorate([
    (0, common_1.Post)('bancard/confirm'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PagosController.prototype, "confirmPayment", null);
__decorate([
    (0, common_1.Post)('webhooks/bancard'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PagosController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Get)('inscripcion/:inscripcionId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('inscripcionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PagosController.prototype, "findByInscripcion", null);
exports.PagosController = PagosController = __decorate([
    (0, common_1.Controller)('pagos'),
    __metadata("design:paramtypes", [pagos_service_1.PagosService])
], PagosController);
//# sourceMappingURL=pagos.controller.js.map