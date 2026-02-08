/**
 * Script para reemplazar localhost:3002 hardcoded por import de config (VERSIÓN 2 - CORREGIDA)
 *
 * Uso: node fix-localhost-hardcoded-v2.js
 */

const fs = require('fs');
const path = require('path');

// Archivos a procesar
const filesToFix = [
  'frontend/contexts/AuthContext.tsx',
  'frontend/app/ofertas/page.tsx',
  'frontend/components/credentials/ChannelConfigForm.tsx',
  'frontend/app/credenciales/page.tsx',
  'frontend/components/campaigns/ChannelSelector.tsx',
  'frontend/app/conexiones/[id]/mapeo/page.tsx',
  'frontend/app/campanas/nueva/page.tsx',
];

function processFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Archivo no encontrado: ${filePath}`);
    return { processed: false, replacements: 0 };
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Contar cuántas veces aparece localhost:3002
  const matches = content.match(/http:\/\/localhost:3002/g);
  const replacementCount = matches ? matches.length : 0;

  if (replacementCount === 0) {
    console.log(`✅ ${filePath} - Ya está correcto (0 reemplazos)`);
    return { processed: false, replacements: 0 };
  }

  // Verificar si ya tiene el import
  const hasApiUrlImport = content.includes("from '@/lib/config'") ||
                          content.includes('from "@/lib/config"');

  // Agregar import si no existe
  if (!hasApiUrlImport) {
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, "import { API_URL } from '@/lib/config';");
      content = lines.join('\n');
    }
  }

  // REEMPLAZO CUIDADOSO: Solo cambiar 'http://localhost:3002' por '${API_URL}'
  // IMPORTANTE: NO cambiar las comillas alrededor, preservar template literals existentes

  // Caso 1: Ya está en template literal backticks: `http://localhost:3002/path`
  content = content.replace(/`http:\/\/localhost:3002/g, '`${API_URL}');

  // Caso 2: Está en comillas simples: 'http://localhost:3002/path'
  // Cambiar a backticks solo si NO está dentro de otro string
  content = content.replace(/'http:\/\/localhost:3002([^']*)'/g, '`${API_URL}$1`');

  // Caso 3: Está en comillas dobles: "http://localhost:3002/path"
  content = content.replace(/"http:\/\/localhost:3002([^"]*)"/g, '`${API_URL}$1`');

  // Escribir archivo
  fs.writeFileSync(fullPath, content, 'utf8');

  console.log(`✅ ${filePath} - ${replacementCount} reemplazos`);
  return { processed: true, replacements: replacementCount };
}

// Ejecutar
console.log('\n🔧 Iniciando reemplazo de localhost:3002 hardcoded (v2 mejorado)...\n');

let totalProcessed = 0;
let totalReplacements = 0;

filesToFix.forEach(file => {
  const result = processFile(file);
  if (result.processed) {
    totalProcessed++;
    totalReplacements += result.replacements;
  }
});

console.log('\n📊 Resumen:');
console.log(`   Archivos procesados: ${totalProcessed}`);
console.log(`   Total de reemplazos: ${totalReplacements}`);
console.log('\n✅ Script completado!\n');
