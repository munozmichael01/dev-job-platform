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
}

module.exports = { ensureTables };
