-- ================================================================
-- QUERY 2: MÉTRICAS POR CANAL CON UTM BREAKDOWN (OPTIMIZADA)
-- ================================================================
-- Test con las mismas 10 ofertas para comparar performance

WITH 
-- Pre-agregar List Impressions por canal
ListImpressionsChannel AS (
  SELECT 
    jod.IDJobVacancy,
    ISNULL(jod.Utm_Source, 'organic') AS Source,
    ISNULL(jod.Utm_Medium, 'none') AS Medium,
    ISNULL(jod.Utm_Campaign, 'none') AS Campaign,
    COUNT(DISTINCT jod.IDJobOfferDisplay) AS ListImpressions
  FROM JobOfferDisplay jod WITH (NOLOCK)
  WHERE jod.IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY jod.IDJobVacancy, 
           ISNULL(jod.Utm_Source, 'organic'),
           ISNULL(jod.Utm_Medium, 'none'),
           ISNULL(jod.Utm_Campaign, 'none')
),

-- Pre-agregar Detail Views por canal
DetailViewsChannel AS (
  SELECT 
    jodd.IDJobVacancy,
    ISNULL(jodd.Utm_Source, 'organic') AS Source,
    ISNULL(jodd.Utm_Medium, 'none') AS Medium,
    ISNULL(jodd.Utm_Campaign, 'none') AS Campaign,
    COUNT(DISTINCT jodd.IDJobOfferDescriptionDisplay) AS DetailViews
  FROM JobOfferDescriptionDisplay jodd WITH (NOLOCK)
  WHERE jodd.IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY jodd.IDJobVacancy,
           ISNULL(jodd.Utm_Source, 'organic'),
           ISNULL(jodd.Utm_Medium, 'none'),
           ISNULL(jodd.Utm_Campaign, 'none')
),

-- Pre-agregar Page Visits por canal
PageVisitsChannel AS (
  SELECT 
    jvc.IDJobVacancy,
    ISNULL(jvc.Utm_Source, 'organic') AS Source,
    ISNULL(jvc.Utm_Medium, 'none') AS Medium,
    ISNULL(jvc.Utm_Campaign, 'none') AS Campaign,
    COUNT(DISTINCT jvc.IDJobVacancyClicks) AS PageVisits
  FROM JobVacancyClicks jvc WITH (NOLOCK)
  WHERE jvc.IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY jvc.IDJobVacancy,
           ISNULL(jvc.Utm_Source, 'organic'),
           ISNULL(jvc.Utm_Medium, 'none'),
           ISNULL(jvc.Utm_Campaign, 'none')
),

-- Pre-agregar Applications por canal
ApplicationsChannel AS (
  SELECT 
    tr.IDJobVacancy,
    ISNULL(tr.Utm_Source, 'organic') AS Source,
    ISNULL(tr.Utm_Medium, 'none') AS Medium,
    ISNULL(tr.Utm_Campaign, 'none') AS Campaign,
    COUNT(DISTINCT tr.IDRegistration) AS Applications
  FROM TRegistration tr WITH (NOLOCK)
  WHERE tr.IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY tr.IDJobVacancy,
           ISNULL(tr.Utm_Source, 'organic'),
           ISNULL(tr.Utm_Medium, 'none'),
           ISNULL(tr.Utm_Campaign, 'none')
),

-- Consolidar todos los canales únicos
AllChannels AS (
  SELECT DISTINCT IDJobVacancy, Source, Medium, Campaign FROM ListImpressionsChannel
  UNION
  SELECT DISTINCT IDJobVacancy, Source, Medium, Campaign FROM DetailViewsChannel
  UNION
  SELECT DISTINCT IDJobVacancy, Source, Medium, Campaign FROM PageVisitsChannel
  UNION
  SELECT DISTINCT IDJobVacancy, Source, Medium, Campaign FROM ApplicationsChannel
)

-- Query final con todas las métricas por canal
SELECT 
  ac.IDJobVacancy,
  ac.Source,
  ac.Medium,
  ac.Campaign,
  ISNULL(lic.ListImpressions, 0) AS ListImpressions,
  ISNULL(dvc.DetailViews, 0) AS DetailViews,
  ISNULL(pvc.PageVisits, 0) AS PageVisits,
  ISNULL(app.Applications, 0) AS Applications,
  
  -- Total Engagements = DetailViews + PageVisits
  (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS TotalEngagements,
  
  -- Total Touchpoints = ListImpressions + DetailViews + PageVisits
  (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS TotalTouchpoints,
  
  -- Overall Conversion Rate = Applications / TotalTouchpoints * 100
  CASE 
    WHEN (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) > 0
    THEN CAST(ISNULL(app.Applications, 0) * 100.0 / 
         (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS DECIMAL(5,2))
    ELSE 0
  END AS OverallConversionRate,
  
  -- Engagement Application Rate = Applications / TotalEngagements * 100
  CASE 
    WHEN (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) > 0
    THEN CAST(ISNULL(app.Applications, 0) * 100.0 / 
         (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS DECIMAL(5,2))
    ELSE 0
  END AS EngagementApplicationRate

FROM AllChannels ac
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

ORDER BY ac.IDJobVacancy, ac.Source, ac.Medium, ac.Campaign;