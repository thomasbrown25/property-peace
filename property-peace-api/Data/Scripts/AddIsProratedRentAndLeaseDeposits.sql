-- Run this script to fix "Invalid column name 'IsProratedRent'" and "Invalid object name 'lease.LeaseDeposits'".
-- Adds IsProratedRent to lease.Leases and creates lease.LeaseDeposits if missing.

-- 1. Add IsProratedRent column to lease.Leases (if not exists)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'IsProratedRent'
)
BEGIN
    ALTER TABLE [lease].[Leases]
    ADD [IsProratedRent] BIT NULL;
END
GO

-- 2. Create lease.LeaseDeposits table (if not exists)
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = N'lease' AND t.name = N'LeaseDeposits'
)
BEGIN
    CREATE TABLE [lease].[LeaseDeposits] (
        [Id] BIGINT IDENTITY(1,1) NOT NULL,
        [LeaseId] BIGINT NOT NULL,
        [OrganizationId] BIGINT NULL,
        [Name] NVARCHAR(200) NOT NULL,
        [Amount] DECIMAL(18,2) NOT NULL,
        [DueDate] DATETIME2 NOT NULL,
        [SortOrder] INT NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL,
        [UpdatedAt] DATETIME2 NULL,
        CONSTRAINT [PK_LeaseDeposits] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_LeaseDeposits_Leases_LeaseId] FOREIGN KEY ([LeaseId])
            REFERENCES [lease].[Leases] ([Id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_LeaseDeposits_LeaseId] ON [lease].[LeaseDeposits] ([LeaseId]);
    CREATE INDEX [IX_LeaseDeposits_OrganizationId] ON [lease].[LeaseDeposits] ([OrganizationId]);
END
GO
