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
exports.MatchesController = void 0;
const common_1 = require("@nestjs/common");
const matches_service_1 = require("./matches.service");
const fixture_service_1 = require("./fixture.service");
const cargar_resultado_dto_1 = require("./dto/cargar-resultado.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
let MatchesController = class MatchesController {
    constructor(matchesService, fixtureService) {
        this.matchesService = matchesService;
        this.fixtureService = fixtureService;
    }
    generarFixture(tournamentId) {
        return this.fixtureService.generarFixtureCompleto(tournamentId);
    }
    obtenerFixture(tournamentId, categoryId) {
        return this.fixtureService.obtenerFixture(tournamentId, categoryId);
    }
    findOne(id) {
        return this.matchesService.findOne(id);
    }
    cargarResultado(id, dto) {
        return this.matchesService.cargarResultado(id, dto);
    }
    reprogramar(id, body) {
        return this.matchesService.reprogramar(id, body);
    }
    obtenerPendientes(tournamentId) {
        return this.matchesService.obtenerPartidosPendientes(tournamentId);
    }
};
exports.MatchesController = MatchesController;
__decorate([
    (0, common_1.Post)('torneo/:tournamentId/generar-fixture'),
    (0, roles_decorator_1.Roles)('organizador', 'admin'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, common_1.Param)('tournamentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "generarFixture", null);
__decorate([
    (0, common_1.Get)('torneo/:tournamentId/fixture'),
    __param(0, (0, common_1.Param)('tournamentId')),
    __param(1, (0, common_1.Query)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "obtenerFixture", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id/cargar-resultado'),
    (0, roles_decorator_1.Roles)('organizador', 'admin'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cargar_resultado_dto_1.CargarResultadoDto]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "cargarResultado", null);
__decorate([
    (0, common_1.Put)(':id/reprogramar'),
    (0, roles_decorator_1.Roles)('organizador', 'admin'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "reprogramar", null);
__decorate([
    (0, common_1.Get)('torneo/:tournamentId/pendientes'),
    (0, roles_decorator_1.Roles)('organizador', 'admin'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    __param(0, (0, common_1.Param)('tournamentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MatchesController.prototype, "obtenerPendientes", null);
exports.MatchesController = MatchesController = __decorate([
    (0, common_1.Controller)('matches'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [matches_service_1.MatchesService,
        fixture_service_1.FixtureService])
], MatchesController);
//# sourceMappingURL=matches.controller.js.map