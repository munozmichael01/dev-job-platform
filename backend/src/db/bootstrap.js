const { pool, poolConnect, sql } = require('./db');

async function ensureTables() {
  await poolConnect;

  // Segments
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Segments')
    BEGIN
      CREATE TABLE Segments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Filters NVARCHAR(MAX) NULL, -- JSON
        Status NVARCHAR(50) NOT NULL DEFAULT 'active',
        OfferCount INT NOT NULL DEFAULT 0,
        Campaigns INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
      )
    END
  `);

  // Campaigns
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Campaigns')
    BEGIN
      CREATE TABLE Campaigns (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        SegmentId INT NOT NULL,
        DistributionType NVARCHAR(50) NOT NULL DEFAULT 'automatic',
        StartDate DATETIME NULL,
        EndDate DATETIME NULL,
        Budget DECIMAL(12,2) NULL,
        TargetApplications INT NULL,
        MaxCPA DECIMAL(12,2) NULL,
        Channels NVARCHAR(MAX) NULL, -- JSON
        BidStrategy NVARCHAR(50) NULL,
        ManualBid DECIMAL(12,2) NULL,
        Priority NVARCHAR(20) NULL,
        AutoOptimization BIT NOT NULL DEFAULT 1,
        Status NVARCHAR(50) NOT NULL DEFAULT 'active',
        InternalConfig NVARCHAR(MAX) NULL, -- JSON con campos internos (maxCPC, dailyBudget, timezone, etc.)
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Campaigns_Segments FOREIGN KEY (SegmentId) REFERENCES Segments(Id)
      )
    END
  `);

  // Agregar columna InternalConfig a tabla Campaigns existente (si no existe)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Campaigns') AND name = 'InternalConfig')
    BEGIN
      ALTER TABLE Campaigns 
      ADD InternalConfig NVARCHAR(MAX) NULL
      PRINT 'Columna InternalConfig agregada a tabla Campaigns'
    END
    ELSE
    BEGIN
      PRINT 'Columna InternalConfig ya existe en tabla Campaigns'
    END
  `);

  // Notifications - Tabla para sistema de alertas y notificaciones
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications')
    BEGIN
      CREATE TABLE Notifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NULL,
        CampaignId INT NULL,
        Type NVARCHAR(50) NOT NULL,
        Priority NVARCHAR(20) NOT NULL DEFAULT 'medium',
        Title NVARCHAR(255) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        Data NVARCHAR(MAX) NULL,
        Context NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        ReadAt DATETIME NULL,
        Acknowledged BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT FK_Notifications_Campaigns FOREIGN KEY (CampaignId) REFERENCES Campaigns(Id)
      )
    END
  `);

  // CampaignChannels - Nueva tabla para tracking granular por canal y oferta
  // (Comentado para evitar error de permisos - tabla se creará manualmente)
  /*
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CampaignChannels')
    BEGIN
      CREATE TABLE CampaignChannels (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CampaignId INT NOT NULL,
        OfferId INT NOT NULL,
        ChannelId NVARCHAR(50) NOT NULL,
        
        -- Distribución de presupuesto
        AllocatedBudget DECIMAL(10,2) NOT NULL DEFAULT 0,
        SpentBudget DECIMAL(10,2) NOT NULL DEFAULT 0,
        AllocatedTarget INT NOT NULL DEFAULT 0,
        AchievedApplications INT NOT NULL DEFAULT 0,
        
        -- Performance tracking
        CurrentCPA DECIMAL(8,2) NULL,
        BidAmount DECIMAL(8,2) NULL,
        QualityScore INT DEFAULT 0,
        ConversionRate DECIMAL(5,2) DEFAULT 0,
        
        -- Identificadores externos para sincronización
        ExternalCampaignId NVARCHAR(255) NULL,
        
        -- Estado y control
        Status NVARCHAR(20) NOT NULL DEFAULT 'active',
        AutoOptimization BIT NOT NULL DEFAULT 1,
        LastOptimized DATETIME NULL,
        
        -- Timestamps
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Relaciones y constraints
        CONSTRAINT FK_CampaignChannels_Campaigns FOREIGN KEY (CampaignId) REFERENCES Campaigns(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CampaignChannels_JobOffers FOREIGN KEY (OfferId) REFERENCES JobOffers(Id) ON DELETE CASCADE,
        CONSTRAINT UC_CampaignChannels_Unique UNIQUE (CampaignId, OfferId, ChannelId)
      )
      
      -- Índices para performance
      CREATE INDEX IX_CampaignChannels_Campaign ON CampaignChannels(CampaignId);
      CREATE INDEX IX_CampaignChannels_Offer ON CampaignChannels(OfferId);
      CREATE INDEX IX_CampaignChannels_Channel ON CampaignChannels(ChannelId);
      CREATE INDEX IX_CampaignChannels_Status ON CampaignChannels(Status, CampaignId);
    END
  `);
  */

  // Applications - Tabla para aplicaciones recibidas desde canales externos
  // (Comentado para evitar error de permisos - tabla se creará manualmente)
  /*
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Applications')
    BEGIN
      CREATE TABLE Applications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ApplicantName NVARCHAR(255) NOT NULL,
        ApplicantEmail NVARCHAR(255) NOT NULL,
        ApplicantPhone NVARCHAR(50) NULL,
        ExternalJobId NVARCHAR(255) NOT NULL,
        JobTitle NVARCHAR(255) NULL,
        CompanyName NVARCHAR(255) NULL,
        Source NVARCHAR(50) NOT NULL, -- talent, jooble, etc.
        SourceApplicationId NVARCHAR(255) NULL,
        ReceivedAt DATETIME NOT NULL,
        ProcessedAt DATETIME NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'received',
        ApplicantData NVARCHAR(MAX) NULL, -- JSON con datos completos
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
      )
      
      -- Índices para performance
      CREATE INDEX IX_Applications_Source ON Applications(Source, ReceivedAt);
      CREATE INDEX IX_Applications_JobId ON Applications(ExternalJobId, ReceivedAt);
      CREATE INDEX IX_Applications_Email ON Applications(ApplicantEmail);
      CREATE INDEX IX_Applications_Status ON Applications(Status, ReceivedAt);
    END
  `);
  */

  // UserChannelCredentials - Tabla ya creada manualmente 
  // (Comentado para evitar error de permisos - tabla existe en BD)
  /*
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserChannelCredentials')
    BEGIN
      CREATE TABLE UserChannelCredentials (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL, -- ID del usuario/cliente
        ChannelId NVARCHAR(50) NOT NULL, -- 'jooble', 'talent', 'jobrapido', etc.
        ChannelName NVARCHAR(100) NOT NULL, -- Nombre del canal para display
        
        -- Credenciales encriptadas en JSON
        EncryptedCredentials NVARCHAR(MAX) NOT NULL,
        
        -- Metadatos de la configuración
        ConfigurationData NVARCHAR(MAX) NULL, -- Configuraciones adicionales del canal
        
        -- Estado y validación
        IsActive BIT NOT NULL DEFAULT 1,
        IsValidated BIT NOT NULL DEFAULT 0, -- Si las credenciales han sido validadas
        LastValidated DATETIME NULL,
        ValidationError NVARCHAR(500) NULL,
        
        -- Límites y configuración
        DailyBudgetLimit DECIMAL(10,2) NULL,
        MonthlyBudgetLimit DECIMAL(10,2) NULL,
        MaxCPA DECIMAL(8,2) NULL,
        
        -- Auditoría
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy NVARCHAR(100) NULL,
        
        -- Constraints
        CONSTRAINT UQ_UserChannelCredentials_User_Channel UNIQUE(UserId, ChannelId)
      )
      
      -- Índices para performance
      CREATE INDEX IX_UserChannelCredentials_User ON UserChannelCredentials(UserId, IsActive);
      CREATE INDEX IX_UserChannelCredentials_Channel ON UserChannelCredentials(ChannelId, IsActive);
      CREATE INDEX IX_UserChannelCredentials_Validation ON UserChannelCredentials(IsValidated, LastValidated);
    END
  `);
  */

  // CampaignSegments - Tabla ya creada manualmente 
  // (Comentado para evitar error de permisos - tabla debe existir en BD)
  /*
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CampaignSegments')
    BEGIN
      CREATE TABLE CampaignSegments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CampaignId INT NOT NULL,
        SegmentId INT NOT NULL,
        
        -- Configuración específica por segmento (opcional)
        BudgetAllocation DECIMAL(5,2) NULL, -- Porcentaje del presupuesto asignado a este segmento
        Weight DECIMAL(5,2) DEFAULT 1.0, -- Peso relativo para distribución automática
        
        -- Auditoría
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT FK_CampaignSegments_Campaign FOREIGN KEY (CampaignId) REFERENCES Campaigns(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CampaignSegments_Segment FOREIGN KEY (SegmentId) REFERENCES Segments(Id),
        CONSTRAINT UQ_CampaignSegments_Campaign_Segment UNIQUE(CampaignId, SegmentId)
      )

      -- Índices para performance
      CREATE INDEX IX_CampaignSegments_Campaign ON CampaignSegments(CampaignId);
      CREATE INDEX IX_CampaignSegments_Segment ON CampaignSegments(SegmentId);
    END
  `);
  */

  // Notifications - Sistema de notificaciones interno
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications')
    BEGIN
      CREATE TABLE Notifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NULL,
        CampaignId INT NULL,
        Type NVARCHAR(50) NOT NULL,
        Priority NVARCHAR(20) NOT NULL DEFAULT 'medium',
        Title NVARCHAR(255) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        Data NVARCHAR(MAX) NULL,
        Context NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        ReadAt DATETIME NULL,
        Acknowledged BIT NOT NULL DEFAULT 0
      )
      
      -- Índices para performance
      CREATE INDEX IX_Notifications_UserId ON Notifications(UserId);
      CREATE INDEX IX_Notifications_CampaignId ON Notifications(CampaignId);
      CREATE INDEX IX_Notifications_Type ON Notifications(Type);
      CREATE INDEX IX_Notifications_CreatedAt ON Notifications(CreatedAt);
      CREATE INDEX IX_Notifications_ReadAt ON Notifications(ReadAt);
    END
  `);

  // Users - Tabla para autenticación de usuarios
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
    BEGIN
      CREATE TABLE Users (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        FirstName NVARCHAR(255) NOT NULL,
        LastName NVARCHAR(255) NOT NULL,
        Company NVARCHAR(255) NOT NULL,
        Website NVARCHAR(500) NULL,
        Phone NVARCHAR(50) NOT NULL,
        PasswordHash NVARCHAR(255) NULL, -- Para autenticación tradicional
        Image NVARCHAR(500) NULL,
        GoogleId NVARCHAR(100) NULL, -- Para autenticación Google
        Role NVARCHAR(50) NOT NULL DEFAULT 'user',
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
      )
      
      -- Índices para performance
      CREATE UNIQUE INDEX IX_Users_Email ON Users(Email);
      CREATE INDEX IX_Users_GoogleId ON Users(GoogleId);
      CREATE INDEX IX_Users_Active ON Users(IsActive);
      
      PRINT 'Tabla Users creada exitosamente'
    END
    ELSE
    BEGIN
      PRINT 'Tabla Users ya existe'
    END
  `);

  // Agregar columnas faltantes a tabla Users existente
  await pool.request().query(`
    -- Agregar columna FirstName si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'FirstName')
    BEGIN
      ALTER TABLE Users ADD FirstName NVARCHAR(255) NULL
      PRINT 'Columna FirstName agregada a tabla Users'
    END
    
    -- Agregar columna LastName si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'LastName')
    BEGIN
      ALTER TABLE Users ADD LastName NVARCHAR(255) NULL
      PRINT 'Columna LastName agregada a tabla Users'
    END
    
    -- Agregar columna Company si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Company')
    BEGIN
      ALTER TABLE Users ADD Company NVARCHAR(255) NULL
      PRINT 'Columna Company agregada a tabla Users'
    END
    
    -- Agregar columna Website si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Website')
    BEGIN
      ALTER TABLE Users ADD Website NVARCHAR(500) NULL
      PRINT 'Columna Website agregada a tabla Users'
    END
    
    -- Agregar columna Phone si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Phone')
    BEGIN
      ALTER TABLE Users ADD Phone NVARCHAR(50) NULL
      PRINT 'Columna Phone agregada a tabla Users'
    END
    
    -- Agregar columna PasswordHash si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PasswordHash')
    BEGIN
      ALTER TABLE Users ADD PasswordHash NVARCHAR(255) NULL
      PRINT 'Columna PasswordHash agregada a tabla Users'
    END
    
    -- Agregar columna GoogleId si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'GoogleId')
    BEGIN
      ALTER TABLE Users ADD GoogleId NVARCHAR(100) NULL
      PRINT 'Columna GoogleId agregada a tabla Users'
    END
    
    -- Agregar columna Image si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Image')
    BEGIN
      ALTER TABLE Users ADD Image NVARCHAR(500) NULL
      PRINT 'Columna Image agregada a tabla Users'
    END
    
    -- Agregar columna Role si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Role')
    BEGIN
      ALTER TABLE Users ADD Role NVARCHAR(50) NOT NULL DEFAULT 'user'
      PRINT 'Columna Role agregada a tabla Users'
    END
    
    -- Agregar columna IsActive si no existe
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsActive')
    BEGIN
      ALTER TABLE Users ADD IsActive BIT NOT NULL DEFAULT 1
      PRINT 'Columna IsActive agregada a tabla Users'
    END
  `);

  // Agregar relación UserId a tabla Campaigns si no existe
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Campaigns') AND name = 'UserId')
    BEGIN
      ALTER TABLE Campaigns ADD UserId BIGINT NULL
      PRINT 'Columna UserId agregada a tabla Campaigns'
    END
    ELSE
    BEGIN
      PRINT 'Columna UserId ya existe en tabla Campaigns'
    END
  `);

  console.log('🎯 Todas las tablas están disponibles');
}

module.exports = { ensureTables };
