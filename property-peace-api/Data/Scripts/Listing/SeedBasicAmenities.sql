-- Seed listing.BasicAmenities with options for Parking, Laundry, and Air conditioning.
-- Run once. Uses MERGE to avoid duplicates.

SET NOCOUNT ON;

MERGE listing.BasicAmenities AS t
USING (VALUES
  (N'Street parking', N'Parking'),
  (N'Garage', N'Parking'),
  (N'Parking lot', N'Parking'),
  (N'Driveway', N'Parking'),
  (N'No parking', N'Parking'),
  (N'In unit', N'Laundry'),
  (N'In building', N'Laundry'),
  (N'Hookups only', N'Laundry'),
  (N'No laundry', N'Laundry'),
  (N'Central', N'AirConditioning'),
  (N'Window units', N'AirConditioning'),
  (N'Ductless mini-split', N'AirConditioning'),
  (N'None', N'AirConditioning')
) AS s (Name, Category)
ON t.Name = s.Name AND t.Category = s.Category
WHEN NOT MATCHED BY TARGET THEN
  INSERT (Name, Category) VALUES (s.Name, s.Category);
GO
