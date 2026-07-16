using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddDefaultAndCustomFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: create tables only if missing (handles partial migration or SQL script overlap)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'listing' AND t.name = N'DefaultFeatures')
                BEGIN
                    CREATE TABLE listing.DefaultFeatures (Id bigint IDENTITY(1,1) NOT NULL, Name nvarchar(200) NOT NULL, CONSTRAINT PK_DefaultFeatures PRIMARY KEY (Id));
                    CREATE UNIQUE INDEX IX_DefaultFeatures_Name ON listing.DefaultFeatures (Name);
                END
                IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'listing' AND t.name = N'CustomFeatures')
                BEGIN
                    CREATE TABLE listing.CustomFeatures (
                        Id bigint IDENTITY(1,1) NOT NULL,
                        Name nvarchar(200) NOT NULL,
                        OrganizationId bigint NOT NULL,
                        CreatedBy bigint NOT NULL,
                        CreatedAt datetime2 NOT NULL,
                        CONSTRAINT PK_CustomFeatures PRIMARY KEY (Id),
                        CONSTRAINT FK_CustomFeatures_Organizations_OrganizationId FOREIGN KEY (OrganizationId) REFERENCES organization.Organizations(Id),
                        CONSTRAINT FK_CustomFeatures_Users_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES core.Users(Id)
                    );
                    CREATE INDEX IX_CustomFeatures_OrganizationId ON listing.CustomFeatures (OrganizationId);
                END
            ");

            // Add columns only if they don't exist (idempotent for DBs updated via SQL scripts)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'DefaultFeatureId')
                    ALTER TABLE listing.ListingFeatures ADD DefaultFeatureId bigint NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'CustomFeatureId')
                    ALTER TABLE listing.ListingFeatures ADD CustomFeatureId bigint NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'IsAcquired')
                    ALTER TABLE listing.ListingFeatures ADD IsAcquired bit NOT NULL DEFAULT 1;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('listing.ListingFeatures') AND name = N'IX_ListingFeatures_DefaultFeatureId')
                    CREATE INDEX IX_ListingFeatures_DefaultFeatureId ON listing.ListingFeatures (DefaultFeatureId);
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('listing.ListingFeatures') AND name = N'IX_ListingFeatures_CustomFeatureId')
                    CREATE INDEX IX_ListingFeatures_CustomFeatureId ON listing.ListingFeatures (CustomFeatureId);
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ListingFeatures_DefaultFeatures_DefaultFeatureId')
                    ALTER TABLE listing.ListingFeatures ADD CONSTRAINT FK_ListingFeatures_DefaultFeatures_DefaultFeatureId FOREIGN KEY (DefaultFeatureId) REFERENCES listing.DefaultFeatures(Id);
                IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ListingFeatures_CustomFeatures_CustomFeatureId')
                    ALTER TABLE listing.ListingFeatures ADD CONSTRAINT FK_ListingFeatures_CustomFeatures_CustomFeatureId FOREIGN KEY (CustomFeatureId) REFERENCES listing.CustomFeatures(Id);
            ");

            // Backfill DefaultFeatureId from DefaultAmenityId where Category = 'PropertyFeature'
            migrationBuilder.Sql(@"
                UPDATE lf
                SET lf.DefaultFeatureId = df.Id
                FROM listing.ListingFeatures lf
                INNER JOIN listing.DefaultAmenities da ON da.Id = lf.DefaultAmenityId AND da.Category = N'PropertyFeature'
                INNER JOIN listing.DefaultFeatures df ON df.Name = da.Name
            ");

            // Backfill CustomFeatureId: insert CustomFeatures from CustomAmenities (PropertyFeature) then update
            migrationBuilder.Sql(@"
                INSERT INTO listing.CustomFeatures (Name, OrganizationId, CreatedBy, CreatedAt)
                SELECT ca.Name, ca.OrganizationId, ca.CreatedBy, ca.CreatedAt
                FROM listing.CustomAmenities ca
                WHERE ca.Category = N'PropertyFeature'
                  AND NOT EXISTS (SELECT 1 FROM listing.CustomFeatures cf WHERE cf.OrganizationId = ca.OrganizationId AND cf.Name = ca.Name)
            ");

            migrationBuilder.Sql(@"
                UPDATE lf
                SET lf.CustomFeatureId = cf.Id
                FROM listing.ListingFeatures lf
                INNER JOIN listing.CustomAmenities ca ON ca.Id = lf.CustomAmenityId AND ca.Category = N'PropertyFeature'
                INNER JOIN listing.CustomFeatures cf ON cf.OrganizationId = ca.OrganizationId AND cf.Name = ca.Name
            ");

            // Drop old FK and columns on ListingFeatures (idempotent)
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ListingFeatures_DefaultAmenities_DefaultAmenityId')
                    ALTER TABLE listing.ListingFeatures DROP CONSTRAINT FK_ListingFeatures_DefaultAmenities_DefaultAmenityId;
                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_ListingFeatures_CustomAmenities_CustomAmenityId')
                    ALTER TABLE listing.ListingFeatures DROP CONSTRAINT FK_ListingFeatures_CustomAmenities_CustomAmenityId;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('listing.ListingFeatures') AND name = N'IX_ListingFeatures_DefaultAmenityId')
                    DROP INDEX IX_ListingFeatures_DefaultAmenityId ON listing.ListingFeatures;
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('listing.ListingFeatures') AND name = N'IX_ListingFeatures_CustomAmenityId')
                    DROP INDEX IX_ListingFeatures_CustomAmenityId ON listing.ListingFeatures;
                IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'DefaultAmenityId')
                    ALTER TABLE listing.ListingFeatures DROP COLUMN DefaultAmenityId;
                IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.tables t ON c.object_id = t.object_id JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = N'listing' AND t.name = N'ListingFeatures' AND c.name = N'CustomAmenityId')
                    ALTER TABLE listing.ListingFeatures DROP COLUMN CustomAmenityId;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "DefaultAmenityId",
                schema: "listing",
                table: "ListingFeatures",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "CustomAmenityId",
                schema: "listing",
                table: "ListingFeatures",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ListingFeatures_DefaultAmenityId",
                schema: "listing",
                table: "ListingFeatures",
                column: "DefaultAmenityId");

            migrationBuilder.CreateIndex(
                name: "IX_ListingFeatures_CustomAmenityId",
                schema: "listing",
                table: "ListingFeatures",
                column: "CustomAmenityId");

            migrationBuilder.AddForeignKey(
                name: "FK_ListingFeatures_DefaultAmenities_DefaultAmenityId",
                schema: "listing",
                table: "ListingFeatures",
                column: "DefaultAmenityId",
                principalSchema: "listing",
                principalTable: "DefaultAmenities",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.AddForeignKey(
                name: "FK_ListingFeatures_CustomAmenities_CustomAmenityId",
                schema: "listing",
                table: "ListingFeatures",
                column: "CustomAmenityId",
                principalSchema: "listing",
                principalTable: "CustomAmenities",
                principalColumn: "Id",
                onDelete: ReferentialAction.NoAction);

            migrationBuilder.DropForeignKey(
                name: "FK_ListingFeatures_DefaultFeatures_DefaultFeatureId",
                schema: "listing",
                table: "ListingFeatures");

            migrationBuilder.DropForeignKey(
                name: "FK_ListingFeatures_CustomFeatures_CustomFeatureId",
                schema: "listing",
                table: "ListingFeatures");

            migrationBuilder.DropIndex(
                name: "IX_ListingFeatures_DefaultFeatureId",
                schema: "listing",
                table: "ListingFeatures");

            migrationBuilder.DropIndex(
                name: "IX_ListingFeatures_CustomFeatureId",
                schema: "listing",
                table: "ListingFeatures");

            migrationBuilder.DropColumn(
                name: "DefaultFeatureId",
                schema: "listing",
                table: "ListingFeatures");

            migrationBuilder.DropColumn(
                name: "CustomFeatureId",
                schema: "listing",
                table: "ListingFeatures");

            migrationBuilder.DropColumn(
                name: "IsAcquired",
                schema: "listing",
                table: "ListingFeatures");

            migrationBuilder.DropTable(
                name: "CustomFeatures",
                schema: "listing");

            migrationBuilder.DropTable(
                name: "DefaultFeatures",
                schema: "listing");
        }
    }
}
