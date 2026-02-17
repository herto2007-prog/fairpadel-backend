import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: any = null;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  // Paleta FairPadel (dark + rojo)
  private readonly COLORS = {
    primary: '#e63946',      // Rojo FairPadel
    primaryLight: '#f87171',  // Rojo claro (hover/accent)
    success: '#22c55e',       // Verde confirmaciones
    bg: '#0f0f13',            // Fondo principal
    card: '#1a1a24',          // Fondo tarjetas/infobox
    surface: '#252532',       // Superficie elevada
    border: '#2d2d3d',        // Bordes
    text: '#f1f1f1',          // Texto principal
    secondary: '#a0a0b0',     // Texto secundario
    muted: '#6b6b7b',         // Texto muted
  };

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (apiKey && apiKey !== 'dev-mode-no-key') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Resend } = require('resend');
        this.resend = new Resend(apiKey);
        this.logger.log('Resend email service initialized');
      } catch (e) {
        this.logger.warn('Failed to initialize Resend: ' + e.message);
      }
    } else {
      this.logger.warn('RESEND_API_KEY not configured, emails will be logged only');
    }
  }

  async enviarEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<{ success: boolean }> {
    if (!this.resend) {
      this.logger.log(`[DEV] Email -> ${to}: ${subject}`);
      return { success: true };
    }

    // Warn if still using Resend's shared sandbox domain (emails will go to spam)
    if (this.fromEmail.includes('resend.dev')) {
      this.logger.warn(
        'SPAM WARNING: Using resend.dev shared domain. Configure FROM_EMAIL with your own verified domain (e.g. noreply@fairpadel.com) to avoid spam folders. See: https://resend.com/docs/dashboard/domains/introduction',
      );
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        headers: {
          'X-Entity-Ref-ID': `fairpadel-${Date.now()}`, // Unique ID helps avoid spam grouping
        },
      });
      this.logger.log(`Email enviado -> ${to}: ${subject}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Email fallo -> ${to}: ${error.message}`);
      return { success: false };
    }
  }

  // ═══════════════════════════════════════
  // TEMPLATES DE AUTENTICACION
  // ═══════════════════════════════════════

  async enviarEmailVerificacion(email: string, nombre: string, token: string) {
    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.primary}; margin: 0 0 16px 0;">Verifica tu email</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Bienvenido a FairPadel. Verifica tu email haciendo click en el boton:</p>
      ${this.buttonHtml(verificationUrl, 'Verificar Email')}
      <p style="color: ${this.COLORS.muted}; font-size: 12px; margin-top: 24px;">Este enlace expira en 24 horas.</p>
    `);
    return this.enviarEmail(email, 'Verifica tu email - FairPadel', html);
  }

  async enviarEmailBienvenida(email: string, nombre: string) {
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.success}; margin: 0 0 16px 0;">Bienvenido a FairPadel!</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu cuenta ha sido verificada exitosamente. Ya puedes inscribirte en torneos.</p>
      ${this.buttonHtml(`${this.frontendUrl}/tournaments`, 'Ver Torneos')}
    `);
    return this.enviarEmail(email, 'Bienvenido a FairPadel!', html);
  }

  async enviarEmailRecuperacion(email: string, nombre: string, token: string) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.primary}; margin: 0 0 16px 0;">Recuperacion de contrasena</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Recibimos una solicitud para restablecer tu contrasena:</p>
      ${this.buttonHtml(resetUrl, 'Restablecer Contrasena')}
      <p style="color: ${this.COLORS.muted}; font-size: 12px; margin-top: 24px;">Expira en 1 hora. Si no solicitaste esto, ignora este email.</p>
    `);
    return this.enviarEmail(email, 'Recuperacion de contrasena - FairPadel', html);
  }

  // ═══════════════════════════════════════
  // TEMPLATES DE NOTIFICACIONES
  // ═══════════════════════════════════════

  async enviarNotificacion(email: string, nombre: string, contenido: string) {
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.primary}; margin: 0 0 16px 0;">Notificacion</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>${contenido}</p>
      ${this.buttonHtml(`${this.frontendUrl}/profile`, 'Ir a FairPadel')}
    `);
    return this.enviarEmail(email, 'Notificacion - FairPadel', html);
  }

  async enviarInscripcionConfirmada(
    email: string,
    nombre: string,
    data: { torneoNombre: string; categoria: string; companero: string; fechas: string },
  ) {
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.success}; margin: 0 0 16px 0;">Inscripcion Confirmada</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu inscripcion al torneo <strong>${data.torneoNombre}</strong> fue confirmada.</p>
      ${this.infoBox(`
        <p><strong>Categoria:</strong> ${data.categoria}</p>
        <p><strong>Companero/a:</strong> ${data.companero}</p>
        <p><strong>Fechas:</strong> ${data.fechas}</p>
      `)}
      ${this.buttonHtml(`${this.frontendUrl}/inscripciones`, 'Ver Mis Inscripciones')}
    `);
    return this.enviarEmail(email, `Inscripcion Confirmada - ${data.torneoNombre}`, html);
  }

  async enviarFixturePublicado(
    email: string,
    nombre: string,
    data: { torneoNombre: string; oponentes: string; fecha: string; hora: string; cancha: string; sede: string; fixtureUrl: string },
  ) {
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.primary}; margin: 0 0 16px 0;">Fixture Publicado</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>El fixture del torneo <strong>${data.torneoNombre}</strong> fue publicado.</p>
      ${this.infoBox(`
        <p><strong>Vs.</strong> ${data.oponentes}</p>
        <p><strong>Fecha:</strong> ${data.fecha} - ${data.hora}</p>
        <p><strong>Cancha:</strong> ${data.cancha} (${data.sede})</p>
      `)}
      ${this.buttonHtml(data.fixtureUrl, 'Ver Fixture')}
    `);
    return this.enviarEmail(email, `Fixture Publicado - ${data.torneoNombre}`, html);
  }

  async enviarSiguientePartido(
    email: string,
    nombre: string,
    data: { torneoNombre: string; ronda: string; oponentes: string; fecha: string; hora: string; cancha: string; sede: string; fixtureUrl: string },
  ) {
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.primary}; margin: 0 0 16px 0;">Proximo Partido Confirmado</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Tu siguiente partido en <strong>${data.torneoNombre}</strong> esta listo:</p>
      ${this.infoBox(`
        <p><strong>${data.ronda}</strong></p>
        <p><strong>Vs.</strong> ${data.oponentes}</p>
        <p><strong>Fecha:</strong> ${data.fecha} - ${data.hora}</p>
        <p><strong>Cancha:</strong> ${data.cancha} (${data.sede})</p>
      `)}
      ${this.buttonHtml(data.fixtureUrl, 'Ver Fixture')}
    `);
    return this.enviarEmail(email, `Proximo Partido - ${data.torneoNombre} (${data.ronda})`, html);
  }

  async enviarResultadoPartido(
    email: string,
    nombre: string,
    data: { torneoNombre: string; ronda: string; resultado: string; siguienteRonda?: string },
  ) {
    const msg = data.siguienteRonda
      ? `Felicidades! Avanzas a <strong>${data.siguienteRonda}</strong> en <strong>${data.torneoNombre}</strong>.`
      : `Felicidades por tu victoria en <strong>${data.torneoNombre}</strong>!`;
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.success}; margin: 0 0 16px 0;">Victoria!</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>${msg}</p>
      ${this.infoBox(`
        <p><strong>Ronda:</strong> ${data.ronda}</p>
        <p><strong>Resultado:</strong> ${data.resultado}</p>
      `)}
    `);
    return this.enviarEmail(email, `Victoria en ${data.torneoNombre}!`, html);
  }

  async enviarAscensoCategoria(
    email: string,
    nombre: string,
    data: { categoriaAnterior: string; categoriaNueva: string },
  ) {
    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.primary}; margin: 0 0 16px 0;">Ascenso de Categoria!</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Felicidades! Has ascendido de <strong>${data.categoriaAnterior}</strong> a <strong>${data.categoriaNueva}</strong>.</p>
      ${this.buttonHtml(`${this.frontendUrl}/profile`, 'Ver Mi Perfil')}
    `);
    return this.enviarEmail(email, `Ascendiste a ${data.categoriaNueva}!`, html);
  }

  async enviarResumenSemanal(email: string, nombre: string, datos: any) {
    // Ranking change indicator
    let rankingChange = '';
    if (datos.posicionAnterior && datos.ranking && datos.posicionAnterior !== datos.ranking) {
      const diff = datos.posicionAnterior - datos.ranking;
      if (diff > 0) {
        rankingChange = ` <span style="color: ${this.COLORS.success};">&#9650; ${diff}</span>`;
      } else {
        rankingChange = ` <span style="color: ${this.COLORS.primaryLight};">&#9660; ${Math.abs(diff)}</span>`;
      }
    }

    const logrosSection = datos.logrosNuevos > 0
      ? `<p style="margin-top: 12px;">🏅 <strong>${datos.logrosNuevos} logro${datos.logrosNuevos > 1 ? 's' : ''} nuevo${datos.logrosNuevos > 1 ? 's' : ''}</strong> esta semana!</p>`
      : '';

    const rachaSection = datos.rachaActual >= 3
      ? `<p style="margin-top: 8px;">🔥 Racha actual: <strong>${datos.rachaActual} victorias consecutivas</strong></p>`
      : '';

    const html = this.wrapTemplate(`
      <h2 style="color: ${this.COLORS.primary}; margin: 0 0 16px 0;">Tu Resumen Semanal ⭐</h2>
      <p>Hola <strong>${nombre}</strong>, asi fue tu semana:</p>
      ${this.infoBox(`
        <p><strong>Partidos jugados:</strong> ${datos.partidosJugados}</p>
        <p><strong>Victorias:</strong> ${datos.victorias}</p>
        <p><strong>Ranking actual:</strong> #${datos.ranking || '-'}${rankingChange}</p>
      `)}
      ${logrosSection}
      ${rachaSection}
      ${this.buttonHtml(`${this.frontendUrl}/rankings`, 'Ver Rankings')}
      <p style="color: ${this.COLORS.muted}; font-size: 11px; text-align: center;">Este resumen es exclusivo para suscriptores Premium.</p>
    `);
    return this.enviarEmail(email, 'Tu Resumen Semanal - FairPadel ⭐', html);
  }

  // ═══════════════════════════════════════
  // HELPERS HTML
  // ═══════════════════════════════════════

  private wrapTemplate(body: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: ${this.COLORS.bg}; color: ${this.COLORS.text}; padding: 32px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 28px; font-weight: bold; color: ${this.COLORS.primary};">FairPadel</span>
        </div>
        ${body}
        <hr style="border: none; border-top: 1px solid ${this.COLORS.border}; margin: 24px 0;" />
        <p style="color: ${this.COLORS.muted}; font-size: 11px; text-align: center;">
          FairPadel - Torneos de Padel en Paraguay<br/>
          Configura tus preferencias de notificacion en tu perfil.
        </p>
      </div>
    `;
  }

  private buttonHtml(url: string, text: string): string {
    return `<div style="text-align: center; margin: 24px 0;"><a href="${url}" style="display: inline-block; background: ${this.COLORS.primary}; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">${text}</a></div>`;
  }

  private infoBox(content: string): string {
    return `<div style="background: ${this.COLORS.card}; border: 1px solid ${this.COLORS.border}; padding: 16px; border-radius: 8px; margin: 16px 0;">${content}</div>`;
  }
}
