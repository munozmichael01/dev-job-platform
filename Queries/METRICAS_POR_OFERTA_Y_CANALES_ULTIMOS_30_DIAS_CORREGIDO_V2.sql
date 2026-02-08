-- ================================================================
-- QUERY FINAL: MÉTRICAS POR CANAL CON JOB TITLES ESTRUCTURADOS
-- ================================================================

DECLARE @FechaInicio DATE = DATEADD(DAY, -30, GETDATE());
DECLARE @FechaFin DATE = NULL;

WITH OfferIds AS (
  SELECT TOP 10000 IdjobVacancy
  FROM TJobvacancy WITH (NOLOCK)
  WHERE PublicationDate >= @FechaInicio
    AND (@FechaFin IS NULL OR PublicationDate <= @FechaFin)
  ORDER BY PublicationDate DESC
),

ListImpressionsChannel AS (
  SELECT
    jod.IDJobVacancy,
    ISNULL(jod.Utm_Source, 'organic') AS Source,
    ISNULL(jod.Utm_Medium, 'none') AS Medium,
    ISNULL(jod.Utm_Campaign, 'none') AS Campaign,
    COUNT(DISTINCT jod.IDJobOfferDisplay) AS ListImpressions
  FROM JobOfferDisplay jod WITH (NOLOCK)
  INNER JOIN OfferIds oi ON jod.IDJobVacancy = oi.IdjobVacancy
  GROUP BY jod.IDJobVacancy,
           ISNULL(jod.Utm_Source, 'organic'),
           ISNULL(jod.Utm_Medium, 'none'),
           ISNULL(jod.Utm_Campaign, 'none')
),

DetailViewsChannel AS (
  SELECT
    jodd.IDJobVacancy,
    ISNULL(jodd.Utm_Source, 'organic') AS Source,
    ISNULL(jodd.Utm_Medium, 'none') AS Medium,
    ISNULL(jodd.Utm_Campaign, 'none') AS Campaign,
    COUNT(DISTINCT jodd.IDJobOfferDescriptionDisplay) AS DetailViews
  FROM JobOfferDescriptionDisplay jodd WITH (NOLOCK)
  INNER JOIN OfferIds oi ON jodd.IDJobVacancy = oi.IdjobVacancy
  GROUP BY jodd.IDJobVacancy,
           ISNULL(jodd.Utm_Source, 'organic'),
           ISNULL(jodd.Utm_Medium, 'none'),
           ISNULL(jodd.Utm_Campaign, 'none')
),

PageVisitsChannel AS (
  SELECT
    jvc.IDJobVacancy,
    ISNULL(jvc.Utm_Source, 'organic') AS Source,
    ISNULL(jvc.Utm_Medium, 'none') AS Medium,
    ISNULL(jvc.Utm_Campaign, 'none') AS Campaign,
    COUNT(DISTINCT jvc.IDJobVacancyClicks) AS PageVisits
  FROM JobVacancyClicks jvc WITH (NOLOCK)
  INNER JOIN OfferIds oi ON jvc.IDJobVacancy = oi.IdjobVacancy
  GROUP BY jvc.IDJobVacancy,
           ISNULL(jvc.Utm_Source, 'organic'),
           ISNULL(jvc.Utm_Medium, 'none'),
           ISNULL(jvc.Utm_Campaign, 'none')
),

ApplicationsChannel AS (
  SELECT
    tr.IDJobVacancy,
    ISNULL(tr.Utm_Source, 'organic') AS Source,
    ISNULL(tr.Utm_Medium, 'none') AS Medium,
    ISNULL(tr.Utm_Campaign, 'none') AS Campaign,
    COUNT(DISTINCT tr.IDRegistration) AS Applications
  FROM TRegistration tr WITH (NOLOCK)
  INNER JOIN OfferIds oi ON tr.IDJobVacancy = oi.IdjobVacancy
  GROUP BY tr.IDJobVacancy,
           ISNULL(tr.Utm_Source, 'organic'),
           ISNULL(tr.Utm_Medium, 'none'),
           ISNULL(tr.Utm_Campaign, 'none')
),

AllChannels AS (
  SELECT DISTINCT IDJobVacancy, Source, Medium, Campaign FROM ListImpressionsChannel
  UNION
  SELECT DISTINCT IDJobVacancy, Source, Medium, Campaign FROM DetailViewsChannel
  UNION
  SELECT DISTINCT IDJobVacancy, Source, Medium, Campaign FROM PageVisitsChannel
  UNION
  SELECT DISTINCT IDJobVacancy, Source, Medium, Campaign FROM ApplicationsChannel
),

-- ========== CTEs PARA DEDUPLICAR DIMENSIONES ==========
UniqueRegions AS (
  SELECT
    IDRegion,
    BaseName,
    ROW_NUMBER() OVER (PARTITION BY IDRegion ORDER BY (SELECT NULL)) AS rn
  FROM TRegion WITH (NOLOCK)
  WHERE IDSLanguage = 14
),

UniqueCountries AS (
  SELECT
    IDCountry,
    BaseName,
    ROW_NUMBER() OVER (PARTITION BY IDCountry ORDER BY (SELECT NULL)) AS rn
  FROM TCountry WITH (NOLOCK)
  WHERE IDSLanguage = 14
),

UniqueAreas AS (
  SELECT
    IDArea,
    BaseName,
    ROW_NUMBER() OVER (PARTITION BY IDArea ORDER BY (SELECT NULL)) AS rn
  FROM TArea WITH (NOLOCK)
  WHERE IDSLanguage = 14
),

