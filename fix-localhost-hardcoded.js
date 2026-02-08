/**
 * Script para reemplazar localhost:3002 hardcoded por import de config
 *
 * Uso: node fix-localhost-hardcoded.js
 */

const fs = require('fs');
const path = require('path');

// Archivos a procesar (del grep anterior)
const filesToFix = [
  'frontend/contexts/AuthContext.tsx',
  'frontend/app/ofertas/page.tsx',
  'frontend/components/credentials/ChannelConfigForm.tsx',
  'frontend/app/credenciales/page.tsx',
  'frontend/components/campaigns/ChannelSelector.tsx',
  'frontend/app/conexiones/[id]/mapeo/page.tsx',
  'frontend/app/campanas/nueva/page.tsx',
];

// Patron a buscar
const localhostPattern = /http:\/\/localhost:3002/g;

// Función para procesar un archivo
function processFile(filePath) {
  const fullPath = path.join(__dirname, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Archivo no encontrado: ${filePath}`);
    return { processed: false, replacements: 0 };
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;

  // Contar reemplazos
  const matches = content.match(localhostPattern);
  const replacementCount = matches ? matches.length : 0;

  if (replacementCount === 0) {
    console.log(`✅ ${filePath} - Ya está correcto (0 reemplazos)`);
    return { processed: false, replacements: 0 };
  }

  // Verificar si ya tiene el import de API_URL
  const hasApiUrlImport = content.includes("from '@/lib/config'") ||
                          content.includes('from "@/lib/config"');

  // Si no tiene el import, agregarlo
  if (!hasApiUrlImport) {
    // Encontrar la última línea de imports
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('import{')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      // Insertar después del último import
      lines.splice(lastImportIndex + 1, 0, "import { API_URL } from '@/lib/config';");
      content = lines.join('\n');
    } else {
      // Si no hay imports, agregar al principio después de 'use client' o 'use server'
      const hasUseClient = content.includes('"use client"') || content.includes("'use client'");
      const hasUseServer = content.includes('"use server"') || content.includes("'use server'");

      if (hasUseClient || hasUseServer) {
        content = content.replace(
          /(['"])use (client|server)\1\s*\n/,
          `$&\nimport { API_URL } from '@/lib/config';\n`
        );
      } else {
        content = `import { API_URL } from '@/lib/config';\n\n${content}`;
      }
    }
  }

  // Reemplazar todas las ocurrencias de localhost:3002
  content = content.replace(localhostPattern, '${API_URL}');

  // Corregir casos donde ya había template literals
  content = content.replace(/`\$\{API_URL\}/g, '`${API_URL}');
  content = content.replace(/'\$\{API_URL\}/g, '`${API_URL}');
  content = content.replace(/"\$\{API_URL\}/g, '`${API_URL}');

  // Corregir casos donde no es template literal
  content = content.replace(/fetch\('(\$\{API_URL\}[^']+)'\)/g, 'fetch(`$1`)');
  content = content.replace(/fetch\("(\$\{API_URL\}[^"]+)"\)/g, 'fetch(`$1`)');
  content = content.replace(/authFetch\('(\$\{API_URL\}[^']+)'\)/g, 'authFetch(`$1`)');
  content = content.replace(/authFetch\("(\$\{API_URL\}[^"]+)"\)/g, 'authFetch(`$1`)');
  content = content.replace(/authFetchJSON\('(\$\{API_URL\}[^']+)'\)/g, 'authFetchJSON(`$1`)');
  content = content.replace(/authFetchJSON\("(\$\{API_URL\}[^"]+)"\)/g, 'authFetchJSON(`$1`)');
  content = content.replace(/fetchWithAuth\('(\$\{API_URL\}[^']+)'\)/g, 'fetchWithAuth(`$1`)');
  content = content.replace(/fetchWithAuth\("(\$\{API_URL\}[^"]+)"\)/g, 'fetchWithAuth(`$1`)');

  // Escribir el archivo modificado
  fs.writeFileSync(fullPath, content, 'utf8');

  console.log(`✅ ${filePath} - ${replacementCount} reemplazos`);
  return { processed: true, replacements: replacementCount };
}

// Procesar todos los archivos
console.log('\n🔧 Iniciando reemplazo de localhost:3002 hardcoded...\n');

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
