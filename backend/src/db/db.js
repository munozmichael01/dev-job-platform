require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseDbPassword = process.env.SUPABASE_DB_PASSWORD;

// Supabase client for non-SQL operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Extract project reference from URL
const projectRef = supabaseUrl.split('https://')[1].split('.supabase.co')[0];

console.log('📋 Connection info:');
console.log(`   Project Ref: ${projectRef}`);
console.log(`   Password configured: ${supabaseDbPassword ? 'YES' : 'NO'}`);

// PostgreSQL connection configuration for Supabase
// Try different host formats based on Supabase regions
const possibleHosts = [
  `db.${projectRef}.supabase.co`,
  `aws-0-us-east-1.pooler.supabase.com`,
  `aws-0-eu-central-1.pooler.supabase.com`,
  `aws-0-ap-southeast-1.pooler.supabase.com`
];

// PRODUCTION SOLUTION: Use Supabase Adapter instead of PostgreSQL pooler
// This eliminates IPv6 connectivity issues and provides SQL Server-compatible interface
console.log('✅ Using Supabase Adapter (production-ready solution)');
console.log('   Benefits: No IPv6 required, SQL Server compatible, uses Supabase client');

const supabaseAdapter = require('./supabaseAdapter');
const pool = supabaseAdapter;

// SQL wrapper to maintain SQL Server compatibility
class PostgreSQLWrapper {
  async query(strings, ...values) {
    // Convert template literal to parameterized query
    let text = '';
    const params = [];

    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) {
        params.push(values[i]);
        text += `$${params.length}`;
      }
    }

    try {
      const result = await pool.query(text, params);
      return {
        recordset: result.rows,
        rowsAffected: [result.rowCount]
      };
    } catch (error) {
      console.error('❌ PostgreSQL Query Error:', error.message);
      console.error('Query:', text.substring(0, 200));
      throw error;
    }
  }

  async connect() {
    return pool;
  }
}

const sqlWrapper = new PostgreSQLWrapper();

// Create SQL Server-compatible type definitions (for backward compatibility)
// These are ignored by Supabase adapter but allow old code to work
const sql = {
  ...sqlWrapper,
  // SQL Server type definitions (ignored by adapter)
  NVarChar: () => null,
  Int: () => null,
  BigInt: () => null,
  Bit: () => null,
  DateTime: () => null,
  DateTime2: () => null,
  Decimal: () => null,
  Float: () => null,
  NText: () => null,
  Text: () => null,
  VarChar: () => null
};

// Test connection - commenting out for now, using Supabase client instead
// pool.connect()
//   .then(client => {
//     console.log('✅ Conexión directa a Supabase PostgreSQL establecida');
//     client.release();
//   })
//   .catch(err => {
//     console.error('❌ Error conectando a Supabase PostgreSQL:', err.message);
//     console.log('\n💡 TROUBLESHOOTING:');
//     console.log('   1. Verifica SUPABASE_DB_PASSWORD en .env');
//     console.log('   2. Ve a Supabase Dashboard > Settings > Database');
//     console.log('   3. Busca "Connection string" y copia el password');
//     console.log('   4. Asegúrate de que el host sea correcto para tu región');
//   });

// Test Supabase client instead
supabase.from('Users').select('Email').limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Error conectando a Supabase client:', error.message);
    } else {
      console.log('✅ Conexión a Supabase client establecida exitosamente');
      console.log(`   ${data ? data.length : 0} usuario(s) encontrado(s)`);
    }
  })
  .catch(err => {
    console.error('❌ Error en test Supabase client:', err.message);
  });

// pool.request() is now provided by supabaseAdapter
// No need to add it manually - it's already part of the adapter

const poolPromise = Promise.resolve(pool);

module.exports = {
  sql,
  pool,
  poolPromise,
  poolConnect: poolPromise,
  supabase
};