UniqueFields AS (
  SELECT
    IDfield,
    BaseName,
    ROW_NUMBER() OVER (PARTITION BY IDfield ORDER BY (SELECT NULL)) AS rn
  FROM TField WITH (NOLOCK)
  WHERE IDSLanguage = 14
),

-- ========== JOB TITLES DEDUPLICADOS ==========
UniqueJobTitles AS (
  SELECT
    jtd.FK_JobTitle,
    jtd.Denomination,
    ROW_NUMBER() OVER (
      PARTITION BY jtd.FK_JobTitle
      ORDER BY
        CASE WHEN jtd.LanguageId = 14 THEN 0 ELSE 1 END,  -- Priorizar español (14)
        jtd.ID
    ) AS rn
  FROM JobTitlesDenominations jtd WITH (NOLOCK)
  INNER JOIN JobTitles jt WITH (NOLOCK) ON jtd.FK_JobTitle = jt.ID
  WHERE jt.Active = 1
)

-- ========== QUERY FINAL: MÉTRICAS + DIMENSIONES ==========
SELECT
  -- MÉTRICAS POR CANAL
  ac.IDJobVacancy AS OfferId,
  ac.Source,
  ac.Medium,
  ac.Campaign,
  ISNULL(lic.ListImpressions, 0) AS ListImpressions,
  ISNULL(dvc.DetailViews, 0) AS DetailViews,
  ISNULL(pvc.PageVisits, 0) AS PageVisits,
  ISNULL(app.Applications, 0) AS Applications,
  (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS TotalEngagements,
  (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS TotalTouchpoints,

  CASE
    WHEN (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) > 0
    THEN CAST(ISNULL(app.Applications, 0) * 100.0 /
         (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS DECIMAL(10,2))
    ELSE 0
  END AS OverallConversionRate,

  CASE
    WHEN (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) > 0
    THEN CAST(ISNULL(app.Applications, 0) * 100.0 /
         (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS DECIMAL(10,2))
    ELSE 0
  END AS EngagementApplicationRate,

  -- DIMENSIONES DE LA OFERTA
  jo.Title AS JobTitle,                    -- ✅ Título libre de la oferta
  jo.TitleId AS JobTitleId,                -- ✅ ID del JobTitle estructurado
  ujt.Denomination AS JobTitleDenomination, -- ✅ Denominación estructurada

  -- Empresa
  jo.Identerprise AS CompanyId,
  e.Name AS CompanyName,

  -- Ubicación
  jo.IDCity AS CityId,
  c.Name AS City,
  jo.IDRegion AS RegionId,
  r.BaseName AS Region,
  jo.IDCountry AS CountryId,
  co.BaseName AS Country,

  -- Clasificación
  jo.IDArea AS AreaId,
  a.BaseName AS Area,
  jo.fieldid AS SectorId,
  f.BaseName AS Sector,

  -- Metadata
  jo.Idstatus AS StatusId,
  CASE jo.Idstatus
    WHEN 1 THEN 'Active'
    WHEN 2 THEN 'Paused'
    WHEN 3 THEN 'Closed'
    ELSE 'Unknown'
  END AS StatusName,
  jo.PublicationDate,
  DATEDIFF(DAY, jo.PublicationDate, GETDATE()) AS DaysActive

FROM AllChannels ac

-- JOIN con métricas
LEFT JOIN ListImpressionsChannel lic
  ON ac.IDJobVacancy = lic.IDJobVacancy
  AND ac.Source = lic.Source
  AND ac.Medium = lic.Medium
  AND ac.Campaign = lic.Campaign
LEFT JOIN DetailViewsChannel dvc
  ON ac.IDJobVacancy = dvc.IDJobVacancy
  AND ac.Source = dvc.Source
  AND ac.Medium = dvc.Medium
  AND ac.Campaign = dvc.Campaign
LEFT JOIN PageVisitsChannel pvc
  ON ac.IDJobVacancy = pvc.IDJobVacancy
  AND ac.Source = pvc.Source
  AND ac.Medium = pvc.Medium
  AND ac.Campaign = pvc.Campaign
LEFT JOIN ApplicationsChannel app
  ON ac.IDJobVacancy = app.IDJobVacancy
  AND ac.Source = app.Source
  AND ac.Medium = app.Medium
  AND ac.Campaign = app.Campaign

-- JOIN con dimensiones de oferta
INNER JOIN TJobvacancy jo WITH (NOLOCK) ON ac.IDJobVacancy = jo.IdjobVacancy

-- JOIN con JobTitles estructurados
LEFT JOIN UniqueJobTitles ujt ON jo.TitleId = ujt.FK_JobTitle AND ujt.rn = 1

-- JOIN con resto de dimensiones
LEFT JOIN TEnterprise e WITH (NOLOCK) ON jo.Identerprise = e.IDEnterprise
LEFT JOIN TCity c WITH (NOLOCK) ON jo.IDCity = c.IDCity
LEFT JOIN UniqueRegions r ON jo.IDRegion = r.IDRegion AND r.rn = 1
LEFT JOIN UniqueCountries co ON jo.IDCountry = co.IDCountry AND co.rn = 1
LEFT JOIN UniqueAreas a ON jo.IDArea = a.IDArea AND a.rn = 1
LEFT JOIN UniqueFields f ON jo.fieldid = f.IDfield AND f.rn = 1

ORDER BY ac.IDJobVacancy, Applications DESC;
