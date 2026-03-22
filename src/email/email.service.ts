import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY no está configurado. Los emails no se enviarán.');
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  private getFromEmail(): string {
    const fromEmail = this.configService.get<string>('FROM_EMAIL');
    return fromEmail || 'FairPadel <noreply@fairpadel.com>';
  }

  /**
   * Envía email de verificación de cuenta
   */
  async sendVerificationEmail(
    to: string,
    name: string,
    verificationLink: string,
  ): Promise<void> {
    const html = this.getVerificationEmailTemplate(name, verificationLink);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Email de verificación para ${to}:`);
        this.logger.warn(`Link: ${verificationLink}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: 'Verifica tu cuenta - FairPadel',
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de verificación enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando email de verificación a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email de recuperación de contraseña
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetLink: string,
  ): Promise<void> {
    const html = this.getPasswordResetEmailTemplate(name, resetLink);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Email de reset para ${to}:`);
        this.logger.warn(`Link: ${resetLink}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: 'Recupera tu contraseña - FairPadel',
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Email de reset enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando email de reset a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Template HTML para verificación de email
   */
  private getVerificationEmailTemplate(name: string, link: string): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu cuenta - FairPadel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0B0E14 0%, #151921 100%);
      color: #ffffff;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: rgba(21, 25, 33, 0.95);
      border: 1px solid #232838;
      border-radius: 24px;
      padding: 48px;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    .logo-container {
      margin-bottom: 32px;
    }
    .logo {
      width: 120px;
      height: auto;
      max-height: 80px;
      object-fit: contain;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #ffffff;
    }
    .subtitle {
      font-size: 16px;
      color: #9ca3af;
      margin-bottom: 32px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #df2531 0%, #b91c1c 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      box-shadow: 0 4px 20px rgba(223, 37, 49, 0.3);
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #232838, transparent);
      margin: 32px 0;
    }
    .link-text {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .link {
      color: #df2531;
      word-break: break-all;
      font-size: 13px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #232838;
      color: #6b7280;
      font-size: 13px;
    }
    .highlight {
      color: #df2531;
      font-weight: 600;
    }
    .check-list {
      text-align: left;
      margin: 24px 0;
      padding: 0 24px;
    }
    .check-item {
      display: flex;
      align-items: center;
      margin: 12px 0;
      color: #d1d5db;
      font-size: 15px;
    }
    .check-icon {
      color: #22c55e;
      margin-right: 12px;
      font-size: 18px;
    }
    @media (max-width: 480px) {
      .card { padding: 32px 24px; }
      .title { font-size: 24px; }
      .logo { width: 100px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <img src="${logoUrl}" alt="FairPadel" class="logo" />
      </div>
      
      <h1 class="title">¡Bienvenido, ${name}!</h1>
      <p class="subtitle">
        Estás a un paso de unirte a la comunidad de pádel más grande de Paraguay.
      </p>
      
      <div class="check-list">
        <div class="check-item">
          <span class="check-icon">✓</span>
          <span>Inscríbete en torneos</span>
        </div>
        <div class="check-item">
          <span class="check-icon">✓</span>
          <span>Consulta tu ranking</span>
        </div>
        <div class="check-item">
          <span class="check-icon">✓</span>
          <span>Conecta con otros jugadores</span>
        </div>
      </div>
      
      <p style="color: #d1d5db; margin-bottom: 16px;">
        Solo necesitas verificar tu email para activar tu cuenta:
      </p>
      
      <a href="${link}" class="button">Verificar mi cuenta</a>
      
      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
        Este link expira en <span class="highlight">24 horas</span>
      </p>
      
      <div class="divider"></div>
      
      <p class="link-text">Si el botón no funciona, copia y pega este link:</p>
      <p class="link">${link}</p>
      
      <div class="footer">
        <p>Si no creaste esta cuenta, puedes ignorar este email.</p>
        <p style="margin-top: 8px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Envía email de invitación a jugador 2 no registrado
   */
  async sendInvitacionJugador(
    to: string,
    nombreJugador2: string,
    nombreJugador1: string,
    torneoNombre: string,
    linkConfirmacion: string,
  ): Promise<void> {
    const html = this.getInvitacionJugadorTemplate(nombreJugador2, nombreJugador1, torneoNombre, linkConfirmacion);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Invitación para ${to}:`);
        this.logger.warn(`Link: ${linkConfirmacion}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `¡Te invitaron a jugar en ${torneoNombre}! - FairPadel`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Invitación enviada a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando invitación a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email de confirmación de inscripción
   */
  async sendInscripcionConfirmada(
    to: string,
    nombre: string,
    torneoNombre: string,
    categoria: string,
    fechaSorteo: string,
  ): Promise<void> {
    const html = this.getInscripcionConfirmadaTemplate(nombre, torneoNombre, categoria, fechaSorteo);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Confirmación inscripción para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `✅ Inscripción confirmada - ${torneoNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Confirmación enviada a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando confirmación a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Envía email cuando un partido es programado (recordatorio)
   */
  async sendPartidoProgramado(
    to: string,
    nombre: string,
    torneoNombre: string,
    fecha: string,
    hora: string,
    cancha: string,
    sede: string,
    rival: string,
  ): Promise<void> {
    const html = this.getPartidoProgramadoTemplate(nombre, torneoNombre, fecha, hora, cancha, sede, rival);
    
    try {
      if (!this.resend) {
        this.logger.warn(`[MODO DESARROLLO] Partido programado para ${to}`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.getFromEmail(),
        to: [to],
        subject: `📅 Tu partido está programado - ${torneoNombre}`,
        html,
      });

      if (error) {
        this.logger.error('Error enviando email:', error);
        throw new Error(`Error enviando email: ${error.message}`);
      }

      this.logger.log(`Partido programado enviado a ${to}, ID: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Error enviando partido programado a ${to}:`, error);
      throw error;
    }
  }

  /**
   * Template HTML para invitación a jugador 2
   */
  private getInvitacionJugadorTemplate(
    nombreJugador2: string,
    nombreJugador1: string,
    torneoNombre: string,
    link: string,
  ): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a jugar - FairPadel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0B0E14 0%, #151921 100%);
      color: #ffffff;
      line-height: 1.6;
    }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card {
      background: rgba(21, 25, 33, 0.95);
      border: 1px solid #232838;
      border-radius: 24px;
      padding: 48px;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    .logo-container { margin-bottom: 32px; }
    .logo { width: 120px; height: auto; max-height: 80px; object-fit: contain; }
    .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; color: #ffffff; }
    .subtitle { font-size: 16px; color: #9ca3af; margin-bottom: 32px; }
    .highlight { color: #df2531; font-weight: 600; }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #df2531 0%, #b91c1c 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      box-shadow: 0 4px 20px rgba(223, 37, 49, 0.3);
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #232838, transparent);
      margin: 32px 0;
    }
    .link-text { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
    .link { color: #df2531; word-break: break-all; font-size: 13px; }
    .footer {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #232838;
      color: #6b7280;
      font-size: 13px;
    }
    .info-box {
      background: rgba(223, 37, 49, 0.1);
      border: 1px solid rgba(223, 37, 49, 0.3);
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      text-align: left;
    }
    .info-item { margin: 8px 0; color: #d1d5db; }
    @media (max-width: 480px) {
      .card { padding: 32px 24px; }
      .title { font-size: 24px; }
      .logo { width: 100px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <img src="${logoUrl}" alt="FairPadel" class="logo" />
      </div>
      
      <h1 class="title">¡Hola ${nombreJugador2}!</h1>
      <p class="subtitle">
        <span class="highlight">${nombreJugador1}</span> te quiere como pareja para jugar el torneo:
      </p>
      
      <div class="info-box">
        <div class="info-item"><strong>🏆 Torneo:</strong> ${torneoNombre}</div>
        <div class="info-item"><strong>👤 Tu pareja:</strong> ${nombreJugador1}</div>
      </div>
      
      <p style="color: #d1d5db; margin-bottom: 16px;">
        Confirmá tu participación haciendo clic aquí:
      </p>
      
      <a href="${link}" class="button">Confirmar inscripción</a>
      
      <div class="divider"></div>
      
      <p class="link-text">Si el botón no funciona, copia y pega este link:</p>
      <p class="link">${link}</p>
      
      <div class="footer">
        <p>¿No conocés a ${nombreJugador1}? Podés ignorar este email.</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Template HTML para confirmación de inscripción
   */
  private getInscripcionConfirmadaTemplate(
    nombre: string,
    torneoNombre: string,
    categoria: string,
    fechaSorteo: string,
  ): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inscripción confirmada - FairPadel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0B0E14 0%, #151921 100%);
      color: #ffffff;
      line-height: 1.6;
    }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card {
      background: rgba(21, 25, 33, 0.95);
      border: 1px solid #232838;
      border-radius: 24px;
      padding: 48px;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    .logo-container { margin-bottom: 32px; }
    .logo { width: 120px; height: auto; max-height: 80px; object-fit: contain; }
    .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; color: #ffffff; }
    .subtitle { font-size: 16px; color: #9ca3af; margin-bottom: 32px; }
    .highlight { color: #22c55e; font-weight: 600; }
    .success-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    .info-box {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: left;
    }
    .info-item { margin: 12px 0; color: #d1d5db; font-size: 15px; }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #232838, transparent);
      margin: 32px 0;
    }
    .footer {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #232838;
      color: #6b7280;
      font-size: 13px;
    }
    .next-steps {
      text-align: left;
      margin: 24px 0;
      padding: 0 16px;
    }
    .step {
      display: flex;
      align-items: flex-start;
      margin: 16px 0;
      color: #d1d5db;
      font-size: 15px;
    }
    .step-number {
      background: rgba(223, 37, 49, 0.2);
      color: #df2531;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 12px;
      margin-right: 12px;
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      .card { padding: 32px 24px; }
      .title { font-size: 24px; }
      .logo { width: 100px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <img src="${logoUrl}" alt="FairPadel" class="logo" />
      </div>
      
      <div class="success-icon">✅</div>
      
      <h1 class="title">¡Inscripción confirmada!</h1>
      <p class="subtitle">
        Hola <span class="highlight">${nombre}</span>, tu lugar en el torneo está asegurado.
      </p>
      
      <div class="info-box">
        <div class="info-item"><strong>🏆 Torneo:</strong> ${torneoNombre}</div>
        <div class="info-item"><strong>🏷️ Categoría:</strong> ${categoria}</div>
        <div class="info-item"><strong>🎲 Sorteo:</strong> ${fechaSorteo}</div>
      </div>
      
      <div class="divider"></div>
      
      <h3 style="color: #ffffff; margin-bottom: 16px;">Próximos pasos:</h3>
      <div class="next-steps">
        <div class="step">
          <span class="step-number">1</span>
          <span>Esperá el sorteo el ${fechaSorteo}</span>
        </div>
        <div class="step">
          <span class="step-number">2</span>
          <span>Te avisaremos cuando salga el fixture con tus partidos</span>
        </div>
        <div class="step">
          <span class="step-number">3</span>
          <span>¡A jugar! 🎾</span>
        </div>
      </div>
      
      <div class="footer">
        <p>¿Tenés dudas? Contactá al organizador del torneo.</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Template HTML para partido programado (recordatorio)
   */
  private getPartidoProgramadoTemplate(
    nombre: string,
    torneoNombre: string,
    fecha: string,
    hora: string,
    cancha: string,
    sede: string,
    rival: string,
  ): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu partido está programado - FairPadel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0B0E14 0%, #151921 100%);
      color: #ffffff;
      line-height: 1.6;
    }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card {
      background: rgba(21, 25, 33, 0.95);
      border: 1px solid #232838;
      border-radius: 24px;
      padding: 48px;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    .logo-container { margin-bottom: 32px; }
    .logo { width: 120px; height: auto; max-height: 80px; object-fit: contain; }
    .title { font-size: 28px; font-weight: 700; margin-bottom: 16px; color: #ffffff; }
    .subtitle { font-size: 16px; color: #9ca3af; margin-bottom: 32px; }
    .highlight { color: #df2531; font-weight: 600; }
    .date-box {
      background: linear-gradient(135deg, rgba(223, 37, 49, 0.2) 0%, rgba(185, 28, 28, 0.2) 100%);
      border: 1px solid rgba(223, 37, 49, 0.5);
      border-radius: 16px;
      padding: 24px;
      margin: 24px 0;
    }
    .date-big {
      font-size: 32px;
      font-weight: 700;
      color: #df2531;
      margin-bottom: 8px;
    }
    .time-big {
      font-size: 24px;
      color: #ffffff;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 24px 0;
      text-align: left;
    }
    .info-item {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 16px;
    }
    .info-label {
      font-size: 12px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      color: #ffffff;
      font-weight: 500;
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #232838, transparent);
      margin: 32px 0;
    }
    .footer {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #232838;
      color: #6b7280;
      font-size: 13px;
    }
    .reminder {
      background: rgba(234, 179, 8, 0.1);
      border: 1px solid rgba(234, 179, 8, 0.3);
      border-radius: 12px;
      padding: 16px;
      margin: 24px 0;
      color: #eab308;
      font-size: 14px;
    }
    @media (max-width: 480px) {
      .card { padding: 32px 24px; }
      .title { font-size: 24px; }
      .logo { width: 100px; }
      .info-grid { grid-template-columns: 1fr; }
      .date-big { font-size: 24px; }
      .time-big { font-size: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <img src="${logoUrl}" alt="FairPadel" class="logo" />
      </div>
      
      <h1 class="title">📅 Tu partido está programado</h1>
      <p class="subtitle">
        Hola <span class="highlight">${nombre}</span>, te esperamos en la cancha:
      </p>
      
      <div class="date-box">
        <div class="date-big">${fecha}</div>
        <div class="time-big">${hora} hs</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Torneo</div>
          <div class="info-value">${torneoNombre}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Rival</div>
          <div class="info-value">${rival}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Sede</div>
          <div class="info-value">${sede}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Cancha</div>
          <div class="info-value">${cancha}</div>
        </div>
      </div>
      
      <div class="reminder">
        ⏰ Llegá 15 minutos antes para calentar
      </div>
      
      <div class="divider"></div>
      
      <div class="footer">
        <p>¿No podés asistir? Contactá al organizador lo antes posible.</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Template HTML para recuperación de contraseña
   */
  private getPasswordResetEmailTemplate(name: string, link: string): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recupera tu contraseña - FairPadel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0B0E14 0%, #151921 100%);
      color: #ffffff;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: rgba(21, 25, 33, 0.95);
      border: 1px solid #232838;
      border-radius: 24px;
      padding: 48px;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    .logo-container {
      margin-bottom: 32px;
    }
    .logo {
      width: 120px;
      height: auto;
      max-height: 80px;
      object-fit: contain;
    }
    .title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
      color: #ffffff;
    }
    .subtitle {
      font-size: 16px;
      color: #9ca3af;
      margin-bottom: 32px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #df2531 0%, #b91c1c 100%);
      color: #ffffff;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      margin: 24px 0;
      box-shadow: 0 4px 20px rgba(223, 37, 49, 0.3);
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #232838, transparent);
      margin: 32px 0;
    }
    .warning {
      background: rgba(234, 179, 8, 0.1);
      border: 1px solid rgba(234, 179, 8, 0.3);
      border-radius: 12px;
      padding: 16px;
      margin: 24px 0;
      color: #eab308;
      font-size: 14px;
    }
    .link-text {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .link {
      color: #df2531;
      word-break: break-all;
      font-size: 13px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #232838;
      color: #6b7280;
      font-size: 13px;
    }
    @media (max-width: 480px) {
      .card { padding: 32px 24px; }
      .title { font-size: 24px; }
      .logo { width: 100px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo-container">
        <img src="${logoUrl}" alt="FairPadel" class="logo" />
      </div>
      
      <h1 class="title">Recupera tu contraseña</h1>
      <p class="subtitle">
        Hola ${name}, recibimos una solicitud para restablecer tu contraseña.
      </p>
      
      <a href="${link}" class="button">Crear nueva contraseña</a>
      
      <div class="warning">
        ⚠️ Este link expira en 1 hora por seguridad.
      </div>
      
      <div class="divider"></div>
      
      <p class="link-text">Si el botón no funciona, copia y pega este link:</p>
      <p class="link">${link}</p>
      
      <div class="footer">
        <p>Si no solicitaste este cambio, puedes ignorar este email.</p>
        <p style="margin-top: 8px;">Tu contraseña actual seguirá siendo válida.</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
