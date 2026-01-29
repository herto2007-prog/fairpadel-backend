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
exports.ParejasController = void 0;
const common_1 = require("@nestjs/common");
const parejas_service_1 = require("./parejas.service");
const create_pareja_dto_1 = require("./dto/create-pareja.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let ParejasController = class ParejasController {
    constructor(parejasService) {
        this.parejasService = parejasService;
    }
    create(createParejaDto, req) {
        return this.parejasService.create(createParejaDto, req.user.id);
    }
    findOne(id) {
        return this.parejasService.findOne(id);
    }
    findByUser(userId) {
        return this.parejasService.findByUser(userId);
    }
    buscarJugador(body) {
        return this.parejasService.buscarJugadorPorDocumento(body.documento);
    }
};
exports.ParejasController = ParejasController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_pareja_dto_1.CreateParejaDto, Object]),
    __metadata("design:returntype", void 0)
], ParejasController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ParejasController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ParejasController.prototype, "findByUser", null);
__decorate([
    (0, common_1.Post)('buscar-jugador'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ParejasController.prototype, "buscarJugador", null);
exports.ParejasController = ParejasController = __decorate([
    (0, common_1.Controller)('parejas'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [parejas_service_1.ParejasService])
], ParejasController);
//# sourceMappingURL=parejas.controller.js.map