# WhatsApp Business API - Documentación Técnica

> Fecha: Abril 2026  
> Estado: En evaluación para implementación en FairPadel

---

## 1. Resumen General

La **Plataforma de WhatsApp Business** permite a las empresas comunicarse con clientes a gran escala mediante la API de la nube de WhatsApp.

### Ventajas principales:
- Mensajes seguros con cifrado Signal
- Hasta 80 mensajes por segundo (escalable)
- Webhooks para recibir respuestas y estados
- Plantillas de mensajes pre-aprobadas
- No requiere número de teléfono físico (puede ser virtual)

---

## 2. APIs Disponibles

### 2.1 API de la Nube de WhatsApp (Principal)
**Uso:** Enviar mensajes y recibir respuestas

**Funcionalidades:**
- ✅ Mensajes de texto simples
- ✅ Medios enriquecidos (imágenes, videos, documentos)
- ✅ Mensajes interactivos (botones, listas)
- ✅ Llamadas (hacer y recibir)
- ✅ Grupos (crear, administrar, enviar)

**Endpoint base:**
```
https://graph.facebook.com/v17.0/{PHONE_NUMBER_ID}/messages
```

**Ejemplo de envío (cURL):**
```bash
curl 'https://graph.facebook.com/v17.0/106540352242922/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {ACCESS_TOKEN}' \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "+595981123456",
    "type": "text",
    "text": {
      "preview_url": true,
      "body": "¡Hola! Tu reserva está confirmada."
    }
  }'
```

### 2.2 API de Administración Comercial
**Uso:** Gestionar la cuenta y sus recursos

**Funcionalidades:**
- Administrar números de teléfono comerciales
- Crear y modificar plantillas de mensajes
- Ver estadísticas (mensajes enviados, entregados, leídos)
- Análisis de precios

### 2.3 API de Mensajes de Marketing
**Uso:** Enviar mensajes de marketing optimizados

**Ventajas:**
- Hasta 9% más de entrega que la API estándar
- Optimización automática de contenido
- Métricas de conversión (agregar al carrito, compras, etc.)

---

## 3. Conceptos Clave

### 3.1 Portfolio Comercial
- **Qué es:** Contenedor de todas las cuentas de WhatsApp Business
- **Requisito:** Obligatorio para usar la plataforma
- **Verificación:** Determina límites de volumen y estado "Cuenta de Empresa Oficial"

### 3.2 Cuenta de WhatsApp Business (WABA)
- **Qué es:** Representa a tu empresa en la plataforma
- **Almacena:** Metadatos, números de teléfono, plantillas, estadísticas

### 3.3 Números de Teléfono Comerciales
- **Tipos:** Reales o virtuales
- **Función:** Enviar y recibir mensajes
- **Características:** Pueden tener nombre visible y estado de "Empresa Oficial"

### 3.4 Plantillas de Mensajes
- **Qué son:** Mensajes personalizables pre-construidos
- **Requisito:** Requieren aprobación de Meta antes de usar
- **Uso:** Único tipo de mensaje permitido fuera del horario de atención (24h)
- **Calidad:** Tienen puntuación de calidad que afecta los límites

---

## 4. Requisitos Técnicos

### 4.1 Autenticación
- **Método:** OAuth 2.0 (Tokens de acceso)
- **Header requerido:** `Authorization: Bearer {ACCESS_TOKEN}`

### 4.2 Webhooks (Crítico)
**Función:** Recibir eventos de WhatsApp en nuestro servidor

**Eventos importantes:**
- Mensajes entrantes de usuarios
- Actualizaciones de estado de entrega (enviado, entregado, leído)
- Errores asíncronos

**Configuración:**
```
URL del webhook: https://api.fairpadel.com/webhooks/whatsapp
```

### 4.3 Formato de Respuestas
Todas las respuestas son JSON:
```json
{
  "verified_name": "FairPadel",
  "display_phone_number": "+595981123456",
  "quality_rating": "GREEN",
  "id": "106540352242922"
}
```

---

