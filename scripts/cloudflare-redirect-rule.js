#!/usr/bin/env node
/**
 * Script para crear una Single Redirect Rule en Cloudflare
 * que redirige fairpadel.com → www.fairpadel.com (301)
 *
 * Requiere variables de entorno:
 *   CLOUDFLARE_API_TOKEN - Token de API de Cloudflare (Edit zone settings)
 *   CLOUDFLARE_ZONE_ID   - Zone ID del dominio fairpadel.com
 *
 * Uso:
 *   node scripts/cloudflare-redirect-rule.js
 */

const https = require('https');

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;

if (!API_TOKEN || !ZONE_ID) {
  console.error('Error: Debes definir CLOUDFLARE_API_TOKEN y CLOUDFLARE_ZONE_ID');
  process.exit(1);
}

const RULE_NAME = 'Redirect non-www to www';

const payload = JSON.stringify({
  name: RULE_NAME,
  phase: 'http_request_dynamic_redirect',
  kind: 'zone',
  rules: [
    {
      action: 'redirect',
      action_parameters: {
        from_value: {
          status_code: 301,
          target_url: {
            expression: 'concat("https://www.fairpadel.com", http.request.uri.path, http.request.uri.query)'
          },
          preserve_query_string: true
        }
      },
      expression: '(http.host eq "fairpadel.com")',
      description: 'Redirect all traffic from fairpadel.com to www.fairpadel.com',
      enabled: true
    }
  ]
});

const options = {
  hostname: 'api.cloudflare.com',
  port: 443,
  path: `/client/v4/zones/${ZONE_ID}/rulesets`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.success) {
      console.log('✅ Redirect rule creada exitosamente:');
      console.log(JSON.stringify(json.result, null, 2));
    } else {
      console.error('❌ Error creando la regla:');
      console.error(JSON.stringify(json.errors, null, 2));
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
  process.exit(1);
});

req.write(payload);
req.end();
