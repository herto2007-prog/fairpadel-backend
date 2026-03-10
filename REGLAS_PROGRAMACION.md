# Reglas de Programación - FairPadel

> Documento de oro para desarrollo. Violaciones = bugs en producción.

---

## 1. Ley de Oro del Deploy

**"Probar localmente y si todo corre bien, ahí recién pushear"**

- Siempre ejecutar `npm run build` antes de pushear
- Verificar 0 errores de TypeScript
- Verificar 0 errores de ESLint
- Solo entonces: `git push`

❌ **NUNCA** pushear código sin compilar localmente primero.

---

## 2. Visión Sistémica vs. Apagar Incendios

**"Entender el sistema como un todo, no solamente apagar el incendio, ver más allá y prever todo"**

- No hacer fixes rápidos sin entender el impacto completo
- Analizar cómo el cambio afecta otras partes del sistema
- Pensar en la arquitectura a largo plazo
- Prever consecuencias antes de implementar

❌ **NUNCA** aplicar un parche sin entender por qué falla y qué más podría romper.

---

## 3. Regla del Negocio Primero

**"No apagues incendios, soluciona según la regla del negocio"**

- Cada solución debe alinearse con la lógica real de FairPadel
- Entender el dominio antes de codear (pádel, torneos, categorías PY, etc.)
- Cuando hay duda, preguntar cómo funciona en la realidad
- El código debe reflejar el negocio, no al revés

✅ **SIEMPRE** preguntar: "¿Así es como funciona en un torneo real de pádel en Paraguay?"

---

## 4. Validación Estricta Backend

- Usar `class-validator` con decoradores (`@IsString`, `@IsOptional`, `@IsEnum`, etc.)
- Enviar `undefined` en lugar de strings vacíos (`""`) para campos opcionales
- Configuración obligatoria del ValidationPipe:
  ```typescript
  whitelist: true,
  forbidNonWhitelisted: true,
  ```
- Los DTOs deben tener decoradores, no solo tipos TypeScript

❌ **NUNCA** enviar strings vacíos a campos opcionales de Prisma.

---

## 5. Protección de Datos

**La base de datos es sagrada.**

- **NUNCA** usar `--force-reset` en producción
- Usar `--accept-data-loss` solo cuando sea absolutamente necesario
- Schema changes con migraciones controladas
- Backup mental: cada deploy podría afectar datos reales

❌ **PROHIBIDO** en Dockerfile/CI/CD: `prisma db push --force-reset`

---

## 6. Formatos Locales Paraguay

- **Moneda**: Guaraníes (Gs.) con separador de miles (ej: `Gs. 1.500.000`)
- **Fechas**: Locale `'es-PY'` (dd/mm/yyyy)
- **Teléfono**: Código país + número sin 0 inicial (ej: `+595 981 123456`)
- **Ciudades**: Autocomplete con ciudades de Paraguay

✅ **SIEMPRE** usar componentes específicos: `GuaraniesInput`, `CityAutocomplete`, `PhoneSelector`.

---

## 7. UX/UI Consistente (Compacta)

- Páginas internas usan clase `compact-ui` (tamaños ~15% menores)
- Landing preservado con tamaños originales
- Feedback visual inmediato: estados de carga, mensajes de error/éxito
- Animaciones suaves con `framer-motion`

---

## 8. Arquitectura de Repositorios

**Estructura de repos separados:**

| Repo | URL | Tecnología | Deploy |
|------|-----|------------|--------|
| Backend | https://github.com/herto2007-prog/fairpadel-backend.git | NestJS + Prisma + PostgreSQL | Railway |
| Frontend | https://github.com/herto2007-prog/fairpadel-frontend.git | React 18 + Vite + Tailwind | Railway/Vercel |

**Convenciones:**
- Commits descriptivos en español
- Commits atómicos (un cambio lógico por commit)
- Backend primero, luego frontend (cuando hay dependencias)

---

## 9. Actitud de Kimi en FairPadel

### Mentalidad
- **Siempre ver el sistema como un todo** (arquitectura, no solo features)
- **Sugerir mejoras constantemente** (proactividad, no solo obedecer)
- **Pensar en escalabilidad y mantenibilidad**

### Comunicación
- **Cuando hay dudas, preguntar** (mejor preguntar que asumir mal)
- **Preguntas cortas y por turnos** (no 10 preguntas de una vez)
- **Un tema a la vez** (terminar uno antes de empezar otro)

### Calidad
- **No entregar código que "funciona" pero está mal** (deuda técnica)
- **Refactorizar cuando sea necesario**, no solo agregar código nuevo
- **Documentar decisiones importantes** (por qué se hizo así)

---

## Checklist Pre-Push

```bash
# Backend
npm run build          # Debe pasar sin errores
npm run lint           # Debe pasar sin errores
npm run test           # Debe pasar (si hay tests)

# Frontend
npm run build          # Debe pasar sin errores
npm run lint           # Debe pasar sin errores
```

✅ Todo verde → `git add . && git commit -m "mensaje" && git push`

---

## Violaciones Conocidas (Aprendizajes)

| Fecha | Error | Consecuencia | Solución |
|-------|-------|--------------|----------|
| Mar 2025 | Push sin build | Backend crash en Railway | Implementar Regla #1 |
| Mar 2025 | DTOs sin decoradores | 400 Bad Request en endpoints | Implementar Regla #4 |
| Mar 2025 | `--force-reset` en Dockerfile | Pérdida de datos | Implementar Regla #5 |

---

## 10. Separación de Responsabilidades (Kimi vs Usuario)

**"El usuario (dueño) NUNCA realiza acciones directas en la base de datos"**

- Toda interacción con datos debe ser a través de la API/UI
- No ejecutar `prisma studio`, SQL directo, ni migraciones manuales en producción
- Kimi gestiona migraciones, seeds y cambios de schema
- El usuario gestiona configuración a través del panel admin

❌ **PROHIBIDO para usuario:** Acceso directo a BD, modificaciones manuales de tablas.
✅ **PERMITIDO para usuario:** Configuración vía `/fairpadel/admin`, dashboards, reportes.

---

*Última actualización: Marzo 2025*
*Responsable: Kimi Code CLI + Equipo FairPadel*
