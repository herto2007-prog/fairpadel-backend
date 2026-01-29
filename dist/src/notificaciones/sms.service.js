"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
const common_1 = require("@nestjs/common");
let SmsService = class SmsService {
    constructor() {
        this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    }
    async enviarSms(to, message) {
        console.log('📱 Enviando SMS:');
        console.log('To:', to);
        console.log('Message:', message);
        return { success: true };
    }
    async enviarNotificacion(telefono, contenido) {
        const mensajeCorto = contenido.length > 140
            ? contenido.substring(0, 137) + '...'
            : contenido;
        return this.enviarSms(telefono, `FairPadel: ${mensajeCorto}`);
    }
    async recordatorioPartido(telefono, detalles) {
        return this.enviarSms(telefono, `FairPadel: Recordatorio de partido - ${detalles}`);
    }
    async notificacionPagoConfirmado(telefono) {
        return this.enviarSms(telefono, 'FairPadel: Tu pago fue confirmado exitosamente');
    }
    async cambioHorarioTorneo(telefono, torneo) {
        return this.enviarSms(telefono, `FairPadel: El torneo "${torneo}" cambió de horario. Revisa tu email.`);
    }
};
exports.SmsService = SmsService;
exports.SmsService = SmsService = __decorate([
    (0, common_1.Injectable)()
], SmsService);
//# sourceMappingURL=sms.service.js.map