-- ================================================================
-- QUERY 1: MÉTRICAS GENERALES POR OFERTA - FILTRO POR FECHA
-- ================================================================
-- Parámetros: @FechaInicio, @FechaFin (opcional - si NULL usa solo fecha inicio)

--DECLARE @FechaInicio DATE = DATEADD(DAY, -30, GETDATE()); -- Últimos 30 días
--DECLARE @FechaFin DATE = NULL; -- NULL = sin límite superior

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
      AND (@FechaFin IS NULL OR PublicationDate <= @FechaFin)
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
      AND (@FechaFin IS NULL OR PublicationDate <= @FechaFin)
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
      AND (@FechaFin IS NULL OR PublicationDate <= @FechaFin)
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
      AND (@FechaFin IS NULL OR PublicationDate <= @FechaFin)
  )
  GROUP BY IDJobVacancy
)

SELECT 
  jo.IdjobVacancy AS OfferId,
  jo.Title,
  jo.TitleId,
--jtd.ID AS TitleDenominationId,
--jtd.Denomination AS JobTitleDenomination,
  --jo.Identerprise AS CompanyId,
  --te.Name AS CompanyName,
  jo.FieldId AS SectorId,
--tf.BaseName AS SectorName,
  
  -- ========== NUEVO: STATUS EN OUTPUT ==========
  jo.Idstatus AS StatusId,
  CASE jo.Idstatus
    WHEN 1 THEN 'Active'
    WHEN 2 THEN 'Paused'
    WHEN 3 THEN 'Closed'
    WHEN 4 THEN 'Expired'
    ELSE 'Unknown'
  END AS StatusName,
  
  -- ========== CONTADORES RAW ==========
  ISNULL(li.TotalListImpressions, 0) AS TotalListImpressions,
  ISNULL(dv.TotalDetailViews, 0) AS TotalDetailViews,
  ISNULL(pv.TotalPageVisits, 0) AS TotalPageVisits,
  ISNULL(app.TotalApplications, 0) AS TotalApplications,
  
  -- ========== AGREGADOS CALCULADOS ==========
  (ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0)) AS TotalEngagements,
  (ISNULL(li.TotalListImpressions, 0) + ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0)) AS TotalTouchpoints,
  
  -- ========== MÉTRICAS DE CONVERSIÓN ==========
  CASE 
    WHEN (ISNULL(li.TotalListImpressions, 0) + ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0)) > 0
    THEN CAST((ISNULL(app.TotalApplications, 0) * 100.0 / 
               (ISNULL(li.TotalListImpressions, 0) + ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0))) 
               AS DECIMAL(5,2))
    ELSE NULL
  END AS OverallConversionRate,
  
  CASE 
    WHEN (ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0)) > 0
    THEN CAST((ISNULL(app.TotalApplications, 0) * 100.0 / 
               (ISNULL(dv.TotalDetailViews, 0) + ISNULL(pv.TotalPageVisits, 0))) 
               AS DECIMAL(5,2))
    ELSE NULL
  END AS EngagementApplicationRate,
  
  -- ========== METADATA ==========
  jo.PublicationDate,
  DATEDIFF(DAY, jo.PublicationDate, GETDATE()) AS DaysActive

FROM TJobvacancy jo
--LEFT JOIN JobTitlesDenominations jtd WITH (NOLOCK) ON jo.TitleId = jtd.FK_JobTitle AND jtd.LanguageId = 14
--LEFT JOIN TField tf WITH (NOLOCK) ON jo.FieldId = tf.IdField AND tf.IdsLanguage = 14
--LEFT JOIN TEnterprise te WITH (NOLOCK) ON jo.Identerprise = te.Identerprise
LEFT JOIN ListImpressionsAgg li ON jo.IdjobVacancy = li.IDJobVacancy
LEFT JOIN DetailViewsAgg dv ON jo.IdjobVacancy = dv.IDJobVacancy
LEFT JOIN PageVisitsAgg pv ON jo.IdjobVacancy = pv.IDJobVacancy
LEFT JOIN ApplicationsAgg app ON jo.IdjobVacancy = app.IDJobVacancy

WHERE 
  jo.PublicationDate >= @FechaInicio
  AND (@FechaFin IS NULL OR jo.PublicationDate <= @FechaFin)

ORDER BY 
  TotalApplications DESC, 
  TotalTouchpoints DESC;
