WITH LastReg AS (
    SELECT
        IDSUser,
        MAX(RegistrationDate) AS LastRegistrationDate
    FROM TRegistration
    GROUP BY IDSUser
),
CandsWithCV AS (
    SELECT DISTINCT
        c.IDCandidate,
        c.IDSUser,
        cv.IDSite
    FROM TCandidate c
    JOIN TCVWeb cv
        ON cv.IDCandidate = c.IDCandidate
       AND cv.chkDeleted = 0
)
SELECT
    c.IDSite,

    COUNT(DISTINCT c.IDCandidate) AS TotalCandidatos,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -30, GETDATE())
        THEN c.IDCandidate END) AS Activos30d,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE())
        THEN c.IDCandidate END) AS Activos90d,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -180, GETDATE())
        THEN c.IDCandidate END) AS Activos180d,

    CAST(
        1.0 * COUNT(DISTINCT CASE
            WHEN lr.LastRegistrationDate >= DATEADD(DAY, -30, GETDATE())
            THEN c.IDCandidate END)
        / NULLIF(COUNT(DISTINCT c.IDCandidate), 0)
        AS DECIMAL(10,4)
    ) AS RatioActivacion30d,

    CAST(
        1.0 * COUNT(DISTINCT CASE
            WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE())
            THEN c.IDCandidate END)
        / NULLIF(COUNT(DISTINCT c.IDCandidate), 0)
        AS DECIMAL(10,4)
    ) AS RatioActivacion90d,

    CAST(
        1.0 * COUNT(DISTINCT CASE
            WHEN lr.LastRegistrationDate >= DATEADD(DAY, -180, GETDATE())
            THEN c.IDCandidate END)
        / NULLIF(COUNT(DISTINCT c.IDCandidate), 0)
        AS DECIMAL(10,4)
    ) AS RatioActivacion180d

FROM CandsWithCV c
LEFT JOIN LastReg lr
    ON lr.IDSUser = c.IDSUser
--WHERE c.IDSite IN (6, 8)   -- ⚠️ asumir ES=6, PT=8 (confirmar)
GROUP BY c.IDSite
ORDER BY c.IDSite;

WITH LastReg AS (
    SELECT
        IDSUser,
        MAX(RegistrationDate) AS LastRegistrationDate
    FROM TRegistration
    GROUP BY IDSUser
),
CandsWithCV AS (
    SELECT DISTINCT
        c.IDCandidate,
        c.IDSUser,
        cv.IDSite
    FROM TCandidate c
    JOIN TCVWeb cv
        ON cv.IDCandidate = c.IDCandidate
       AND cv.chkDeleted = 0
)
SELECT
    c.IDSite,
    s.BaseName AS SiteName,

    COUNT(DISTINCT c.IDCandidate) AS TotalCandidatos,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -30, GETDATE())
        THEN c.IDCandidate END) AS Activos30d,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE())
        THEN c.IDCandidate END) AS Activos90d,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -180, GETDATE())
        THEN c.IDCandidate END) AS Activos180d,

    CAST(
        1.0 * COUNT(DISTINCT CASE
            WHEN lr.LastRegistrationDate >= DATEADD(DAY, -30, GETDATE())
            THEN c.IDCandidate END)
        / NULLIF(COUNT(DISTINCT c.IDCandidate), 0)
        AS DECIMAL(10,4)
    ) AS RatioActivacion30d,

    CAST(
        1.0 * COUNT(DISTINCT CASE
            WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE())
            THEN c.IDCandidate END)
        / NULLIF(COUNT(DISTINCT c.IDCandidate), 0)
        AS DECIMAL(10,4)
    ) AS RatioActivacion90d,

    CAST(
        1.0 * COUNT(DISTINCT CASE
            WHEN lr.LastRegistrationDate >= DATEADD(DAY, -180, GETDATE())
            THEN c.IDCandidate END)
        / NULLIF(COUNT(DISTINCT c.IDCandidate), 0)
        AS DECIMAL(10,4)
    ) AS RatioActivacion180d

FROM CandsWithCV c
LEFT JOIN LastReg lr
    ON lr.IDSUser = c.IDSUser
LEFT JOIN TSite s
    ON s.IDSite = c.IDSite
GROUP BY
    c.IDSite,
    s.BaseName
ORDER BY
    TotalCandidatos DESC;
