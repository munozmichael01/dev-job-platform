const sql = require('mssql');

const dbConfig = {
  user: process.env.DB_USER || 'jobplatform',
  password: process.env.DB_PASSWORD || 'JobPlatform2025!',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'JobPlatform',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

async function getTop25CompaniesWithOrganic() {
  let pool;
  try {
    console.log('📊 TOP 25 EMPRESAS CON MÁS OFERTAS (INCLUYENDO ORGÁNICO)');
    console.log('='.repeat(100));
    console.log('Nota: Source vacío/null = Tráfico Orgánico\n');

    pool = await sql.connect(dbConfig);

    const query = `
      WITH CompanyStats AS (
        SELECT
          CompanyName,
          COUNT(*) as TotalOffers,
          -- Conteo por fuente (incluyendo NULL/vacío como 'organic')
          SUM(CASE WHEN Source IS NULL OR Source = '' THEN 1 ELSE 0 END) as OrganicOffers,
          SUM(CASE WHEN Source = 'jooble' THEN 1 ELSE 0 END) as JoobleOffers,
          SUM(CASE WHEN Source = 'talent' THEN 1 ELSE 0 END) as TalentOffers,
          SUM(CASE WHEN Source = 'jobrapido' THEN 1 ELSE 0 END) as JobRapidoOffers,
          SUM(CASE WHEN Source = 'whatjobs' THEN 1 ELSE 0 END) as WhatJobsOffers,
          SUM(CASE WHEN Source = 'infojobs' THEN 1 ELSE 0 END) as InfoJobsOffers,
          SUM(CASE WHEN Source = 'linkedin' THEN 1 ELSE 0 END) as LinkedInOffers,
          SUM(CASE WHEN Source = 'indeed' THEN 1 ELSE 0 END) as IndeedOffers,
          -- Otros sources que no son los principales
          SUM(CASE
            WHEN Source NOT IN ('jooble', 'talent', 'jobrapido', 'whatjobs', 'infojobs', 'linkedin', 'indeed')
            AND Source IS NOT NULL
            AND Source != ''
            THEN 1
            ELSE 0
          END) as OtherSources
        FROM JobOffers
        WHERE UserId = 11
          AND StatusId IN (1, 2, 3) -- Active, Paused, Pending
        GROUP BY CompanyName
      )
      SELECT TOP 25
        CompanyName,
        TotalOffers,
        OrganicOffers,
        JoobleOffers,
        TalentOffers,
        JobRapidoOffers,
        WhatJobsOffers,
        InfoJobsOffers,
        LinkedInOffers,
        IndeedOffers,
        OtherSources,
        -- Calcular % orgánico
        CAST(ROUND((OrganicOffers * 100.0 / TotalOffers), 1) as DECIMAL(5,1)) as OrganicPercent
      FROM CompanyStats
      ORDER BY TotalOffers DESC
    `;

    const result = await pool.request().query(query);

    console.log('Ranking | Empresa                                    | Total  | Organic | % Org  | Jooble | Talent | JRapid | WJobs | IJ | LI | Indeed | Other');
    console.log('-'.repeat(170));

    result.recordset.forEach((row, index) => {
      const rank = (index + 1).toString().padStart(3);
      const company = row.CompanyName.substring(0, 42).padEnd(42);
      const total = row.TotalOffers.toString().padStart(6);
      const organic = row.OrganicOffers.toString().padStart(7);
      const organicPct = row.OrganicPercent.toString().padStart(6);
      const jooble = row.JoobleOffers.toString().padStart(6);
      const talent = row.TalentOffers.toString().padStart(6);
      const jobrapido = row.JobRapidoOffers.toString().padStart(6);
      const whatjobs = row.WhatJobsOffers.toString().padStart(5);
      const infojobs = row.InfoJobsOffers.toString().padStart(2);
      const linkedin = row.LinkedInOffers.toString().padStart(2);
      const indeed = row.IndeedOffers.toString().padStart(6);
      const other = row.OtherSources.toString().padStart(5);

      console.log(`${rank}     | ${company} | ${total} | ${organic} | ${organicPct}% | ${jooble} | ${talent} | ${jobrapido} | ${whatjobs} | ${infojobs} | ${linkedin} | ${indeed} | ${other}`);
    });

    // Totales generales
    const totalsQuery = `
      SELECT
        COUNT(*) as TotalOffers,
        SUM(CASE WHEN Source IS NULL OR Source = '' THEN 1 ELSE 0 END) as OrganicOffers,
        SUM(CASE WHEN Source = 'jooble' THEN 1 ELSE 0 END) as JoobleOffers,
        SUM(CASE WHEN Source = 'talent' THEN 1 ELSE 0 END) as TalentOffers,
        SUM(CASE WHEN Source = 'jobrapido' THEN 1 ELSE 0 END) as JobRapidoOffers,
        SUM(CASE WHEN Source = 'whatjobs' THEN 1 ELSE 0 END) as WhatJobsOffers,
        SUM(CASE WHEN Source = 'infojobs' THEN 1 ELSE 0 END) as InfoJobsOffers,
        SUM(CASE WHEN Source = 'linkedin' THEN 1 ELSE 0 END) as LinkedInOffers,
        SUM(CASE WHEN Source = 'indeed' THEN 1 ELSE 0 END) as IndeedOffers,
        SUM(CASE
          WHEN Source NOT IN ('jooble', 'talent', 'jobrapido', 'whatjobs', 'infojobs', 'linkedin', 'indeed')
          AND Source IS NOT NULL
          AND Source != ''
          THEN 1
          ELSE 0
        END) as OtherSources
      FROM JobOffers
      WHERE UserId = 11
        AND StatusId IN (1, 2, 3)
    `;

    const totalsResult = await pool.request().query(totalsQuery);
    const totals = totalsResult.recordset[0];

    console.log('\n' + '='.repeat(170));
    console.log('📊 TOTALES GENERALES (Usuario 11 - Ofertas activas):');
    console.log('-'.repeat(170));
    console.log(`Total ofertas:     ${totals.TotalOffers.toString().padStart(6)}`);
    console.log(`Orgánico:          ${totals.OrganicOffers.toString().padStart(6)} (${((totals.OrganicOffers * 100.0) / totals.TotalOffers).toFixed(1)}%)`);
    console.log(`Jooble:            ${totals.JoobleOffers.toString().padStart(6)} (${((totals.JoobleOffers * 100.0) / totals.TotalOffers).toFixed(1)}%)`);
    console.log(`Talent.com:        ${totals.TalentOffers.toString().padStart(6)} (${((totals.TalentOffers * 100.0) / totals.TotalOffers).toFixed(1)}%)`);
    console.log(`JobRapido:         ${totals.JobRapidoOffers.toString().padStart(6)} (${((totals.JobRapidoOffers * 100.0) / totals.TotalOffers).toFixed(1)}%)`);
    console.log(`WhatJobs:          ${totals.WhatJobsOffers.toString().padStart(6)} (${((totals.WhatJobsOffers * 100.0) / totals.TotalOffers).toFixed(1)}%)`);
    console.log(`InfoJobs:          ${totals.InfoJobsOffers.toString().padStart(6)} (${((totals.InfoJobsOffers * 100.0) / totals.TotalOffers).toFixed(1)}%)`);
    console.log(`LinkedIn:          ${totals.LinkedInOffers.toString().padStart(6)} (${((totals.LinkedInOffers * 100.0) / totals.TotalOffers).toFixed(1)}%)`);
    console.log(`Indeed:            ${totals.IndeedOffers.toString().padStart(6)} (${((totals.IndeedOffers * 100.0) / totals.TotalOffers).toFixed(1)}%)`);
    console.log(`Otros sources:     ${totals.OtherSources.toString().padStart(6)} (${((totals.OtherSources * 100.0) / totals.TotalOffers).toFixed(1)}%)`);

    await pool.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (pool) await pool.close();
    process.exit(1);
  }
}

getTop25CompaniesWithOrganic();
