-- Adds SmokingAllowed to lease.Leases, creates lease.Pets and lease.Parking tables.

-- 1. Add PetsAllowed and SmokingAllowed columns to lease.Leases
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'PetsAllowed'
)
BEGIN
    ALTER TABLE [lease].[Leases]
    ADD [PetsAllowed] BIT NULL;
END
GO

-- Add SmokingAllowed column (yes, no, outsideOnly)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'SmokingAllowed'
)
BEGIN
    ALTER TABLE [lease].[Leases]
    ADD [SmokingAllowed] NVARCHAR(20) NULL;
END
GO

-- Add UpdatedAt column to lease.Leases (for sorting by last updated)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'UpdatedAt'
)
BEGIN
    ALTER TABLE [lease].[Leases]
    ADD [UpdatedAt] DATETIME2 NULL;
END
GO

-- 2. Create lease.Pets table
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = N'lease' AND t.name = N'Pets'
)
BEGIN
    CREATE TABLE [lease].[Pets] (
        [Id] BIGINT IDENTITY(1,1) NOT NULL,
        [LeaseId] BIGINT NOT NULL,
        [OrganizationId] BIGINT NULL,
        [Type] NVARCHAR(100) NOT NULL,
        [Breed] NVARCHAR(100) NULL,
        [Weight] DECIMAL(10,2) NULL,
        [Age] INT NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [UpdatedAt] DATETIME2 NULL,
        CONSTRAINT [PK_Pets] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Pets_Leases_LeaseId] FOREIGN KEY ([LeaseId])
            REFERENCES [lease].[Leases] ([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_Pets_LeaseId] ON [lease].[Pets] ([LeaseId]);
    CREATE INDEX [IX_Pets_OrganizationId] ON [lease].[Pets] ([OrganizationId]);
END
GO

-- 3. Create lease.Parking table (one per lease)
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = N'lease' AND t.name = N'Parking'
)
BEGIN
    CREATE TABLE [lease].[Parking] (
        [Id] BIGINT IDENTITY(1,1) NOT NULL,
        [LeaseId] BIGINT NOT NULL,
        [OrganizationId] BIGINT NULL,
        [IncludeParkingRules] BIT NOT NULL DEFAULT 0,
        [ParkingTypes] NVARCHAR(500) NULL,
        [CustomRules] NVARCHAR(MAX) NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [UpdatedAt] DATETIME2 NULL,
        CONSTRAINT [PK_Parking] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Parking_Leases_LeaseId] FOREIGN KEY ([LeaseId])
            REFERENCES [lease].[Leases] ([Id]) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX [IX_Parking_LeaseId] ON [lease].[Parking] ([LeaseId]);
    CREATE INDEX [IX_Parking_OrganizationId] ON [lease].[Parking] ([OrganizationId]);
END
GO
