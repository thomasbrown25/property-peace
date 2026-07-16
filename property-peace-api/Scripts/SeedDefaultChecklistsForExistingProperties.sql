-- Script to seed default checklists for existing properties
-- This creates Move-In and Move-Out checklists for each property using the organization's default checklist items
-- Run this script after ensuring all organizations have default checklist items seeded

-- Step 1: Ensure all organizations have default checklist items
-- (This should already be done via the SeedDefaultChecklistItems endpoint, but we'll check)

-- Step 2: For each property, create default Move-In and Move-Out checklists
-- Note: This uses a cursor to iterate through properties and create checklists with their items

DECLARE @PropertyId BIGINT;
DECLARE @OrganizationId BIGINT;
DECLARE @LandlordId BIGINT;
DECLARE @MoveInChecklistId BIGINT;
DECLARE @MoveOutChecklistId BIGINT;
DECLARE @ItemId BIGINT;
DECLARE @ItemName NVARCHAR(200);
DECLARE @ItemDescription NVARCHAR(500);
DECLARE @ItemCategory NVARCHAR(100);
DECLARE @SortOrder INT;

-- Cursor to iterate through properties that don't have default checklists
DECLARE property_cursor CURSOR FOR
SELECT DISTINCT p.Id, p.OrganizationId, p.LandlordId
FROM Properties p
WHERE p.IsDeleted = 0
  AND p.OrganizationId IS NOT NULL
  AND NOT EXISTS (
    -- Check if property already has a default Move-In checklist
    SELECT 1 
    FROM Checklists c 
    WHERE c.PropertyId = p.Id 
      AND c.ChecklistType = 40 -- MoveInChecklist
      AND c.UnitId IS NULL -- Property-level, not unit-specific
      AND c.Title LIKE 'Default%'
  );

OPEN property_cursor;
FETCH NEXT FROM property_cursor INTO @PropertyId, @OrganizationId, @LandlordId;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        BEGIN TRANSACTION;

        -- Create Move-In Checklist
        INSERT INTO Checklists (
            ChecklistType,
            PropertyId,
            UnitId,
            LeaseId,
            TenantId,
            Title,
            InspectionDate,
            CompletedAt,
            IsCompleted,
            ConductedBy,
            TenantSignature,
            LandlordSignature,
            TenantSignedAt,
            LandlordSignedAt,
            GeneralNotes,
            ConditionNotes,
            BeforeMoveInImagesBlobNames,
            BeforeMoveInImagesUrls,
            AfterMoveOutImagesBlobNames,
            AfterMoveOutImagesUrls,
            LandlordId,
            OrganizationId,
            CreatedAt,
            UpdatedAt
        )
        VALUES (
            40, -- MoveInChecklist
            @PropertyId,
            NULL, -- Property-level, not unit-specific
            NULL,
            NULL,
            'Default Move-In Checklist',
            GETDATE(),
            NULL,
            0,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            @LandlordId,
            @OrganizationId,
            GETDATE(),
            NULL
        );

        SET @MoveInChecklistId = SCOPE_IDENTITY();

        -- Create Move-Out Checklist
        INSERT INTO Checklists (
            ChecklistType,
            PropertyId,
            UnitId,
            LeaseId,
            TenantId,
            Title,
            InspectionDate,
            CompletedAt,
            IsCompleted,
            ConductedBy,
            TenantSignature,
            LandlordSignature,
            TenantSignedAt,
            LandlordSignedAt,
            GeneralNotes,
            ConditionNotes,
            BeforeMoveInImagesBlobNames,
            BeforeMoveInImagesUrls,
            AfterMoveOutImagesBlobNames,
            AfterMoveOutImagesUrls,
            LandlordId,
            OrganizationId,
            CreatedAt,
            UpdatedAt
        )
        VALUES (
            41, -- MoveOutChecklist
            @PropertyId,
            NULL, -- Property-level, not unit-specific
            NULL,
            NULL,
            'Default Move-Out Checklist',
            GETDATE(),
            NULL,
            0,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            @LandlordId,
            @OrganizationId,
            GETDATE(),
            NULL
        );

        SET @MoveOutChecklistId = SCOPE_IDENTITY();

        -- Insert checklist items from organization's default items
        -- Cursor to iterate through organization checklist items
        DECLARE item_cursor CURSOR FOR
        SELECT Id, Name, Description, Category, SortOrder
        FROM OrganizationChecklistItems
        WHERE OrganizationId = @OrganizationId
          AND IsDeleted = 0
        ORDER BY SortOrder, Category, Name;

        OPEN item_cursor;
        FETCH NEXT FROM item_cursor INTO @ItemId, @ItemName, @ItemDescription, @ItemCategory, @SortOrder;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- Add item to Move-In Checklist
            INSERT INTO ChecklistItems (
                Name,
                Description,
                Category,
                Condition,
                Notes,
                HasDamage,
                DamageDescription,
                PhotoBlobName,
                PhotoBlobUrl,
                IsChecked,
                CheckedAt,
                ChecklistId,
                SortOrder
            )
            VALUES (
                @ItemName,
                @ItemDescription,
                @ItemCategory,
                NULL,
                NULL,
                0,
                NULL,
                NULL,
                NULL,
                0,
                NULL,
                @MoveInChecklistId,
                @SortOrder
            );

            -- Add item to Move-Out Checklist
            INSERT INTO ChecklistItems (
                Name,
                Description,
                Category,
                Condition,
                Notes,
                HasDamage,
                DamageDescription,
                PhotoBlobName,
                PhotoBlobUrl,
                IsChecked,
                CheckedAt,
                ChecklistId,
                SortOrder
            )
            VALUES (
                @ItemName,
                @ItemDescription,
                @ItemCategory,
                NULL,
                NULL,
                0,
                NULL,
                NULL,
                NULL,
                0,
                NULL,
                @MoveOutChecklistId,
                @SortOrder
            );

            FETCH NEXT FROM item_cursor INTO @ItemId, @ItemName, @ItemDescription, @ItemCategory, @SortOrder;
        END;

        CLOSE item_cursor;
        DEALLOCATE item_cursor;

        COMMIT TRANSACTION;

        PRINT 'Created default checklists for Property ID: ' + CAST(@PropertyId AS NVARCHAR(20));
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        PRINT 'Error creating checklists for Property ID: ' + CAST(@PropertyId AS NVARCHAR(20)) + ' - ' + ERROR_MESSAGE();
    END CATCH;

    FETCH NEXT FROM property_cursor INTO @PropertyId, @OrganizationId, @LandlordId;
END;

CLOSE property_cursor;
DEALLOCATE property_cursor;

PRINT 'Default checklist seeding completed.';

