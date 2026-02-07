require('dotenv').config();
const sql = require('mssql');
const { createClient } = require('@supabase/supabase-js');

// SQL Server config
const sqlConfig = {
  server: 'localhost',
  database: 'JobPlatform',
  user: 'jobplatform',
  password: 'JobPlatform2025!',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

// Supabase config - using service role key from .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bdswyiapdxnxexfzwzhv.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no encontrada en .env');
  console.error('Por favor agrega: SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateUsers() {
  console.log('\n🔄 Migrando usuarios...');

  const result = await sql.query`SELECT * FROM Users`;
  const users = result.recordset;

  console.log(`Encontrados ${users.length} usuarios para migrar`);

  for (const user of users) {
    try {
      const { data, error } = await supabase
        .from('Users')
        .insert({
          Id: user.Id,
          Email: user.Email,
          PasswordHash: user.PasswordHash,
          FirstName: user.FirstName || '',
          LastName: user.LastName || '',
          Company: user.Company || '',
          Website: user.Website,
          Phone: user.Phone || '',
          Image: user.Image,
          GoogleId: user.GoogleId,
          Role: user.Role || 'user',
          IsActive: user.IsActive !== false,
          CreatedAt: user.CreatedAt,
          UpdatedAt: user.UpdatedAt
        });

      if (error) {
        console.error(`❌ Error migrando usuario ${user.Email}:`, error.message);
      } else {
        console.log(`✅ Usuario migrado: ${user.Email} (${user.Role})`);
      }
    } catch (err) {
      console.error(`❌ Excepción migrando ${user.Email}:`, err.message);
    }
  }
}

async function migrateCampaigns() {
  console.log('\n🔄 Migrando campañas...');

  const result = await sql.query`SELECT * FROM Campaigns`;
  const campaigns = result.recordset;

  console.log(`Encontradas ${campaigns.length} campañas para migrar`);

  for (const campaign of campaigns) {
    try {
      const { data, error } = await supabase
        .from('Campaigns')
        .insert({
          Id: campaign.Id,
          Name: campaign.Name,
          Description: campaign.Description,
          SegmentId: campaign.SegmentId,
          DistributionType: campaign.DistributionType,
          StartDate: campaign.StartDate,
          EndDate: campaign.EndDate,
          Budget: campaign.Budget,
          TargetApplications: campaign.TargetApplications,
          MaxCPA: campaign.MaxCPA,
          Channels: campaign.Channels,
          BidStrategy: campaign.BidStrategy,
          ManualBid: campaign.ManualBid,
          Priority: campaign.Priority,
          AutoOptimization: campaign.AutoOptimization || false,
          Status: campaign.Status,
          CreatedAt: campaign.CreatedAt,
          UpdatedAt: campaign.UpdatedAt,
          InternalConfig: campaign.InternalConfig,
          UserId: campaign.UserId,
          LastMetricsSync: campaign.LastMetricsSync,
          ActualSpend: campaign.ActualSpend,
          ActualApplications: campaign.ActualApplications
        });

      if (error) {
        console.error(`❌ Error migrando campaña ${campaign.Id}:`, error.message);
      } else {
        console.log(`✅ Campaña migrada: ${campaign.Name}`);
      }
    } catch (err) {
      console.error(`❌ Excepción migrando campaña ${campaign.Id}:`, err.message);
    }
  }
}

async function migrateSegments() {
  console.log('\n🔄 Migrando segmentos...');

  const result = await sql.query`SELECT * FROM Segments`;
  const segments = result.recordset;

  console.log(`Encontrados ${segments.length} segmentos para migrar`);

  for (const segment of segments) {
    try {
      const { data, error } = await supabase
        .from('Segments')
        .insert({
          Id: segment.Id,
          Name: segment.Name,
          Description: segment.Description,
          Filters: segment.Filters,
          Status: segment.Status,
          OfferCount: segment.OfferCount || 0,
          Campaigns: segment.Campaigns || 0,
          CreatedAt: segment.CreatedAt,
          UpdatedAt: segment.UpdatedAt,
          UserId: segment.UserId
        });

      if (error) {
        console.error(`❌ Error migrando segmento ${segment.Id}:`, error.message);
      } else {
        console.log(`✅ Segmento migrado: ${segment.Name}`);
      }
    } catch (err) {
      console.error(`❌ Excepción migrando segmento ${segment.Id}:`, err.message);
    }
  }
}

async function migrateConnections() {
  console.log('\n🔄 Migrando conexiones...');

  const result = await sql.query`SELECT * FROM Connections`;
  const connections = result.recordset;

  console.log(`Encontradas ${connections.length} conexiones para migrar`);

  let migrated = 0;
  for (const connection of connections) {
    try {
      const { data, error} = await supabase
        .from('Connections')
        .insert({
          id: connection.id,
          name: connection.name,
          type: connection.type,
          url: connection.url,
          frequency: connection.frequency,
          status: connection.status,
          lastSync: connection.lastSync,
          importedOffers: connection.importedOffers,
          errorCount: connection.errorCount,
          clientId: connection.clientId,
          Method: connection.Method,
          Headers: connection.Headers,
          Body: connection.Body,
          CreatedAt: connection.CreatedAt,
          SourceType: connection.SourceType,
          Endpoint: connection.Endpoint,
          PayloadTemplate: connection.PayloadTemplate,
          FeedUrl: connection.FeedUrl,
          Notes: connection.Notes,
          UserId: connection.UserId
        });

      if (error) {
        console.error(`❌ Error migrando conexión ${connection.id}:`, error.message);
      } else {
        migrated++;
        if (migrated % 10 === 0) {
          console.log(`✅ ${migrated}/${connections.length} conexiones migradas...`);
        }
      }
    } catch (err) {
      console.error(`❌ Excepción migrando conexión ${connection.id}:`, err.message);
    }
  }

  console.log(`✅ Total: ${migrated}/${connections.length} conexiones migradas`);
}

async function migrate() {
  try {
    console.log('🚀 Iniciando migración de SQL Server a Supabase...\n');

    // Connect to SQL Server
    await sql.connect(sqlConfig);
    console.log('✅ Conectado a SQL Server');

    // Migrate in order (respecting foreign keys)
    await migrateUsers();
    await migrateCampaigns();
    await migrateSegments();
    await migrateConnections();

    console.log('\n🎉 ¡Migración completada!');

    await sql.close();

  } catch (error) {
    console.error('\n❌ Error en migración:', error);
  }
}

migrate();