## 5. Límites y Restricciones

### 5.1 Límites de Frecuencia

| Recurso | Límite por defecto | Con WABA verificada |
|---------|-------------------|---------------------|
| Solicitudes API | 200/hora | 5,000/hora |
| Mensajes por segundo | 80 msg/s | Escalable |
| Mensajes a mismo usuario | 1 cada 6 segundos | - |
| Ráfaga permitida | 45 mensajes en 6s | Con "préstamo" de cuota |

### 5.2 Límites de Mensajes (Prueba vs Producción)

| Estado WABA | Límite mensajes | Requiere pago |
|-------------|----------------|---------------|
| No verificada (prueba) | ~250 mensajes/día | No |
| Verificada | Según tier | Sí |

### 5.3 Ventana de Servicio (24 horas)
- **Regla:** Solo se pueden enviar mensajes de sesión dentro de las 24h después del último mensaje del usuario
- **Excepción:** Mensajes de plantilla (requieren aprobación previa)

---

## 6. Políticas Importantes

### 6.1 Consentimiento Explícito del Usuario ⚠️ CRÍTICO
**Obligatorio:** Se debe obtener consentimiento ANTES de enviar mensajes de plantilla.

**Requisitos del consentimiento:**
- Debe aclarar el nombre de la empresa (FairPadel)
- Debe especificar la intención (ej: "recibir notificaciones de reservas")
- Debe ser explícito (no implícito)

**Ejemplo de consentimiento válido:**
```
"Al proporcionar tu número de WhatsApp, aceptas recibir notificaciones 
de FairPadel sobre tus reservas de canchas, torneos y partidos programados."
```

### 6.2 Tipos de Mensajes Permitidos

| Tipo | Requiere plantilla | Restricciones |
|------|-------------------|---------------|
| Respuesta a usuario | No | Dentro de 24h |
| Notificación proactiva | Sí | Requiere aprobación |
| Marketing | Sí | Requiere consentimiento explícito |

---

## 7. Recursos de Prueba

### 7.1 Entorno de Sandbox
Al registrarse, Meta crea automáticamente:
- 1 WABA de prueba
- 1 número de teléfono de prueba
- Límites reducidos pero sin necesidad de método de pago

### 7.2 Herramientas Útiles
- **API Playground:** Entorno de prueba integrado en la documentación
- **Postman:** Colección oficial disponible
- **Administrador de WhatsApp:** App web para gestionar recursos

---

## 8. Modelo de Precios (Información General)

**Nota:** Meta cobra por conversación, no por mensaje individual.

**Tipos de conversaciones:**
1. **Conversaciones de negocio iniciadas:** Empresa envía primer mensaje
2. **Conversaciones de usuario iniciadas:** Usuario envía primer mensaje (más barato)

**Precios aproximados (verificar en Meta):**
- Argentina/Brasil/Paraguay: ~US$0.05-0.08 por conversación
- Las conversaciones duran 24 horas

---

## 9. Próximos Pasos para Implementación

### Paso 1: Preparación Legal ✅
- [x] **Documentar requisitos de consentimiento** (ver sección 6.2)
- [ ] Definir método de obtención de consentimiento (web, SMS, papel)
- [ ] Diseñar flujo de consentimiento en el registro/perfil
- [ ] Crear política de privacidad actualizada con WhatsApp
- [ ] Definir categorías de mensajes y consentimientos por separado

### Paso 2: Configuración en Meta
- [ ] Crear portfolio comercial
- [ ] Crear cuenta de WhatsApp Business (WABA)
- [ ] Verificar cuenta de empresa (opcional pero recomendado)

### Paso 3: Configuración Técnica
- [ ] Configurar número de teléfono comercial
- [ ] Crear plantillas de mensajes necesarias
- [ ] Configurar webhook para recibir eventos
- [ ] Solicitar aprobación de plantillas

### Paso 4: Desarrollo
- [ ] Crear módulo de WhatsApp en backend
- [ ] Implementar envío de mensajes
- [ ] Manejar webhooks de estado
- [ ] Integrar con sistema de notificaciones existente

