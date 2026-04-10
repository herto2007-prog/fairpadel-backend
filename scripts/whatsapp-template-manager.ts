/**
 * WhatsApp Template Manager
 * 
 * Gestiona templates de WhatsApp Business API:
 * 1. Lista templates existentes
 * 2. Elimina templates antiguos
 * 3. Crea nuevos templates con formato Meta 2026 compliant
 * 
 * Uso:
 *   npx ts-node scripts/whatsapp-template-manager.ts
 * 
 * Requiere variables de entorno:
 *   - WHATSAPP_ACCESS_TOKEN
 *   - WHATSAPP_BUSINESS_ACCOUNT_ID (1988477522064103)
 */

import { config } from 'dotenv';
config();

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1988477522064103';
const API_VERSION = 'v21.0';

// Templates a crear (formato oficial Meta 2026)
const TEMPLATES_TO_CREATE = [
  {
    name: 'fairpadel_consent_solicitud',
    language: 'es',
    category: 'MARKETING',
    components: [
      {
        type: 'BODY',
        text: 'Bienvenido a FairPadel. Para recibir datos de tus reservas y torneos por este canal, responde SI. Responde NO para omitir.'
      }
    ]
  },
  {
    name: 'fairpadel_consent_confirmado',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Gracias por confirmar. Ahora recibiras mensajes de FairPadel sobre tus reservas activas.'
      }
    ]
  },
  {
    name: 'fairpadel_consent_cancelado',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Has cancelado los mensajes de FairPadel. Para reactivar, accede a tu cuenta.'
      }
    ]
  },
  {
    name: 'fairpadel_torneo_pareja',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Informacion de tu torneo: La pareja asignada es el jugador {{1}} en categoria {{2}} segun registro.',
        example: {
          body_text: [
            ['Pedro Gomez', '3ra Masculina']
          ]
        }
      }
    ]
  },
  {
    name: 'fairpadel_torneo_rival',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Informacion del fixture: El rival asignado es {{1}} en el torneo {{2}} segun programacion.',
        example: {
          body_text: [
            ['Martinez-Lopez', 'Verano 2026']
          ]
        }
      }
    ]
  },
  {
    name: 'fairpadel_reserva_ok',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Datos de tu reserva confirmada: Cancha numero {{1}} asignada para fecha {{2}} segun disponibilidad.',
        example: {
          body_text: [
            ['3', '15/01/2026']
          ]
        }
      }
    ]
  },
  {
    name: 'fairpadel_reserva_sede',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Detalles de tu sede confirmada: {{1}}. Presentarse 15 minutos antes del horario.',
        example: {
          body_text: [
            ['Sede Central']
          ]
        }
      }
    ]
  },
  {
    name: 'fairpadel_recordatorio_24h',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Recordatorio de tu reserva: El partido es manana en sede {{1}} a las {{2}} segun confirmacion previa.',
        example: {
          body_text: [
            ['Sede Central', '18:00']
          ]
        }
      }
    ]
  },
  {
    name: 'fairpadel_recordatorio_4h',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Recordatorio para hoy: Te esperamos en sede {{1}} a las {{2}} segun tu reserva registrada.',
        example: {
          body_text: [
            ['Sede Central', '18:00']
          ]
        }
      }
    ]
  },
  {
    name: 'fairpadel_torneo_insc_ok',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Confirmacion de inscripcion: El torneo {{1}} tiene tu registro en categoria {{2}} segun solicitud enviada.',
        example: {
          body_text: [
            ['Verano 2026', '3ra Masculina']
          ]
        }
      }
    ]
  },
  {
    name: 'fairpadel_torneo_fecha',
    language: 'es',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Fecha confirmada para tu partido: {{1}} a las {{2}} segun fixture oficial.',
        example: {
          body_text: [
            ['20/01/2026', '19:00']
          ]
        }
      }
    ]
  }
];

interface TemplateResponse {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
}

/**
 * Lista todos los templates existentes
 */
