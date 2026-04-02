# Suscripción de Reservas para Dueños de Cancha

Agrega campos de suscripción a AlquilerConfig y tabla de pagos.

## Campos agregados a AlquilerConfig:
- suscripcion_activa (boolean)
- suscripcion_vence_en (date)
- suscripcion_stripe_id (string) - para Bancard ID
- tipo_suscripcion (MENSUAL, ANUAL)

## Tabla nueva: alquiler_pagos
Historial de pagos de suscripción por sede.
