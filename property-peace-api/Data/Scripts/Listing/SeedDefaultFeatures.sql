-- Seed listing.DefaultFeatures with predefined property/building features (screenshot 2).
-- Run after creating the DefaultFeatures table. Uses MERGE to avoid duplicates.

SET NOCOUNT ON;

MERGE listing.DefaultFeatures AS t
USING (VALUES
  (N'Gym'),
  (N'Pool'),
  (N'Elevator'),
  (N'Storage'),
  (N'Security system'),
  (N'Wheelchair accessible'),
  (N'Pet-friendly building'),
  (N'On-site laundry'),
  (N'Balcony'),
  (N'Rooftop'),
  (N'Parking garage'),
  (N'Bike storage')
) AS s (Name)
ON t.Name = s.Name
WHEN NOT MATCHED BY TARGET THEN
  INSERT (Name) VALUES (s.Name);
GO
