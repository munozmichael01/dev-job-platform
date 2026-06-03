-- =============================================================================
-- PROPOSED CLEAN DOMAIN SCHEMA — TalentOS
-- =============================================================================
-- Status:   PROPOSAL ONLY — do not execute without explicit approval
-- Strategy: CLEAN DOMAIN MODEL
--           - Business concepts are preserved
--           - Bad schemas are replaced
--           - Irrelevant records are archived, not silently dropped
--           - Valid production data (Users, Connections) is untouched
--
-- Differs from proposed-clean-schema.sql in:
--   - Segments/Campaigns are ARCHIVED then REPLACED (not just altered)
--   - FieldMappings orphaned rows are CLEANED before ALTER
--   - Connections are KEPT intact (real data)
--   - Archive tables (_bak) created FIRST as safety net
--
-- 2026-06-03 — Domain decision incorporated:
--   - Campaigns support MULTIPLE segments via CampaignSegments join table
--   - Campaigns.SegmentId removed (multi-segment model is the canonical one)
--   - CampaignChannels is the formal campaign-channel relation (no JobOfferId here)
--   - Per-offer/per-channel expansion happens only in DistributionItems at run time
--   - DistributionRuns tracks the execution; DistributionItems tracks per-offer results
--   - Transition shims: backend may return Channels:[] and Budget alias for frontend compat
--
-- Author: Claude Code (2026-06-03)
-- Reviewed by: Codex
-- =============================================================================


-- =============================================================================
-- PREREQUISITES — verify these BEFORE running anything
-- =============================================================================
/*
Run in Supabase SQL Editor:

SELECT 'Users' t,       COUNT(*) n FROM "Users"
UNION SELECT 'Connections',   COUNT(*) FROM "Connections"
UNION SELECT 'Campaigns',     COUNT(*) FROM "Campaigns"
UNION SELECT 'Segments',      COUNT(*) FROM "Segments"
UNION SELECT 'JobOffers',     COUNT(*) FROM "JobOffers"
UNION SELECT 'FieldMappings', COUNT(*) FROM "FieldMappings";
-- Expected: 15, 89, 15, 17, 0, 3

-- Confirm JobOffers is safe to drop
SELECT COUNT(*) FROM "JobOffers";  -- MUST be 0 before continuing

-- Confirm Users PK type (auth depends on this)
SELECT data_type FROM information_schema.columns
WHERE table_name = 'Users' AND column_name = 'Id';
-- Expected: bigint

-- Confirm JobOffers.UserId is UUID (the bug we're fixing)
SELECT data_type FROM information_schema.columns
WHERE table_name = 'JobOffers' AND column_name = 'UserId';
-- Expected: uuid  <-- confirms the mismatch

-- Confirm actual Users columns (PostgREST cache may differ)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'Users' ORDER BY ordinal_position;

-- Back up via Supabase Dashboard → Table Editor → Export CSV
-- for: Users, Connections, Campaigns, Segments, FieldMappings
*/


-- =============================================================================
-- PHASE 0: ARCHIVE — create safety net before any DROP
-- =============================================================================
-- These archive tables preserve existing records for context/rollback.
-- They are not part of the product — just a safety net.
-- Delete them once the new schema is stable and validated in production.

-- Archive Segments (17 rows, OfferCount=0, FilterDefinition inconsistent)
CREATE TABLE IF NOT EXISTS "Segments_bak" AS TABLE "Segments";
ALTER TABLE "Segments_bak" ADD COLUMN IF NOT EXISTS "ArchivedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Segments_bak" ADD COLUMN IF NOT EXISTS "ArchiveReason" TEXT DEFAULT 'Clean domain migration 2026-06-03';

-- Archive Campaigns (15 rows, Channels=JSON string, no FK to DistributionChannels)
CREATE TABLE IF NOT EXISTS "Campaigns_bak" AS TABLE "Campaigns";
ALTER TABLE "Campaigns_bak" ADD COLUMN IF NOT EXISTS "ArchivedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Campaigns_bak" ADD COLUMN IF NOT EXISTS "ArchiveReason" TEXT DEFAULT 'Clean domain migration 2026-06-03';

-- Archive orphaned FieldMappings (3 rows, ConnectionId=2099 does not exist)
CREATE TABLE IF NOT EXISTS "FieldMappings_bak" AS TABLE "FieldMappings";
ALTER TABLE "FieldMappings_bak" ADD COLUMN IF NOT EXISTS "ArchivedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- NOTE: Users and Connections are NOT archived here — they are kept intact.
-- NOTE: JobOffers is NOT archived — it has 0 rows, nothing to preserve.


