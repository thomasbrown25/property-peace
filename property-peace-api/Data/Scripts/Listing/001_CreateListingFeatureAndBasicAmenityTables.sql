-- ============================================================
-- Create listing tables: DefaultFeatures, CustomFeatures,
-- ListingBasicAmenities. Run once; safe to re-run (object checks).
-- ============================================================
SET NOCOUNT ON;

-- Ensure schema exists
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'listing')
BEGIN
    EXEC('CREATE SCHEMA listing');
END
GO

-- 1. listing.DefaultFeatures (predefined property/building features)
IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = N'listing' AND t.name = N'DefaultFeatures')
BEGIN
    CREATE TABLE listing.DefaultFeatures (
        Id        BIGINT IDENTITY(1,1) NOT NULL,
        Name      NVARCHAR(200) NOT NULL,
        CONSTRAINT PK_DefaultFeatures PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_DefaultFeatures_Name UNIQUE (Name)
    );
    PRINT 'Created table listing.DefaultFeatures';
END
ELSE
    PRINT 'Table listing.DefaultFeatures already exists';
GO

-- 2. listing.CustomFeatures (org-scoped custom features)
IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = N'listing' AND t.name = N'CustomFeatures')
BEGIN
    CREATE TABLE listing.CustomFeatures (
        Id             BIGINT IDENTITY(1,1) NOT NULL,
        Name           NVARCHAR(200) NOT NULL,
        OrganizationId BIGINT NOT NULL,
        CreatedBy      BIGINT NOT NULL,
        CreatedAt      DATETIME2 NOT NULL CONSTRAINT DF_CustomFeatures_CreatedAt DEFAULT (GETUTCDATE()),
        CONSTRAINT PK_CustomFeatures PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CustomFeatures_Organizations FOREIGN KEY (OrganizationId)
            REFERENCES organization.Organizations (Id) ON DELETE NO ACTION,
        CONSTRAINT FK_CustomFeatures_Users FOREIGN KEY (CreatedBy)
            REFERENCES core.Users (Id) ON DELETE NO ACTION
    );
    CREATE NONCLUSTERED INDEX IX_CustomFeatures_OrganizationId ON listing.CustomFeatures (OrganizationId);
    PRINT 'Created table listing.CustomFeatures';
END
ELSE
    PRINT 'Table listing.CustomFeatures already exists';
GO

-- 3. listing.ListingBasicAmenities (selected Parking/Laundry/AC options per listing)
IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = N'listing' AND t.name = N'ListingBasicAmenities')
BEGIN
    CREATE TABLE listing.ListingBasicAmenities (
        Id             BIGINT IDENTITY(1,1) NOT NULL,
        ListingId      BIGINT NOT NULL,
        BasicAmenityId BIGINT NOT NULL,
        CONSTRAINT PK_ListingBasicAmenities PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_ListingBasicAmenities_Listings FOREIGN KEY (ListingId)
            REFERENCES listing.Listings (Id) ON DELETE CASCADE,
        CONSTRAINT FK_ListingBasicAmenities_BasicAmenities FOREIGN KEY (BasicAmenityId)
            REFERENCES listing.BasicAmenities (Id) ON DELETE NO ACTION
    );
    CREATE NONCLUSTERED INDEX IX_ListingBasicAmenities_ListingId ON listing.ListingBasicAmenities (ListingId);
    CREATE NONCLUSTERED INDEX IX_ListingBasicAmenities_BasicAmenityId ON listing.ListingBasicAmenities (BasicAmenityId);
    PRINT 'Created table listing.ListingBasicAmenities';
END
ELSE
    PRINT 'Table listing.ListingBasicAmenities already exists';
GO
