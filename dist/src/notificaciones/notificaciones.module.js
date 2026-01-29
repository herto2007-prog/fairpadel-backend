"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificacionesModule = void 0;
const common_1 = require("@nestjs/common");
const notificaciones_controller_1 = require("./notificaciones.controller");
const notificaciones_service_1 = require("./notificaciones.service");
const email_service_1 = require("./email.service");
const sms_service_1 = require("./sms.service");
const prisma_module_1 = require("../prisma/prisma.module");
let NotificacionesModule = class NotificacionesModule {
};
exports.NotificacionesModule = NotificacionesModule;
exports.NotificacionesModule = NotificacionesModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [notificaciones_controller_1.NotificacionesController],
        providers: [notificaciones_service_1.NotificacionesService, email_service_1.EmailService, sms_service_1.SmsService],
        exports: [notificaciones_service_1.NotificacionesService, email_service_1.EmailService, sms_service_1.SmsService],
    })
], NotificacionesModule);
//# sourceMappingURL=notificaciones.module.js.map