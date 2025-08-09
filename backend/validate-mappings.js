const sql = require('mssql');

// Configuración de la base de datos
const config = {
  user: process.env.DB_USER || 'turijobs_admin',
  password: process.env.DB_PASSWORD || 'TuriJobs2024!',
  server: process.env.DB_HOST || '94.130.165.133',
  database: process.env.DB_NAME || 'turijobs_staging',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function validateMappings() {
  try {
    await sql.connect(config);
    console.log('✅ Connected to database');
    
    // Query para obtener mappings con ClientId
    const result = await sql.query`
      SELECT ConnectionId, ClientId, SourceField, TargetField, TransformationType
      FROM ClientFieldMappings 
      WHERE ConnectionId = 1061
      ORDER BY SourceField
    `;
    
    console.log(`\n📊 Found ${result.recordset.length} mappings for Connection 1061:`);
    console.log('=====================================');
    
    result.recordset.forEach((mapping, index) => {
      console.log(`${index + 1}. ${mapping.SourceField} → ${mapping.TargetField}`);
      console.log(`   ConnectionId: ${mapping.ConnectionId}, ClientId: ${mapping.ClientId}`);
      console.log(`   Type: ${mapping.TransformationType}`);
      console.log('');
    });
    
    // Verificar que todos tengan ClientId
    const mappingsWithoutClientId = result.recordset.filter(m => m.ClientId == null);
    if (mappingsWithoutClientId.length > 0) {
      console.log(`❌ ERROR: ${mappingsWithoutClientId.length} mappings without ClientId!`);
      mappingsWithoutClientId.forEach(m => {
        console.log(`   - ${m.SourceField} → ${m.TargetField}`);
      });
    } else {
      console.log(`✅ SUCCESS: All ${result.recordset.length} mappings have ClientId = 1`);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await sql.close();
  }
}

validateMappings();