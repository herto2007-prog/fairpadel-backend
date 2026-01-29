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
exports.InscripcionesController = void 0;
const common_1 = require("@nestjs/common");
const inscripciones_service_1 = require("./inscripciones.service");
const create_inscripcion_dto_1 = require("./dto/create-inscripcion.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let InscripcionesController = class InscripcionesController {
    constructor(inscripcionesService) {
        this.inscripcionesService = inscripcionesService;
    }
    create(createInscripcionDto, req) {
        return this.inscripcionesService.create(createInscripcionDto, req.user.id);
    }
    misinscripciones(req) {
        return this.inscripcionesService.findByUser(req.user.id);
    }
    findByTournament(tournamentId, estado) {
        return this.inscripcionesService.findByTournament(tournamentId, estado);
    }
    findOne(id) {
        return this.inscripcionesService.findOne(id);
    }
    cancelar(id, req) {
        return this.inscripcionesService.cancelar(id, req.user.id);
    }
    subirComprobante(id, body) {
        return this.inscripcionesService.subirComprobante(id, body.comprobanteUrl);
    }
};
exports.InscripcionesController = InscripcionesController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_inscripcion_dto_1.CreateInscripcionDto, Object]),
    __metadata("design:returntype", void 0)
], InscripcionesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('mis-inscripciones'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InscripcionesController.prototype, "misinscripciones", null);
__decorate([
    (0, common_1.Get)('torneo/:tournamentId'),
    __param(0, (0, common_1.Param)('tournamentId')),
    __param(1, (0, common_1.Query)('estado')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], InscripcionesController.prototype, "findByTournament", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InscripcionesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id/cancelar'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InscripcionesController.prototype, "cancelar", null);
__decorate([
    (0, common_1.Post)(':id/comprobante'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InscripcionesController.prototype, "subirComprobante", null);
exports.InscripcionesController = InscripcionesController = __decorate([
    (0, common_1.Controller)('inscripciones'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [inscripciones_service_1.InscripcionesService])
], InscripcionesController);
//# sourceMappingURL=inscripciones.controller.js.map