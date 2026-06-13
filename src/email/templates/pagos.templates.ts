// Plantillas HTML de emails de pago/suscripción (Bancard).
// Extraídas verbatim de email.service.ts — funciones puras (datos -> HTML).

export function pagoExitosoTemplate(
    nombre: string,
    sedeNombre: string,
    planNombre: string,
    monto: number,
    moneda: string,
    fechaPago: string,
    fechaVencimiento: string,
  ): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    const montoFormateado = new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: moneda,
    }).format(monto);
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago Confirmado - FairPadel</title>
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
    .success-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    .highlight { color: #22c55e; font-weight: 600; }
    .amount-box {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.2) 100%);
      border: 1px solid rgba(34, 197, 94, 0.5);
      border-radius: 16px;
      padding: 24px;
      margin: 24px 0;
    }
    .amount {
      font-size: 36px;
      font-weight: 700;
      color: #22c55e;
    }
    .info-box {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: left;
    }
    .info-item { 
      display: flex; 
      justify-content: space-between;
      margin: 12px 0; 
      color: #d1d5db; 
      font-size: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .info-item:last-child { border-bottom: none; }
    .info-label { color: #9ca3af; }
    .info-value { color: #ffffff; font-weight: 500; }
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
      .amount { font-size: 28px; }
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
      
      <h1 class="title">¡Pago confirmado!</h1>
      <p class="subtitle">
        Hola <span class="highlight">${nombre}</span>, tu suscripción está activa.
      </p>
      
      <div class="amount-box">
        <div class="amount">${montoFormateado}</div>
        <p style="color: #86efac; margin-top: 8px;">Pago recibido correctamente</p>
      </div>
      
      <div class="info-box">
        <div class="info-item">
          <span class="info-label">🏟️ Sede</span>
          <span class="info-value">${sedeNombre}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📋 Plan</span>
          <span class="info-value">${planNombre}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📅 Fecha de pago</span>
          <span class="info-value">${fechaPago}</span>
        </div>
        <div class="info-item">
          <span class="info-label">🗓️ Válido hasta</span>
          <span class="info-value">${fechaVencimiento}</span>
        </div>
      </div>
      
      <a href="https://www.fairpadel.com/mis-sedes" class="button">Ver mi suscripción</a>
      
      <div class="divider"></div>
      
      <div class="footer">
        <p>¿Tenés dudas sobre tu suscripción?</p>
        <p style="margin-top: 8px;">Contactanos en soporte@fairpadel.com</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

export function pagoCanceladoTemplate(
    nombre: string,
    sedeNombre: string,
    planNombre: string,
    monto: number,
    moneda: string,
    motivo?: string,
  ): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    const montoFormateado = new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: moneda,
    }).format(monto);
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago Cancelado - FairPadel</title>
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
    .cancel-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    .highlight { color: #ef4444; font-weight: 600; }
    .info-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: left;
    }
    .info-item { 
      display: flex; 
      justify-content: space-between;
      margin: 12px 0; 
      color: #d1d5db; 
      font-size: 15px;
    }
    .info-label { color: #9ca3af; }
    .info-value { color: #ffffff; font-weight: 500; }
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
    .footer {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #232838;
      color: #6b7280;
      font-size: 13px;
    }
    .motivo {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
      color: #fca5a5;
      font-size: 14px;
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
      
      <div class="cancel-icon">❌</div>
      
      <h1 class="title">Pago cancelado</h1>
      <p class="subtitle">
        Hola <span class="highlight">${nombre}</span>, tu transacción fue cancelada.
      </p>
      
      <div class="info-box">
        <div class="info-item">
          <span class="info-label">🏟️ Sede</span>
          <span class="info-value">${sedeNombre}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📋 Plan</span>
          <span class="info-value">${planNombre}</span>
        </div>
        <div class="info-item">
          <span class="info-label">💰 Monto</span>
          <span class="info-value">${montoFormateado}</span>
        </div>
        ${motivo ? `<div class="motivo"><strong>Motivo:</strong> ${motivo}</div>` : ''}
      </div>
      
      <p style="color: #d1d5db; margin: 24px 0;">
        No se realizó ningún cargo a tu tarjeta.
      </p>
      
      <a href="https://www.fairpadel.com/mis-sedes" class="button">Intentar nuevamente</a>
      
      <div class="divider"></div>
      
      <div class="footer">
        <p>¿Necesitás ayuda?</p>
        <p style="margin-top: 8px;">Contactanos en soporte@fairpadel.com</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

export function pagoErrorTemplate(
    nombre: string,
    sedeNombre: string,
    planNombre: string,
    monto: number,
    moneda: string,
    mensajeError?: string,
  ): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    const montoFormateado = new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: moneda,
    }).format(monto);
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error en el Pago - FairPadel</title>
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
    .error-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    .highlight { color: #f59e0b; font-weight: 600; }
    .info-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: left;
    }
    .info-item { 
      display: flex; 
      justify-content: space-between;
      margin: 12px 0; 
      color: #d1d5db; 
      font-size: 15px;
    }
    .info-label { color: #9ca3af; }
    .info-value { color: #ffffff; font-weight: 500; }
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
    .footer {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid #232838;
      color: #6b7280;
      font-size: 13px;
    }
    .error-msg {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 16px;
      margin-top: 16px;
      color: #fcd34d;
      font-size: 14px;
    }
    .tips {
      text-align: left;
      margin: 24px 0;
      padding: 0 16px;
    }
    .tip {
      display: flex;
      align-items: center;
      margin: 12px 0;
      color: #d1d5db;
      font-size: 14px;
    }
    .tip-icon {
      margin-right: 12px;
      color: #f59e0b;
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
      
      <div class="error-icon">⚠️</div>
      
      <h1 class="title">Error en el pago</h1>
      <p class="subtitle">
        Hola <span class="highlight">${nombre}</span>, hubo un problema procesando tu pago.
      </p>
      
      <div class="info-box">
        <div class="info-item">
          <span class="info-label">🏟️ Sede</span>
          <span class="info-value">${sedeNombre}</span>
        </div>
        <div class="info-item">
          <span class="info-label">📋 Plan</span>
          <span class="info-value">${planNombre}</span>
        </div>
        <div class="info-item">
          <span class="info-label">💰 Monto</span>
          <span class="info-value">${montoFormateado}</span>
        </div>
        ${mensajeError ? `<div class="error-msg"><strong>Error:</strong> ${mensajeError}</div>` : ''}
      </div>
      
      <div class="tips">
        <div class="tip">
          <span class="tip-icon">💡</span>
          <span>Verificá que tu tarjeta tenga fondos suficientes</span>
        </div>
        <div class="tip">
          <span class="tip-icon">💡</span>
          <span>Revisá que los datos de la tarjeta sean correctos</span>
        </div>
        <div class="tip">
          <span class="tip-icon">💡</span>
          <span>Contactá a tu banco si el problema persiste</span>
        </div>
      </div>
      
      <a href="https://www.fairpadel.com/mis-sedes" class="button">Intentar nuevamente</a>
      
      <div class="divider"></div>
      
      <div class="footer">
        <p>¿Necesitás ayuda?</p>
        <p style="margin-top: 8px;">Contactanos en soporte@fairpadel.com</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

export function suscripcionCanceladaTemplate(
    nombre: string,
    sedeNombre: string,
    diasRestantes: number,
    fechaVencimiento?: string,
  ): string {
    const logoUrl = 'https://res.cloudinary.com/dncjaaybv/image/upload/v1773057029/logo_h4y1tl.png';
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Suscripción Cancelada - FairPadel</title>
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
    .cancel-icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    .highlight { color: #ef4444; font-weight: 600; }
    .info-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      text-align: left;
    }
    .info-item { 
      display: flex; 
      justify-content: space-between;
      margin: 12px 0; 
      color: #d1d5db; 
      font-size: 15px;
    }
    .info-label { color: #9ca3af; }
    .info-value { color: #ffffff; font-weight: 500; }
    .notice-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      color: #fbbf24;
      font-size: 14px;
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
      
      <div class="cancel-icon">❌</div>
      
      <h1 class="title">Suscripción cancelada</h1>
      <p class="subtitle">
        Hola <span class="highlight">${nombre}</span>, tu suscripción ha sido cancelada.
      </p>
      
      <div class="info-box">
        <div class="info-item">
          <span class="info-label">🏟️ Sede</span>
          <span class="info-value">${sedeNombre}</span>
        </div>
        ${fechaVencimiento ? `
        <div class="info-item">
          <span class="info-label">📅 Vencimiento original</span>
          <span class="info-value">${fechaVencimiento}</span>
        </div>
        ` : ''}
        <div class="info-item">
          <span class="info-label">⏳ Días restantes</span>
          <span class="info-value">${diasRestantes} días</span>
        </div>
      </div>
      
      <div class="notice-box">
        <strong>⚠️ Importante:</strong><br>
        Podés seguir usando el sistema de alquileres hasta el vencimiento original de tu suscripción.
        Pasado ese período, los alquileres serán deshabilitados automáticamente.
      </div>
      
      <p style="color: #d1d5db; margin: 24px 0;">
        ¿Te arrepentiste? Podés reactivar tu suscripción en cualquier momento.
      </p>
      
      <a href="https://www.fairpadel.com/mis-sedes" class="button">Reactivar suscripción</a>
      
      <div class="divider"></div>
      
      <div class="footer">
        <p>Si no solicitaste esta cancelación, contactanos inmediatamente.</p>
        <p style="margin-top: 8px;">soporte@fairpadel.com</p>
        <p style="margin-top: 16px;">© 2026 FairPadel. Todos los derechos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

