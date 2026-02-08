DECLARE @FechaInicio DATE = '2025-12-01';
DECLARE @FechaFin DATE = '2025-12-31';

WITH ListImpressionsAgg AS (
  SELECT 
    IDJobVacancy,
    COUNT(DISTINCT IDJobOfferDisplay) AS TotalListImpressions
  FROM JobOfferDisplay WITH (NOLOCK)
  WHERE IDJobVacancy IN (
    SELECT IdjobVacancy 
    FROM TJobvacancy WITH (NOLOCK)
    WHERE PublicationDate >= @FechaInicio
      AND PublicationDate <= @FechaFin
  )
  GROUP BY IDJobVacancy
),
DetailViewsAgg AS (
  SELECT 
    IDJobVacancy,
    COUNT(DISTINCT IDJobOfferDescriptionDisplay) AS TotalDetailViews
  FROM JobOfferDescriptionDisplay WITH (NOLOCK)
  WHERE IDJobVacancy IN (
    SELECT IdjobVacancy 
    FROM TJobvacancy WITH (NOLOCK)
    WHERE PublicationDate >= @FechaInicio
      AND PublicationDate <= @FechaFin
  )
  GROUP BY IDJobVacancy
),
PageVisitsAgg AS (
  SELECT 
    IDJobVacancy,
    COUNT(DISTINCT IDJobVacancyClicks) AS TotalPageVisits
  FROM JobVacancyClicks WITH (NOLOCK)
  WHERE IDJobVacancy IN (
    SELECT IdjobVacancy 
    FROM TJobvacancy WITH (NOLOCK)
    WHERE PublicationDate >= @FechaInicio
      AND PublicationDate <= @FechaFin
  )
  GROUP BY IDJobVacancy
),
ApplicationsAgg AS (
  SELECT 
    IDJobVacancy,
    COUNT(DISTINCT IDRegistration) AS TotalApplications
  FROM TRegistration WITH (NOLOCK)
  WHERE IDJobVacancy IN (
    SELECT IdjobVacancy 
    FROM TJobvacancy WITH (NOLOCK)
    WHERE PublicationDate >= @FechaInicio
      AND PublicationDate <= @FechaFin
  )
  GROUP BY IDJobVacancy
)

SELECT 
  jo.IdjobVacancy AS OfferId,
  jo.Title,

  -- Job Title
  --jo.TitleId,
  --jtd1.ID AS TitleDenominationId,
  jtd1.Denomination AS JobTitleDenomination,

  -- Company
  --jo.Identerprise AS CompanyId,
  te.Name AS CompanyName,

  -- Sector / Field
  --jo.FieldId AS SectorId,
  tf1.BaseName AS SectorName,

  -- Status
  --jo.Idstatus AS StatusId,
  CASE jo.Idstatus
    WHEN 1 THEN 'Active'
    WHEN 2 THEN 'Paused'
    WHEN 3 THEN 'Closed'
    WHEN 4 THEN 'Expired'
    ELSE 'Unknown'
  END AS StatusName,

  -- Contadores RAW
  ISNULL(li.TotalListImpressions, 0) AS TotalListImpressions,
  ISNULL(dv.TotalDetailViews, 0) AS TotalDetailViews,
  ISNULL(pv.TotalPageVisits, 0) AS TotalPageVisits,
  ISNULL(app.TotalApplications, 0) AS TotalApplications,

  -- Agregados
  (ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0)) AS TotalEngagements,
  (ISNULL(li.TotalListImpressions, 0) + ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0)) AS TotalTouchpoints,

  -- Conversiones
  CASE 
    WHEN (ISNULL(li.TotalListImpressions, 0) + ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0)) > 0
    THEN CAST(
      ISNULL(app.TotalApplications, 0) * 100.0 /
      (ISNULL(li.TotalListImpressions, 0) + ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0))
      AS DECIMAL(5,2)
    )
    ELSE NULL
  END AS OverallConversionRate,

  CASE 
    WHEN (ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0)) > 0
    THEN CAST(
      ISNULL(app.TotalApplications, 0) * 100.0 /
      (ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0))
      AS DECIMAL(5,2)
    )
    ELSE NULL
  END AS EngagementApplicationRate

  -- Metadata
  --jo.PublicationDate,
  --DATEDIFF(DAY, jo.PublicationDate, GETDATE()) AS DaysActive

FROM TJobvacancy jo
LEFT JOIN TEnterprise te WITH (NOLOCK)
  ON jo.Identerprise = te.Identerprise

-- ✅ Traer SOLO 1 denominación por TitleId + idioma 14
OUTER APPLY (
  SELECT TOP 1
    jtd.ID,
    jtd.Denomination
  FROM JobTitlesDenominations jtd WITH (NOLOCK)
  WHERE jtd.FK_JobTitle = jo.TitleId
    AND jtd.LanguageId = 7
  ORDER BY jtd.ID ASC   -- o DESC, según cuál quieras priorizar
) jtd1

-- ✅ Traer SOLO 1 sector por FieldId + idioma 14
OUTER APPLY (
  SELECT TOP 1
    tf.IdField,
    tf.BaseName
  FROM TField tf WITH (NOLOCK)
  WHERE tf.IdField = jo.FieldId
    AND tf.IdsLanguage = 7
  ORDER BY tf.IdField ASC
) tf1

LEFT JOIN ListImpressionsAgg li ON jo.IdjobVacancy = li.IDJobVacancy
LEFT JOIN DetailViewsAgg dv ON jo.IdjobVacancy = dv.IDJobVacancy
LEFT JOIN PageVisitsAgg pv ON jo.IdjobVacancy = pv.IDJobVacancy
LEFT JOIN ApplicationsAgg app ON jo.IdjobVacancy = app.IDJobVacancy

WHERE 
  jo.PublicationDate >= @FechaInicio
  AND jo.PublicationDate <= @FechaFin

ORDER BY 
  TotalApplications DESC, 
  TotalTouchpoints DESC;
