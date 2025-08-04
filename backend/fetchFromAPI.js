const axios = require('axios');
const https = require('https');
const { pool, poolConnect, sql } = require('./db');
require('dotenv').config();

const BASE_URL = 'https://talentfortourism.com/api/search';
const HEADERS = {
  'Content-Type': 'application/json',
  'x-lang-id': '7',
  'x-site-id': '6',
  'x-country-id': '40'
};

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Ejemplo de configuración de mapeo
const mappings = {
  "turijobs": {
    "job_title": "title",
    "job_description": "description",
    "location.city": "city",
    // transformaciones personalizadas
    "salary": (value) => ({
      salaryMin: value.split('-')[0],
      salaryMax: value.split('-')[1]
    })
  }
};

async function fetchPage(pageIndex) {
  const body = {
    userId: null,
    page: {
      index: pageIndex,
      size: 20,
      featuredSize: 4,
      difussionSize: 2
    },
    filter: {}
  };

  //console.log('📦 Enviando este body al endpoint:'); >> Para activar log y leer el body en la terminal
  //console.log(JSON.stringify(body, null, 2)); >> Para activar log y leer el body en la terminal

  try {
    const response = await axios({
      method: 'post',
      url: BASE_URL,
      headers: HEADERS,
      httpsAgent,
      data: body
    });

    return response.data;
  } catch (err) {
    console.error('❌ ERROR en fetchPage:');
    console.error(err.message);
    console.error(err.config?.url);
    console.error(JSON.stringify(err.config?.data, null, 2));
    throw err;
  }
}

