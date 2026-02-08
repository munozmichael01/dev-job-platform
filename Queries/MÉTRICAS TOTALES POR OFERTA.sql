-- ========== VERSIÓN OPTIMIZADA: Pre-agregar antes de JOIN ==========

WITH ListImpressionsAgg AS (
  SELECT 
    IDJobVacancy,
    COUNT(DISTINCT IDJobOfferDisplay) AS TotalListImpressions
  FROM JobOfferDisplay WITH (NOLOCK)
  WHERE IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY IDJobVacancy
),
DetailViewsAgg AS (
  SELECT 
    IDJobVacancy,
    COUNT(DISTINCT IDJobOfferDescriptionDisplay) AS TotalDetailViews
  FROM JobOfferDescriptionDisplay WITH (NOLOCK)
  WHERE IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY IDJobVacancy
),
PageVisitsAgg AS (
  SELECT 
    IDJobVacancy,
    COUNT(DISTINCT IDJobVacancyClicks) AS TotalPageVisits
  FROM JobVacancyClicks WITH (NOLOCK)
  WHERE IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY IDJobVacancy
),
ApplicationsAgg AS (
  SELECT 
    IDJobVacancy,
    COUNT(DISTINCT IDRegistration) AS TotalApplications
  FROM TRegistration WITH (NOLOCK)
  WHERE IDJobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)
  GROUP BY IDJobVacancy
)

SELECT 
  jo.IdjobVacancy AS OfferId,
  jo.Title,
  jo.Identerprise AS CompanyId,
  
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
LEFT JOIN ListImpressionsAgg li ON jo.IdjobVacancy = li.IDJobVacancy
LEFT JOIN DetailViewsAgg dv ON jo.IdjobVacancy = dv.IDJobVacancy
LEFT JOIN PageVisitsAgg pv ON jo.IdjobVacancy = pv.IDJobVacancy
LEFT JOIN ApplicationsAgg app ON jo.IdjobVacancy = app.IDJobVacancy

WHERE 
  jo.IdjobVacancy IN (316433, 316537, 316544, 316496, 316703, 316502, 316517, 316701, 316862, 316302)

ORDER BY 
  TotalApplications DESC, 
  TotalTouchpoints DESC;


