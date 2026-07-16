-- Script to seed default checklist items for existing organizations
-- This creates the default checklist template that will be used when units are created
-- Run this script to populate OrganizationChecklistItems for all existing organizations

-- Default items that apply to both move-in and move-out
DECLARE @CommonItems TABLE (
    Name NVARCHAR(200),
    Category NVARCHAR(100),
    Description NVARCHAR(500),
    SortOrder INT
);

INSERT INTO @CommonItems (Name, Category, Description, SortOrder) VALUES
('Walls - Clean and undamaged', 'Interior', 'Check all walls for cleanliness and damage', 0),
('Floors - Clean and undamaged', 'Interior', 'Check all flooring surfaces', 1),
('Windows - Clean and functional', 'Interior', 'Check all windows open/close properly', 2),
('Doors - Functional locks', 'Interior', 'Check all doors and locks work properly', 3),
('Kitchen - Appliances working', 'Kitchen', 'Test all kitchen appliances', 4),
('Kitchen - Sink and faucet', 'Kitchen', 'Check sink and faucet functionality', 5),
('Bathroom - Toilet functional', 'Bathroom', 'Test toilet functionality', 6),
('Bathroom - Shower/tub functional', 'Bathroom', 'Check shower/tub and water pressure', 7),
('Bathroom - Sink and faucet', 'Bathroom', 'Check bathroom sink functionality', 8),
('HVAC - Heating working', 'HVAC', 'Test heating system', 9),
('HVAC - Cooling working', 'HVAC', 'Test cooling system', 10),
('Electrical - All outlets working', 'Electrical', 'Test all electrical outlets', 11),
('Electrical - Light fixtures working', 'Electrical', 'Test all light fixtures', 12),
('Smoke detectors - Functional', 'Safety', 'Test all smoke detectors', 13),
('Carbon monoxide detectors - Functional', 'Safety', 'Test all CO detectors', 14);

-- Move-in specific items
DECLARE @MoveInItems TABLE (
    Name NVARCHAR(200),
    Category NVARCHAR(100),
    Description NVARCHAR(500),
    SortOrder INT
);

INSERT INTO @MoveInItems (Name, Category, Description, SortOrder) VALUES
('Keys and access - All keys provided', 'Move-In', 'Verify all keys and access codes are provided', 15),
('Parking - Assigned space available', 'Move-In', 'Confirm parking space assignment', 16),
('Mailbox - Access provided', 'Move-In', 'Verify mailbox access', 17),
('Utilities - Transfer information provided', 'Move-In', 'Confirm utility transfer instructions given', 18);

-- Move-out specific items
DECLARE @MoveOutItems TABLE (
    Name NVARCHAR(200),
    Category NVARCHAR(100),
    Description NVARCHAR(500),
    SortOrder INT
);

INSERT INTO @MoveOutItems (Name, Category, Description, SortOrder) VALUES
('Keys - All keys returned', 'Move-Out', 'Verify all keys and access devices returned', 19),
('Cleaning - Unit cleaned thoroughly', 'Move-Out', 'Check that unit is cleaned to move-out standards', 20),
('Personal items - All removed', 'Move-Out', 'Confirm all personal belongings removed', 21),
('Utilities - Disconnected or transferred', 'Move-Out', 'Verify utilities are disconnected or transferred', 22),
('Damage assessment - Document all damage', 'Move-Out', 'Document any damage beyond normal wear and tear', 23);

-- Combine all items
DECLARE @AllItems TABLE (
    Name NVARCHAR(200),
    Category NVARCHAR(100),
    Description NVARCHAR(500),
    SortOrder INT
);

INSERT INTO @AllItems SELECT * FROM @CommonItems;
INSERT INTO @AllItems SELECT * FROM @MoveInItems;
INSERT INTO @AllItems SELECT * FROM @MoveOutItems;

-- Cursor to iterate through organizations that don't have default checklist items
DECLARE @OrganizationId BIGINT;
DECLARE @ItemName NVARCHAR(200);
DECLARE @ItemDescription NVARCHAR(500);
DECLARE @ItemCategory NVARCHAR(100);
DECLARE @SortOrder INT;

DECLARE org_cursor CURSOR FOR
SELECT DISTINCT o.Id
FROM Organizations o
WHERE NOT EXISTS (
    -- Check if organization already has default items
    SELECT 1 
    FROM OrganizationChecklistItems oci 
    WHERE oci.OrganizationId = o.Id 
      AND oci.IsDefault = 1 
      AND oci.IsDeleted = 0
);

OPEN org_cursor;
FETCH NEXT FROM org_cursor INTO @OrganizationId;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Insert all default items for this organization
        DECLARE item_cursor CURSOR FOR
        SELECT Name, Description, Category, SortOrder
        FROM @AllItems
        ORDER BY SortOrder;

        OPEN item_cursor;
        FETCH NEXT FROM item_cursor INTO @ItemName, @ItemDescription, @ItemCategory, @SortOrder;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            INSERT INTO OrganizationChecklistItems (
                Name,
                Description,
                Category,
                OrganizationId,
                IsDefault,
                IsDeleted,
                SortOrder,
                CreatedAt,
                UpdatedAt
            )
            VALUES (
                @ItemName,
                @ItemDescription,
                @ItemCategory,
                @OrganizationId,
                1, -- IsDefault = true
                0, -- IsDeleted = false
                @SortOrder,
                GETDATE(),
                NULL
            );

            FETCH NEXT FROM item_cursor INTO @ItemName, @ItemDescription, @ItemCategory, @SortOrder;
        END;

        CLOSE item_cursor;
        DEALLOCATE item_cursor;

        COMMIT TRANSACTION;

        PRINT 'Seeded default checklist items for Organization ID: ' + CAST(@OrganizationId AS NVARCHAR(20));
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        PRINT 'Error seeding items for Organization ID: ' + CAST(@OrganizationId AS NVARCHAR(20)) + ' - ' + ERROR_MESSAGE();
    END CATCH;

    FETCH NEXT FROM org_cursor INTO @OrganizationId;
END;

CLOSE org_cursor;
DEALLOCATE org_cursor;

PRINT 'Default checklist items seeding completed.';

-- Verification query - run this to check results
SELECT 
    o.Id AS OrganizationId,
    o.Name AS OrganizationName,
    COUNT(oci.Id) AS ChecklistItemCount
FROM Organizations o
LEFT JOIN OrganizationChecklistItems oci ON oci.OrganizationId = o.Id 
    AND oci.IsDefault = 1 
    AND oci.IsDeleted = 0
GROUP BY o.Id, o.Name
ORDER BY o.Id;

