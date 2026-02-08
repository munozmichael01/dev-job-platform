-- ================================================================
-- QUERY 3: MÉTRICAS POR CANAL CON UTM BREAKDOWN - FILTRO POR FECHA (CORREGIDA)
-- ================================================================

DECLARE @FechaInicio DATE = DATEADD(DAY, -30, GETDATE());
DECLARE @FechaFin DATE = NULL;

WITH OfferIds AS (
  SELECT IdjobVacancy
  FROM TJobvacancy WITH (NOLOCK)
  WHERE PublicationDate >= @FechaInicio
    AND (@FechaFin IS NULL OR PublicationDate <= @FechaFin)
),
-- Pre-agregar List Impressions por canal
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
-- Pre-agregar Detail Views por canal
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
-- Pre-agregar Page Visits por canal
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
-- Pre-agregar Applications por canal
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
  
  (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS TotalEngagements,
  (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS TotalTouchpoints,
  
  -- ========== FIX: DECIMAL(10,2) en lugar de DECIMAL(5,2) + validación adicional ==========
  CASE 
    WHEN (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) > 0
    THEN 
      -- Limitar a máximo 9999.99% para evitar overflow
      CASE 
        WHEN (ISNULL(app.Applications, 0) * 100.0 / 
             (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0))) > 9999.99
        THEN CAST(9999.99 AS DECIMAL(10,2))
        ELSE CAST(ISNULL(app.Applications, 0) * 100.0 / 
             (ISNULL(lic.ListImpressions, 0) + ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS DECIMAL(10,2))
      END
    ELSE 0
  END AS OverallConversionRate,
  
  CASE 
    WHEN (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) > 0
    THEN 
      -- Limitar a máximo 9999.99% para evitar overflow
      CASE 
        WHEN (ISNULL(app.Applications, 0) * 100.0 / 
             (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0))) > 9999.99
        THEN CAST(9999.99 AS DECIMAL(10,2))
        ELSE CAST(ISNULL(app.Applications, 0) * 100.0 / 
             (ISNULL(dvc.DetailViews, 0) + ISNULL(pvc.PageVisits, 0)) AS DECIMAL(10,2))
      END
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
