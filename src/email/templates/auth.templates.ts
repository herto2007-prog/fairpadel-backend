// Plantillas HTML de emails de cuenta (verificación, reset de contraseña).
// Extraídas verbatim de email.service.ts — funciones puras (datos -> HTML).

export function verificationEmailTemplate(name: string, link: string): string {
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

export function passwordResetEmailTemplate(name: string, link: string): string {
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

