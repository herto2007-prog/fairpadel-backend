/**
 * Script para crear plantillas de WhatsApp en Meta vía API
 * Uso: node scripts/create-whatsapp-templates.js
 */

const BUSINESS_ACCOUNT_ID = '1988477522064103';
const ACCESS_TOKEN = 'EAANQSlLypO8BROhI5OTiV92MSMCZAgilHHLob6mzw0OnUWiU9o3bcEXudze5dpC39qDrDw9pdCYe7yrIBxOfbZA5RGaSa4K4gDxxDzkBBxMlxqZAr8qv0WfQdPRFbLfJvlqk4EWTkvtKCF6TClcZCBnGIMXkCTN5MuBL1469NvSXvglBPtKy5MHu8FOtRgZDZD';
const API_VERSION = 'v21.0';

const templates = [
  {
    name: 'despedida_consentimiento',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: 'Entendido {{1}}. Has cancelado las notificaciones de FairPadel por WhatsApp. Si cambias de opinión, podés reactivarlas desde tu perfil en fairpadel.com',
        example: {
          body_text: [['Juan']]
        }
      }
    ]
  },
  {
    name: 'bienvenida_consentimiento',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: '✅ ¡Perfecto {{1}}! Ahora recibirás notificaciones de FairPadel por WhatsApp. Te enviaremos recordatorios de reservas, actualizaciones de torneos y más.',
        example: {
          body_text: [['Juan']]
        }
      }
    ]
  },
  {
    name: 'confirmacion_reserva',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: 'Hola {{1}}, tu reserva fue confirmada:\n\n📅 Fecha: {{2}}\n🎾 Cancha: {{3}}\n⏰ Hora: {{4}}\n\nNos vemos en la cancha!',
        example: {
          body_text: [['Juan', '15/01/2026', 'Cancha 1', '18:00']]
        }
      }
    ]
  },
  {
    name: 'recordatorio_reserva_24h',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: '⏰ Recordatorio: Tenés una reserva mañana!\n\n📅 {{1}}\n🎾 {{2}}\n⏰ {{3}}\n\nSi no podés asistir, cancelá con anticipación.',
        example: {
          body_text: [['15/01/2026', 'Cancha 1', '18:00']]
        }
      }
    ]
  },
  {
    name: 'recordatorio_reserva_4h',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: '🔔 ¡Te esperamos en unas horas!\n\n📅 {{1}}\n🎾 {{2}}\n⏰ {{3}}\n\nNo olvides tu equipo. ¡Buen partido!',
        example: {
          body_text: [['15/01/2026', 'Cancha 1', '18:00']]
        }
      }
    ]
  },
  {
    name: 'inscripcion_torneo',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: '¡Felicidades {{1}}! Te inscribiste en {{2}}\n\n🎾 Categoría: {{3}}\n👤 Pareja: {{4}}\n\nTe avisaremos cuando se publique el fixture.',
        example: {
          body_text: [['Juan', 'Torneo Verano 2026', '3ra Masculina', 'Pedro Gomez']]
        }
      }
    ]
  },
  {
    name: 'fixture_publicado',
    category: 'UTILITY',
    language: 'es',
    components: [
      {
        type: 'BODY',
        text: '¡El fixture de {{1}} ya está disponible!\n\n🎾 Tu primer partido:\n📅 {{2}}\n⏰ {{3}}\n🆚 Vs: {{4}}\n\nVer fixture: {{5}}',
        example: {
          body_text: [['Torneo Verano 2026', '20/01/2026', '19:00', 'Martinez/Lopez', 'https://fairpadel.com/fixture/123']]
        }
      }
    ]
  }
];

async function createTemplate(template) {
  try {
    console.log(`\n📝 Creando plantilla: ${template.name}...`);
    
    const response = await fetch(
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

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Error en ${template.name}:`, data.error?.message || JSON.stringify(data));
      return { success: false, name: template.name, error: data.error };
    }

    console.log(`✅ ${template.name} creada! ID: ${data.id}, Status: ${data.status}`);
    return { success: true, name: template.name, id: data.id, status: data.status };
  } catch (error) {
    console.error(`❌ Error en ${template.name}:`, error.message);
    return { success: false, name: template.name, error: error.message };
  }
}

async function main() {
  console.log('🚀 Creando plantillas de WhatsApp...\n');
  console.log(`📊 Total a crear: ${templates.length}`);
  
  const results = [];
  
  for (const template of templates) {
    const result = await createTemplate(template);
    results.push(result);
    // Esperar 1 segundo entre peticiones para no saturar la API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n\n📋 RESUMEN:');
  console.log('===================');
  const exitosos = results.filter(r => r.success);
  const fallidos = results.filter(r => !r.success);
  
  console.log(`✅ Exitosos: ${exitosos.length}`);
  console.log(`❌ Fallidos: ${fallidos.length}`);
  
  if (fallidos.length > 0) {
    console.log('\n❌ Plantillas con error:');
    fallidos.forEach(f => console.log(`  - ${f.name}: ${f.error?.message || f.error}`));
  }
  
  if (exitosos.length > 0) {
    console.log('\n✅ Plantillas creadas:');
    exitosos.forEach(e => console.log(`  - ${e.name}: ${e.id} (${e.status})`));
  }
}

main().catch(console.error);
