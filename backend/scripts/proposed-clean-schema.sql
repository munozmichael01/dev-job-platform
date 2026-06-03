-- =============================================================================
-- PROPOSED CLEAN SCHEMA — TalentOS
-- =============================================================================
-- Status:  PROPOSAL ONLY — do not execute without Codex + user approval
-- Purpose: Replace the current mixed/inconsistent schema with a clean,
--          multi-tenant-ready model aligned with CLEAN_DATA_MODEL_BLUEPRINT.md
-- Author:  Claude Code (audit 2026-06-03)
--
-- EXECUTION ORDER: run phases in sequence, never skip phases.
-- Each phase is idempotent where possible (IF NOT EXISTS, ON CONFLICT DO NOTHING).
-- =============================================================================


-- =============================================================================
-- PHASE 0: PREREQUISITES
-- =============================================================================
-- Run these checks BEFORE executing anything:
--
--   SELECT COUNT(*) FROM "Users";          -- must be 15
--   SELECT COUNT(*) FROM "Connections";    -- must be 89
--   SELECT COUNT(*) FROM "Campaigns";      -- must be 15
--   SELECT COUNT(*) FROM "Segments";       -- must be 17
--   SELECT COUNT(*) FROM "JobOffers";      -- must be 0 (safe to alter)
--
-- Take a manual snapshot/backup of Users, Connections, Campaigns, Segments
-- from the Supabase dashboard before running any DDL.
-- =============================================================================


-- =============================================================================
-- PHASE 1: ADD OrganizationId TO Users (backwards-compatible)
-- =============================================================================
-- Decision: keep Users.Id as BIGINT (existing auth JWT uses it).
-- Add OrganizationId as nullable so existing rows aren't broken.
-- Multi-tenant migration happens AFTER this column exists.

ALTER TABLE "Users"
  ADD COLUMN IF NOT EXISTS "Phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "PasswordHash" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "OrganizationId" BIGINT,
  ADD COLUMN IF NOT EXISTS "Company" VARCHAR(255);

-- NOTE: Users already has Id BIGINT, Email, FirstName, LastName, Role, IsActive,
-- CreatedAt, UpdatedAt, Image, GoogleId confirmed from live schema audit.
-- Phone and PasswordHash exist in schema-supabase-fixed.sql but NOT in live data —
-- add them conditionally.


-- =============================================================================
-- PHASE 2: DROP / REPLACE JobOffers (safe — 0 rows)
-- =============================================================================
-- The current JobOffers table has:
--   PK:     OfferId (SERIAL) — not Id
--   UserId: UUID type — incompatible with Users.Id BIGINT
--   Missing: SourceConnectionId, OrganizationId, RawJobRecordId, PayloadHash
--   Extra:  60+ SQL Server legacy columns (TitleId, AreaId, DegreeId, etc.)
-- Since JobOffers has 0 rows it is SAFE to drop and recreate.

DROP TABLE IF EXISTS "JobOffers" CASCADE;

