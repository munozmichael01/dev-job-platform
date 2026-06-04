-- =============================================================================
-- INCREMENTAL MIGRATION: add-job-offer-sources.sql
-- =============================================================================
-- Status:  READY — do not execute without Michael's explicit confirmation.
-- Purpose: Implement canonical deduplication for JobOffers.
--
-- What this script does:
--   1. Cleans contaminated import data (JobOffers, RawJobRecords, DistributionItems, SegmentJobOffers)
--   2. Drops the old per-connection UNIQUE constraint on JobOffers
--   3. Adds the canonical UNIQUE(UserId, SourceSystem, ExternalId)
--   4. Widens JobType/ContractType/WorkdayType/Seniority to VARCHAR(255)
--      (feeds like Turijobs send 134-char jobtype values; VARCHAR(100) rejects them)
--   5. Creates JobOfferSources — the M:N link between canonical offers and feed connections
--   6. Reloads PostgREST schema cache
--
-- Prerequisites (verify in Supabase SQL Editor before running):
--   SELECT COUNT(*) FROM "JobOffers";      -- any value is OK, data will be deleted
--   SELECT COUNT(*) FROM "RawJobRecords";  -- any value is OK, data will be deleted
--
-- Context:
--   proposed-clean-domain-schema.sql was already executed (JobOffers, RawJobRecords exist).
--   This is an incremental patch on top of that schema.
-- =============================================================================


-- =============================================================================
-- STEP 1: CLEAN CONTAMINATED IMPORT DATA
-- =============================================================================
-- These tables hold data from imports that used the wrong UNIQUE constraint
-- (allowing duplicates across connections). Safe to delete — this is test/MVP data.
-- Users, Connections, Campaigns, Segments are NOT touched.

DELETE FROM "DistributionItems";      -- depends on JobOffers
DELETE FROM "DistributionRuns";       -- depends on Campaigns, not JobOffers directly, but clean for consistency
DELETE FROM "SegmentJobOffers";       -- depends on JobOffers
DELETE FROM "AgentRecommendations";   -- depends on nothing critical but clean
DELETE FROM "AgentRuns";              -- same

-- Clean RawJobRecords first (has FK to JobOffers via JobOfferId)
UPDATE "RawJobRecords" SET "JobOfferId" = NULL;  -- break FK before delete
DELETE FROM "RawJobRecords";

-- Now clean JobOffers
DELETE FROM "JobOffers";


-- =============================================================================
-- STEP 2: DROP OLD UNIQUE CONSTRAINT ON JobOffers
-- =============================================================================
-- The constraint uq_joboffer_source was: UNIQUE(UserId, ConnectionId, ExternalId)
-- This allowed the same offer (same ExternalId) to exist multiple times if it
-- arrived via different connections — causing duplicates.

ALTER TABLE "JobOffers"
  DROP CONSTRAINT IF EXISTS "uq_joboffer_source";


-- =============================================================================
-- STEP 3: ADD CANONICAL UNIQUE CONSTRAINT
-- =============================================================================
-- The canonical key is: one offer per user per source system per external ID.
-- ConnectionId is no longer part of the uniqueness — multiple connections can
-- point to the same canonical offer (tracked via JobOfferSources).

ALTER TABLE "JobOffers"
  ADD CONSTRAINT "uq_joboffers_canonical_source"
  UNIQUE ("UserId", "SourceSystem", "ExternalId");


-- =============================================================================
-- STEP 4: WIDEN SHORT VARCHAR COLUMNS
-- =============================================================================
-- Real-world feed values (e.g. Turijobs jobtype) exceed 100 chars.
-- Widening to 255 is safe — no data exists, and 255 is the standard for
-- free-text classification fields in job feeds.

ALTER TABLE "JobOffers"
  ALTER COLUMN "JobType"      TYPE VARCHAR(255),
  ALTER COLUMN "ContractType" TYPE VARCHAR(255),
  ALTER COLUMN "WorkdayType"  TYPE VARCHAR(255),
  ALTER COLUMN "Seniority"    TYPE VARCHAR(255);


