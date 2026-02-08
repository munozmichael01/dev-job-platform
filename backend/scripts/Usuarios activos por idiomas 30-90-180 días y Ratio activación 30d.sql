WITH LastReg AS (
    SELECT
        IDSUser,
        MAX(RegistrationDate) AS LastRegistrationDate
    FROM TRegistration
    GROUP BY IDSUser
),
CandsWithCV AS (
    -- Universo: candidatos con algún CV no borrado
    SELECT DISTINCT
        c.IDCandidate,
        c.IDSUser
    FROM TCandidate c
    JOIN TCVWeb cv
        ON cv.IDCandidate = c.IDCandidate
       AND cv.chkDeleted = 0
),
CandLang AS (
    -- Candidato - Idioma (estructurado en CV)
    SELECT DISTINCT
        c.IDCandidate,
        c.IDSUser,
        cll.IDSLanguage
    FROM TCandidate c
    JOIN TCVWeb cv
        ON cv.IDCandidate = c.IDCandidate
       AND cv.chkDeleted = 0
    JOIN TCVWebLangLevel cll
        ON cll.IDCVWeb = cv.IDCVWeb
),
CandNoLang AS (
    -- Candidatos con CV pero sin ningún idioma en CV
    SELECT
        cc.IDCandidate,
        cc.IDSUser,
        CAST(NULL AS INT) AS IDSLanguage
    FROM CandsWithCV cc
    WHERE NOT EXISTS (
        SELECT 1
        FROM CandLang cl
        WHERE cl.IDCandidate = cc.IDCandidate
    )
),
CandLangAll AS (
    SELECT IDCandidate, IDSUser, IDSLanguage FROM CandLang
    UNION ALL
    SELECT IDCandidate, IDSUser, IDSLanguage FROM CandNoLang
),
LangName AS (
    -- Mapa único de nombres en inglés por IDSLanguage
    SELECT
        IDSLanguage,
        MAX(BaseName) AS BaseName_EN
    FROM TLanguageName
    WHERE IDSLanguageText = 14
    GROUP BY IDSLanguage
)
SELECT
    cla.IDSLanguage,
    CASE
        WHEN cla.IDSLanguage IS NULL THEN 'Desconocido'
        WHEN ln.BaseName_EN IS NULL THEN CONCAT('IDSLanguage ', cla.IDSLanguage)
        ELSE ln.BaseName_EN
    END AS Idioma_EN,

    COUNT(DISTINCT cla.IDCandidate) AS Total,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -30, GETDATE())
        THEN cla.IDCandidate END) AS Activos30d,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -90, GETDATE())
        THEN cla.IDCandidate END) AS Activos90d,

    COUNT(DISTINCT CASE
        WHEN lr.LastRegistrationDate >= DATEADD(DAY, -180, GETDATE())
        THEN cla.IDCandidate END) AS Activos180d,

    -- Ratio de activación últimos 30 días
    CAST(
        1.0 * COUNT(DISTINCT CASE
            WHEN lr.LastRegistrationDate >= DATEADD(DAY, -30, GETDATE())
            THEN cla.IDCandidate END)
        / NULLIF(COUNT(DISTINCT cla.IDCandidate), 0) * 100
        AS DECIMAL(10,4)
    ) AS RatioActivacion30d

FROM CandLangAll cla
LEFT JOIN LastReg lr
    ON lr.IDSUser = cla.IDSUser
LEFT JOIN LangName ln
    ON ln.IDSLanguage = cla.IDSLanguage
GROUP BY
    cla.IDSLanguage,
    CASE
        WHEN cla.IDSLanguage IS NULL THEN 'Desconocido'
        WHEN ln.BaseName_EN IS NULL THEN CONCAT('IDSLanguage ', cla.IDSLanguage)
        ELSE ln.BaseName_EN
    END
ORDER BY
    Total DESC;
