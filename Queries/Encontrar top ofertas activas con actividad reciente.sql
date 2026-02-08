-- Encontrar 10-20 ofertas activas con actividad reciente
SELECT TOP 2000
  jo.IdjobVacancy,
  jo.Title,
  jo.PublicationDate,
  (SELECT COUNT(*) FROM JobOfferDisplay WHERE IdjobVacancy = jo.IdjobVacancy) AS ListImpr,
  (SELECT COUNT(*) FROM JobOfferDescriptionDisplay WHERE IdjobVacancy = jo.IdjobVacancy) AS DetailViews,
  (SELECT COUNT(*) FROM JobVacancyClicks WHERE IdjobVacancy = jo.IdjobVacancy) AS PageVisits,
  (SELECT COUNT(*) FROM Tregistration WHERE IdjobVacancy = jo.IdjobVacancy) AS Apps
FROM tJobVacancy jo
WHERE 
  jo.Idstatus = 1
  AND jo.PublicationDate >= DATEADD(DAY, -30, GETDATE())
  AND EXISTS (SELECT 1 FROM JobOfferDisplay WHERE IdjobVacancy = jo.IdjobVacancy)
ORDER BY Apps DESC, ListImpr DESC;
