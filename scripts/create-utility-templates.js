/**
 * Script para crear plantillas UTILITY puras sin emojis
 */

const BUSINESS_ACCOUNT_ID = '1988477522064103';
const ACCESS_TOKEN = 'EAANQSlLypO8BROhI5OTiV92MSMCZAgilHHLob6mzw0OnUWiU9o3bcEXudze5dpC39qDrDw9pdCYe7yrIBxOfbZA5RGaSa4K4gDxxDzkBBxMlxqZAr8qv0WfQdPRFbLfJvlqk4EWTkvtKCF6TClcZCBnGIMXkCTN5MuBL1469NvSXvglBPtKy5MHu8FOtRgZDZD';
const API_VERSION = 'v21.0';

const templates = [
  {
    name: 'confirmacion_consentimiento',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: 'Para activar notificaciones de FairPadel, responde SI. Responde NO para cancelar.',
      example: { body_text: [['']] }
    }]
  },
  {
    name: 'consentimiento_activado',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: 'Confirmamos tu suscripcion a notificaciones de FairPadel. Recibiras alertas sobre tus reservas.',
      example: { body_text: [['']] }
    }]
  },
  {
    name: 'despedida_consentimiento',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: 'Has cancelado las notificaciones. Para reactivar, accede a tu perfil en fairpadel.com',
      example: { body_text: [['']] }
    }]
  },
  {
    name: 'confirmacion_reserva',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: 'Confirmamos tu reserva:\nSede: {{1}}\nCancha: {{2}}\nFecha: {{3}}\nHora: {{4}}',
      example: { body_text: [['Sede Central', 'Cancha 1', '15/01/2026', '18:00']] }
    }]
  },
  {
    name: 'recordatorio_reserva_24h',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: 'Recordatorio de tu reserva para manana:\nSede: {{1}}\nCancha: {{2}}\nFecha: {{3}}\nHora: {{4}}',
      example: { body_text: [['Sede Central', 'Cancha 1', '15/01/2026', '18:00']] }
    }]
  },
  {
    name: 'recordatorio_reserva_4h',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: 'Recordatorio de tu reserva:\nSede: {{1}}\nCancha: {{2}}\nFecha: {{3}}\nHora: {{4}}\nLlega 15 minutos antes.',
      example: { body_text: [['Sede Central', 'Cancha 1', '15/01/2026', '18:00']] }
    }]
  },
  {
    name: 'confirmacion_inscripcion_torneo',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: 'Confirmamos tu inscripcion en {{1}}:\nCategoria: {{2}}\nPareja: {{3}}',
      example: { body_text: [['Torneo Verano 2026', '3ra Masculina', 'Pedro Gomez']] }
    }]
  },
  {
    name: 'recordatorio_primer_partido',
    category: 'UTILITY',
    language: 'es',
    components: [{
      type: 'BODY',
      text: 'Recordatorio de tu partido:\nTorneo: {{1}}\nFecha: {{2}}\nHora: {{3}}\nRival: {{4}}',
      example: { body_text: [['Torneo Verano 2026', '20/01/2026', '19:00', 'Martinez-Lopez']] }
    }]
  }
];

async function createTemplate(template, delay) {
  await new Promise(r => setTimeout(r, delay));
  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${BUSINESS_ACCOUNT_ID}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template),
      }
    );
    const data = await res.json();
    if (data.id) {
      console.log(`✅ ${template.name}: ${data.id}`);
      return { success: true, name: template.name, id: data.id };
    } else {
      console.log(`❌ ${template.name}: ${data.error?.message}`);
      return { success: false, name: template.name, error: data.error?.message };
    }
  } catch (e) {
    console.log(`❌ ${template.name}: ${e.message}`);
    return { success: false, name: template.name, error: e.message };
  }
}

async function main() {
  console.log('Creando plantillas UTILITY sin emojis...\n');
  const results = [];
  for (let i = 0; i < templates.length; i++) {
    const result = await createTemplate(templates[i], i * 1000);
    results.push(result);
  }
  
  console.log('\n📊 RESUMEN:');
  const ok = results.filter(r => r.success);
  const fail = results.filter(r => !r.success);
  console.log(`✅ Exitosas: ${ok.length}`);
  console.log(`❌ Fallidas: ${fail.length}`);
  if (fail.length > 0) {
    fail.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }
}

main();
