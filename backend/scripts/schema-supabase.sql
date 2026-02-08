-- ============================================================================
-- SCHEMA COMPLETO PARA SUPABASE (PostgreSQL)
-- Compatible con modelo actual + futuro Turijobs
-- ============================================================================

-- ============================================================================
-- TABLA: Users
-- ============================================================================
CREATE TABLE "Users" (
  "UserId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Email" VARCHAR(255) NOT NULL UNIQUE,
  "PasswordHash" VARCHAR(255) NOT NULL,
  "FirstName" VARCHAR(100),
  "LastName" VARCHAR(100),
  "CompanyName" VARCHAR(255),
  "Role" VARCHAR(50) DEFAULT 'user',
  "IsActive" BOOLEAN DEFAULT true,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON "Users"("Email");

-- ============================================================================
-- TABLA: Channels (Canales de distribución)
-- ============================================================================
CREATE TABLE "Channels" (
  "ChannelId" VARCHAR(50) PRIMARY KEY,
  "Name" VARCHAR(100) NOT NULL,
  "Description" TEXT,
  "IsActive" BOOLEAN DEFAULT true,
  "ConfigSchema" JSONB,
  "CreatedAt" TIMESTAMP DEFAULT NOW()
);

-- Insertar canales por defecto
INSERT INTO "Channels" ("ChannelId", "Name", "Description") VALUES
('jooble', 'Jooble', 'CPC €15-25 - Auction API'),
('talent', 'Talent.com', 'CPA €18 - XML Feed'),
('jobrapido', 'JobRapido', '€12 - Feed orgánico'),
('whatjobs', 'WhatJobs', 'CPC €14 - XML Feed + S2S'),
('infojobs', 'InfoJobs', 'Canal #1 en España (pendiente)'),
('linkedin', 'LinkedIn', 'Job Postings API (pendiente)'),
('indeed', 'Indeed', 'Mayor volumen global (pendiente)');

-- ============================================================================
-- TABLA: Connections (Conexiones XML/API/CSV)
-- ============================================================================
CREATE TABLE "Connections" (
  "ConnectionId" SERIAL PRIMARY KEY,
  "UserId" UUID NOT NULL REFERENCES "Users"("UserId") ON DELETE CASCADE,
  "Name" VARCHAR(255) NOT NULL,
  "Type" VARCHAR(50) NOT NULL, -- 'xml', 'api', 'csv'
  "Url" TEXT,
  "AuthType" VARCHAR(50),
  "AuthCredentials" TEXT,
  "ScheduleEnabled" BOOLEAN DEFAULT false,
  "ScheduleFrequency" INTEGER,
  "LastSync" TIMESTAMP,
  "Status" VARCHAR(50) DEFAULT 'active',
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_connections_userid ON "Connections"("UserId");

-- ============================================================================
-- TABLA: FieldMappings (Mapeos de campos)
-- ============================================================================
CREATE TABLE "FieldMappings" (
  "MappingId" SERIAL PRIMARY KEY,
  "ConnectionId" INTEGER NOT NULL REFERENCES "Connections"("ConnectionId") ON DELETE CASCADE,
  "SourceField" VARCHAR(255) NOT NULL,
  "TargetField" VARCHAR(255) NOT NULL,
  "TransformationType" VARCHAR(50),
  "TransformationConfig" TEXT,
  "CreatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fieldmappings_connectionid ON "FieldMappings"("ConnectionId");

-- ============================================================================
-- TABLA: JobOffers (HÍBRIDO - Modelo actual + Turijobs)
-- ============================================================================
CREATE TABLE "JobOffers" (
  "OfferId" SERIAL PRIMARY KEY,
  "UserId" UUID NOT NULL REFERENCES "Users"("UserId") ON DELETE CASCADE,
  "ConnectionId" INTEGER REFERENCES "Connections"("ConnectionId") ON DELETE SET NULL,

  -- ===== CAMPOS ACTUALES (Obligatorios/existentes) =====
  "ExternalId" VARCHAR(50),
  "Title" VARCHAR(255) NOT NULL,
  "Description" TEXT,
  "CompanyName" VARCHAR(255),
  "Sector" VARCHAR(100),
  "Address" VARCHAR(500),
  "Country" VARCHAR(100),
  "Region" VARCHAR(100),
  "City" VARCHAR(100),
  "Postcode" VARCHAR(20),
  "Latitude" DECIMAL(10, 7),
  "Longitude" DECIMAL(10, 7),
  "Vacancies" INTEGER DEFAULT 1,
  "SalaryMin" DECIMAL(10, 2),
  "SalaryMax" DECIMAL(10, 2),
  "JobType" VARCHAR(100),
  "ExternalUrl" TEXT,
  "ApplicationUrl" TEXT,
  "Budget" DECIMAL(10, 2),
  "ApplicationsGoal" INTEGER,
  "Source" VARCHAR(100),
  "PublicationDate" TIMESTAMP,
  "StatusId" INTEGER DEFAULT 1,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW(),

  -- ===== CAMPOS TURIJOBS (Opcionales - NULL permitido) =====
  -- IDs de clasificación
  "TitleId" INTEGER,
  "TitleDenominationId" INTEGER,
  "AreaId" INTEGER,
  "SectorId" INTEGER,
  "DegreeId" INTEGER,
  "ExperienceId" INTEGER,
  "ContractTypeId" INTEGER,
  "WorkdayTypeId" INTEGER,
  "SalaryTypeId" INTEGER,
  "CompanyId" INTEGER,
  "BrandId" INTEGER,
  "CityId" INTEGER,
  "RegionId" INTEGER,
  "CountryId" INTEGER,
  "LanguageId" INTEGER,

  -- Display names (nombres descriptivos de IDs)
  "JobTitle" VARCHAR(255),
  "Area" VARCHAR(100),
  "BrandName" VARCHAR(255),
  "DegreeName" VARCHAR(100),
  "ExperienceName" VARCHAR(100),
  "ContractTypeName" VARCHAR(100),
  "WorkdayTypeName" VARCHAR(100),
  "Language" VARCHAR(100),
  "SalaryTypeName" VARCHAR(50),
  "SalaryCurrency" VARCHAR(10),
  "SalaryVisible" BOOLEAN DEFAULT false,

  -- Campos adicionales Turijobs
  "Requirements" TEXT,
  "ScheduleTime" VARCHAR(255),
  "StatusName" VARCHAR(50),
  "FinishDate" TIMESTAMP,
  "LastModified" TIMESTAMP,
  "OfferUrl" VARCHAR(500),
  "RedirectUrl" VARCHAR(500),
  "HasRedirect" BOOLEAN DEFAULT false,
  "IsBlind" BOOLEAN DEFAULT false,
  "IsFilled" BOOLEAN DEFAULT false,
  "IsFeatured" BOOLEAN DEFAULT false,
  "CountryISO" VARCHAR(2)
);

CREATE INDEX idx_joboffers_userid ON "JobOffers"("UserId");
CREATE INDEX idx_joboffers_externalid ON "JobOffers"("ExternalId");
CREATE INDEX idx_joboffers_statusid ON "JobOffers"("StatusId");
CREATE INDEX idx_joboffers_publicationdate ON "JobOffers"("PublicationDate");
CREATE INDEX idx_joboffers_city ON "JobOffers"("City");
CREATE INDEX idx_joboffers_sector ON "JobOffers"("Sector");

-- ============================================================================
-- TABLA: Campaigns
-- ============================================================================
CREATE TABLE "Campaigns" (
  "CampaignId" SERIAL PRIMARY KEY,
  "UserId" UUID NOT NULL REFERENCES "Users"("UserId") ON DELETE CASCADE,
  "Name" VARCHAR(255) NOT NULL,
  "Description" TEXT,
  "Budget" DECIMAL(10, 2) DEFAULT 0,
  "StartDate" TIMESTAMP,
  "EndDate" TIMESTAMP,
  "StatusId" INTEGER DEFAULT 1,
  "ApplicationsGoal" INTEGER,
  "ActualSpend" DECIMAL(10, 2) DEFAULT 0,
  "ActualApplications" INTEGER DEFAULT 0,
  "LastMetricsSync" TIMESTAMP,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_userid ON "Campaigns"("UserId");
CREATE INDEX idx_campaigns_statusid ON "Campaigns"("StatusId");

-- ============================================================================
-- TABLA: Segments (Segmentación de ofertas)
-- ============================================================================
CREATE TABLE "Segments" (
  "SegmentId" SERIAL PRIMARY KEY,
  "UserId" UUID NOT NULL REFERENCES "Users"("UserId") ON DELETE CASCADE,
  "ConnectionId" INTEGER REFERENCES "Connections"("ConnectionId") ON DELETE CASCADE,
  "Name" VARCHAR(255) NOT NULL,
  "Description" TEXT,
  "FilterCriteria" JSONB,
  "OfferCount" INTEGER DEFAULT 0,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_segments_userid ON "Segments"("UserId");
CREATE INDEX idx_segments_connectionid ON "Segments"("ConnectionId");

-- ============================================================================
-- TABLA: CampaignOffers (Relación Campañas-Ofertas)
-- ============================================================================
CREATE TABLE "CampaignOffers" (
  "CampaignOfferId" SERIAL PRIMARY KEY,
  "CampaignId" INTEGER NOT NULL REFERENCES "Campaigns"("CampaignId") ON DELETE CASCADE,
  "OfferId" INTEGER NOT NULL REFERENCES "JobOffers"("OfferId") ON DELETE CASCADE,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("CampaignId", "OfferId")
);

CREATE INDEX idx_campaignoffers_campaignid ON "CampaignOffers"("CampaignId");
CREATE INDEX idx_campaignoffers_offerid ON "CampaignOffers"("OfferId");

-- ============================================================================
-- TABLA: CampaignChannels (Distribución por canal)
-- ============================================================================
CREATE TABLE "CampaignChannels" (
  "CampaignChannelId" SERIAL PRIMARY KEY,
  "CampaignId" INTEGER NOT NULL REFERENCES "Campaigns"("CampaignId") ON DELETE CASCADE,
  "ChannelId" VARCHAR(50) NOT NULL REFERENCES "Channels"("ChannelId"),
  "AllocatedBudget" DECIMAL(10, 2) DEFAULT 0,
  "Status" INTEGER DEFAULT 1,
  "ExternalCampaignId" VARCHAR(100),
  "EstimatedCPC" DECIMAL(10, 2) DEFAULT 0,
  "ActualSpend" DECIMAL(10, 2) DEFAULT 0,
  "ActualClicks" INTEGER DEFAULT 0,
  "ActualImpressions" INTEGER DEFAULT 0,
  "ActualApplications" INTEGER DEFAULT 0,
  "LastSyncAt" TIMESTAMP,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("CampaignId", "ChannelId")
);

CREATE INDEX idx_campaignchannels_campaignid ON "CampaignChannels"("CampaignId");
CREATE INDEX idx_campaignchannels_channelid ON "CampaignChannels"("ChannelId");

-- ============================================================================
-- TABLA: UserChannelCredentials (Credenciales encriptadas)
-- ============================================================================
CREATE TABLE "UserChannelCredentials" (
  "CredentialId" SERIAL PRIMARY KEY,
  "UserId" UUID NOT NULL REFERENCES "Users"("UserId") ON DELETE CASCADE,
  "ChannelId" VARCHAR(50) NOT NULL REFERENCES "Channels"("ChannelId"),
  "EncryptedCredentials" TEXT NOT NULL,
  "IsActive" BOOLEAN DEFAULT true,
  "LastValidated" TIMESTAMP,
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("UserId", "ChannelId")
);

CREATE INDEX idx_userchannelcredentials_userid ON "UserChannelCredentials"("UserId");

-- ============================================================================
-- TABLAS TURIJOBS - MÉTRICAS (Futuro)
-- ============================================================================

-- Métricas globales por oferta y ventana temporal
CREATE TABLE "OfferMetrics" (
  "OfferMetricId" SERIAL PRIMARY KEY,
  "OfferId" INTEGER NOT NULL REFERENCES "JobOffers"("OfferId") ON DELETE CASCADE,
  "ExternalOfferId" VARCHAR(50) NOT NULL,
  "WindowType" VARCHAR(20) NOT NULL CHECK ("WindowType" IN ('lifetime', 'last30d', 'last7d')),

  -- Funnel metrics (4 niveles)
  "TotalListImpressions" INTEGER DEFAULT 0,
  "TotalDetailViews" INTEGER DEFAULT 0,
  "TotalPageVisits" INTEGER DEFAULT 0,
  "TotalApplications" INTEGER DEFAULT 0,

  -- Pre-calculated metrics
  "TotalEngagements" INTEGER DEFAULT 0,
  "TotalTouchpoints" INTEGER DEFAULT 0,
  "OverallConversionRate" DECIMAL(10, 4) DEFAULT 0,
  "EngagementApplicationRate" DECIMAL(10, 4) DEFAULT 0,

  "LastSyncAt" TIMESTAMP DEFAULT NOW(),
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW(),

  UNIQUE("OfferId", "WindowType")
);

CREATE INDEX idx_offermetrics_offerid ON "OfferMetrics"("OfferId");
CREATE INDEX idx_offermetrics_externalofferid ON "OfferMetrics"("ExternalOfferId");
CREATE INDEX idx_offermetrics_windowtype ON "OfferMetrics"("WindowType");

-- Métricas por canal (source/medium/campaign)
CREATE TABLE "OfferMetricsByChannel" (
  "ChannelMetricId" SERIAL PRIMARY KEY,
  "OfferId" INTEGER NOT NULL REFERENCES "JobOffers"("OfferId") ON DELETE CASCADE,
  "ExternalOfferId" VARCHAR(50) NOT NULL,
  "Source" VARCHAR(100) NOT NULL,
  "Medium" VARCHAR(100) NOT NULL,
  "Campaign" VARCHAR(200),
  "WindowType" VARCHAR(20) NOT NULL CHECK ("WindowType" IN ('lifetime', 'last30d', 'last7d')),

  -- Funnel metrics (mismo que OfferMetrics)
  "TotalListImpressions" INTEGER DEFAULT 0,
  "TotalDetailViews" INTEGER DEFAULT 0,
  "TotalPageVisits" INTEGER DEFAULT 0,
  "TotalApplications" INTEGER DEFAULT 0,
  "TotalEngagements" INTEGER DEFAULT 0,
  "TotalTouchpoints" INTEGER DEFAULT 0,
  "OverallConversionRate" DECIMAL(10, 4) DEFAULT 0,
  "EngagementApplicationRate" DECIMAL(10, 4) DEFAULT 0,

  -- Cost tracking
  "ChannelSpend" DECIMAL(10, 2) DEFAULT 0,

  "LastSyncAt" TIMESTAMP DEFAULT NOW(),
  "CreatedAt" TIMESTAMP DEFAULT NOW(),
  "UpdatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_offermetricsbychannel_offerid ON "OfferMetricsByChannel"("OfferId");
CREATE INDEX idx_offermetricsbychannel_source ON "OfferMetricsByChannel"("Source");

-- Unique constraint separado (Campaign puede ser NULL)
CREATE UNIQUE INDEX idx_offermetricsbychannel_unique
  ON "OfferMetricsByChannel"("OfferId", "Source", "Medium", COALESCE("Campaign", ''), "WindowType");

-- Histórico de métricas (snapshots diarios)
CREATE TABLE "OfferMetricsHistory" (
  "HistoryId" SERIAL PRIMARY KEY,
  "OfferId" INTEGER NOT NULL REFERENCES "JobOffers"("OfferId") ON DELETE CASCADE,
  "ExternalOfferId" VARCHAR(50) NOT NULL,
  "SnapshotDate" DATE NOT NULL,

  -- Solo lifetime snapshot
  "TotalListImpressions" INTEGER DEFAULT 0,
  "TotalDetailViews" INTEGER DEFAULT 0,
  "TotalPageVisits" INTEGER DEFAULT 0,
  "TotalApplications" INTEGER DEFAULT 0,
  "TotalEngagements" INTEGER DEFAULT 0,
  "TotalTouchpoints" INTEGER DEFAULT 0,
  "OverallConversionRate" DECIMAL(10, 4) DEFAULT 0,
  "EngagementApplicationRate" DECIMAL(10, 4) DEFAULT 0,

  "CreatedAt" TIMESTAMP DEFAULT NOW(),

  UNIQUE("OfferId", "SnapshotDate")
);

CREATE INDEX idx_offermetricshistory_offerid ON "OfferMetricsHistory"("OfferId");
CREATE INDEX idx_offermetricshistory_snapshotdate ON "OfferMetricsHistory"("SnapshotDate");

-- ============================================================================
-- TRIGGERS para UpdatedAt automático
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "Users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON "Connections"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_joboffers_updated_at BEFORE UPDATE ON "JobOffers"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON "Campaigns"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at BEFORE UPDATE ON "Segments"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaignchannels_updated_at BEFORE UPDATE ON "CampaignChannels"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_userchannelcredentials_updated_at BEFORE UPDATE ON "UserChannelCredentials"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offermetrics_updated_at BEFORE UPDATE ON "OfferMetrics"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offermetricsbychannel_updated_at BEFORE UPDATE ON "OfferMetricsByChannel"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FIN DEL SCHEMA
-- ============================================================================