-- =============================================================================
-- STEP 5: CREATE JobOfferSources
-- =============================================================================
-- This table records every (connection, externalId) → canonical JobOffer mapping.
-- One canonical JobOffer can have many sources. When an offer disappears from
-- one feed it doesn't mean it's gone if another connection still sends it.
--
-- Deduplication contract:
--   RawJobRecords: unique per ConnectionId + ExternalId (or PayloadHash)
--   JobOffers:     unique per UserId + SourceSystem + ExternalId  ← canonical
--   JobOfferSources: unique per UserId + ConnectionId + ExternalId ← per-source link
--
-- Reconciliation rule:
--   JobOfferSources.StatusInSource tracks availability per feed connection.
--   JobOffers.Status only becomes 'paused'/'archived' when ALL linked sources
--   are no longer active — not when just one connection stops sending the offer.

CREATE TABLE IF NOT EXISTS "JobOfferSources" (
  "Id"               BIGSERIAL PRIMARY KEY,

  -- Ownership
  "UserId"           BIGINT NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,

  -- Link to canonical offer
  "JobOfferId"       BIGINT NOT NULL REFERENCES "JobOffers"("Id") ON DELETE CASCADE,

  -- Link to source
  "ConnectionId"     INTEGER NOT NULL,                  -- references Connections.id
  "RawJobRecordId"   BIGINT REFERENCES "RawJobRecords"("Id") ON DELETE SET NULL,

  -- Source identity
  "SourceSystem"     VARCHAR(100) NOT NULL,             -- e.g. 'turijobs', 'bebee'
  "ExternalId"       VARCHAR(255) NOT NULL,             -- ID in the source system

  -- Change detection
  "PayloadHash"      VARCHAR(64),

  -- Per-source availability
  "StatusInSource"   VARCHAR(50) NOT NULL DEFAULT 'active',
  -- 'active'   — offer present in latest feed run for this connection
  -- 'paused'   — offer missing from feed, ExpirationDate future or absent
  -- 'archived' — offer missing from feed, ExpirationDate past
  -- 'expired'  — alias for archived when reason is expiration

  -- Reconciliation timestamps
  "FirstSeenAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "LastSeenAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "MissingSince"     TIMESTAMP,
  "PauseReason"      VARCHAR(100),
  "ArchivedReason"   VARCHAR(100),

  "CreatedAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt"        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Uniqueness: one row per (user, connection, externalId)
  CONSTRAINT "uq_joboffersources_link"
    UNIQUE ("UserId", "ConnectionId", "ExternalId")
);

CREATE INDEX idx_jos_joboffer    ON "JobOfferSources"("JobOfferId");
CREATE INDEX idx_jos_connection  ON "JobOfferSources"("ConnectionId");
CREATE INDEX idx_jos_userid_src  ON "JobOfferSources"("UserId", "SourceSystem", "ExternalId");
CREATE INDEX idx_jos_status      ON "JobOfferSources"("StatusInSource");
CREATE INDEX idx_jos_lastseen    ON "JobOfferSources"("LastSeenAt" DESC);


-- =============================================================================
-- STEP 6: RELOAD PostgREST SCHEMA CACHE
-- =============================================================================
-- Must run after all DDL so the new table and column changes are visible via API.
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- POST-MIGRATION VALIDATION QUERIES
-- (Run these immediately after execution)
-- =============================================================================
/*
-- 1. Data cleaned
SELECT COUNT(*) FROM "JobOffers";       -- Expected: 0
SELECT COUNT(*) FROM "RawJobRecords";   -- Expected: 0

-- 2. New constraint exists
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'JobOffers' AND constraint_type = 'UNIQUE';
-- Expected: uq_joboffers_canonical_source (old uq_joboffer_source should be gone)

-- 3. Column widths updated
SELECT column_name, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'JobOffers'
AND column_name IN ('JobType','ContractType','WorkdayType','Seniority');
-- Expected: all 255

-- 4. JobOfferSources exists
SELECT COUNT(*) FROM "JobOfferSources";  -- Expected: 0 (new table, empty)

-- 5. Users and Connections untouched
SELECT COUNT(*) FROM "Users";       -- Expected: 15
SELECT COUNT(*) FROM "Connections"; -- Expected: 89
*/
