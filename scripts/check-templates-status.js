/**
 * Script para verificar estado actual de plantillas en Meta
 */

const BUSINESS_ACCOUNT_ID = '1988477522064103';
const ACCESS_TOKEN = 'EAANQSlLypO8BROhI5OTiV92MSMCZAgilHHLob6mzw0OnUWiU9o3bcEXudze5dpC39qDrDw9pdCYe7yrIBxOfbZA5RGaSa4K4gDxxDzkBBxMlxqZAr8qv0WfQdPRFbLfJvlqk4EWTkvtKCF6TClcZCBnGIMXkCTN5MuBL1469NvSXvglBPtKy5MHu8FOtRgZDZD';
const API_VERSION = 'v21.0';

async function checkTemplates() {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${BUSINESS_ACCOUNT_ID}/message_templates?fields=name,category,status,correct_category&limit=20`,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Error:', data.error?.message || JSON.stringify(data));
      return;
    }

    console.log('📋 ESTADO ACTUAL DE PLANTILLAS:\n');
    console.log('Nombre                          | Categoría    | Estado    | Corrección pendiente');
    console.log('--------------------------------------------------------------------------------');
    
    data.data.forEach(t => {
      const icon = t.category === 'MARKETING' ? '⚠️ ' : '✅ ';
      const pending = t.correct_category && t.correct_category !== t.category 
        ? `→ ${t.correct_category}` 
        : '-';
      const name = t.name.padEnd(30, ' ');
      const cat = t.category.padEnd(12, ' ');
      const status = t.status.padEnd(9, ' ');
      console.log(`${icon}${name}| ${cat}| ${status}| ${pending}`);
    });

    // Contar
    const marketing = data.data.filter(t => t.category === 'MARKETING');
    const utility = data.data.filter(t => t.category === 'UTILITY');
    const pendingChange = data.data.filter(t => t.correct_category && t.correct_category !== t.category);

    console.log('\n📊 RESUMEN:');
    console.log(`   UTILITY: ${utility.length}`);
    console.log(`   MARKETING: ${marketing.length} ${marketing.length > 0 ? '⚠️ (más caro, límites de frecuencia)' : ''}`);
    if (pendingChange.length > 0) {
      console.log(`   Con cambio pendiente: ${pendingChange.length} ⚠️`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkTemplates();
