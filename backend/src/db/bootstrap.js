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
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Campaigns_Segments FOREIGN KEY (SegmentId) REFERENCES Segments(Id)
      )
    END
  `);

  // CampaignChannels - Nueva tabla para tracking granular por canal y oferta
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

  // Applications - Tabla para aplicaciones recibidas desde canales externos
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
}

module.exports = { ensureTables };
