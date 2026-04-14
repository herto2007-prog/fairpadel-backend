# Cloudflare Redirect: fairpadel.com → www.fairpadel.com

## Objetivo
Unificar el dominio canónico para SEO y resolver los problemas de indexación duplicada en Google Search Console.

## Método recomendado: Single Redirect Rule (Cloudflare)

1. Ir al dashboard de Cloudflare → seleccionar la zona `fairpadel.com`.
2. Navegar a **Rules** → **Redirect Rules**.
3. Click en **Create rule**.
4. Configurar:

### When incoming requests match:
```
(http.host eq "fairpadel.com")
```

### Then:
- Type: `Dynamic`
- Expression: `concat("https://www.fairpadel.com", http.request.uri.path, http.request.uri.query)`
- Status code: `301`

### Alternativa con Static:
- URL: `https://www.fairpadel.com${http.request.uri.path}${http.request.uri.query}`
- Status code: `301`

5. Guardar y desplegar.

## Método alternativo: Page Rule (Legacy)

1. Ir a **Rules** → **Page Rules**.
2. Click en **Create Page Rule**.
3. URL: `fairpadel.com/*`
4. Setting: **Forwarding URL**
5. Select status code: **301 - Permanent Redirect**
6. Destination URL: `https://www.fairpadel.com/$1`
7. Guardar y desplegar.

## Verificación

Una vez aplicado, probar con:
```bash
curl -I http://fairpadel.com/torneos
curl -I https://fairpadel.com/torneos
```

Debe retornar:
```
HTTP/2 301
location: https://www.fairpadel.com/torneos
```

## Pasos posteriores en Google Search Console

1. Acceder a https://search.google.com/search-console
2. Para la propiedad `www.fairpadel.com`:
   - Ir a **Sitemaps**
   - Eliminar el sitemap anterior si existe
   - Agregar: `https://www.fairpadel.com/sitemap.xml`
3. Para la propiedad `fairpadel.com` (sin www):
   - Ir a **Configuración** → **Cambio de dirección**
   - Indicar que el sitio se movió a `www.fairpadel.com`
   - O simplemente dejar de enviar sitemaps aquí y esperar a que Google consolide

## Nota sobre el sitemap

El `sitemap.xml` ya fue actualizado para usar únicamente `https://www.fairpadel.com` como dominio canónico. Todas las páginas privadas (login, register, dashboard, admin, perfil, etc.) ahora incluyen la meta etiqueta `noindex, nofollow` dinámica.
