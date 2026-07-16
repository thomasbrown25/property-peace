-- Script to fix LandlordId for checklists that were created without it
-- This ensures checklists are associated with the correct landlord (property owner)

-- First, check which checklists have NULL or incorrect LandlordId
SELECT 
    c.Id AS ChecklistId,
    c.PropertyId,
    c.UnitId,
    c.LandlordId AS CurrentLandlordId,
    p.LandlordId AS PropertyLandlordId,
    c.Title
FROM Checklists c
INNER JOIN Properties p ON c.PropertyId = p.Id
WHERE c.LandlordId IS NULL 
   OR c.LandlordId != p.LandlordId;

-- Update checklists to use the property's LandlordId
UPDATE c
SET c.LandlordId = p.LandlordId,
    c.UpdatedAt = GETDATE()
FROM Checklists c
INNER JOIN Properties p ON c.PropertyId = p.Id
WHERE c.LandlordId IS NULL 
   OR c.LandlordId != p.LandlordId;

-- Verification query
SELECT 
    c.Id AS ChecklistId,
    c.PropertyId,
    c.UnitId,
    c.LandlordId,
    p.LandlordId AS PropertyLandlordId,
    CASE 
        WHEN c.LandlordId = p.LandlordId THEN 'OK'
        ELSE 'MISMATCH'
    END AS Status,
    c.Title
FROM Checklists c
INNER JOIN Properties p ON c.PropertyId = p.Id
ORDER BY c.PropertyId, c.UnitId, c.ChecklistType;

PRINT 'LandlordId update completed.';