CREATE TABLE "JobOffers" (
  -- Identity
  "Id"                  BIGSERIAL PRIMARY KEY,
  "UserId"              BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
  "ConnectionId"        INTEGER,          -- FK to Connections.id (existing table)
  "RawJobRecordId"      BIGINT,           -- FK to RawJobRecords.Id (Phase 3)
  "ExternalId"          VARCHAR(255),     -- ID in the source system, NOT the PK
  "SourceSystem"        VARCHAR(100),     -- e.g. 'turijobs-feed', 'bebee-xml'
  "PayloadHash"         VARCHAR(64),      -- SHA-256 of canonical fields for change detection

  -- Content
  "Title"               VARCHAR(500) NOT NULL,
  "DescriptionHtml"     TEXT,
  "DescriptionText"     TEXT,
  "RequirementsText"    TEXT,
  "BenefitsText"        TEXT,
  "ApplicationUrl"      VARCHAR(1024),
  "ExternalUrl"         VARCHAR(1024),

  -- Company
  "CompanyName"         VARCHAR(255),
  "CompanyExternalId"   VARCHAR(100),
  "CompanyLogoUrl"      VARCHAR(1024),

  -- Location
  "Country"             VARCHAR(100),
  "CountryCode"         VARCHAR(10),
  "Region"              VARCHAR(100),
  "City"                VARCHAR(100),
  "Postcode"            VARCHAR(20),
  "Address"             VARCHAR(500),
  "Latitude"            DECIMAL(9,6),
  "Longitude"           DECIMAL(9,6),
  "RemotePolicy"        VARCHAR(50),      -- 'onsite', 'remote', 'hybrid'

  -- Classification
  "Sector"              VARCHAR(255),
  "Category"            VARCHAR(255),
  "Subcategory"         VARCHAR(255),
  "JobType"             VARCHAR(100),     -- 'full-time', 'part-time', etc.
  "ContractType"        VARCHAR(100),     -- 'permanent', 'temporary', etc.
  "WorkdayType"         VARCHAR(100),
  "Seniority"           VARCHAR(100),
  "Language"            VARCHAR(10),

  -- Salary
  "SalaryRaw"           VARCHAR(500),     -- original string preserved
  "SalaryMin"           DECIMAL(12,2),
  "SalaryMax"           DECIMAL(12,2),
  "SalaryCurrency"      VARCHAR(10) DEFAULT 'EUR',
  "SalaryPeriod"        VARCHAR(50),      -- 'annual', 'monthly', 'hourly'
  "SalaryIsVisible"     BOOLEAN DEFAULT true,

  -- Operation
  "Vacancies"           INTEGER DEFAULT 1,
  "PublicationDate"     TIMESTAMP,
  "ExpirationDate"      TIMESTAMP,
  "Status"              VARCHAR(50) NOT NULL DEFAULT 'active',
                        -- 'active', 'paused', 'archived', 'draft', 'expired'
  "CreatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT uq_joboffer_source UNIQUE ("UserId", "ConnectionId", "ExternalId")
);

CREATE INDEX idx_joboffer_userid     ON "JobOffers"("UserId");
CREATE INDEX idx_joboffer_status     ON "JobOffers"("Status");
CREATE INDEX idx_joboffer_created    ON "JobOffers"("CreatedAt" DESC);
CREATE INDEX idx_joboffer_externalid ON "JobOffers"("ExternalId") WHERE "ExternalId" IS NOT NULL;
CREATE INDEX idx_joboffer_company    ON "JobOffers"("CompanyName");
CREATE INDEX idx_joboffer_city       ON "JobOffers"("City");
CREATE INDEX idx_joboffer_sector     ON "JobOffers"("Sector");


-- =============================================================================
-- PHASE 3: NEW TABLES — Ingestion pipeline
-- =============================================================================
-- These tables are new (verified absent or empty in Supabase).

-- RawJobRecords: immutable raw payload before any transformation
CREATE TABLE IF NOT EXISTS "RawJobRecords" (
  "Id"                BIGSERIAL PRIMARY KEY,
  "UserId"            BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
  "ConnectionId"      INTEGER NOT NULL,   -- FK to Connections.id
  "ExternalId"        VARCHAR(255),
  "RawFormat"         VARCHAR(20) NOT NULL DEFAULT 'xml',  -- 'xml', 'csv', 'json'
  "RawPayload"        TEXT NOT NULL,
  "PayloadHash"       VARCHAR(64) NOT NULL,
  "ReceivedAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ProcessingStatus"  VARCHAR(50) NOT NULL DEFAULT 'pending',
                      -- 'pending', 'processed', 'failed', 'skipped'
  "ProcessingError"   TEXT,
  "JobOfferId"        BIGINT REFERENCES "JobOffers"("Id") ON DELETE SET NULL,

  CONSTRAINT uq_raw_source UNIQUE ("ConnectionId", "ExternalId"),
  CONSTRAINT uq_raw_hash   UNIQUE ("ConnectionId", "PayloadHash")
);

CREATE INDEX idx_raw_connid   ON "RawJobRecords"("ConnectionId");
CREATE INDEX idx_raw_status   ON "RawJobRecords"("ProcessingStatus");
CREATE INDEX idx_raw_received ON "RawJobRecords"("ReceivedAt" DESC);


