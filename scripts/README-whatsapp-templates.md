# WhatsApp Template Manager

Script para gestionar templates de WhatsApp Business API siguiendo las reglas Meta 2026.

## Características

- ✅ Lista todos los templates existentes
- ✅ Elimina templates antiguos automáticamente
- ✅ Crea 11 nuevos templates con formato compliant Meta 2026
- ✅ Máximo 2 variables por template (ratio válido)
- ✅ Categorías correctas: UTILITY (10) + MARKETING (1)
- ✅ Ejemplos en formato JSON requerido por Meta API

## Uso

### 1. Configurar variables de entorno

Asegúrate de tener en tu `.env`:

```env
WHATSAPP_ACCESS_TOKEN=tu_token_aqui
WHATSAPP_BUSINESS_ACCOUNT_ID=1988477522064103
```

### 2. Ejecutar el script

```bash
# Opción 1: Via npm script
npm run whatsapp:templates

# Opción 2: Directo con ts-node
npx ts-node scripts/whatsapp-template-manager.ts

# Opción 3: Con node (compilado)
npx tsc scripts/whatsapp-template-manager.ts --outDir dist-scripts --esModuleInterop
node dist-scripts/whatsapp-template-manager.js
```

## Flujo del Script

```
1. LISTAR → Muestra todos los templates actuales
2. ELIMINAR → Borra templates antiguos (excepto los nuevos si ya existen)
3. CREAR → Crea los 11 templates uno por uno (con delays para no saturar API)
```

## Templates que se crearán

| # | Nombre | Categoría | Variables | Descripción |
|---|--------|-----------|-----------|-------------|
| 1 | `fairpadel_consent_solicitud` | MARKETING | 0 | Solicitud inicial de opt-in |
| 2 | `fairpadel_consent_confirmado` | UTILITY | 0 | Confirmación de opt-in |
| 3 | `fairpadel_consent_cancelado` | UTILITY | 0 | Cancelación de opt-in |
| 4 | `fairpadel_torneo_pareja` | UTILITY | 2 | Pareja asignada en torneo |
| 5 | `fairpadel_torneo_rival` | UTILITY | 2 | Rival asignado |
| 6 | `fairpadel_reserva_ok` | UTILITY | 2 | Confirmación de reserva |
| 7 | `fairpadel_reserva_sede` | UTILITY | 1 | Info de sede |
| 8 | `fairpadel_recordatorio_24h` | UTILITY | 2 | Recordatorio 24 horas |
| 9 | `fairpadel_recordatorio_4h` | UTILITY | 2 | Recordatorio 4 horas |
| 10 | `fairpadel_torneo_insc_ok` | UTILITY | 2 | Inscripción confirmada |
| 11 | `fairpadel_torneo_fecha` | UTILITY | 2 | Fecha de partido |

## Tiempos de Aprobación Esperados

| Categoría | Tiempo típico | Máximo |
|-----------|---------------|--------|
| UTILITY | 15 min - 2 horas | 24 horas |
| MARKETING | 1 - 24 horas | 48+ horas |

## Solución de Problemas

### Error: "Invalid token"
Verifica que tu `WHATSAPP_ACCESS_TOKEN` sea válido y no haya expirado.

### Error: "Rate limit exceeded"
El script ya incluye delays de 1 segundo entre creaciones. Si aún falla, espera 1 hora (límite: 100 templates/hora).

### Templates en PENDING por mucho tiempo
- UTILITY: Normal hasta 24h
- Si pasa más tiempo: contacta soporte de Meta
- Verifica en WhatsApp Manager el estado real

### Error: "Template already exists"
El script ignora silenciosamente los duplicados, pero si quieres recrear:
1. Ve a Meta Business Manager
2. Elimina manualmente el template
3. Vuelve a ejecutar el script

## Cambios vs Versión Anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Categorías | SISTEMA, TORNEO, RESERVA (inválidas) | Solo UTILITY/MARKETING |
| Variables | Hasta 4 por template | Máximo 2 por template |
| Ejemplos | String plano | JSON con body_text |
| URLs en body | Sí | No (prohibido en UTILITY) |
| Texto | "suscripcion", "alertas" | "mensajes", "datos" |

## Verificación Manual

Después de ejecutar, verifica en:
https://business.facebook.com/wa/manage/message-templates/

Estado esperado: `Pending` → `Active` (en minutos/horas)

## API Endpoints Usados

- **Listar**: `GET /{BUSINESS_ACCOUNT_ID}/message_templates`
- **Eliminar**: `DELETE /{TEMPLATE_ID}`
- **Crear**: `POST /{BUSINESS_ACCOUNT_ID}/message_templates`

Documentación: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
