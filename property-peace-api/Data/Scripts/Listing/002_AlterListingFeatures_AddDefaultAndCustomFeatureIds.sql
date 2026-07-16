-- ============================================================
-- Alter listing.ListingFeatures: add DefaultFeatureId and
-- CustomFeatureId; migrate data from DefaultAmenityId/CustomAmenityId
-- (when they pointed to feature data); then drop old columns.
-- Run after 001_ and after SeedDefaultFeatures.sql.
-- ============================================================
SET NOCOUNT ON;

-- Only alter if ListingFeatures still has the old columns
IF EXISTS (SELECT 1 FROM sys.columns c
           JOIN sys.tables t ON c.object_id = t.object_id
           JOIN sys.schemas s ON t.schema_id = s.schema_id
           WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'DefaultAmenityId')
BEGIN
    -- 1. Add new columns (nullable)
    IF NOT EXISTS (SELECT 1 FROM sys.columns c
                   JOIN sys.tables t ON c.object_id = t.object_id
                   JOIN sys.schemas s ON t.schema_id = s.schema_id
                   WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'DefaultFeatureId')
    BEGIN
        ALTER TABLE listing.ListingFeatures ADD DefaultFeatureId BIGINT NULL;
        ALTER TABLE listing.ListingFeatures ADD CustomFeatureId  BIGINT NULL;
        PRINT 'Added DefaultFeatureId and CustomFeatureId to listing.ListingFeatures';
    END

    -- 2. Add FKs to new columns (requires DefaultFeatures and CustomFeatures tables)
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ListingFeatures_DefaultFeatures')
    BEGIN
        ALTER TABLE listing.ListingFeatures
        ADD CONSTRAINT FK_ListingFeatures_DefaultFeatures
        FOREIGN KEY (DefaultFeatureId) REFERENCES listing.DefaultFeatures (Id) ON DELETE NO ACTION;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ListingFeatures_CustomFeatures')
    BEGIN
        ALTER TABLE listing.ListingFeatures
        ADD CONSTRAINT FK_ListingFeatures_CustomFeatures
        FOREIGN KEY (CustomFeatureId) REFERENCES listing.CustomFeatures (Id) ON DELETE NO ACTION;
    END

    -- 3. Backfill DefaultFeatureId from DefaultAmenityId (where amenity was a PropertyFeature)
    UPDATE lf
    SET lf.DefaultFeatureId = df.Id
    FROM listing.ListingFeatures lf
    INNER JOIN listing.DefaultAmenities da ON da.Id = lf.DefaultAmenityId AND da.Category = N'PropertyFeature'
    INNER JOIN listing.DefaultFeatures df ON df.Name = da.Name;

    PRINT 'Backfilled DefaultFeatureId from DefaultAmenityId (PropertyFeature).';

    -- 4. Create CustomFeatures from CustomAmenities where Category = 'PropertyFeature' (for orgs that had custom features)
    INSERT INTO listing.CustomFeatures (Name, OrganizationId, CreatedBy, CreatedAt)
    SELECT ca.Name, ca.OrganizationId, ca.CreatedBy, ca.CreatedAt
    FROM listing.CustomAmenities ca
    WHERE ca.Category = N'PropertyFeature'
      AND NOT EXISTS (
          SELECT 1 FROM listing.CustomFeatures cf
          WHERE cf.OrganizationId = ca.OrganizationId AND cf.Name = ca.Name
      );

    -- 5. Backfill CustomFeatureId from CustomAmenityId
    UPDATE lf
    SET lf.CustomFeatureId = cf.Id
    FROM listing.ListingFeatures lf
    INNER JOIN listing.CustomAmenities ca ON ca.Id = lf.CustomAmenityId AND ca.Category = N'PropertyFeature'
    INNER JOIN listing.CustomFeatures cf ON cf.OrganizationId = ca.OrganizationId AND cf.Name = ca.Name;

    PRINT 'Backfilled CustomFeatureId from CustomAmenityId (PropertyFeature).';

    -- 6. Drop old FK and columns
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ListingFeatures_DefaultAmenity_DefaultAmenityId')
        ALTER TABLE listing.ListingFeatures DROP CONSTRAINT FK_ListingFeatures_DefaultAmenity_DefaultAmenityId;
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('listing.ListingFeatures')
               AND name LIKE N'%DefaultAmenity%')
    BEGIN
        DECLARE @fk NVARCHAR(256);
        SELECT @fk = name FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID('listing.ListingFeatures') AND name LIKE N'%DefaultAmenity%';
        IF @fk IS NOT NULL
            EXEC('ALTER TABLE listing.ListingFeatures DROP CONSTRAINT ' + @fk);
    END
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('listing.ListingFeatures')
               AND name LIKE N'%CustomAmenity%')
    BEGIN
        DECLARE @fk2 NVARCHAR(256);
        SELECT @fk2 = name FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID('listing.ListingFeatures') AND name LIKE N'%CustomAmenity%';
        IF @fk2 IS NOT NULL
            EXEC('ALTER TABLE listing.ListingFeatures DROP CONSTRAINT ' + @fk2);
    END

    IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'DefaultAmenityId')
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.indexes i
                   JOIN sys.tables t ON i.object_id = t.object_id
                   JOIN sys.schemas s ON t.schema_id = s.schema_id
                   WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND i.name = N'IX_ListingFeatures_DefaultAmenityId')
            DROP INDEX IX_ListingFeatures_DefaultAmenityId ON listing.ListingFeatures;
        ALTER TABLE listing.ListingFeatures DROP COLUMN DefaultAmenityId;
        PRINT 'Dropped DefaultAmenityId from listing.ListingFeatures';
    END
    IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'CustomAmenityId')
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.indexes i
                   JOIN sys.tables t ON i.object_id = t.object_id
                   JOIN sys.schemas s ON t.schema_id = s.schema_id
                   WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND i.name = N'IX_ListingFeatures_CustomAmenityId')
            DROP INDEX IX_ListingFeatures_CustomAmenityId ON listing.ListingFeatures;
        ALTER TABLE listing.ListingFeatures DROP COLUMN CustomAmenityId;
        PRINT 'Dropped CustomAmenityId from listing.ListingFeatures';
    END
END
ELSE
    PRINT 'listing.ListingFeatures already uses DefaultFeatureId/CustomFeatureId; no change.';
GO
