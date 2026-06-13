// Plantillas HTML de emails de torneos (invitación, confirmación, partido programado).
// Extraídas verbatim de email.service.ts — funciones puras (datos -> HTML).

export function invitacionJugadorTemplate(
    to: string,
    nombreJugador2: string,
    nombreJugador1: string,
    torneoNombre: string,
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
      
      <div class="info-box" style="text-align: center;">
        <p style="color: #ffffff; font-size: 16px; margin-bottom: 12px;">
          📩 Tu pareja te inscribió en este torneo.
        </p>
        <p style="color: #d1d5db; font-size: 14px;">
          Para confirmar tu inscripción, <strong>registrate en fairpadel.com</strong> usando este email (<code style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${to}</code>).
        </p>
      </div>
      
      <div class="footer">
        <p>¿No conocés a ${nombreJugador1}? Podés ignorar este email.</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

export function inscripcionConfirmadaTemplate(
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

export function partidoProgramadoTemplate(
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

