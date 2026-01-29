"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
let EmailService = class EmailService {
    constructor() {
        this.fromEmail = process.env.FROM_EMAIL || 'noreply@fairpadel.com';
    }
    async enviarEmail(to, subject, html) {
        console.log('📧 Enviando email:');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('HTML:', html);
        return { success: true };
    }
    async enviarEmailVerificacion(email, nombre, token) {
        const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;
        const html = `
      <h1>Bienvenido a FairPadel, ${nombre}!</h1>
      <p>Por favor verifica tu email haciendo click en el siguiente enlace:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>Este enlace expira en 24 horas.</p>
    `;
        return this.enviarEmail(email, 'Verifica tu email - FairPadel', html);
    }
    async enviarEmailBienvenida(email, nombre) {
        const html = `
      <h1>¡Bienvenido a FairPadel, ${nombre}!</h1>
      <p>Tu cuenta ha sido verificada exitosamente.</p>
      <p>Ya puedes comenzar a inscribirte en torneos y gestionar tus partidos.</p>
      <a href="${process.env.FRONTEND_URL}/dashboard">Ir al Dashboard</a>
    `;
        return this.enviarEmail(email, '¡Bienvenido a FairPadel!', html);
    }
    async enviarEmailRecuperacion(email, nombre, token) {
        const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;
        const html = `
      <h1>Recuperación de contraseña</h1>
      <p>Hola ${nombre},</p>
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p>Haz click en el siguiente enlace para crear una nueva contraseña:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>Este enlace expira en 1 hora.</p>
      <p>Si no solicitaste esto, ignora este email.</p>
    `;
        return this.enviarEmail(email, 'Recuperación de contraseña - FairPadel', html);
    }
    async enviarNotificacion(email, nombre, contenido) {
        const html = `
      <h2>Notificación de FairPadel</h2>
      <p>Hola ${nombre},</p>
      <p>${contenido}</p>
      <a href="${process.env.FRONTEND_URL}/dashboard">Ver en FairPadel</a>
    `;
        return this.enviarEmail(email, 'Notificación - FairPadel', html);
    }
    async enviarResumenSemanal(email, nombre, datos) {
        const html = `
      <h1>Resumen Semanal - FairPadel</h1>
      <p>Hola ${nombre},</p>
      <h3>Tu actividad esta semana:</h3>
      <ul>
        <li>Partidos jugados: ${datos.partidosJugados}</li>
        <li>Victorias: ${datos.victorias}</li>
        <li>Ranking actual: #${datos.ranking}</li>
      </ul>
      <a href="${process.env.FRONTEND_URL}/rankings">Ver Rankings</a>
    `;
        return this.enviarEmail(email, 'Resumen Semanal - FairPadel', html);
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)()
], EmailService);
//# sourceMappingURL=email.service.js.map