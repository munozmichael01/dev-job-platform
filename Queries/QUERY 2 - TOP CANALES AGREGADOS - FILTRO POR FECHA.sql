-- ================================================================
-- QUERY 2: TOP CANALES AGREGADOS - FILTRO POR FECHA
-- ================================================================

DECLARE @FechaInicio DATE = DATEADD(DAY, -30, GETDATE());
DECLARE @FechaFin DATE = NULL;

WITH OfferIds AS (
  SELECT IdjobVacancy
  FROM TJobvacancy WITH (NOLOCK)
  WHERE PublicationDate >= @FechaInicio
    AND (@FechaFin IS NULL OR PublicationDate <= @FechaFin)
),
-- Agregar List Impressions
ListAgg AS (
  SELECT 
    ISNULL(jod.Utm_Source, 'organic') AS Source,
    COUNT(DISTINCT jod.IDJobOfferDisplay) AS ListImpressions
  FROM JobOfferDisplay jod WITH (NOLOCK)
  INNER JOIN OfferIds oi ON jod.IDJobVacancy = oi.IdjobVacancy
  GROUP BY ISNULL(jod.Utm_Source, 'organic')
),
-- Agregar Detail Views
DetailAgg AS (
  SELECT 
    ISNULL(jodd.Utm_Source, 'organic') AS Source,
    COUNT(DISTINCT jodd.IDJobOfferDescriptionDisplay) AS DetailViews
  FROM JobOfferDescriptionDisplay jodd WITH (NOLOCK)
  INNER JOIN OfferIds oi ON jodd.IDJobVacancy = oi.IdjobVacancy
  GROUP BY ISNULL(jodd.Utm_Source, 'organic')
),
-- Agregar Page Visits
ClicksAgg AS (
  SELECT 
    ISNULL(jvc.Utm_Source, 'organic') AS Source,
    COUNT(DISTINCT jvc.IDJobVacancyClicks) AS PageVisits
  FROM JobVacancyClicks jvc WITH (NOLOCK)
  INNER JOIN OfferIds oi ON jvc.IDJobVacancy = oi.IdjobVacancy
  GROUP BY ISNULL(jvc.Utm_Source, 'organic')
),
-- Agregar Applications
AppsAgg AS (
  SELECT 
    ISNULL(tr.Utm_Source, 'organic') AS Source,
    COUNT(DISTINCT tr.IDRegistration) AS Applications
  FROM TRegistration tr WITH (NOLOCK)
  INNER JOIN OfferIds oi ON tr.IDJobVacancy = oi.IdjobVacancy
  GROUP BY ISNULL(tr.Utm_Source, 'organic')
),
-- Consolidar todos los sources
AllSources AS (
  SELECT DISTINCT Source FROM ListAgg
  UNION SELECT DISTINCT Source FROM DetailAgg
  UNION SELECT DISTINCT Source FROM ClicksAgg
  UNION SELECT DISTINCT Source FROM AppsAgg
)

SELECT 
  s.Source,
  ISNULL(l.ListImpressions, 0) AS TotalListImpressions,
  ISNULL(d.DetailViews, 0) AS TotalDetailViews,
  ISNULL(c.PageVisits, 0) AS TotalPageVisits,
  ISNULL(a.Applications, 0) AS TotalApplications,
  
  (ISNULL(d.DetailViews, 0) + ISNULL(c.PageVisits, 0)) AS TotalEngagements,
  (ISNULL(l.ListImpressions, 0) + ISNULL(d.DetailViews, 0) + ISNULL(c.PageVisits, 0)) AS TotalTouchpoints,
  
  CASE 
    WHEN (ISNULL(l.ListImpressions, 0) + ISNULL(d.DetailViews, 0) + ISNULL(c.PageVisits, 0)) > 0
    THEN CAST(ISNULL(a.Applications, 0) * 100.0 / 
         (ISNULL(l.ListImpressions, 0) + ISNULL(d.DetailViews, 0) + ISNULL(c.PageVisits, 0)) AS DECIMAL(5,2))
    ELSE 0
  END AS OverallConversionRate,
  
  CASE 
    WHEN (ISNULL(d.DetailViews, 0) + ISNULL(c.PageVisits, 0)) > 0
    THEN CAST(ISNULL(a.Applications, 0) * 100.0 / 
         (ISNULL(d.DetailViews, 0) + ISNULL(c.PageVisits, 0)) AS DECIMAL(5,2))
    ELSE 0
  END AS EngagementApplicationRate

FROM AllSources s
LEFT JOIN ListAgg l ON s.Source = l.Source
LEFT JOIN DetailAgg d ON s.Source = d.Source
LEFT JOIN ClicksAgg c ON s.Source = c.Source
LEFT JOIN AppsAgg a ON s.Source = a.Source

ORDER BY TotalApplications DESC, OverallConversionRate DESC;