async function listTemplates(): Promise<TemplateResponse[]> {
  const url = `https://graph.facebook.com/${API_VERSION}/${BUSINESS_ACCOUNT_ID}/message_templates?limit=100`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error listando templates: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Elimina un template por ID
 */
async function deleteTemplate(templateId: string): Promise<boolean> {
  const url = `https://graph.facebook.com/${API_VERSION}/${templateId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`  ❌ Error eliminando ${templateId}: ${error}`);
    return false;
  }

  return true;
}

/**
 * Crea un nuevo template
 */
async function createTemplate(template: any): Promise<{ success: boolean; id?: string; error?: string }> {
  const url = `https://graph.facebook.com/${API_VERSION}/${BUSINESS_ACCOUNT_ID}/message_templates`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(template)
  });

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: JSON.stringify(data) };
  }

  return { success: true, id: data.id };
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 WhatsApp Template Manager\n');
  console.log(`📱 Business Account ID: ${BUSINESS_ACCOUNT_ID}`);
  console.log(`🔑 Token: ${ACCESS_TOKEN ? '✅ Configurado' : '❌ NO CONFIGURADO'}\n`);

  if (!ACCESS_TOKEN) {
    console.error('❌ Error: WHATSAPP_ACCESS_TOKEN no está configurado');
    console.error('   Agregalo al archivo .env');
    process.exit(1);
  }

  // PASO 1: Listar templates existentes
  console.log('📋 Paso 1: Listando templates existentes...');
  let existingTemplates: TemplateResponse[] = [];
  try {
    existingTemplates = await listTemplates();
    console.log(`   Encontrados: ${existingTemplates.length} templates\n`);
    
    if (existingTemplates.length > 0) {
      console.log('   Templates actuales:');
      existingTemplates.forEach(t => {
        console.log(`   - ${t.name} | ${t.category} | ${t.status}`);
      });
      console.log('');
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    process.exit(1);
  }

  // PASO 2: Eliminar templates (excepto los que coinciden con los nuevos)
  if (existingTemplates.length > 0) {
    console.log('🗑️  Paso 2: Eliminando templates antiguos...');
    
    const newTemplateNames = TEMPLATES_TO_CREATE.map(t => t.name);
    const templatesToDelete = existingTemplates.filter(t => !newTemplateNames.includes(t.name));
    
    if (templatesToDelete.length === 0) {
      console.log('   ℹ️  No hay templates para eliminar (los nuevos no existen o ya están creados)\n');
    } else {
      console.log(`   Templates a eliminar: ${templatesToDelete.length}\n`);
      
      for (const template of templatesToDelete) {
        process.stdout.write(`   Eliminando ${template.name}... `);
        const success = await deleteTemplate(template.id);
        if (success) {
          console.log('✅');
        } else {
          console.log('❌ (puede estar en uso o protegido)');
        }
        // Delay para no saturar la API
        await new Promise(r => setTimeout(r, 500));
      }
      console.log('');
    }
  }

  // PASO 3: Crear nuevos templates
  console.log('📝 Paso 3: Creando nuevos templates...');
  console.log(`   Total a crear: ${TEMPLATES_TO_CREATE.length}\n`);

  const results = {
    success: 0,
    failed: 0,
    pending: 0,
    errors: [] as string[]
  };

  for (let i = 0; i < TEMPLATES_TO_CREATE.length; i++) {
    const template = TEMPLATES_TO_CREATE[i];
    const number = `${i + 1}/${TEMPLATES_TO_CREATE.length}`;
    
    process.stdout.write(`   [${number}] Creando ${template.name} (${template.category})... `);
    
    const result = await createTemplate(template);
    
    if (result.success) {
      console.log(`✅ ID: ${result.id}`);
      results.success++;
    } else {
      // Verificar si ya existe (error específico)
      if (result.error?.includes('already exists') || result.error?.includes('duplicate')) {
        console.log('⚠️  Ya existe');
        results.pending++;
      } else {
        console.log(`❌ Error: ${result.error?.substring(0, 100)}...`);
        results.failed++;
        results.errors.push(`${template.name}: ${result.error}`);
      }
    }

    // Delay para no saturar la API (máx 100 templates/hora)
    if (i < TEMPLATES_TO_CREATE.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN');
  console.log('='.repeat(50));
  console.log(`✅ Creados exitosamente: ${results.success}`);
  console.log(`⚠️  Ya existentes: ${results.pending}`);
  console.log(`❌ Fallidos: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errores detallados:');
    results.errors.forEach(e => console.log(`   - ${e}`));
  }

  console.log('\n💡 Notas:');
  console.log('   - Los templates en estado PENDING pueden tardar hasta 24h en aprobarse');
  console.log('   - UTILITY: típicamente 15 minutos - 24 horas');
  console.log('   - MARKETING: puede tardar más (revisión más estricta)');
  console.log('   - Verifica el estado en: Meta Business Manager > WhatsApp Manager > Templates');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Ejecutar
main().catch(error => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
