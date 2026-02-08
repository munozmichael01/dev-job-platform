WITH LastReg AS (
    SELECT
        r.IDSUser,
        MAX(r.RegistrationDate) AS LastRegistrationDate
    FROM TRegistration r
    GROUP BY r.IDSUser
),
LangCandidates AS (
    SELECT DISTINCT
        c.IDCandidate
    FROM TCandidate c
    JOIN TCVWeb cv
        ON cv.IDCandidate = c.IDCandidate
       AND cv.chkDeleted = 0
    JOIN TCVWebLangLevel cll
        ON cll.IDCVWeb = cv.IDCVWeb
)
SELECT
    COUNT(DISTINCT c.IDCandidate) AS TotalCandidatos,

    -- Activos por LastLoggin
    COUNT(DISTINCT CASE WHEN u.LastLoggin >= DATEADD(DAY, -30, GETDATE()) THEN c.IDCandidate END) AS Activos30d_LastLogin,
    COUNT(DISTINCT CASE WHEN u.LastLoggin >= DATEADD(DAY, -90, GETDATE()) THEN c.IDCandidate END) AS Activos90d_LastLogin,
    COUNT(DISTINCT CASE WHEN u.LastLoggin >= DATEADD(DAY, -180, GETDATE()) THEN c.IDCandidate END) AS Activos180d_LastLogin,

    -- Activos por última inscripción
    COUNT(DISTINCT CASE WHEN lr.LastRegistrationDate >= DATEADD(DAY, -30, GETDATE()) THEN c.IDCandidate END) AS Activos30d_Inscripcion,
    COUNT(DISTINCT CASE WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE()) THEN c.IDCandidate END) AS Activos90d_Inscripcion,
    COUNT(DISTINCT CASE WHEN lr.LastRegistrationDate >= DATEADD(DAY, -180, GETDATE()) THEN c.IDCandidate END) AS Activos180d_Inscripcion,

    -- Activos (por inscripción) que además tienen idioma registrado en CV
    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -30, GETDATE())
         AND lc.IDCandidate IS NOT NULL
        THEN c.IDCandidate END) AS Activos30d_Inscripcion_ConIdiomaCV,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE())
         AND lc.IDCandidate IS NOT NULL
        THEN c.IDCandidate END) AS Activos90d_Inscripcion_ConIdiomaCV,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -180, GETDATE())
         AND lc.IDCandidate IS NOT NULL
        THEN c.IDCandidate END) AS Activos180d_Inscripcion_ConIdiomaCV,

    -- Ratios globales
    CAST(
        1.0 * COUNT(DISTINCT CASE WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE()) THEN c.IDCandidate END)
        / NULLIF(COUNT(DISTINCT c.IDCandidate), 0)
        AS DECIMAL(10,4)
    ) AS Ratio90d_Inscripcion_Total,

    CAST(
        1.0 * COUNT(DISTINCT CASE
            WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE())
             AND lc.IDCandidate IS NOT NULL
            THEN c.IDCandidate END)
        / NULLIF(COUNT(DISTINCT CASE WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE()) THEN c.IDCandidate END), 0)
        AS DECIMAL(10,4)
    ) AS Ratio90d_Inscripcion_ConIdiomaCV_SobreActivos90d
FROM TCandidate c
JOIN TSUserCandidate u
    ON u.IDSUser = c.IDSUser
LEFT JOIN LastReg lr
    ON lr.IDSUser = c.IDSUser
LEFT JOIN LangCandidates lc
    ON lc.IDCandidate = c.IDCandidate;
