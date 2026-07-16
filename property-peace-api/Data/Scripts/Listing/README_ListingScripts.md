# Listing schema SQL scripts

Run in order when applying schema changes manually (instead of EF migrations).

## Order

1. **001_CreateListingFeatureAndBasicAmenityTables.sql**  
   Creates:
   - `listing.DefaultFeatures` (predefined property/building features)
   - `listing.CustomFeatures` (org-scoped custom features)
   - `listing.ListingBasicAmenities` (selected Parking/Laundry/AC per listing)  
   Safe to re-run (checks for existing objects).

2. **SeedDefaultFeatures.sql**  
   Inserts the 12 default feature rows into `listing.DefaultFeatures`.  
   Run after 001.

3. **002_AlterListingFeatures_AddDefaultAndCustomFeatureIds.sql**  
   Alters `listing.ListingFeatures`:
   - Adds `DefaultFeatureId`, `CustomFeatureId`
   - Backfills from existing `DefaultAmenityId`/`CustomAmenityId` (PropertyFeature) if present
   - Drops `DefaultAmenityId`, `CustomAmenityId`  
   Run after 001 and SeedDefaultFeatures.

4. **003_AlterListingAmenities_MoveBasicToListingBasicAmenities.sql**  
   Alters `listing.ListingAmenities`:
   - Copies rows with `BasicAmenityId` into `listing.ListingBasicAmenities`
   - Drops FK, index, and column `BasicAmenityId`  
   Run after 001.

## Existing seed scripts (unchanged)

- **SeedDefaultAmenities.sql** – seeds `listing.DefaultAmenities` (property amenities only).
- **SeedBasicAmenities.sql** – seeds `listing.BasicAmenities` (Parking/Laundry/Air Conditioning options).

## Dependencies

- Schema `listing` and tables `listing.Listings`, `listing.BasicAmenities`, `listing.ListingAmenities`, `listing.DefaultAmenities`, `listing.CustomAmenities` must exist.
- Schema `organization` and table `organization.Organizations` for `CustomFeatures`.
- Schema `core` and table `core.Users` for `CustomFeatures.CreatedBy`.
