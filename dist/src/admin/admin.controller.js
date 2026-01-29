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
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_service_1 = require("./admin.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
let AdminController = class AdminController {
    constructor(adminService) {
        this.adminService = adminService;
    }
    obtenerTorneosPendientes() {
        return this.adminService.obtenerTorneosPendientes();
    }
    aprobarTorneo(id) {
        return this.adminService.aprobarTorneo(id);
    }
    rechazarTorneo(id, body) {
        return this.adminService.rechazarTorneo(id, body.motivo);
    }
    obtenerSolicitudesOrganizador(estado) {
        return this.adminService.obtenerSolicitudesOrganizador(estado);
    }
    aprobarSolicitudOrganizador(id) {
        return this.adminService.aprobarSolicitudOrganizador(id);
    }
    rechazarSolicitudOrganizador(id, body) {
        return this.adminService.rechazarSolicitudOrganizador(id, body.motivo);
    }
    obtenerFotosModeracion() {
        return this.adminService.obtenerFotosModeracion();
    }
    aprobarFoto(id) {
        return this.adminService.aprobarFoto(id);
    }
    eliminarFoto(id, body) {
        return this.adminService.eliminarFotoInapropiada(id, body.motivo);
    }
    obtenerUsuarios(search, estado) {
        return this.adminService.obtenerUsuarios(search, estado);
    }
    suspenderUsuario(id, body) {
        return this.adminService.suspenderUsuario(id, body.motivo);
    }
    activarUsuario(id) {
        return this.adminService.activarUsuario(id);
    }
    obtenerReportesFotos(estado) {
        return this.adminService.obtenerReportesFotos(estado);
    }
    obtenerReportesUsuarios(estado) {
        return this.adminService.obtenerReportesUsuarios(estado);
    }
    resolverReporteFoto(id, body) {
        return this.adminService.resolverReporteFoto(id, body.accion);
    }
    resolverReporteUsuario(id, body) {
        return this.adminService.resolverReporteUsuario(id, body.accion);
    }
    obtenerSuscripciones(estado) {
        return this.adminService.obtenerSuscripciones(estado);
    }
    extenderSuscripcion(id, body) {
        return this.adminService.extenderSuscripcion(id, body.dias);
    }
    obtenerConfiguracionPuntos() {
        return this.adminService.obtenerConfiguracionPuntos();
    }
    actualizarConfiguracionPuntos(id, body) {
        return this.adminService.actualizarConfiguracionPuntos(id, body);
    }
    crearCupon(body) {
        return this.adminService.crearCupon(body);
    }
    obtenerCupones() {
        return this.adminService.obtenerCupones();
    }
    desactivarCupon(id) {
        return this.adminService.desactivarCupon(id);
    }
    obtenerMetricasDashboard() {
        return this.adminService.obtenerMetricasDashboard();
    }
    obtenerMetricasUsuarios() {
        return this.adminService.obtenerMetricasUsuarios();
    }
    obtenerMetricasTorneos() {
        return this.adminService.obtenerMetricasTorneos();
    }
    obtenerMetricasIngresos() {
        return this.adminService.obtenerMetricasIngresos();
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('torneos-pendientes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerTorneosPendientes", null);
__decorate([
    (0, common_1.Put)('torneos/:id/aprobar'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "aprobarTorneo", null);
__decorate([
    (0, common_1.Put)('torneos/:id/rechazar'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rechazarTorneo", null);
__decorate([
    (0, common_1.Get)('solicitudes-organizador'),
    __param(0, (0, common_1.Query)('estado')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerSolicitudesOrganizador", null);
__decorate([
    (0, common_1.Put)('solicitudes-organizador/:id/aprobar'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "aprobarSolicitudOrganizador", null);
__decorate([
    (0, common_1.Put)('solicitudes-organizador/:id/rechazar'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rechazarSolicitudOrganizador", null);
__decorate([
    (0, common_1.Get)('fotos-moderacion'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerFotosModeracion", null);
__decorate([
    (0, common_1.Put)('fotos/:id/aprobar'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "aprobarFoto", null);
__decorate([
    (0, common_1.Put)('fotos/:id/eliminar'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "eliminarFoto", null);
__decorate([
    (0, common_1.Get)('usuarios'),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('estado')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerUsuarios", null);
__decorate([
    (0, common_1.Put)('usuarios/:id/suspender'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "suspenderUsuario", null);
__decorate([
    (0, common_1.Put)('usuarios/:id/activar'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "activarUsuario", null);
__decorate([
    (0, common_1.Get)('reportes/fotos'),
    __param(0, (0, common_1.Query)('estado')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerReportesFotos", null);
__decorate([
    (0, common_1.Get)('reportes/usuarios'),
    __param(0, (0, common_1.Query)('estado')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerReportesUsuarios", null);
__decorate([
    (0, common_1.Put)('reportes/fotos/:id/resolver'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolverReporteFoto", null);
__decorate([
    (0, common_1.Put)('reportes/usuarios/:id/resolver'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolverReporteUsuario", null);
__decorate([
    (0, common_1.Get)('suscripciones'),
    __param(0, (0, common_1.Query)('estado')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerSuscripciones", null);
__decorate([
    (0, common_1.Put)('suscripciones/:id/extender'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "extenderSuscripcion", null);
__decorate([
    (0, common_1.Get)('configuracion/puntos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerConfiguracionPuntos", null);
__decorate([
    (0, common_1.Put)('configuracion/puntos/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "actualizarConfiguracionPuntos", null);
__decorate([
    (0, common_1.Post)('cupones'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "crearCupon", null);
__decorate([
    (0, common_1.Get)('cupones'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerCupones", null);
__decorate([
    (0, common_1.Put)('cupones/:id/desactivar'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "desactivarCupon", null);
__decorate([
    (0, common_1.Get)('metricas/dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerMetricasDashboard", null);
__decorate([
    (0, common_1.Get)('metricas/usuarios'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerMetricasUsuarios", null);
__decorate([
    (0, common_1.Get)('metricas/torneos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerMetricasTorneos", null);
__decorate([
    (0, common_1.Get)('metricas/ingresos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "obtenerMetricasIngresos", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map