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
exports.SedesController = void 0;
const common_1 = require("@nestjs/common");
const sedes_service_1 = require("./sedes.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const create_sede_dto_1 = require("./dto/create-sede.dto");
const update_sede_dto_1 = require("./dto/update-sede.dto");
const create_sede_cancha_dto_1 = require("./dto/create-sede-cancha.dto");
const update_sede_cancha_dto_1 = require("./dto/update-sede-cancha.dto");
const configurar_torneo_canchas_dto_1 = require("./dto/configurar-torneo-canchas.dto");
let SedesController = class SedesController {
    constructor(sedesService) {
        this.sedesService = sedesService;
    }
    async createSede(createSedeDto) {
        return this.sedesService.createSede(createSedeDto);
    }
    async findAllSedes(ciudad, activo) {
        return this.sedesService.findAllSedes({
            ciudad,
            activo: activo === 'true' ? true : activo === 'false' ? false : undefined,
        });
    }
    async findOneSede(id) {
        return this.sedesService.findOneSede(id);
    }
    async updateSede(id, updateSedeDto) {
        return this.sedesService.updateSede(id, updateSedeDto);
    }
    async deleteSede(id) {
        return this.sedesService.deleteSede(id);
    }
    async createCancha(sedeId, createCanchaDto) {
        return this.sedesService.createCancha(sedeId, createCanchaDto);
    }
    async findAllCanchas(sedeId) {
        return this.sedesService.findAllCanchas(sedeId);
    }
    async updateCancha(sedeId, canchaId, updateCanchaDto) {
        return this.sedesService.updateCancha(sedeId, canchaId, updateCanchaDto);
    }
    async deleteCancha(sedeId, canchaId) {
        return this.sedesService.deleteCancha(sedeId, canchaId);
    }
    async updateCanchasBulk(sedeId, canchas) {
        return this.sedesService.updateCanchasBulk(sedeId, canchas);
    }
    async configurarTorneoCanchas(tournamentId, dto) {
        return this.sedesService.configurarTorneoCanchas(tournamentId, dto);
    }
    async getTorneoCanchas(tournamentId) {
        return this.sedesService.getTorneoCanchas(tournamentId);
    }
    async agregarSedeATorneo(tournamentId, sedeId) {
        return this.sedesService.agregarSedeATorneo(tournamentId, sedeId);
    }
    async removerSedeDeTorneo(tournamentId, sedeId) {
        return this.sedesService.removerSedeDeTorneo(tournamentId, sedeId);
    }
    async getSedesDeTorneo(tournamentId) {
        return this.sedesService.getSedesDeTorneo(tournamentId);
    }
};
exports.SedesController = SedesController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_sede_dto_1.CreateSedeDto]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "createSede", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('ciudad')),
    __param(1, (0, common_1.Query)('activo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "findAllSedes", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "findOneSede", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_sede_dto_1.UpdateSedeDto]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "updateSede", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "deleteSede", null);
__decorate([
    (0, common_1.Post)(':sedeId/canchas'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('sedeId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_sede_cancha_dto_1.CreateSedeCanchaDto]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "createCancha", null);
__decorate([
    (0, common_1.Get)(':sedeId/canchas'),
    __param(0, (0, common_1.Param)('sedeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "findAllCanchas", null);
__decorate([
    (0, common_1.Put)(':sedeId/canchas/:canchaId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('sedeId')),
    __param(1, (0, common_1.Param)('canchaId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_sede_cancha_dto_1.UpdateSedeCanchaDto]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "updateCancha", null);
__decorate([
    (0, common_1.Delete)(':sedeId/canchas/:canchaId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('sedeId')),
    __param(1, (0, common_1.Param)('canchaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "deleteCancha", null);
__decorate([
    (0, common_1.Put)(':sedeId/canchas-bulk'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    __param(0, (0, common_1.Param)('sedeId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "updateCanchasBulk", null);
__decorate([
    (0, common_1.Post)('torneos/:tournamentId/configurar-canchas'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('tournamentId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, configurar_torneo_canchas_dto_1.ConfigurarTorneoCanchasDto]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "configurarTorneoCanchas", null);
__decorate([
    (0, common_1.Get)('torneos/:tournamentId/canchas'),
    __param(0, (0, common_1.Param)('tournamentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "getTorneoCanchas", null);
__decorate([
    (0, common_1.Post)('torneos/:tournamentId/sedes/:sedeId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('tournamentId')),
    __param(1, (0, common_1.Param)('sedeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "agregarSedeATorneo", null);
__decorate([
    (0, common_1.Delete)('torneos/:tournamentId/sedes/:sedeId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('tournamentId')),
    __param(1, (0, common_1.Param)('sedeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "removerSedeDeTorneo", null);
__decorate([
    (0, common_1.Get)('torneos/:tournamentId/sedes'),
    __param(0, (0, common_1.Param)('tournamentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SedesController.prototype, "getSedesDeTorneo", null);
exports.SedesController = SedesController = __decorate([
    (0, common_1.Controller)('sedes'),
    __metadata("design:paramtypes", [sedes_service_1.SedesService])
], SedesController);
//# sourceMappingURL=sedes.controller.js.map