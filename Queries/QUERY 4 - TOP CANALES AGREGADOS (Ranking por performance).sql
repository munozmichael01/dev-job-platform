-- ================================================================
-- QUERY 4: TOP CANALES AGREGADOS (Ranking por performance)
-- ================================================================

WITH 
-- Agregar List Impressions
ListAgg AS (
  SELECT 
    ISNULL(Utm_Source, 'organic') AS Source,
    COUNT(DISTINCT IDJobOfferDisplay) AS ListImpressions
  FROM JobOfferDisplay WITH (NOLOCK)
  WHERE IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY ISNULL(Utm_Source, 'organic')
),
-- Agregar Detail Views
DetailAgg AS (
  SELECT 
    ISNULL(Utm_Source, 'organic') AS Source,
    COUNT(DISTINCT IDJobOfferDescriptionDisplay) AS DetailViews
  FROM JobOfferDescriptionDisplay WITH (NOLOCK)
  WHERE IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY ISNULL(Utm_Source, 'organic')
),
-- Agregar Page Visits
ClicksAgg AS (
  SELECT 
    ISNULL(Utm_Source, 'organic') AS Source,
    COUNT(DISTINCT IDJobVacancyClicks) AS PageVisits
  FROM JobVacancyClicks WITH (NOLOCK)
  WHERE IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY ISNULL(Utm_Source, 'organic')
),
-- Agregar Applications
AppsAgg AS (
  SELECT 
    ISNULL(Utm_Source, 'organic') AS Source,
    COUNT(DISTINCT IDRegistration) AS Applications
  FROM TRegistration WITH (NOLOCK)
  WHERE IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY ISNULL(Utm_Source, 'organic')
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