-- =============================================================================
-- PHASE 1: PATCH Users (non-destructive — only ADD COLUMN IF NOT EXISTS)
-- =============================================================================
-- Users is the one table we never touch destructively.
-- Auth JWT depends on Users.Id BIGINT — do not change PK or type.

ALTER TABLE "Users"
  ADD COLUMN IF NOT EXISTS "Phone"          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "PasswordHash"   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "OrganizationId" BIGINT;  -- nullable, activates with multi-tenant
-- Do NOT add FK constraint on OrganizationId yet (Organizations table doesn't exist)
-- Do NOT add NOT NULL to OrganizationId (would break existing rows)


-- =============================================================================
-- PHASE 2: REPLACE JobOffers — safe (0 rows confirmed)
-- =============================================================================
-- Problem: PK=OfferId, UserId=UUID, 60+ SQL Server legacy columns
-- Solution: DROP + CREATE with clean domain model
-- Preserved concept: canonical internal job offer (the core product entity)

DROP TABLE IF EXISTS "JobOffers" CASCADE;

CREATE TABLE "JobOffers" (
  -- Identity
  "Id"                BIGSERIAL PRIMARY KEY,
  "UserId"            BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
  "ConnectionId"      INTEGER,           -- FK to Connections.id (existing table, adds soon)
  "RawJobRecordId"    BIGINT,            -- FK to RawJobRecords.Id (added in Phase 3)
  "ExternalId"        VARCHAR(255),      -- ID in source system — NOT the PK
  "SourceSystem"      VARCHAR(100),      -- 'turijobs-feed', 'bebee-xml', 'manual'
  "PayloadHash"       VARCHAR(64),       -- SHA-256 for change detection

  -- Content
  "Title"             VARCHAR(500) NOT NULL,
  "DescriptionHtml"   TEXT,
  "DescriptionText"   TEXT,
  "RequirementsText"  TEXT,
  "BenefitsText"      TEXT,
  "ApplicationUrl"    VARCHAR(1024),
  "ExternalUrl"       VARCHAR(1024),

  -- Company
  "CompanyName"       VARCHAR(255),
  "CompanyExternalId" VARCHAR(100),
  "CompanyLogoUrl"    VARCHAR(1024),

  -- Location
  "Country"           VARCHAR(100),
  "CountryCode"       VARCHAR(10),
  "Region"            VARCHAR(100),
  "City"              VARCHAR(100),
  "Postcode"          VARCHAR(20),
  "Address"           VARCHAR(500),
  "Latitude"          DECIMAL(9,6),
  "Longitude"         DECIMAL(9,6),
  "RemotePolicy"      VARCHAR(50),       -- 'onsite', 'remote', 'hybrid'

  -- Classification
  "Sector"            VARCHAR(255),
  "Category"          VARCHAR(255),
  "Subcategory"       VARCHAR(255),
  "JobType"           VARCHAR(100),
  "ContractType"      VARCHAR(100),
  "WorkdayType"       VARCHAR(100),
  "Seniority"         VARCHAR(100),
  "Language"          VARCHAR(10),

  -- Salary (raw preserved for audit; parsed values for filtering)
  "SalaryRaw"         VARCHAR(500),
  "SalaryMin"         DECIMAL(12,2),
  "SalaryMax"         DECIMAL(12,2),
  "SalaryCurrency"    VARCHAR(10) DEFAULT 'EUR',
  "SalaryPeriod"      VARCHAR(50),       -- 'annual', 'monthly', 'hourly'
  "SalaryIsVisible"   BOOLEAN DEFAULT true,

  -- Operation
  "Vacancies"         INTEGER DEFAULT 1,
  "PublicationDate"   TIMESTAMP,
  "ExpirationDate"    TIMESTAMP,
  "Status"            VARCHAR(50) NOT NULL DEFAULT 'active',
  -- Valid values: 'active', 'paused', 'archived', 'expired', 'draft'
  -- Semantics for externally-imported offers:
  --   active   = present in the most recent feed run
  --   paused   = missing from feed but ExpirationDate is future (or absent)
  --   archived = missing from feed AND ExpirationDate is past
  -- NOTE: JobOffers.Status ≠ DistributionItems.Status — they are independent.
  --   JobOffers.Status  = availability of the canonical offer
  --   DistributionItems.Status = publication state on each external channel

  -- Feed reconciliation columns (optional — code writes these if they exist)
  "LastSeenAt"        TIMESTAMP,
  -- Timestamp of the last feed import run that included this offer
  "MissingSince"      TIMESTAMP,
  -- Set when offer disappears from feed (before archiving)
  "PauseReason"       VARCHAR(100),
  -- e.g. 'missing_from_source_feed', 'missing_from_source_feed_no_expiration'
  "ArchivedReason"    VARCHAR(100),
  -- e.g. 'expired', 'manually_removed', 'feed_connection_deleted'

  "CreatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Deduplication: same ExternalId from same Connection under same User is not allowed
  CONSTRAINT uq_joboffer_source UNIQUE ("UserId", "ConnectionId", "ExternalId")
);

CREATE INDEX idx_jo_userid     ON "JobOffers"("UserId");
CREATE INDEX idx_jo_status     ON "JobOffers"("Status");
CREATE INDEX idx_jo_created    ON "JobOffers"("CreatedAt" DESC);
CREATE INDEX idx_jo_externalid ON "JobOffers"("ExternalId") WHERE "ExternalId" IS NOT NULL;
CREATE INDEX idx_jo_company    ON "JobOffers"("CompanyName");
CREATE INDEX idx_jo_city       ON "JobOffers"("City");
CREATE INDEX idx_jo_sector     ON "JobOffers"("Sector");
CREATE INDEX idx_jo_conn       ON "JobOffers"("ConnectionId") WHERE "ConnectionId" IS NOT NULL;


-- =============================================================================
-- PHASE 3: CREATE RawJobRecords (new — ingestion layer)
-- =============================================================================
-- Business concept: immutable raw payload before any transformation
-- Allows: reprocessing without re-fetching, auditing parse errors,
--         changing mappings without losing original data

CREATE TABLE IF NOT EXISTS "RawJobRecords" (
  "Id"                BIGSERIAL PRIMARY KEY,
  "UserId"            BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
  "ConnectionId"      INTEGER NOT NULL,  -- references Connections.id
  "ExternalId"        VARCHAR(255),
  "RawFormat"         VARCHAR(20) NOT NULL DEFAULT 'xml',  -- 'xml', 'csv', 'json', 'manual'
  "RawPayload"        TEXT NOT NULL,
  "PayloadHash"       VARCHAR(64) NOT NULL,
  "ReceivedAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ProcessingStatus"  VARCHAR(50) NOT NULL DEFAULT 'pending',
  "ProcessingError"   TEXT,
  "JobOfferId"        BIGINT REFERENCES "JobOffers"("Id") ON DELETE SET NULL,
  CONSTRAINT uq_raw_source UNIQUE ("ConnectionId", "ExternalId"),
  CONSTRAINT uq_raw_hash   UNIQUE ("ConnectionId", "PayloadHash")
);

CREATE INDEX idx_raw_connid   ON "RawJobRecords"("ConnectionId");
CREATE INDEX idx_raw_status   ON "RawJobRecords"("ProcessingStatus");
CREATE INDEX idx_raw_received ON "RawJobRecords"("ReceivedAt" DESC);

-- Now that RawJobRecords exists, add the FK from JobOffers
ALTER TABLE "JobOffers"
  ADD CONSTRAINT fk_jo_rawrecord
  FOREIGN KEY ("RawJobRecordId") REFERENCES "RawJobRecords"("Id") ON DELETE SET NULL;


-- =============================================================================
-- PHASE 4: PATCH Connections (non-destructive — add columns, no DROP)
-- =============================================================================
-- Business concept: external data source (XML feed, CSV, API)
-- Preserved: 89 rows with real URLs
-- Not renaming to SourceConnections yet — breaking change; do it gradually

ALTER TABLE "Connections"
  ADD COLUMN IF NOT EXISTS "OrganizationId" BIGINT;  -- for future multi-tenant
-- NOTE: Connections.UserId already exists in live schema
-- NOTE: Connections.clientId still points to Clients — do NOT add FK constraint
--       until Clients → Organizations migration is done


-- =============================================================================
-- PHASE 5: UPGRADE FieldMappings (clean orphans + add columns)
-- =============================================================================
-- Business concept: versionable field-level mapping from source to canonical model
-- Action: clean 3 orphaned rows, add missing columns from blueprint

-- Clean orphaned rows (ConnectionId=2099 does not exist)
DELETE FROM "FieldMappings" WHERE "ConnectionId" NOT IN (SELECT id FROM "Connections");

-- Add missing blueprint columns
ALTER TABLE "FieldMappings"
  ADD COLUMN IF NOT EXISTS "UserId"       BIGINT REFERENCES "Users"("Id"),
  ADD COLUMN IF NOT EXISTS "Version"      INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "SourcePath"   TEXT,
  ADD COLUMN IF NOT EXISTS "Required"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "DefaultValue" TEXT,
  ADD COLUMN IF NOT EXISTS "UpdatedAt"    TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Migrate SourceField → SourcePath for any surviving rows
UPDATE "FieldMappings"
SET "SourcePath" = "SourceField"
WHERE "SourcePath" IS NULL AND "SourceField" IS NOT NULL;


-- =============================================================================
-- PHASE 6: REPLACE Segments (archive first, then clean schema)
-- =============================================================================
-- Business concept: dynamic/static selection of job offers for distribution
-- Archive action: Segments_bak already created in Phase 0
-- Reason: OfferCount=0 (no real offers), Filters JSON uses legacy key names,
--         OfferCount is a derived value (should not be stored)

DROP TABLE IF EXISTS "Segments" CASCADE;  -- Segments_bak already created

CREATE TABLE "Segments" (
  "Id"                SERIAL PRIMARY KEY,
  "UserId"            BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
  "Name"              VARCHAR(255) NOT NULL,
  "Description"       TEXT,
  "Type"              VARCHAR(20) NOT NULL DEFAULT 'dynamic',  -- 'dynamic', 'static'
  "FilterDefinition"  JSONB,
  -- FilterDefinition example:
  -- { "country": "VE", "sector": ["Tecnología"], "city": ["Caracas"], "status": "active" }
  "Status"            VARCHAR(50) NOT NULL DEFAULT 'active',
  "CreatedByUserId"   BIGINT REFERENCES "Users"("Id"),
  "CreatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seg_userid ON "Segments"("UserId");
CREATE INDEX idx_seg_status ON "Segments"("Status");

-- SegmentJobOffers: for static segments or snapshots
CREATE TABLE IF NOT EXISTS "SegmentJobOffers" (
  "SegmentId"  INTEGER NOT NULL REFERENCES "Segments"("Id") ON DELETE CASCADE,
  "JobOfferId" BIGINT  NOT NULL REFERENCES "JobOffers"("Id") ON DELETE CASCADE,
  "AddedAt"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("SegmentId", "JobOfferId")
);

-- OPTIONAL: if archived segments are worth porting, uncomment:
-- INSERT INTO "Segments" ("UserId", "Name", "Description", "FilterDefinition", "Status", "CreatedAt", "UpdatedAt")
-- SELECT b."UserId", b."Name", b."Description", b."Filters"::jsonb, b."Status", b."CreatedAt", b."UpdatedAt"
-- FROM "Segments_bak" b
-- WHERE b."UserId" IN (SELECT "Id" FROM "Users");  -- only port segments from existing users


-- =============================================================================
-- PHASE 7: REPLACE Campaigns + CampaignSegments + CampaignChannels
-- =============================================================================
-- Business concepts:
--   Campaign:         groups distribution of multiple segments across channels
--   CampaignSegments: formal M:N join — one campaign can have MANY segments
--   CampaignChannels: formal M:N join — one campaign can target MANY channels
--
-- Domain decisions (2026-06-03):
--   - Campaigns.SegmentId REMOVED — multi-segment is the canonical model
--   - CampaignSegments is the only way to associate segments to a campaign
--   - CampaignChannels does NOT contain JobOfferId or per-offer budget splits
--     (that happens at distribution time in DistributionItems)
--   - Per-offer/channel expansion: DistributionRun → DistributionItems
--
-- Archive actions: Campaigns_bak already created in Phase 0

DROP TABLE IF EXISTS "CampaignChannels";   -- 0 rows, safe
DROP TABLE IF EXISTS "CampaignSegments";   -- explicit drop, do not rely on CASCADE
DROP TABLE IF EXISTS "Campaigns" CASCADE;  -- Campaigns_bak already created

-- DistributionChannels catalog MUST exist before CampaignChannels (FK dependency)
CREATE TABLE IF NOT EXISTS "DistributionChannels" (
  "Id"                  SERIAL PRIMARY KEY,
  "Code"                VARCHAR(50) NOT NULL UNIQUE,   -- 'jooble', 'talent', etc.
  "Name"                VARCHAR(100) NOT NULL,
  "Type"                VARCHAR(50),                   -- 'xml-feed', 'api', 'scraper'
  "Country"             VARCHAR(10),
  "IsActive"            BOOLEAN NOT NULL DEFAULT true,
  "RequirementsSchema"  JSONB,                         -- validation rules per channel
  "CreatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed known channels (idempotent)
INSERT INTO "DistributionChannels" ("Code", "Name", "Type", "Country") VALUES
  ('jooble',    'Jooble',     'xml-feed', NULL),
  ('talent',    'Talent.com', 'xml-feed', NULL),
  ('jobrapido', 'JobRapido',  'xml-feed', NULL),
  ('whatjobs',  'WhatJobs',   'xml-feed', NULL),
  ('infojobs',  'InfoJobs',   'api',      'ES'),
  ('linkedin',  'LinkedIn',   'api',      NULL),
  ('indeed',    'Indeed',     'xml-feed', NULL)
ON CONFLICT ("Code") DO NOTHING;

-- Campaigns: no SegmentId FK — segments are in CampaignSegments below
CREATE TABLE "Campaigns" (
  "Id"              SERIAL PRIMARY KEY,
  "UserId"          BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
  -- NOTE: no SegmentId column — use CampaignSegments for the M:N relationship
  "Name"            VARCHAR(255) NOT NULL,
  "Description"     TEXT,
  "Objective"       VARCHAR(255),
  "BudgetTotal"     DECIMAL(10,2),
  -- Transition shim: backend may return this as "Budget" in JSON responses
  -- for frontend compatibility during migration. Field name in DB is BudgetTotal.
  "BudgetCurrency"  VARCHAR(10) DEFAULT 'EUR',
  "StartDate"       TIMESTAMP,
  "EndDate"         TIMESTAMP,
  "Status"          VARCHAR(50) NOT NULL DEFAULT 'draft',
  -- Valid values: 'draft', 'active', 'paused', 'completed', 'archived'
  "Config"          JSONB,
  -- Config stores campaign-level settings preserved for frontend compatibility:
  -- distributionType, targetApplications, maxCPA, manualBid, priority, autoOptimization
  "CreatedByUserId" BIGINT REFERENCES "Users"("Id"),
  "CreatedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_camp_userid  ON "Campaigns"("UserId");
CREATE INDEX idx_camp_status  ON "Campaigns"("Status");

-- CampaignSegments: formal M:N join table — one campaign, many segments
-- This is the CANONICAL relationship. Not a legacy table.
CREATE TABLE "CampaignSegments" (
  "Id"               SERIAL PRIMARY KEY,
  "CampaignId"       INTEGER NOT NULL REFERENCES "Campaigns"("Id") ON DELETE CASCADE,
  "SegmentId"        INTEGER NOT NULL REFERENCES "Segments"("Id") ON DELETE CASCADE,
  "BudgetAllocation" DECIMAL(5,2) DEFAULT 100.0,
  -- Percentage of campaign budget allocated to this segment (0.0–100.0)
  -- If 2 segments: 50.0 each. If 3: 33.33 each. Sum across segments should = 100.
  "Weight"           DECIMAL(5,2) DEFAULT 1.0,
  "CreatedAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("CampaignId", "SegmentId")
);

CREATE INDEX idx_campseg_campaign ON "CampaignSegments"("CampaignId");
CREATE INDEX idx_campseg_segment  ON "CampaignSegments"("SegmentId");

-- CampaignChannels: formal M:N join — which channels a campaign targets
-- Does NOT contain JobOfferId or per-offer budget splits.
-- Per-offer expansion happens at distribution time in DistributionItems.
CREATE TABLE "CampaignChannels" (
  "Id"          SERIAL PRIMARY KEY,
  "CampaignId"  INTEGER NOT NULL REFERENCES "Campaigns"("Id") ON DELETE CASCADE,
  "ChannelId"   INTEGER NOT NULL REFERENCES "DistributionChannels"("Id"),
  "Budget"      DECIMAL(10,2),
  -- Channel-level budget allocation (sum across channels = Campaigns.BudgetTotal)
  "BidStrategy" VARCHAR(50),
  "Status"      VARCHAR(50) NOT NULL DEFAULT 'active',
  "Config"      JSONB,
  -- Config stores channel-specific settings: maxCPA, manualBid, priority, autoOptimization
  -- Example: {"maxCPA": 9.99, "manualBid": null, "priority": "medium", "autoOptimization": true}
  "CreatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("CampaignId", "ChannelId")
);

CREATE INDEX idx_cc_campaign ON "CampaignChannels"("CampaignId");
CREATE INDEX idx_cc_channel  ON "CampaignChannels"("ChannelId");

-- Transition shim note:
-- Backend GET /api/campaigns response may include:
--   "Channels": ["jooble", "talent"]        (derived from CampaignChannels JOIN DistributionChannels)
--   "Budget": <value>                        (alias for BudgetTotal)
--   "segments": [{segmentId, name, ...}]    (derived from CampaignSegments JOIN Segments)
-- This preserves frontend contract while schema is updated.

-- OPTIONAL: port archived campaigns, then recreate CampaignSegments rows
-- Uncomment only after confirming archived campaigns have value:
-- INSERT INTO "Campaigns" ("UserId","Name","Description","BudgetTotal","StartDate","EndDate","Status","CreatedAt","UpdatedAt")
-- SELECT b."UserId", b."Name", b."Description", b."Budget", b."StartDate", b."EndDate",
--        b."Status", b."CreatedAt", b."UpdatedAt"
-- FROM "Campaigns_bak" b
-- WHERE b."UserId" IN (SELECT "Id" FROM "Users");
--
-- Then recreate CampaignSegments from Campaigns_bak.SegmentId (single segment per old campaign):
-- INSERT INTO "CampaignSegments" ("CampaignId", "SegmentId")
-- SELECT c."Id", b."SegmentId"
-- FROM "Campaigns" c
-- JOIN "Campaigns_bak" b ON b."Name" = c."Name" AND b."UserId" = c."UserId"
-- WHERE b."SegmentId" IS NOT NULL
-- ON CONFLICT DO NOTHING;


-- =============================================================================
-- PHASE 8: REPLACE ChannelCredentials
-- =============================================================================
-- Business concept: per-user credentials for each external channel
-- Action: replace UserChannelCredentials (0 rows, no FK to channels)

DROP TABLE IF EXISTS "UserChannelCredentials";

CREATE TABLE "ChannelCredentials" (
  "Id"                    SERIAL PRIMARY KEY,
  "UserId"                BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
  "ChannelId"             INTEGER NOT NULL REFERENCES "DistributionChannels"("Id"),
  "Name"                  VARCHAR(255) NOT NULL,
  "CredentialsEncrypted"  TEXT,
  "ConfigurationData"     JSONB,
  "IsActive"              BOOLEAN NOT NULL DEFAULT true,
  "IsValidated"           BOOLEAN NOT NULL DEFAULT false,
  "LastValidated"         TIMESTAMP,
  "ValidationError"       TEXT,
  "DailyBudgetLimit"      DECIMAL(10,2),
  "MonthlyBudgetLimit"    DECIMAL(10,2),
  "MaxCPA"                DECIMAL(10,2),
  "Status"                VARCHAR(50) NOT NULL DEFAULT 'active',
  "CreatedAt"             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("UserId", "ChannelId")
);

CREATE INDEX idx_chcred_userid ON "ChannelCredentials"("UserId");


-- =============================================================================
-- PHASE 9: CREATE Distribution runtime tables (new)
-- =============================================================================
-- Business concepts:
--   DistributionRun:  one execution of a campaign on a specific channel
--                     Triggered by: campaign activation, scheduled re-sync, manual push
--   DistributionItem: result for ONE offer within ONE run
--                     This is where per-offer/per-channel expansion happens —
--                     NOT in CampaignChannels (which is just the campaign-level config)
--
-- Separation of concerns:
--   CampaignChannels  → "this campaign targets these channels" (config, M:N)
--   DistributionRuns  → "this campaign ran against this channel at this time" (execution)
--   DistributionItems → "this offer was sent to this channel with this result" (per-offer audit)

CREATE TABLE IF NOT EXISTS "DistributionRuns" (
  "Id"              BIGSERIAL PRIMARY KEY,
  "UserId"          BIGINT NOT NULL REFERENCES "Users"("Id"),
  "CampaignId"      INTEGER NOT NULL REFERENCES "Campaigns"("Id"),
  "CampaignChannelId" INTEGER REFERENCES "CampaignChannels"("Id"),
  -- Link back to the specific campaign-channel config that triggered this run
  "ChannelId"       INTEGER NOT NULL REFERENCES "DistributionChannels"("Id"),
  -- Denormalized for fast queries without joining through CampaignChannels
  "Status"          VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending', 'running', 'completed', 'failed', 'partial'
  "TriggerType"     VARCHAR(50) DEFAULT 'manual',
  -- 'manual', 'scheduled', 'activation', 'resync'
  "StartedAt"       TIMESTAMP,
  "FinishedAt"      TIMESTAMP,
  "OffersTotal"     INTEGER DEFAULT 0,
  "OffersOk"        INTEGER DEFAULT 0,
  "OffersFailed"    INTEGER DEFAULT 0,
  "ErrorMessage"    TEXT,
  "CreatedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_distrun_campaign ON "DistributionRuns"("CampaignId");
CREATE INDEX idx_distrun_channel  ON "DistributionRuns"("ChannelId");
CREATE INDEX idx_distrun_status   ON "DistributionRuns"("Status");
CREATE INDEX idx_distrun_campchan ON "DistributionRuns"("CampaignChannelId");

CREATE TABLE IF NOT EXISTS "DistributionItems" (
  "Id"                  BIGSERIAL PRIMARY KEY,
  "DistributionRunId"   BIGINT NOT NULL REFERENCES "DistributionRuns"("Id") ON DELETE CASCADE,
  "JobOfferId"          BIGINT NOT NULL REFERENCES "JobOffers"("Id"),
  "ChannelId"           INTEGER NOT NULL REFERENCES "DistributionChannels"("Id"),
  -- Denormalized from DistributionRun for direct queries
  "ExternalChannelId"   VARCHAR(255),
  -- ID assigned by the external channel after publishing (e.g. Jooble's campaign ID)
  "Status"              VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending', 'published', 'failed', 'removed', 'expired'
  "AllocatedBudget"     DECIMAL(10,2),
  "AllocatedTarget"     INTEGER,
  -- Per-offer budget and target allocation computed at distribution time
  -- These are NOT stored in CampaignChannels — they are computed here per run
  "Payload"             JSONB,           -- what was sent to the channel
  "Response"            JSONB,           -- what the channel replied
  "ErrorMessage"        TEXT,
  "CreatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_distitem_run    ON "DistributionItems"("DistributionRunId");
CREATE INDEX idx_distitem_offer  ON "DistributionItems"("JobOfferId");
CREATE INDEX idx_distitem_status ON "DistributionItems"("Status");


-- =============================================================================
-- PHASE 10: CREATE Agent tables (new — Phases 7+ of roadmap)
-- =============================================================================
-- Business concept: traceability of AI agent executions and human-reviewable
--                   recommendations. Human always decides; AI only recommends.

CREATE TABLE IF NOT EXISTS "AgentRuns" (
  "Id"              BIGSERIAL PRIMARY KEY,
  "UserId"          BIGINT NOT NULL REFERENCES "Users"("Id"),
  "AgentType"       VARCHAR(100) NOT NULL,   -- 'JobDescriptionAgent', 'DistributionAgent'
  "EntityType"      VARCHAR(100),            -- 'JobOffer', 'Campaign', 'Segment'
  "EntityId"        BIGINT,
  "InputHash"       VARCHAR(64),
  "InputSnapshot"   JSONB,
  "Output"          JSONB,
  "Model"           VARCHAR(100),            -- 'claude-sonnet-4-6'
  "PromptVersion"   VARCHAR(50),
  "Status"          VARCHAR(50) NOT NULL DEFAULT 'pending',
  "CostEstimate"    DECIMAL(8,6),            -- USD
  "CreatedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agrun_type   ON "AgentRuns"("AgentType");
CREATE INDEX idx_agrun_entity ON "AgentRuns"("EntityType", "EntityId");
CREATE INDEX idx_agrun_user   ON "AgentRuns"("UserId");

CREATE TABLE IF NOT EXISTS "AgentRecommendations" (
  "Id"                  BIGSERIAL PRIMARY KEY,
  "AgentRunId"          BIGINT NOT NULL REFERENCES "AgentRuns"("Id") ON DELETE CASCADE,
  "UserId"              BIGINT NOT NULL REFERENCES "Users"("Id"),
  "EntityType"          VARCHAR(100),
  "EntityId"            BIGINT,
  "RecommendationType"  VARCHAR(100),   -- 'improve_description', 'suggest_channel'
  "Recommendation"      JSONB NOT NULL,
  "Confidence"          DECIMAL(4,3),   -- 0.000–1.000
  "Status"              VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- 'pending', 'accepted', 'rejected', 'expired'
  "ReviewedByUserId"    BIGINT REFERENCES "Users"("Id"),
  "ReviewedAt"          TIMESTAMP,
  "CreatedAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agrec_run    ON "AgentRecommendations"("AgentRunId");
CREATE INDEX idx_agrec_entity ON "AgentRecommendations"("EntityType", "EntityId");
CREATE INDEX idx_agrec_status ON "AgentRecommendations"("Status");


-- =============================================================================
-- PHASE 11: NOTIFY PostgREST to reload schema cache
-- =============================================================================
-- Must run AFTER all DDL to make new columns visible via the REST API.
-- This fixes the "column JobOffers.Id does not exist" PostgREST error.
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- POST-MIGRATION VALIDATION
-- =============================================================================
/*
Run these queries immediately after execution to confirm correctness:

-- 1. Tables with data preserved
SELECT 'Users'       t, COUNT(*) n FROM "Users"
UNION SELECT 'Connections',   COUNT(*) FROM "Connections"
UNION SELECT 'Segments_bak',  COUNT(*) FROM "Segments_bak"
UNION SELECT 'Campaigns_bak', COUNT(*) FROM "Campaigns_bak";
-- Expected: 15, 89, 17, 15

-- 2. New clean tables are empty (ready for real data)
SELECT 'JobOffers' t,       COUNT(*) n FROM "JobOffers"
UNION SELECT 'Segments',         COUNT(*) FROM "Segments"
UNION SELECT 'Campaigns',        COUNT(*) FROM "Campaigns"
UNION SELECT 'CampaignSegments', COUNT(*) FROM "CampaignSegments"
UNION SELECT 'CampaignChannels', COUNT(*) FROM "CampaignChannels"
UNION SELECT 'RawJobRecords',    COUNT(*) FROM "RawJobRecords";
-- Expected: 0, 0, 0, 0, 0, 0

-- 3. Distribution catalog seeded
SELECT COUNT(*) FROM "DistributionChannels";  -- Expected: 7

-- 4. FieldMappings cleaned (orphaned rows removed)
SELECT COUNT(*) FROM "FieldMappings";  -- Expected: 0 (all were orphaned)

-- 5. JobOffers.UserId is now BIGINT (not UUID)
SELECT data_type FROM information_schema.columns
WHERE table_name = 'JobOffers' AND column_name = 'UserId';
-- Expected: bigint

-- 6. API smoke test
-- GET /job-offers → should return 200 { success: true, total: 0, data: [] }
-- POST /api/auth/login → should still work
-- GET /api/auth/verify → should still work with existing tokens

-- 7. If POST /job-offers still 500 after NOTIFY, run:
-- NOTIFY pgrst, 'reload schema';
-- and wait 5 seconds before retrying
*/


-- =============================================================================
-- ROLLBACK GUIDE (if something goes wrong)
-- =============================================================================
/*
Users:      No destructive changes — no rollback needed
Connections: No destructive changes — no rollback needed
FieldMappings: Orphaned rows cleaned. Restore from FieldMappings_bak if needed.

Segments:   DROP TABLE "Segments" CASCADE;
            ALTER TABLE "Segments_bak" RENAME TO "Segments";

Campaigns:  DROP TABLE "CampaignChannels"; DROP TABLE "CampaignSegments";
            DROP TABLE "Campaigns" CASCADE;
            ALTER TABLE "Campaigns_bak" RENAME TO "Campaigns";
            -- Note: old CampaignSegments data (if any existed) is not restored by this rollback.
            -- Check Campaigns_bak.SegmentId if individual segment references are needed.

JobOffers:  No data to restore (was empty). Drop the new table if needed.

All new tables (RawJobRecords, DistributionRuns, etc.):
            Simply DROP TABLE IF EXISTS <table_name> CASCADE;
*/
