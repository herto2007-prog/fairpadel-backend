# Guía de Activación: Algoritmo de Descanso V2

## Resumen

Nuevo algoritmo de cálculo de descansos entre partidos/fases.

**Lógica:** `Hora último partido + 4h = Hora mínima para siguiente`

**Ejemplo:** 22:30 + 4h = 02:30 (día siguiente) → Buscar primer slot >= 02:30

---

## Variables de Entorno

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `FEATURE_DESCANSO_V2` | `true` / `false` | Activa el nuevo algoritmo |
| `FEATURE_DESCANSO_V2_TORNEO_ID` | `abc-123` | ID de torneo específico para prueba |

---

## Fases de Activación

### Fase 1: Desarrollo (Local)

```bash
# En .env
FEATURE_DESCANSO_V2=true
```

Probar el endpoint de comparación:

```bash
POST /admin/canchas-sorteo/test-descanso
{
  "ultimoPartidoFecha": "2024-03-17",
  "ultimoPartidoHoraFin": "22:30",
  "faseOrigen": "ZONA",
  "faseDestino": "SEMIS"
}
```

**Respuesta esperada:**
```json
{
  "legacy": { "horaMinima": "00:00", "cambioDia": true },
  "nuevo": { "horaMinima": "02:30", "fechaDestino": "2024-03-18", "cambioDia": true },
  "comparacion": { "horasDiferentes": true, "recomendacion": "..." }
}
```

### Fase 2: Prueba en Torneo Específico

```bash
# En producción, solo para un torneo de prueba
FEATURE_DESCANSO_V2=true
FEATURE_DESCANSO_V2_TORNEO_ID=abc-123-def
```

Verificar estado:
```bash
GET /admin/canchas-sorteo/features?tournamentId=abc-123-def
```

**Monitorear logs:**
```
[DescansoV2] 2024-03-17 22:30 + 240min = 2024-03-18 02:30
[DescansoCompare] Cat A | ZONA→SEMIS | Legacy: 02:30 | Nuevo: 02:30 | CambioDía: true
```

### Fase 3: Activación Completa

```bash
# En producción, para todos los torneos
FEATURE_DESCANSO_V2=true
# FEATURE_DESCANSO_V2_TORNEO_ID= (vacío)
```

### Rollback (Si hay problemas)

```bash
# Desactivar inmediatamente
FEATURE_DESCANSO_V2=false
```

No requiere redeploy, solo reiniciar el servicio.

---

## Checklist de Validación

### Antes de activar en producción:

- [ ] Tests unitarios pasan: `npm test -- descanso-calculator`
- [ ] Endpoint de test funciona correctamente
- [ ] Logs muestran comparación legacy vs nuevo
- [ ] No hay errores en el sorteo con el nuevo algoritmo
- [ ] Los horarios generados son los esperados

### Después de activar:

- [ ] Monitorear logs por 24-48h
- [ ] Verificar que los partidos tienen descansos correctos
- [ ] Confirmar con organizadores que todo funciona bien

---

## Solución de Problemas

### El nuevo algoritmo no se activa

1. Verificar variables de entorno:
   ```bash
   GET /admin/canchas-sorteo/features
   ```

2. Verificar que el módulo `ProgramacionModule` esté importado en `BracketModule`

3. Verificar que `DescansoCalculatorService` esté inyectado

### Resultados inesperados

1. Usar el endpoint de test para comparar legacy vs nuevo
2. Revisar logs: `[DescansoCompare]` y `[DescansoV2]`
3. Reportar el caso específico con input/output

---

## Contacto

Para problemas o dudas, revisar los logs del sistema o contactar al equipo de desarrollo.
