# Plan de Implementación - Módulo WhatsApp

> **Estado:** Fase 1-2 COMPLETADAS (Base de datos + Backend core)  
> **Fecha:** Abril 2026  
> **Responsable:** FairPadel Dev Team

---

## 1. Resumen Ejecutivo

### Objetivo
Implementar notificaciones por WhatsApp Business API para FairPadel, con doble opt-in de consentimiento y funcionamiento como canal secundario (email primario).

### Alcance
- Registro de usuarios con consentimiento de WhatsApp
- Doble confirmación (checkbox + mensaje de validación)
- Envío de notificaciones: reservas, recordatorios, torneos, inscripciones
- Webhooks para recibir confirmaciones y respuestas

### Estado Actual
| Fase | Estado | Descripción |
|------|--------|-------------|
| Fase 1 | ✅ **COMPLETADA** | Esquema de base de datos |
| Fase 2 | ✅ **COMPLETADA** | Backend core (módulo NestJS) |
| Fase 3 | ⏳ **PENDIENTE** | Integración frontend (checkbox registro) |
| Fase 4 | ⏳ **PENDIENTE** | Configuración Meta + Templates |
| Fase 5 | ⏳ **PENDIENTE** | Testing y ajustes |

---

## 2. Arquitectura del Sistema

### 2.1 Flujo de Consentimiento (Doble Opt-in)

```
┌─────────────────────────────────────────────────────────────┐
│  REGISTRO DE USUARIO                                         │
│  1. Usuario completa formulario                              │
│  2. Marca checkbox: "Acepto recibir notificaciones por WA"   │
│  3. Guarda: consentCheckboxWhatsapp=true                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  POST-REGISTRO                                               │
│  4. Enviar mensaje de WhatsApp:                             │
│     "Hola [nombre], confirmá que querés recibir             │
│      notificaciones de FairPadel respondiendo SI"           │
│  5. Estado: consentWhatsappStatus=PENDIENTE                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  CONFIRMACIÓN POR USUARIO                                   │
│  6. Usuario responde "SI"                                   │
│  7. Webhook recibe respuesta                                │
│  8. Guarda: consentWhatsappStatus=CONFIRMADO                │
│  9. Ahora puede recibir notificaciones                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Feature Flag

El módulo está protegido por la variable de entorno `WHATSAPP_ENABLED`:

```
WHATSAPP_ENABLED=false  → Módulo en modo silencioso (logs pero no envía)
WHATSAPP_ENABLED=true   → Módulo activo (envía mensajes reales)
```

Esto permite desarrollo y testing sin credenciales de Meta.

---

## 3. Modelo de Datos

### 3.1 Modificaciones a Tabla `users`

```sql
-- Campos de consentimiento de WhatsApp
ALTER TABLE users ADD COLUMN consent_checkbox_whatsapp BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN consent_whatsapp_status VARCHAR(20); -- PENDIENTE, CONFIRMADO, RECHAZADO, REVOCADO
ALTER TABLE users ADD COLUMN consent_whatsapp_date TIMESTAMP;
ALTER TABLE users ADD COLUMN preferencia_notificacion VARCHAR(20) DEFAULT 'EMAIL'; -- EMAIL, WHATSAPP, AMBOS

-- NOTA: Usamos el campo existente `telefono` para WhatsApp
-- No se crea telefono_whatsapp separado
```

### 3.2 Tablas Nuevas

#### `whatsapp_conversations`
```sql
CREATE TABLE whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    wa_id VARCHAR(50) UNIQUE NOT NULL, -- Número de teléfono de WhatsApp
    estado VARCHAR(20) DEFAULT 'ACTIVA', -- ACTIVA, EXPIRADA, BLOQUEADA
    categoria VARCHAR(30) DEFAULT 'MARKETING', -- MARKETING, UTILITY, AUTHENTICATION, SERVICE
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP NOT NULL, -- 24h desde último mensaje del usuario
    ultimo_mensaje_at TIMESTAMP,
    metadata JSONB
);
```

#### `whatsapp_mensajes`
```sql
CREATE TABLE whatsapp_mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    wa_message_id VARCHAR(100) UNIQUE NOT NULL,
    direccion VARCHAR(20) NOT NULL, -- ENTRANTE, SALIENTE
    tipo VARCHAR(30) NOT NULL, -- TEXT, TEMPLATE, IMAGE, etc.
    contenido TEXT NOT NULL,
    template_name VARCHAR(100),
    estado VARCHAR(30) DEFAULT 'ENVIADO', -- ENVIADO, ENTREGADO, LEIDO, FALLIDO
    error_msg TEXT,
    error_code VARCHAR(50),
    categorizacion VARCHAR(30), -- MARKETING, UTILITY, etc.
    enviado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    entregado_at TIMESTAMP,
    leido_at TIMESTAMP
);
```

#### `whatsapp_templates`
```sql
CREATE TABLE whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    categoria VARCHAR(50) NOT NULL, -- SISTEMA, RESERVA, RECORDATORIO, TORNEO
    lenguaje VARCHAR(10) DEFAULT 'es',
    contenido TEXT NOT NULL,
    variables TEXT[], -- Ej: ['nombre', 'fecha', 'cancha']
    aprobado BOOLEAN DEFAULT false,
    wa_template_id VARCHAR(100),
    wa_template_name VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    descripcion TEXT,
    ejemplo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Estructura del Módulo

