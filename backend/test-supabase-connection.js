require('dotenv').config();
const { sql, supabase } = require('./src/db/db');

async function testConnection() {
  console.log('🧪 Testing Supabase PostgreSQL connection...\n');

  try {
    // Test 1: Direct PostgreSQL query
    console.log('1️⃣ Testing direct PostgreSQL query...');
    const result = await sql.query`SELECT COUNT(*) as count FROM "Users"`;
    console.log(`   ✅ Users count: ${result.recordset[0].count}`);

    // Test 2: Supabase client query
    console.log('\n2️⃣ Testing Supabase client query...');
    const { data, error } = await supabase.from('Users').select('Email, Role');
    if (error) throw error;
    console.log(`   ✅ Found ${data.length} users via Supabase client`);
    console.log('   Sample users:', data.slice(0, 3).map(u => `${u.Email} (${u.Role})`));

    // Test 3: Complex query with WHERE
    console.log('\n3️⃣ Testing parameterized query...');
    const role = 'superadmin';
    const adminResult = await sql.query`SELECT * FROM "Users" WHERE "Role" = ${role}`;
    console.log(`   ✅ Found ${adminResult.recordset.length} superadmin users`);

    // Test 4: Campaigns query
    console.log('\n4️⃣ Testing Campaigns table...');
    const campaigns = await sql.query`SELECT COUNT(*) as count FROM "Campaigns"`;
    console.log(`   ✅ Campaigns count: ${campaigns.recordset[0].count}`);

    // Test 5: Segments query
    console.log('\n5️⃣ Testing Segments table...');
    const segments = await sql.query`SELECT COUNT(*) as count FROM "Segments"`;
    console.log(`   ✅ Segments count: ${segments.recordset[0].count}`);

    // Test 6: Connections query
    console.log('\n6️⃣ Testing Connections table...');
    const connections = await sql.query`SELECT COUNT(*) as count FROM "Connections"`;
    console.log(`   ✅ Connections count: ${connections.recordset[0].count}`);

    console.log('\n🎉 All tests passed! Supabase PostgreSQL is working correctly.\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();
