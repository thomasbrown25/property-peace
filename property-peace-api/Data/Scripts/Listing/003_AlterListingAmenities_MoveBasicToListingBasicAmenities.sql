-- ============================================================
-- Alter listing.ListingAmenities: copy basic amenity selections
-- into listing.ListingBasicAmenities, then drop BasicAmenityId.
-- Run after 001_ (so ListingBasicAmenities exists).
-- ============================================================
SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.columns c
               JOIN sys.tables t ON c.object_id = t.object_id
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = N'listing' AND t.name = N'ListingAmenities' AND c.name = N'BasicAmenityId')
BEGIN
    PRINT 'listing.ListingAmenities has no BasicAmenityId; nothing to do.';
END
ELSE
BEGIN
    -- 1. Copy existing basic amenity selections into ListingBasicAmenities (avoid duplicates)
    INSERT INTO listing.ListingBasicAmenities (ListingId, BasicAmenityId)
    SELECT la.ListingId, la.BasicAmenityId
    FROM listing.ListingAmenities la
    WHERE la.BasicAmenityId IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM listing.ListingBasicAmenities lba
          WHERE lba.ListingId = la.ListingId AND lba.BasicAmenityId = la.BasicAmenityId
      );

    PRINT 'Migrated basic amenity selections to listing.ListingBasicAmenities.';

    -- 2. Drop FK on BasicAmenityId (find by name pattern)
    DECLARE @fkName NVARCHAR(256);
    SELECT @fkName = fk.name
    FROM sys.foreign_keys fk
    WHERE fk.parent_object_id = OBJECT_ID('listing.ListingAmenities')
      AND fk.referenced_object_id = OBJECT_ID('listing.BasicAmenities');

    IF @fkName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE listing.ListingAmenities DROP CONSTRAINT ' + QUOTENAME(@fkName));
        PRINT 'Dropped FK ' + @fkName + ' from listing.ListingAmenities';
    END

    -- 3. Drop index on BasicAmenityId if present
    IF EXISTS (SELECT 1 FROM sys.indexes i
               JOIN sys.tables t ON i.object_id = t.object_id
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = N'listing' AND t.name = N'ListingAmenities' AND i.name = N'IX_ListingAmenities_BasicAmenityId')
    BEGIN
        DROP INDEX IX_ListingAmenities_BasicAmenityId ON listing.ListingAmenities;
        PRINT 'Dropped index IX_ListingAmenities_BasicAmenityId';
    END

    -- 4. Drop column
    ALTER TABLE listing.ListingAmenities DROP COLUMN BasicAmenityId;
    PRINT 'Dropped column BasicAmenityId from listing.ListingAmenities';
END
GO
