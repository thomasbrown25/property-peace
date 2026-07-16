-- Backfill default UtilityServiceResponsibility and MaintenanceResponsibility for existing leases
-- that do not already have any rows. Idempotent: only inserts for leases with no existing rows.
-- Run after AddUtilitiesMaintenanceKeysTables.sql.

-- 1. Default utilities for leases that have none (11 rows per lease: 5 required + 6 optional)
INSERT INTO [lease].[UtilityServiceResponsibility] ([LeaseId], [OrganizationId], [Name], [Responsibility], [IsRequired])
SELECT l.[Id], l.[OrganizationId], u.[Name], N'Tenant', u.[IsRequired]
FROM [lease].[Leases] l
CROSS APPLY (VALUES
    (N'Electricity', 1),
    (N'Gas', 1),
    (N'Sewer / Septic', 1),
    (N'Trash', 1),
    (N'Water', 1),
    (N'Cable / Satellite', 0),
    (N'HOA / Condo Fee', 0),
    (N'Internet', 0),
    (N'Landscaping', 0),
    (N'Phone', 0),
    (N'Snow Removal', 0)
) u ([Name], [IsRequired])
WHERE NOT EXISTS (SELECT 1 FROM [lease].[UtilityServiceResponsibility] ur WHERE ur.[LeaseId] = l.[Id]);

-- 2. Default maintenance for leases that have none (13 rows per lease)
INSERT INTO [lease].[MaintenanceResponsibility] ([LeaseId], [OrganizationId], [Name], [Description], [Responsibility])
SELECT l.[Id], l.[OrganizationId], m.[Name], m.[Description], m.[Responsibility]
FROM [lease].[Leases] l
CROSS APPLY (VALUES
    (N'Appliance repair', NULL, N'Landlord'),
    (N'Furnace filters', NULL, N'Tenant'),
    (N'Garage door service', NULL, N'Landlord'),
    (N'Pest control (common)', N'e.g., cockroaches, ants, spiders, rodents', N'Tenant'),
    (N'Pest control (affecting structure)', N'e.g., termites, carpenter ants, rodents if exclusion services are needed', N'Landlord'),
    (N'Leaky faucet', NULL, N'Landlord'),
    (N'Lightbulbs', NULL, N'Tenant'),
    (N'Resetting breakers/fuses', NULL, N'Tenant'),
    (N'Running toilet', NULL, N'Landlord'),
    (N'Smoke/CO2 alarm batteries', NULL, N'Tenant'),
    (N'Smoke/CO2 alarm unit replacement', NULL, N'Landlord'),
    (N'Sprinkler repairs', NULL, N'Tenant'),
    (N'Sprinklers - seasonal turn on/off', NULL, N'Tenant')
) m ([Name], [Description], [Responsibility])
WHERE NOT EXISTS (SELECT 1 FROM [lease].[MaintenanceResponsibility] mr WHERE mr.[LeaseId] = l.[Id]);

GO
