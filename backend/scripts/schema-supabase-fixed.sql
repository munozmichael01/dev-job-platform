-- ================================================
-- SCHEMA SUPABASE - MATCH EXACTO CON SQL SERVER
-- ================================================
-- Este schema coincide exactamente con la estructura actual de SQL Server
-- Usa BIGINT para IDs en lugar de UUID para compatibilidad directa

-- Drop existing tables if they exist
DROP TABLE IF EXISTS "Connections" CASCADE;
DROP TABLE IF EXISTS "Segments" CASCADE;
DROP TABLE IF EXISTS "Campaigns" CASCADE;
DROP TABLE IF EXISTS "Users" CASCADE;

-- ================================================
-- TABLA: Users
-- ================================================
CREATE TABLE "Users" (
  "Id" BIGSERIAL PRIMARY KEY,
  "Email" VARCHAR(255) NOT NULL UNIQUE,
  "FirstName" VARCHAR(255) NOT NULL,
  "LastName" VARCHAR(255) NOT NULL,
  "Company" VARCHAR(255) NOT NULL DEFAULT '',
  "Website" VARCHAR(500),
  "Phone" VARCHAR(50) NOT NULL DEFAULT '',
  "PasswordHash" VARCHAR(255),
  "Image" VARCHAR(500),
  "GoogleId" VARCHAR(100),
  "Role" VARCHAR(50) NOT NULL DEFAULT 'user',
  "IsActive" BOOLEAN NOT NULL DEFAULT true,
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para Users
CREATE INDEX idx_users_email ON "Users"("Email");
CREATE INDEX idx_users_role ON "Users"("Role");
CREATE INDEX idx_users_googleid ON "Users"("GoogleId") WHERE "GoogleId" IS NOT NULL;

-- ================================================
-- TABLA: Campaigns
-- ================================================
CREATE TABLE "Campaigns" (
  "Id" SERIAL PRIMARY KEY,
  "Name" VARCHAR(255) NOT NULL,
  "Description" TEXT,
  "SegmentId" INTEGER NOT NULL,
  "DistributionType" VARCHAR(50) NOT NULL,
  "StartDate" TIMESTAMP,
  "EndDate" TIMESTAMP,
  "Budget" DECIMAL(10,2),
  "TargetApplications" INTEGER,
  "MaxCPA" DECIMAL(10,2),
  "Channels" TEXT,
  "BidStrategy" VARCHAR(50),
  "ManualBid" DECIMAL(10,2),
  "Priority" VARCHAR(20),
  "AutoOptimization" BOOLEAN NOT NULL DEFAULT false,
  "Status" VARCHAR(50) NOT NULL DEFAULT 'draft',
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "InternalConfig" TEXT,
  "UserId" BIGINT,
  "LastMetricsSync" TIMESTAMP,
  "ActualSpend" DECIMAL(10,2),
  "ActualApplications" INTEGER,
  CONSTRAINT fk_campaigns_user FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE
);

-- Índices para Campaigns
CREATE INDEX idx_campaigns_userid ON "Campaigns"("UserId");
CREATE INDEX idx_campaigns_segmentid ON "Campaigns"("SegmentId");
CREATE INDEX idx_campaigns_status ON "Campaigns"("Status");
CREATE INDEX idx_campaigns_dates ON "Campaigns"("StartDate", "EndDate");

-- ================================================
-- TABLA: Segments
-- ================================================
CREATE TABLE "Segments" (
  "Id" SERIAL PRIMARY KEY,
  "Name" VARCHAR(255) NOT NULL,
  "Description" TEXT,
  "Filters" TEXT,
  "Status" VARCHAR(50) NOT NULL DEFAULT 'active',
  "OfferCount" INTEGER NOT NULL DEFAULT 0,
  "Campaigns" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "UserId" BIGINT,
  CONSTRAINT fk_segments_user FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE
);

-- Índices para Segments
CREATE INDEX idx_segments_userid ON "Segments"("UserId");
CREATE INDEX idx_segments_status ON "Segments"("Status");

-- ================================================
-- TABLA: Connections
-- ================================================
CREATE TABLE "Connections" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "url" VARCHAR(1024),
  "frequency" VARCHAR(50),
  "status" VARCHAR(50),
  "lastSync" TIMESTAMP,
  "importedOffers" INTEGER,
  "errorCount" INTEGER,
  "clientId" INTEGER NOT NULL,
  "Method" VARCHAR(10),
  "Headers" TEXT,
  "Body" TEXT,
  "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "SourceType" VARCHAR(500),
  "Endpoint" VARCHAR(500),
  "PayloadTemplate" TEXT,
  "FeedUrl" VARCHAR(500),
  "Notes" TEXT,
  "UserId" BIGINT,
  CONSTRAINT fk_connections_user FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE
);

-- Índices para Connections
CREATE INDEX idx_connections_userid ON "Connections"("UserId");
CREATE INDEX idx_connections_clientid ON "Connections"("clientId");
CREATE INDEX idx_connections_type ON "Connections"("type");
CREATE INDEX idx_connections_status ON "Connections"("status");

-- ================================================
-- COMENTARIOS
-- ================================================
COMMENT ON TABLE "Users" IS 'Tabla de usuarios del sistema';
COMMENT ON TABLE "Campaigns" IS 'Campañas de distribución de ofertas';
COMMENT ON TABLE "Segments" IS 'Segmentos de ofertas filtradas';
COMMENT ON TABLE "Connections" IS 'Conexiones a fuentes de datos externas';

-- ================================================
-- FINALIZADO
-- ================================================
-- Schema creado exitosamente para coincidir con SQL Server