### Paso 5: Testing
- [ ] Probar en ambiente de sandbox
- [ ] Verificar entrega de mensajes
- [ ] Validar manejo de webhooks

---

## 6.2 Consentimiento Explícito del Usuario - Requisitos Detallados ⚠️ CRÍTICO

**Actualizado:** Noviembre 2024 (Política de mensajes de WhatsApp Business)

### Requisitos obligatorios:

1. **Aceptación clara:** La persona debe aceptar explícitamente recibir mensajes de comunicación de la empresa
2. **Identificación de la empresa:** Debe manifestarse con claridad el nombre de la empresa (FairPadel)
3. **Cumplimiento legal:** Debe cumplir con todas las leyes locales aplicables

### Condiciones para contactar por WhatsApp:

Se puede contactar a una persona por WhatsApp si:
- ✅ Dió su número de teléfono celular
- ✅ Se obtuvo el permiso de aceptación para recibir mensajes o llamadas posteriores

### Métodos de aceptación válidos:

| Método | Descripción | Ejemplo para FairPadel |
|--------|-------------|------------------------|
| **SMS** | Mensaje de texto con confirmación | Usuario recibe SMS y responde "SI" |
| **Sitio web** | Checkbox en formulario web | Checkbox al registrar: "Acepto recibir notificaciones por WhatsApp" |
| **Teléfono (IVR)** | Sistema de respuesta interactiva | Llamada automática pidiendo confirmación |
| **En persona** | Formulario físico firmado | Contrato en sede firmado por el cliente |

### Mejores prácticas recomendadas:

#### 1. Consentimiento por categoría
- **Opción A (Simple):** Un consentimiento general para todas las notificaciones
- **Opción B (Detallado):** Consentimientos independientes por categoría:
  - ✅ Actualizaciones de pedidos/reservas
  - ✅ Ofertas y promociones  
  - ✅ Recordatorios de partidos
  - ✅ Recomendaciones de torneos

#### 2. Transparencia para el usuario
- Comunicar claramente el valor de recibir los mensajes
- Proporcionar instrucciones claras sobre cómo rechazar
- Respetar las solicitudes de baja inmediatamente

#### 3. Mantenimiento de calidad
- Supervisar la calificación de calidad de los mensajes
- Si la calidad es baja, Meta limitará la frecuencia
- Los usuarios pueden bloquear o denunciar a la empresa

### Ejemplo de texto de consentimiento válido:

```
"Al proporcionar tu número de teléfono, aceptas recibir mensajes de 
FairPadel por WhatsApp sobre:
• Confirmaciones de tus reservas de canchas
• Recordatorios de partidos programados  
• Información sobre torneos en los que te inscribas

Puedes cancelar estos mensajes en cualquier momento respondiendo 
'DAR DE BAJA' o desde tu perfil de usuario."
```

---

## 10. Preguntas Clave para Definir

Antes de proceder con la implementación, debemos responder:

1. **¿Qué tipo de notificaciones enviaremos por WhatsApp?**
   - Confirmaciones de reserva
   - Recordatorios de partidos
   - Invitaciones a torneos
   - Notificaciones de sistema

2. **¿Cómo obtendremos el consentimiento del usuario?**
   - Checkbox al registrarse
   - Configuración en perfil
   - Mensaje de bienvenida

3. **¿WhatsApp reemplazará a email o será opcional?**
   - Primario vs Secundario
   - Opción de preferencia del usuario

4. **¿Usaremos número de FairPadel o cada sede tendrá el suyo?**

5. **¿Presupuesto estimado?**
   - Basado en volumen de mensajes mensual

---

## Referencias

- Documentación oficial: https://developers.facebook.com/docs/whatsapp
- Política de mensajes: https://business.whatsapp.com/policy
- Panel de administración: https://business.facebook.com/whatsapp

---

**Documento creado por:** Kimi Code Assistant  
**Fecha de creación:** Abril 2026  
**Estado:** Pendiente de revisión y aprobación
