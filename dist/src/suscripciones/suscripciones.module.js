"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuscripcionesModule = void 0;
const common_1 = require("@nestjs/common");
const suscripciones_controller_1 = require("./suscripciones.controller");
const suscripciones_service_1 = require("./suscripciones.service");
const prisma_module_1 = require("../prisma/prisma.module");
const pagos_module_1 = require("../pagos/pagos.module");
let SuscripcionesModule = class SuscripcionesModule {
};
exports.SuscripcionesModule = SuscripcionesModule;
exports.SuscripcionesModule = SuscripcionesModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, pagos_module_1.PagosModule],
        controllers: [suscripciones_controller_1.SuscripcionesController],
        providers: [suscripciones_service_1.SuscripcionesService],
        exports: [suscripciones_service_1.SuscripcionesService],
    })
], SuscripcionesModule);
//# sourceMappingURL=suscripciones.module.js.map