-- Adds Provisions & Attachments columns to lease.Leases for the build-lease-agreement step.
-- Run before using the Provisions & Attachments page.

IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'IncludeEarlyTerminationClause')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [IncludeEarlyTerminationClause] BIT NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'EarlyTerminationClauseText')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [EarlyTerminationClauseText] NVARCHAR(MAX) NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'AdditionalTerms')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [AdditionalTerms] NVARCHAR(MAX) NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'BuiltBefore1978')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [BuiltBefore1978] BIT NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'AwareOfLeadPaint')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [AwareOfLeadPaint] BIT NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'LeadPaintExplanation')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [LeadPaintExplanation] NVARCHAR(MAX) NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'HasLeadPaintRecords')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [HasLeadPaintRecords] BIT NULL;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'lease' AND t.name = N'Leases' AND c.name = N'LeadPaintRecordsExplanation')
BEGIN
    ALTER TABLE [lease].[Leases] ADD [LeadPaintRecordsExplanation] NVARCHAR(MAX) NULL;
END
GO
