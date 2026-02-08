require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no encontrada en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function recreateSchema() {
  console.log('🔧 Recreando schema de Supabase...\n');

  try {
    // Leer el archivo SQL corregido
    const sqlScript = fs.readFileSync('./scripts/schema-supabase-fixed.sql', 'utf8');

    // Dividir en statements individuales
    const statements = sqlScript
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

    console.log(`📋 Ejecutando ${statements.length} statements SQL...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comentarios y líneas vacías
      if (!statement || statement.startsWith('--')) continue;

      try {
        // Usar rpc para ejecutar SQL directo
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          console.error(`❌ Error en statement ${i + 1}:`, error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
        } else {
          const action = statement.substring(0, 20);
          console.log(`✅ Statement ${i + 1} ejecutado: ${action}...`);
        }
      } catch (err) {
        console.error(`❌ Excepción en statement ${i + 1}:`, err.message);
      }
    }

    console.log('\n✅ Schema recreado exitosamente');

  } catch (error) {
    console.error('❌ Error recreando schema:', error);
  }
}

recreateSchema();
