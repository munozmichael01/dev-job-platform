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

async function createTurijobsMapping() {
  try {
    await sql.connect(config);

    // Mapeo específico para Turijobs API JSON
    const turijobsMappings = [
      // CAMPOS BÁSICOS
      { source: 'id', target: 'ExternalId', type: 'NUMBER' },
      { source: 'title', target: 'Title', type: 'STRING' },
      { source: 'description', target: 'Description', type: 'STRING' },
      { source: 'publicationDate', target: 'PublicationDate', type: 'DATE' },
      { source: 'externalUrl', target: 'ExternalUrl', type: 'STRING' },
      { source: 'url', target: 'ApplicationUrl', type: 'STRING' },
      { source: 'vacancies', target: 'Vacancies', type: 'NUMBER' },

      // LOCALIZACIÓN
      { source: 'location.cityName', target: 'City', type: 'STRING' },
      { source: 'location.regionName', target: 'Region', type: 'STRING' },
      { source: 'location.countryName', target: 'Country', type: 'STRING' },
      { source: 'location.latitude', target: 'Latitude', type: 'NUMBER' },
      { source: 'location.longitude', target: 'Longitude', type: 'NUMBER' },

      // EMPRESA
      { source: 'company.enterpriseName', target: 'CompanyName', type: 'STRING' },
      { source: 'company.sector', target: 'Sector', type: 'STRING' },
      { source: 'company.address', target: 'Address', type: 'STRING' },

      // CAMPOS ADICIONALES DE TURIJOBS
      { source: 'type', target: 'JobType', type: 'STRING' },
      { source: 'applies', target: 'ApplicationsGoal', type: 'NUMBER' }
    ];

    console.log('🔄 Creating Turijobs API mappings...');

    // Conexiones de API del usuario 11 (Turijobs)
    const connections = await sql.query`
      SELECT id, name FROM Connections
      WHERE UserId = 11 AND type = 'API'
      AND url LIKE '%turijobs.com%'
    `;

    if (connections.recordset.length === 0) {
      console.log('⚠️ No Turijobs API connections found for user 11');
      return;
    }

    for (const connection of connections.recordset) {
      console.log(`📝 Creating mappings for connection: ${connection.name} (ID: ${connection.id})`);

      // Limpiar mapeos existentes
      await sql.query`
        DELETE FROM ClientFieldMappings
        WHERE ConnectionId = ${connection.id}
      `;

      // Crear nuevos mapeos
      for (const mapping of turijobsMappings) {
        await sql.query`
          INSERT INTO ClientFieldMappings
          (ConnectionId, ClientId, SourceField, TargetField, TransformationType, TransformationRule)
          VALUES
          (${connection.id}, 3, ${mapping.source}, ${mapping.target}, ${mapping.type}, NULL)
        `;
      }

      console.log(`✅ Created ${turijobsMappings.length} mappings for connection ${connection.id}`);
    }

    console.log('🎉 Turijobs mappings created successfully!');

  } catch (error) {
    console.error('❌ Error creating Turijobs mappings:', error.message);
  } finally {
    await sql.close();
  }
}

createTurijobsMapping();