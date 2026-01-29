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
exports.RankingsController = void 0;
const common_1 = require("@nestjs/common");
const rankings_service_1 = require("./rankings.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let RankingsController = class RankingsController {
    constructor(rankingsService) {
        this.rankingsService = rankingsService;
    }
    obtenerRankings(tipo, alcance, genero) {
        return this.rankingsService.obtenerRankings(tipo, alcance, genero);
    }
    obtenerRankingGlobal(genero) {
        return this.rankingsService.obtenerRankingGlobal(genero);
    }
    obtenerRankingPorPais(pais, genero) {
        return this.rankingsService.obtenerRankingPorPais(pais, genero);
    }
    obtenerRankingPorCiudad(ciudad, genero) {
        return this.rankingsService.obtenerRankingPorCiudad(ciudad, genero);
    }
    obtenerRankingPorCategoria(categoria, genero) {
        return this.rankingsService.obtenerRankingPorCategoria(categoria, genero);
    }
    obtenerTop10(genero) {
        return this.rankingsService.obtenerTop10(genero);
    }
    obtenerRankingJugador(jugadorId) {
        return this.rankingsService.obtenerRankingJugador(jugadorId);
    }
    obtenerHistorialPuntos(jugadorId) {
        return this.rankingsService.obtenerHistorialPuntos(jugadorId);
    }
};
exports.RankingsController = RankingsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('tipo')),
    __param(1, (0, common_1.Query)('alcance')),
    __param(2, (0, common_1.Query)('genero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], RankingsController.prototype, "obtenerRankings", null);
__decorate([
    (0, common_1.Get)('global'),
    __param(0, (0, common_1.Query)('genero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RankingsController.prototype, "obtenerRankingGlobal", null);
__decorate([
    (0, common_1.Get)('pais/:pais'),
    __param(0, (0, common_1.Param)('pais')),
    __param(1, (0, common_1.Query)('genero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], RankingsController.prototype, "obtenerRankingPorPais", null);
__decorate([
    (0, common_1.Get)('ciudad/:ciudad'),
    __param(0, (0, common_1.Param)('ciudad')),
    __param(1, (0, common_1.Query)('genero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], RankingsController.prototype, "obtenerRankingPorCiudad", null);
__decorate([
    (0, common_1.Get)('categoria/:categoria'),
    __param(0, (0, common_1.Param)('categoria')),
    __param(1, (0, common_1.Query)('genero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], RankingsController.prototype, "obtenerRankingPorCategoria", null);
__decorate([
    (0, common_1.Get)('top10'),
    __param(0, (0, common_1.Query)('genero')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RankingsController.prototype, "obtenerTop10", null);
__decorate([
    (0, common_1.Get)('jugador/:jugadorId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('jugadorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RankingsController.prototype, "obtenerRankingJugador", null);
__decorate([
    (0, common_1.Get)('jugador/:jugadorId/historial'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('jugadorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RankingsController.prototype, "obtenerHistorialPuntos", null);
exports.RankingsController = RankingsController = __decorate([
    (0, common_1.Controller)('rankings'),
    __metadata("design:paramtypes", [rankings_service_1.RankingsService])
], RankingsController);
//# sourceMappingURL=rankings.controller.js.map