-- =============================================================================
-- PHASE 4: REPLACE Segments (has 17 rows — migrate, don't drop blindly)
-- =============================================================================
-- Current Segments.Filters is a JSON string with keys: jobTitles, locations,
-- sectors, experienceLevels, contractTypes. The blueprint uses FilterDefinition.
-- Migration: rename Filters -> FilterDefinition, keep existing data.
-- NOTE: Codex must confirm if the 17 existing segments are worth keeping.

ALTER TABLE "Segments"
  ADD COLUMN IF NOT EXISTS "FilterDefinition" TEXT,
  ADD COLUMN IF NOT EXISTS "Type"             VARCHAR(20) DEFAULT 'dynamic',
  ADD COLUMN IF NOT EXISTS "CreatedByUserId"  BIGINT REFERENCES "Users"("Id");

-- Migrate existing Filters -> FilterDefinition (one-time, idempotent)
UPDATE "Segments"
SET "FilterDefinition" = "Filters"
WHERE "FilterDefinition" IS NULL AND "Filters" IS NOT NULL;

-- Add SegmentJobOffers for static segments
CREATE TABLE IF NOT EXISTS "SegmentJobOffers" (
  "SegmentId"   INTEGER NOT NULL REFERENCES "Segments"("Id") ON DELETE CASCADE,
  "JobOfferId"  BIGINT  NOT NULL REFERENCES "JobOffers"("Id") ON DELETE CASCADE,
  "AddedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("SegmentId", "JobOfferId")
);


-- =============================================================================
-- PHASE 5: REPLACE Campaigns (has 15 rows — migrate selectively)
-- =============================================================================
-- Current Campaigns.Channels is a JSON string (e.g. '["jooble"]').
-- CampaignChannels table exists but has 0 rows.
-- Blueprint: Campaigns -> CampaignChannels -> DistributionChannels.
-- Decision: keep Campaigns table structure, add missing columns.

ALTER TABLE "Campaigns"
  ADD COLUMN IF NOT EXISTS "BudgetCurrency"   VARCHAR(10) DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "CreatedByUserId"  BIGINT REFERENCES "Users"("Id"),
  ADD COLUMN IF NOT EXISTS "Objective"        VARCHAR(255);

-- Migrate CreatedByUserId from UserId (existing data)
UPDATE "Campaigns"
SET "CreatedByUserId" = "UserId"
WHERE "CreatedByUserId" IS NULL AND "UserId" IS NOT NULL;

-- DistributionChannels: catalog of external channels
CREATE TABLE IF NOT EXISTS "DistributionChannels" (
  "Id"                  SERIAL PRIMARY KEY,
  "Code"                VARCHAR(50) NOT NULL UNIQUE, -- 'jooble', 'talent', 'infojobs'
  "Name"                VARCHAR(100) NOT NULL,
  "Type"                VARCHAR(50),                 -- 'xml-feed', 'api', 'scraper'
  "Country"             VARCHAR(10),
  "IsActive"            BOOLEAN NOT NULL DEFAULT true,
  "RequirementsSchema"  JSONB,
  "CreatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed known channels (idempotent)
INSERT INTO "DistributionChannels" ("Code", "Name", "Type", "Country") VALUES
  ('jooble',    'Jooble',    'xml-feed', NULL),
  ('talent',    'Talent.com','xml-feed', NULL),
  ('jobrapido', 'JobRapido', 'xml-feed', NULL),
  ('whatjobs',  'WhatJobs',  'xml-feed', NULL),
  ('infojobs',  'InfoJobs',  'api',      'ES'),
  ('linkedin',  'LinkedIn',  'api',      NULL),
  ('indeed',    'Indeed',    'xml-feed', NULL)
ON CONFLICT ("Code") DO NOTHING;

-- CampaignChannels: proper join table (currently empty — safe to recreate)
DROP TABLE IF EXISTS "CampaignChannels";

CREATE TABLE "CampaignChannels" (
  "Id"          SERIAL PRIMARY KEY,
  "CampaignId"  INTEGER NOT NULL REFERENCES "Campaigns"("Id") ON DELETE CASCADE,
  "ChannelId"   INTEGER NOT NULL REFERENCES "DistributionChannels"("Id"),
  "Budget"      DECIMAL(10,2),
  "BidStrategy" VARCHAR(50),
  "Status"      VARCHAR(50) NOT NULL DEFAULT 'active',
  "Config"      JSONB,
  "CreatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("CampaignId", "ChannelId")
);

CREATE INDEX idx_campchannels_campaign ON "CampaignChannels"("CampaignId");


-- =============================================================================
-- PHASE 6: DISTRIBUTION RUNTIME TABLES (all new, confirmed absent)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "DistributionRuns" (
  "Id"            BIGSERIAL PRIMARY KEY,
  "UserId"        BIGINT NOT NULL REFERENCES "Users"("Id"),
  "CampaignId"    INTEGER NOT NULL REFERENCES "Campaigns"("Id"),
  "ChannelId"     INTEGER NOT NULL REFERENCES "DistributionChannels"("Id"),
  "Status"        VARCHAR(50) NOT NULL DEFAULT 'pending',
                  -- 'pending', 'running', 'completed', 'failed', 'partial'
  "StartedAt"     TIMESTAMP,
  "FinishedAt"    TIMESTAMP,
  "OffersTotal"   INTEGER DEFAULT 0,
  "OffersOk"      INTEGER DEFAULT 0,
  "OffersFailed"  INTEGER DEFAULT 0,
  "ErrorMessage"  TEXT,
  "CreatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_distruns_campaign ON "DistributionRuns"("CampaignId");
CREATE INDEX idx_distruns_status   ON "DistributionRuns"("Status");

CREATE TABLE IF NOT EXISTS "DistributionItems" (
  "Id"                BIGSERIAL PRIMARY KEY,
  "DistributionRunId" BIGINT NOT NULL REFERENCES "DistributionRuns"("Id") ON DELETE CASCADE,
  "JobOfferId"        BIGINT NOT NULL REFERENCES "JobOffers"("Id"),
  "ChannelId"         INTEGER NOT NULL REFERENCES "DistributionChannels"("Id"),
  "ExternalChannelId" VARCHAR(255),    -- ID assigned by the channel after publish
  "Status"            VARCHAR(50) NOT NULL DEFAULT 'pending',
  "Payload"           JSONB,           -- what was sent to the channel
  "Response"          JSONB,           -- what the channel replied
  "ErrorMessage"      TEXT,
  "CreatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_distitems_run    ON "DistributionItems"("DistributionRunId");
CREATE INDEX idx_distitems_offer  ON "DistributionItems"("JobOfferId");


-- =============================================================================
-- PHASE 7: CHANNEL CREDENTIALS (replace UserChannelCredentials — 0 rows)
-- =============================================================================
-- Current table has 0 rows, inconsistent naming (no FK to DistributionChannels).

DROP TABLE IF EXISTS "UserChannelCredentials";

CREATE TABLE "ChannelCredentials" (
  "Id"                    SERIAL PRIMARY KEY,
  "UserId"                BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
  "ChannelId"             INTEGER NOT NULL REFERENCES "DistributionChannels"("Id"),
  "Name"                  VARCHAR(255) NOT NULL,
  "CredentialsEncrypted"  TEXT,         -- existing encryption logic preserved
  "Status"                VARCHAR(50) NOT NULL DEFAULT 'active',
  "CreatedAt"             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("UserId", "ChannelId")
);


-- =============================================================================
-- PHASE 8: UPGRADE FieldMappings (has 3 rows — safe to alter)
-- =============================================================================
-- Current: MappingId, ConnectionId, SourceField, TargetField,
--          TransformationType, TransformationConfig, CreatedAt
-- Blueprint adds: Version, SourcePath, Required, DefaultValue

ALTER TABLE "FieldMappings"
  ADD COLUMN IF NOT EXISTS "UserId"          BIGINT REFERENCES "Users"("Id"),
  ADD COLUMN IF NOT EXISTS "Version"         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "SourcePath"      TEXT,
  ADD COLUMN IF NOT EXISTS "Required"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "DefaultValue"    TEXT,
  ADD COLUMN IF NOT EXISTS "UpdatedAt"       TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Migrate SourceField -> SourcePath for existing rows
UPDATE "FieldMappings"
SET "SourcePath" = "SourceField"
WHERE "SourcePath" IS NULL AND "SourceField" IS NOT NULL;


-- =============================================================================
-- PHASE 9: AGENT TABLES (new — Phases 7+ of roadmap, safe to create now)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "AgentRuns" (
  "Id"                BIGSERIAL PRIMARY KEY,
  "UserId"            BIGINT NOT NULL REFERENCES "Users"("Id"),
  "AgentType"         VARCHAR(100) NOT NULL,  -- 'JobDescriptionAgent', 'DistributionAgent'
  "EntityType"        VARCHAR(100),           -- 'JobOffer', 'Campaign', etc.
  "EntityId"          BIGINT,
  "InputHash"         VARCHAR(64),
  "InputSnapshot"     JSONB,
  "Output"            JSONB,
  "Model"             VARCHAR(100),           -- 'claude-sonnet-4-6'
  "PromptVersion"     VARCHAR(50),
  "Status"            VARCHAR(50) NOT NULL DEFAULT 'pending',
                      -- 'pending', 'running', 'completed', 'failed'
  "CostEstimate"      DECIMAL(8,6),           -- USD
  "CreatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agentruns_type    ON "AgentRuns"("AgentType");
CREATE INDEX idx_agentruns_entity  ON "AgentRuns"("EntityType", "EntityId");
CREATE INDEX idx_agentruns_user    ON "AgentRuns"("UserId");

CREATE TABLE IF NOT EXISTS "AgentRecommendations" (
  "Id"                  BIGSERIAL PRIMARY KEY,
  "AgentRunId"          BIGINT NOT NULL REFERENCES "AgentRuns"("Id") ON DELETE CASCADE,
  "UserId"              BIGINT NOT NULL REFERENCES "Users"("Id"),
  "EntityType"          VARCHAR(100),
  "EntityId"            BIGINT,
  "RecommendationType"  VARCHAR(100),         -- 'improve_description', 'suggest_channel'
  "Recommendation"      JSONB NOT NULL,
  "Confidence"          DECIMAL(4,3),         -- 0.000 to 1.000
  "Status"              VARCHAR(50) NOT NULL DEFAULT 'pending',
                        -- 'pending', 'accepted', 'rejected', 'expired'
  "ReviewedByUserId"    BIGINT REFERENCES "Users"("Id"),
  "ReviewedAt"          TIMESTAMP,
  "CreatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agentrec_run    ON "AgentRecommendations"("AgentRunId");
CREATE INDEX idx_agentrec_entity ON "AgentRecommendations"("EntityType", "EntityId");
CREATE INDEX idx_agentrec_status ON "AgentRecommendations"("Status");


-- =============================================================================
-- PHASE 10: NOTIFY PostgREST to reload schema cache
-- =============================================================================
-- Run AFTER all DDL is complete to make new columns visible via API.
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- POST-MIGRATION VALIDATION QUERIES
-- (Run these after execution to confirm correctness)
-- =============================================================================
/*
-- 1. Users intact
SELECT COUNT(*), MIN("Id"), MAX("Id") FROM "Users";  -- expect 15 rows

-- 2. Connections intact
SELECT COUNT(*) FROM "Connections";  -- expect 89

-- 3. Campaigns intact (with new columns null)
SELECT COUNT(*), COUNT("CreatedByUserId") FROM "Campaigns";  -- 15 rows, CreatedByUserId filled

-- 4. Segments intact (with FilterDefinition populated)
SELECT COUNT(*), COUNT("FilterDefinition") FROM "Segments";  -- 17, 17

-- 5. JobOffers clean slate
SELECT COUNT(*) FROM "JobOffers";  -- 0 (was already 0)

-- 6. DistributionChannels seeded
SELECT COUNT(*) FROM "DistributionChannels";  -- 7

-- 7. FieldMappings with new columns
SELECT COUNT(*), COUNT("SourcePath") FROM "FieldMappings";  -- 3, 3

-- 8. PostgREST sees all columns (should not 400 anymore)
-- Run from the app: GET /job-offers (should return 200 with total: 0, no 500)
*/
