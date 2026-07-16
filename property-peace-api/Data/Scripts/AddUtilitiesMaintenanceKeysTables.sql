-- Adds Utilities, Maintenance, & Keys support: new columns on lease.Leases and new tables.
-- Run this before using the Utilities, Maintenance, & Keys build-lease-agreement step.

-- 1. Add columns to lease.Leases (if not exist)
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'HasSharedUtilities')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [HasSharedUtilities] BIT NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'SharedUtilitiesDisclosure')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [SharedUtilitiesDisclosure] NVARCHAR(MAX) NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'MaintenanceNotificationMethods')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [MaintenanceNotificationMethods] NVARCHAR(500) NULL;
END
GO

-- 2. Create lease.UtilityServiceResponsibility (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'UtilityServiceResponsibility')
BEGIN
    CREATE TABLE [lease].[UtilityServiceResponsibility] (
        [Id] BIGINT IDENTITY(1,1) NOT NULL,
        [LeaseId] BIGINT NOT NULL,
        [OrganizationId] BIGINT NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Responsibility] NVARCHAR(20) NOT NULL,
        [IsRequired] BIT NOT NULL,
        CONSTRAINT [PK_UtilityServiceResponsibility] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_UtilityServiceResponsibility_Leases_LeaseId] FOREIGN KEY ([LeaseId])
            REFERENCES [lease].[Leases] ([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_UtilityServiceResponsibility_LeaseId] ON [lease].[UtilityServiceResponsibility] ([LeaseId]);
    CREATE INDEX [IX_UtilityServiceResponsibility_OrganizationId] ON [lease].[UtilityServiceResponsibility] ([OrganizationId]);
END
GO

-- 3. Create lease.MaintenanceResponsibility (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'MaintenanceResponsibility')
BEGIN
    CREATE TABLE [lease].[MaintenanceResponsibility] (
        [Id] BIGINT IDENTITY(1,1) NOT NULL,
        [LeaseId] BIGINT NOT NULL,
        [OrganizationId] BIGINT NULL,
        [Name] NVARCHAR(150) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [Responsibility] NVARCHAR(20) NOT NULL,
        CONSTRAINT [PK_MaintenanceResponsibility] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MaintenanceResponsibility_Leases_LeaseId] FOREIGN KEY ([LeaseId])
            REFERENCES [lease].[Leases] ([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_MaintenanceResponsibility_LeaseId] ON [lease].[MaintenanceResponsibility] ([LeaseId]);
    CREATE INDEX [IX_MaintenanceResponsibility_OrganizationId] ON [lease].[MaintenanceResponsibility] ([OrganizationId]);
END
GO

-- 4. Create lease.LeaseKeys (if not exists)
IF NOT EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'LeaseKeys')
BEGIN
    CREATE TABLE [lease].[LeaseKeys] (
        [Id] BIGINT IDENTITY(1,1) NOT NULL,
        [LeaseId] BIGINT NOT NULL,
        [OrganizationId] BIGINT NULL,
        [KeyType] NVARCHAR(50) NOT NULL,
        [Copies] INT NOT NULL,
        CONSTRAINT [PK_LeaseKeys] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_LeaseKeys_Leases_LeaseId] FOREIGN KEY ([LeaseId])
            REFERENCES [lease].[Leases] ([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_LeaseKeys_LeaseId] ON [lease].[LeaseKeys] ([LeaseId]);
    CREATE INDEX [IX_LeaseKeys_OrganizationId] ON [lease].[LeaseKeys] ([OrganizationId]);
END
GO
