-- Seed listing.DefaultAmenities with default Property Amenities only (screenshot 1).
-- BasicAmenities (Parking, Laundry, Air Conditioning options) are in SeedBasicAmenities.sql.
-- Property features are in listing.DefaultFeatures; see SeedDefaultFeatures.sql.

SET NOCOUNT ON;

MERGE listing.DefaultAmenities AS t
USING (VALUES
  (N'Dishwasher', N'PropertyAmenity'),
  (N'Air conditioning', N'PropertyAmenity'),
  (N'Washer & dryer in unit', N'PropertyAmenity'),
  (N'Patio', N'PropertyAmenity'),
  (N'Hardwood flooring', N'PropertyAmenity'),
  (N'Oversized closets', N'PropertyAmenity'),
  (N'Fireplace', N'PropertyAmenity'),
  (N'Refrigerator', N'PropertyAmenity'),
  (N'Ceiling fan(s)', N'PropertyAmenity'),
  (N'Yard', N'PropertyAmenity'),
  (N'Utilities included', N'PropertyAmenity'),
  (N'Furnished', N'PropertyAmenity'),
  (N'Parking', N'PropertyAmenity'),
  (N'Laundry', N'PropertyAmenity')
) AS s (Name, Category)
ON t.Name = s.Name AND t.Category = s.Category
WHEN NOT MATCHED BY TARGET THEN
  INSERT (Name, Category) VALUES (s.Name, s.Category);
GO
