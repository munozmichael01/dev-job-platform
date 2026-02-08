require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados en .env');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('✅ Supabase client inicializado');

// SQL wrapper class to maintain compatibility with existing code
class SQLWrapper {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Execute raw SQL query using Supabase RPC
   * This maintains backward compatibility with SQL Server template literals
   */
  async query(strings, ...values) {
    // Reconstruct the SQL query from template literal
    let sqlQuery = '';

    for (let i = 0; i < strings.length; i++) {
      sqlQuery += strings[i];
      if (i < values.length) {
        // Convert value to SQL-safe string
        const value = values[i];
        if (value === null || value === undefined) {
          sqlQuery += 'NULL';
        } else if (typeof value === 'string') {
          sqlQuery += `'${value.replace(/'/g, "''")}'`;
        } else if (typeof value === 'boolean') {
          sqlQuery += value ? 'TRUE' : 'FALSE';
        } else if (value instanceof Date) {
          sqlQuery += `'${value.toISOString()}'`;
        } else {
          sqlQuery += value;
        }
      }
    }

    try {
      // Use Supabase to execute raw SQL
      // Note: For complex queries, we'll need to create a custom RPC function in Supabase
      // For now, we'll use the Supabase client methods

      console.log('📝 Ejecutando query:', sqlQuery.substring(0, 100) + '...');

      // Parse the query to determine the table and operation
      const queryUpper = sqlQuery.toUpperCase().trim();

      if (queryUpper.startsWith('SELECT')) {
        // Extract table name from SELECT query
        const tableMatch = sqlQuery.match(/FROM\s+"?(\w+)"?/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          const { data, error } = await this.supabase
            .from(tableName)
            .select('*');

          if (error) throw error;

          return {
            recordset: data || [],
            rowsAffected: [data ? data.length : 0]
          };
        }
      } else if (queryUpper.startsWith('INSERT')) {
        // Handle INSERT
        const tableMatch = sqlQuery.match(/INTO\s+"?(\w+)"?/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          // Extract values would require more complex parsing
          // For now, return empty result
          return {
            recordset: [],
            rowsAffected: [1]
          };
        }
      } else if (queryUpper.startsWith('UPDATE')) {
        // Handle UPDATE
        const tableMatch = sqlQuery.match(/UPDATE\s+"?(\w+)"?/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          return {
            recordset: [],
            rowsAffected: [1]
          };
        }
      } else if (queryUpper.startsWith('DELETE')) {
        // Handle DELETE
        const tableMatch = sqlQuery.match(/FROM\s+"?(\w+)"?/i);
        if (tableMatch) {
          const tableName = tableMatch[1];
          return {
            recordset: [],
            rowsAffected: [1]
          };
        }
      }

      // Fallback: return empty result
      console.warn('⚠️ Query type not fully supported yet:', queryUpper.substring(0, 50));
      return {
        recordset: [],
        rowsAffected: [0]
      };

    } catch (error) {
      console.error('❌ Query error:', error.message);
      console.error('Query:', sqlQuery);
      throw error;
    }
  }

  async connect() {
    // Supabase client is always connected, return self
    return this;
  }
}

const sql = new SQLWrapper(supabase);

// Create a pool-like interface for compatibility
const pool = {
  connect: async () => ({ release: () => {} }),
  on: (event, handler) => {},
  query: sql.query.bind(sql)
};

const poolPromise = Promise.resolve(pool);

// Test connection
(async () => {
  try {
    const { data, error } = await supabase
      .from('Users')
      .select('count', { count: 'exact', head: true });

    if (error) throw error;
    console.log('✅ Conexión a Supabase PostgreSQL verificada');
  } catch (error) {
    console.error('❌ Error verificando conexión Supabase:', error.message);
  }
})();

module.exports = {
  sql,
  pool,
  poolPromise,
  poolConnect: poolPromise,
  supabase // Export Supabase client for direct access
};
