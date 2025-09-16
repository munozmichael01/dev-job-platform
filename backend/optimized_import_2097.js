const sql = require('mssql');
const axios = require('axios');

const config = {
  user: 'jobplatform',
  password: 'JobPlatform2025!',
  server: 'localhost',
  database: 'JobPlatform',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200
  },
  requestTimeout: 300000, // 5 minutos
  connectionTimeout: 60000 // 1 minuto
};

class OptimizedTurijobsImporter {
  constructor() {
    this.connectionId = 2097;
    this.clientId = 11;
    this.batchSize = 50; // Procesar en lotes de 50 ofertas
    this.maxConcurrency = 3; // Máximo 3 operaciones de BD paralelas
  }

  async fetchPage(page, size = 8) {
    try {
      const url = 'https://www.turijobs.com/ngapi/api/search';
      const headers = {
        "accept": "*/*",
        "x-site-id": "6",
        "x-lang-id": "7",
        "x-country-id": "40",
        "Content-Type": "application/json"
      };

      const body = {
        userId: null,
        page: { index: page, size: size, featuredSize: 4, difussionSize: 2 },
        filter: {}
      };

      console.log(`🔗 Fetching page ${page}...`);
      const response = await axios.post(url, body, {
        headers,
        timeout: 30000 // 30 segundos por request
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching page ${page}:`, error.message);
      throw error;
    }
  }

  transformOffer(offer) {
    // Mapeo básico para Turijobs
    return {
      ExternalId: offer.id?.toString() || null,
      Title: this.truncateString(offer.title, 200),
      JobTitle: this.truncateString(offer.title, 200),
      Description: this.truncateString(offer.description, 2000) || "",
      CompanyName: this.truncateString(offer.company?.enterpriseName, 200),
      Sector: this.truncateString(offer.company?.sector, 100),
      City: this.truncateString(offer.location?.cityName, 100),
      Region: this.truncateString(offer.location?.regionName, 100),
      Country: this.truncateString(offer.location?.countryName, 100),
      Latitude: offer.location?.latitude || null,
      Longitude: offer.location?.longitude || null,
      JobType: this.truncateString(offer.type, 50),
      ExternalUrl: this.truncateString(offer.externalUrl, 500),
      ApplicationUrl: this.truncateString(offer.url, 500),
      Vacancies: parseInt(offer.vacancies) || 1,
      PublicationDate: offer.publicationDate ? new Date(offer.publicationDate) : new Date(),
      Address: this.truncateString(offer.company?.address, 200),
      ApplicationsGoal: parseInt(offer.applies) || null,
      Source: 'Turijobs',
      ConnectionId: this.connectionId,
      StatusId: 1, // Active
      CreatedAt: new Date(),
      UserId: this.clientId
    };
  }

  truncateString(str, maxLength) {
    if (!str) return '';
    const cleaned = String(str).trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) : cleaned;
  }

  async saveBatch(offers) {
    const pool = await sql.connect(config);

    try {
      console.log(`💾 Saving batch of ${offers.length} offers...`);

      // Usar MERGE para UPDATE/INSERT eficiente
      for (const offer of offers) {
        const request = pool.request();

        // Parámetros del merge
        Object.keys(offer).forEach(key => {
          request.input(key, offer[key]);
        });

        await request.query(`
          MERGE JobOffers AS target
          USING (SELECT @ExternalId as ExternalId, @ConnectionId as ConnectionId) AS source
          ON target.ExternalId = source.ExternalId AND target.ConnectionId = source.ConnectionId
          WHEN MATCHED THEN
            UPDATE SET
              Title = @Title,
              JobTitle = @JobTitle,
              Description = @Description,
              CompanyName = @CompanyName,
              Sector = @Sector,
              City = @City,
              Region = @Region,
              Country = @Country,
              Latitude = @Latitude,
              Longitude = @Longitude,
              JobType = @JobType,
              ExternalUrl = @ExternalUrl,
              ApplicationUrl = @ApplicationUrl,
              Vacancies = @Vacancies,
              PublicationDate = @PublicationDate,
              Address = @Address,
              ApplicationsGoal = @ApplicationsGoal,
              UpdatedAt = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (ExternalId, Title, JobTitle, Description, CompanyName, Sector, City, Region, Country,
                   Latitude, Longitude, JobType, ExternalUrl, ApplicationUrl, Vacancies,
                   PublicationDate, Address, ApplicationsGoal, Source, ConnectionId, StatusId,
                   CreatedAt, UserId)
            VALUES (@ExternalId, @Title, @JobTitle, @Description, @CompanyName, @Sector, @City, @Region, @Country,
                   @Latitude, @Longitude, @JobType, @ExternalUrl, @ApplicationUrl, @Vacancies,
                   @PublicationDate, @Address, @ApplicationsGoal, @Source, @ConnectionId, @StatusId,
                   @CreatedAt, @UserId);
        `);
      }

      console.log(`✅ Batch of ${offers.length} offers saved successfully`);
      return offers.length;

    } catch (error) {
      console.error(`❌ Error saving batch:`, error.message);
      throw error;
    } finally {
      await pool.close();
    }
  }

  async processInStreaming() {
    try {
      console.log('🚀 STARTING OPTIMIZED TURIJOBS IMPORT - CONNECTION 2097');
      console.log(`⚙️ Configuration: Batch size ${this.batchSize}, Max concurrency ${this.maxConcurrency}`);

      let totalProcessed = 0;
      let totalErrors = 0;
      let currentPage = 1;
      let totalPages = 1;
      let batch = [];

      // Obtener primera página para determinar total
      const firstPage = await this.fetchPage(currentPage);
      totalPages = firstPage.pages || Math.ceil((firstPage.total || 100) / 8);

      console.log(`📊 Total pages to process: ${totalPages}`);

      // Procesar primera página
      if (firstPage.offers && firstPage.offers.length > 0) {
        for (const offer of firstPage.offers) {
          batch.push(this.transformOffer(offer));

          // Procesar batch cuando alcance el tamaño configurado
          if (batch.length >= this.batchSize) {
            try {
              const processed = await this.saveBatch(batch);
              totalProcessed += processed;
              console.log(`📈 Progress: ${totalProcessed} offers processed, page ${currentPage}/${totalPages}`);
              batch = []; // Resetear batch
            } catch (error) {
              console.error(`❌ Batch error on page ${currentPage}:`, error.message);
              totalErrors += batch.length;
              batch = []; // Resetear batch incluso si falla
            }
          }
        }
      }

      // Procesar páginas restantes
      for (currentPage = 2; currentPage <= totalPages; currentPage++) {
        try {
          const pageData = await this.fetchPage(currentPage);

          if (pageData.offers && pageData.offers.length > 0) {
            for (const offer of pageData.offers) {
              batch.push(this.transformOffer(offer));

              // Procesar batch cuando alcance el tamaño configurado
              if (batch.length >= this.batchSize) {
                try {
                  const processed = await this.saveBatch(batch);
                  totalProcessed += processed;
                  console.log(`📈 Progress: ${totalProcessed} offers processed, page ${currentPage}/${totalPages}`);
                  batch = [];
                } catch (error) {
                  console.error(`❌ Batch error on page ${currentPage}:`, error.message);
                  totalErrors += batch.length;
                  batch = [];
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error processing page ${currentPage}:`, error.message);
          totalErrors++;
        }

        // Progress report cada 10 páginas
        if (currentPage % 10 === 0) {
          console.log(`🔄 Checkpoint: ${currentPage}/${totalPages} pages, ${totalProcessed} offers processed`);
        }
      }

      // Procesar batch final si queda algo
      if (batch.length > 0) {
        try {
          const processed = await this.saveBatch(batch);
          totalProcessed += processed;
          console.log(`📈 Final batch: ${processed} offers processed`);
        } catch (error) {
          console.error(`❌ Final batch error:`, error.message);
          totalErrors += batch.length;
        }
      }

      console.log('🎉 IMPORT COMPLETED!');
      console.log(`✅ Total processed: ${totalProcessed} offers`);
      console.log(`❌ Total errors: ${totalErrors}`);
      console.log(`📊 Success rate: ${((totalProcessed / (totalProcessed + totalErrors)) * 100).toFixed(2)}%`);

      return {
        imported: totalProcessed,
        errors: totalErrors,
        totalPages: totalPages
      };

    } catch (error) {
      console.error('❌ CRITICAL ERROR:', error.message);
      console.error(error.stack);
      throw error;
    }
  }
}

// Ejecutar la importación
async function runOptimizedImport() {
  const importer = new OptimizedTurijobsImporter();
  await importer.processInStreaming();
}

runOptimizedImport();