```
src/modules/whatsapp/
├── whatsapp.module.ts          # Módulo NestJS con feature flag
├── index.ts                     # Exports públicos
├── controllers/
│   ├── whatsapp.controller.ts   # API interna (protegida JWT)
│   └── whatsapp-webhook.controller.ts  # Webhook público (Meta)
├── services/
│   ├── whatsapp.service.ts              # API pública para otros módulos
│   ├── whatsapp-messaging.service.ts    # Envío de mensajes a Meta
│   ├── whatsapp-consent.service.ts      # Gestión de consentimiento
│   └── whatsapp-webhook.service.ts      # Procesamiento de webhooks
└── dto/
    ├── send-notification.dto.ts
    └── request-consent.dto.ts
```

---

## 5. Variables de Entorno

```bash
# Feature flag principal
WHATSAPP_ENABLED=false

# Credenciales de Meta (requeridas si WHATSAPP_ENABLED=true)
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id

# Configuración opcional
WHATSAPP_API_VERSION=v17.0
WHATSAPP_VERIFY_TOKEN=your-verify-token-here
WHATSAPP_WEBHOOK_SECRET=
```

---

## 6. API Endpoints

### Endpoints Internos (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/whatsapp/send-notification` | Enviar notificación a usuario |
| POST | `/whatsapp/request-consent` | Solicitar consentimiento |
| GET | `/whatsapp/consent-status/:userId` | Verificar estado de consentimiento |
| GET | `/whatsapp/status` | Verificar si WhatsApp está habilitado |

### Endpoints Públicos (Webhook)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/webhooks/whatsapp` | Verificación de webhook (Meta) |
| POST | `/webhooks/whatsapp` | Recepción de eventos (Meta) |

---

## 7. Templates Disponibles

| Template | Categoría | Variables |
|----------|-----------|-----------|
| `confirmacion_consentimiento` | SISTEMA | `nombre` |
| `bienvenida_consentimiento` | SISTEMA | `nombre` |
| `confirmacion_reserva` | RESERVA | `nombre`, `fecha`, `cancha`, `hora` |
| `recordatorio_reserva_24h` | RECORDATORIO | `fecha`, `cancha`, `hora` |
| `recordatorio_reserva_4h` | RECORDATORIO | `fecha`, `cancha`, `hora` |
| `inscripcion_torneo` | TORNEO | `nombre`, `torneo`, `categoria`, `pareja` |
| `fixture_publicado` | TORNEO | `torneo`, `fecha`, `hora`, `rival`, `link` |

---

## 8. Uso desde Otros Módulos

```typescript
import { WhatsAppService } from '../whatsapp/services/whatsapp.service';

@Injectable()
export class ReservasService {
  constructor(private whatsAppService: WhatsAppService) {}

  async confirmarReserva(reservaId: string) {
    // ... lógica de confirmación ...
    
    // Enviar notificación por WhatsApp
    await this.whatsAppService.sendNotification(
      userId,
      'confirmacion_reserva',
      {
        nombre: 'Juan',
        fecha: '15/01/2026',
        cancha: 'Cancha 1',
        hora: '18:00'
      }
    );
  }
}
```

---

## 9. Checklist Fase 3 (Frontend)

- [ ] Agregar checkbox de consentimiento en formulario de registro
- [ ] Crear página de preferencias de notificación en perfil
- [ ] Mostrar estado de confirmación de WhatsApp
- [ ] Permitir cambiar preferencia EMAIL/WhatsApp/AMBOS
- [ ] Opción para revocar consentimiento

---

## 10. Checklist Fase 4 (Meta)

- [ ] Crear Business Account en Meta
- [ ] Verificar número de teléfono
- [ ] Enviar templates para aprobación
- [ ] Configurar webhook en Meta Dashboard
- [ ] Obtener access token permanente
- [ ] Configurar variables de entorno en producción

---

## 11. Documentación Relacionada

- [WHATSAPP_BUSINESS_API.md](./WHATSAPP_BUSINESS_API.md) - Especificación completa de la API
- [Script SQL de Templates](../scripts/seed-whatsapp-templates.sql) - Seed de templates

---

## 12. Notas Importantes

1. **Modo Silencioso**: Con `WHATSAPP_ENABLED=false`, el módulo loguea pero no envía mensajes reales. Útil para desarrollo.

2. **Doble Opt-in**: El usuario debe marcar el checkbox Y confirmar respondiendo "SI" al mensaje.

3. **Canal Secundario**: WhatsApp es secundario. Siempre se envía email primero.

4. **24h Window**: Las conversaciones expiran después de 24h sin respuesta del usuario.

5. **Templates Aprobados**: Para iniciar conversaciones se requieren templates aprobados por Meta.

---

*Última actualización: Abril 2026*
