const sql = require('mssql');

const config = {
  user: 'jobplatform',
  password: 'JobPlatform2025!',
  server: 'localhost',
  database: 'JobPlatform',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function createMappingForConnection(connectionId) {
  try {
    await sql.connect(config);

    // Mapeo específico para Turijobs API JSON
    const turijobsMappings = [
      { source: 'id', target: 'ExternalId', type: 'NUMBER' },
      { source: 'title', target: 'Title', type: 'STRING' },
      { source: 'description', target: 'Description', type: 'STRING' },
      { source: 'publicationDate', target: 'PublicationDate', type: 'DATE' },
      { source: 'externalUrl', target: 'ExternalUrl', type: 'STRING' },
      { source: 'url', target: 'ApplicationUrl', type: 'STRING' },
      { source: 'vacancies', target: 'Vacancies', type: 'NUMBER' },
      { source: 'location.cityName', target: 'City', type: 'STRING' },
      { source: 'location.regionName', target: 'Region', type: 'STRING' },
      { source: 'location.countryName', target: 'Country', type: 'STRING' },
      { source: 'location.latitude', target: 'Latitude', type: 'NUMBER' },
      { source: 'location.longitude', target: 'Longitude', type: 'NUMBER' },
      { source: 'company.enterpriseName', target: 'CompanyName', type: 'STRING' },
      { source: 'company.sector', target: 'Sector', type: 'STRING' },
      { source: 'company.address', target: 'Address', type: 'STRING' },
      { source: 'type', target: 'JobType', type: 'STRING' },
      { source: 'applies', target: 'ApplicationsGoal', type: 'NUMBER' }
    ];

    const connectionIdNum = parseInt(process.argv[2]);
    if (!connectionIdNum) {
      console.error('❌ Usage: node create_turijobs_mapping_specific.js [CONNECTION_ID]');
      return;
    }

    console.log(`🔄 Creating mappings for connection ID: ${connectionIdNum}`);

    // Verificar que la conexión existe
    const connection = await sql.query`
      SELECT id, name FROM Connections WHERE id = ${connectionIdNum} AND UserId = 11
    `;

    if (connection.recordset.length === 0) {
      console.error(`❌ Connection ${connectionIdNum} not found or doesn't belong to user 11`);
      return;
    }

    console.log(`📝 Connection found: ${connection.recordset[0].name}`);

    // Limpiar mapeos existentes
    await sql.query`
      DELETE FROM ClientFieldMappings WHERE ConnectionId = ${connectionIdNum}
    `;

    // Crear nuevos mapeos
    for (const mapping of turijobsMappings) {
      await sql.query`
        INSERT INTO ClientFieldMappings
        (ConnectionId, ClientId, SourceField, TargetField, TransformationType, TransformationRule)
        VALUES
        (${connectionIdNum}, 3, ${mapping.source}, ${mapping.target}, ${mapping.type}, NULL)
      `;
    }

    console.log(`✅ Created ${turijobsMappings.length} mappings for connection ${connectionIdNum}`);
    console.log('🎉 Ready for import!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
  }
}

createMappingForConnection();