async function fetchAllOffers() {
  await poolConnect;
  let inserted = 0;
  let failed = [];
  const externalIdsFetched = [];

  try {
    const firstPage = await fetchPage(1);
    const totalPages = firstPage.pages;
    const allOffers = [...firstPage.offers];

    for (let i = 2; i <= totalPages; i++) {
      const data = await fetchPage(i);
      allOffers.push(...data.offers);
    }

    for (const offer of allOffers) {
      externalIdsFetched.push(offer.id);
      const publicationDate = offer.publicationDate
        ? new Date(offer.publicationDate)
        : new Date();

      try {
        await pool.request()
          .input('ExternalId', sql.Int, offer.id)
          .input('Title', sql.NVarChar(255), offer.title || '')
          .input('JobTitle', sql.NVarChar(255), offer.tags?.[offer.tags.length - 2] || offer.title || '')
          .input('Description', sql.NVarChar(sql.MAX), offer.description || '')
          .input('CompanyName', sql.NVarChar(255), offer.company?.enterpriseName || '')
          .input('Sector', sql.NVarChar(255), offer.company?.sector || '')
          .input('Address', sql.NVarChar(255), offer.company?.address || `${offer.location.cityName || ''}, ${offer.location.regionName || ''}`)
          .input('Country', sql.NVarChar(100), offer.location?.countryName || '')
          .input('CountryId', sql.Int, offer.location?.countryId || null)
          .input('Region', sql.NVarChar(100), offer.location?.regionName || '')
          .input('RegionId', sql.Int, offer.location?.regionId || null)
          .input('City', sql.NVarChar(100), offer.location?.cityName || '')
          .input('CityId', sql.Int, offer.location?.cityId || null)
          .input('Postcode', sql.NVarChar(20), offer.location?.postalCode || '')
          .input('Latitude', sql.Decimal(9, 6), offer.location?.latitude || null)
          .input('Longitude', sql.Decimal(9, 6), offer.location?.longitude || null)
          .input('Vacancies', sql.Int, offer.vacancies || 1)
          .input('SalaryMin', sql.Decimal(10, 2), 0)
          .input('SalaryMax', sql.Decimal(10, 2), 0)
          .input('JobType', sql.NVarChar(100), offer.tags?.find(tag => tag.includes('time')) || '')
          .input('ExternalUrl', sql.NVarChar(500), `https://www.turijobs.com/${offer.url}`)
          .input('ApplicationUrl', sql.NVarChar(500), offer.externalUrl || '')
          .input('Budget', sql.Decimal(10, 2), 5)
          .input('BudgetSpent', sql.Decimal(10, 2), 0)
          .input('ApplicationsGoal', sql.Int, 20)
          .input('ApplicationsReceived', sql.Int, offer.applies || 0)
          .input('StatusId', sql.Int, 1)
          .input('ClientId', sql.Int, 2)
          .input('Source', sql.NVarChar(10), 'API')
          .input('PublicationDate', sql.DateTime, publicationDate)
          .input('CreatedAt', sql.DateTime, new Date())
          .query(`
            MERGE INTO JobOffers WITH (HOLDLOCK) AS Target
            USING (SELECT @ExternalId AS ExternalId, @ClientId AS ClientId) AS Source
            ON Target.ExternalId = Source.ExternalId AND Target.ClientId = Source.ClientId
            WHEN MATCHED THEN
              UPDATE SET Title = @Title, JobTitle = @JobTitle, Description = @Description,
                         CompanyName = @CompanyName, Sector = @Sector, Address = @Address,
                         Country = @Country, CountryId = @CountryId, Region = @Region,
                         RegionId = @RegionId, City = @City, CityId = @CityId, Postcode = @Postcode,
                         Latitude = @Latitude, Longitude = @Longitude, Vacancies = @Vacancies,
                         SalaryMin = @SalaryMin, SalaryMax = @SalaryMax, JobType = @JobType,
                         ExternalUrl = @ExternalUrl, ApplicationUrl = @ApplicationUrl, Budget = @Budget,
                         BudgetSpent = @BudgetSpent, ApplicationsGoal = @ApplicationsGoal,
                         ApplicationsReceived = @ApplicationsReceived, StatusId = @StatusId,
                         Source = @Source, PublicationDate = @PublicationDate
            WHEN NOT MATCHED THEN
              INSERT (ExternalId, Title, JobTitle, Description, CompanyName, Sector, Address, Country, CountryId,
                      Region, RegionId, City, CityId, Postcode, Latitude, Longitude, Vacancies,
                      SalaryMin, SalaryMax, JobType, ExternalUrl, ApplicationUrl, Budget,
                      BudgetSpent, ApplicationsGoal, ApplicationsReceived, StatusId, ClientId, Source, PublicationDate, CreatedAt)
              VALUES (@ExternalId, @Title, @JobTitle, @Description, @CompanyName, @Sector, @Address, @Country, @CountryId,
                      @Region, @RegionId, @City, @CityId, @Postcode, @Latitude, @Longitude, @Vacancies,
                      @SalaryMin, @SalaryMax, @JobType, @ExternalUrl, @ApplicationUrl, @Budget,
                      @BudgetSpent, @ApplicationsGoal, @ApplicationsReceived, @StatusId, @ClientId, @Source, @PublicationDate, @CreatedAt);
          `);

        inserted++;
      } catch (err) {
        failed.push({ id: offer.id, reason: err.message });
      }
    }

    console.log(`✅ Total insertadas: ${inserted}`);
    console.log(`❌ Total fallidas: ${failed.length}`);
    console.table(failed);

    // ARCHIVADO
    if (externalIdsFetched.length > 0) {
      try {
        await pool.request()
          .query(`
            UPDATE JobOffers
            SET StatusId = 2
            WHERE ClientId = 2
              AND Source = 'API'
              AND ExternalId NOT IN (${externalIdsFetched.join(',')});
          `);
        console.log('📦 Archivado completado.');
      } catch (archiveErr) {
        console.error('❌ Error al archivar ofertas:', archiveErr.message);
      }
    } else {
      console.warn('⚠️ Archivado no ejecutado porque no se encontraron ofertas nuevas.');
    }

  } catch (err) {
    console.error('❌ Error general:', err.message);
  }
}

fetchAllOffers();
