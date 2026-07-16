-- Simplified script to seed default checklists for existing properties
-- This script creates Move-In and Move-Out checklists for each property
-- that doesn't already have default checklists
--
-- Prerequisites:
-- 1. All organizations should have default checklist items seeded (via API endpoint)
-- 2. Run this script to create default checklists for existing properties
--
-- Usage: Execute this script in SQL Server Management Studio or via sqlcmd

-- First, let's see which properties need default checklists
SELECT 
    p.Id AS PropertyId,
    p.Name AS PropertyName,
    p.OrganizationId,
    p.LandlordId,
    COUNT(c.Id) AS ExistingChecklistCount
FROM Properties p
LEFT JOIN Checklists c ON c.PropertyId = p.Id 
    AND c.UnitId IS NULL 
    AND c.Title LIKE 'Default%'
WHERE p.IsDeleted = 0
    AND p.OrganizationId IS NOT NULL
GROUP BY p.Id, p.Name, p.OrganizationId, p.LandlordId
HAVING COUNT(c.Id) < 2  -- Should have 2 checklists (Move-In and Move-Out)
ORDER BY p.OrganizationId, p.Id;

-- Note: The actual insertion is complex and requires iterating through organization items
-- It's recommended to use the C# service method CreateDefaultChecklistsForProperty
-- or run the full script (SeedDefaultChecklistsForExistingProperties.sql) which uses cursors

-- Alternative: Create a stored procedure or use the API endpoint to seed checklists
-- The API endpoint can be called programmatically for each property

