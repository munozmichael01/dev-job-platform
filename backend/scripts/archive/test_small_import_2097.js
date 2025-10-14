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
  }
};

async function testSmallImport() {
  try {
    console.log('🧪 TESTING SMALL TURIJOBS IMPORT - 100 OFFERS');

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
      page: { index: 1, size: 8, featuredSize: 4, difussionSize: 2 },
      filter: {}
    };

    console.log('📞 Fetching first page...');
    const response = await axios.post(url, body, { headers, timeout: 30000 });

    if (response.data.offers && response.data.offers.length > 0) {
      console.log(`✅ Found ${response.data.offers.length} offers`);

      const pool = await sql.connect(config);
      let processedCount = 0;

      for (const offer of response.data.offers) {
        try {
          // Transformar oferta
          const transformedOffer = {
            ExternalId: offer.id?.toString() || null,
            Title: (offer.title || "").substring(0, 200),
            JobTitle: (offer.title || "").substring(0, 200),
            Description: (offer.description || "").substring(0, 2000),
            CompanyName: (offer.company?.enterpriseName || "").substring(0, 200),
            Sector: (offer.company?.sector || "").substring(0, 100),
            City: (offer.location?.cityName || "").substring(0, 100),
            Region: (offer.location?.regionName || "").substring(0, 100),
            Country: (offer.location?.countryName || "").substring(0, 100),
            Latitude: offer.location?.latitude || null,
            Longitude: offer.location?.longitude || null,
            JobType: (offer.type || "").substring(0, 50),
            ExternalUrl: (offer.externalUrl || "").substring(0, 500),
            ApplicationUrl: (offer.url || "").substring(0, 500),
            Vacancies: parseInt(offer.vacancies) || 1,
            PublicationDate: offer.publicationDate ? new Date(offer.publicationDate) : new Date(),
            Address: (offer.company?.address || "").substring(0, 200),
            ApplicationsGoal: parseInt(offer.applies) || null,
            Source: 'Turijobs',
            ConnectionId: 2097,
            StatusId: 1,
            CreatedAt: new Date(),
            UserId: 3
          };

          // Insertar en BD
          const request = pool.request();

          Object.keys(transformedOffer).forEach(key => {
            request.input(key, transformedOffer[key]);
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

          processedCount++;
          console.log(`✅ Processed offer ${processedCount}: ${transformedOffer.Title.substring(0, 50)}...`);

        } catch (error) {
          console.error(`❌ Error processing offer ${offer.id}:`, error.message);
        }
      }

      await pool.close();
      console.log(`🎉 COMPLETED! Processed ${processedCount}/${response.data.offers.length} offers`);

    } else {
      console.log('❌ No offers found in API response');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testSmallImport();