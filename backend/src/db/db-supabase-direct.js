require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase client for non-SQL operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Extract project reference from URL
const projectRef = supabaseUrl.split('https://')[1].split('.supabase.co')[0];

// PostgreSQL connection string for Supabase
// IMPORTANT: You need to get the database password from Supabase Settings > Database
const connectionString = process.env.SUPABASE_CONNECTION_STRING ||
  `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

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

const sql = new PostgreSQLWrapper();

// Test connection
pool.connect()
  .then(client => {
    console.log('✅ Conexión directa a Supabase PostgreSQL establecida');
    client.release();
  })
  .catch(err => {
    console.error('❌ Error conectando a Supabase PostgreSQL:', err.message);
    console.log('💡 Verifica que SUPABASE_DB_PASSWORD esté configurado en .env');
    console.log('💡 Obtén el password desde: Supabase Dashboard > Settings > Database > Connection string');
  });

const poolPromise = Promise.resolve(pool);

module.exports = {
  sql,
  pool,
  poolPromise,
  poolConnect: poolPromise,
  supabase
};
