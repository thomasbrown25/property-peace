-- Seeds lease_shield.StateLawSections for Kentucky (KRS Ch 383 - Rental of property; forcible entry and detainer; URLTA 383.505-383.705).
-- Source: https://law.justia.com/codes/kentucky/chapter-383/
-- URL pattern: https://law.justia.com/codes/kentucky/chapter-383/section-{383-XXX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/kentucky/chapter-383/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('KY', '383.010', N'Definitions', 1),
  ('KY', '383.020', N'Forcible entry or detainer', 2),
  ('KY', '383.030', N'Summons; complaint', 3),
  ('KY', '383.040', N'Judgment; writ of possession', 4),
  ('KY', '383.050', N'Appeal', 5),
  ('KY', '383.060', N'Rent paid into court', 6),
  ('KY', '383.500', N'Local governments authorized to adopt URLTA', 7),
  ('KY', '383.505', N'Short title', 8),
  ('KY', '383.510', N'Definitions', 9),
  ('KY', '383.520', N'Terms and conditions of rental agreement', 10),
  ('KY', '383.530', N'Prohibited provisions', 11),
  ('KY', '383.540', N'Rental deposits', 12),
  ('KY', '383.550', N'Landlord to supply possession', 13),
  ('KY', '383.560', N'Landlord to maintain fit premises', 14),
  ('KY', '383.570', N'Tenant to maintain dwelling unit', 15),
  ('KY', '383.580', N'Access', 16),
  ('KY', '383.590', N'Noncompliance by landlord; tenant remedies', 17),
  ('KY', '383.600', N'Failure to supply essential services', 18),
  ('KY', '383.610', N'Landlord remedies; noncompliance by tenant', 19),
  ('KY', '383.620', N'Termination of tenancy', 20),
  ('KY', '383.630', N'Landlord remedies; absence or abandonment', 21),
  ('KY', '383.640', N'Remedies; tenant holding over', 22),
  ('KY', '383.650', N'Action for possession', 23),
  ('KY', '383.660', N'Defenses to action for possession', 24),
  ('KY', '383.670', N'Rent paid into court', 25),
  ('KY', '383.680', N'Casualty damage', 26),
  ('KY', '383.690', N'Early termination; domestic violence', 27),
  ('KY', '383.700', N'Early termination; military', 28),
  ('KY', '383.705', N'Retaliatory conduct', 29)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + REPLACE(s.SectionCode, '.', '-') + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + REPLACE(s.SectionCode, '.', '-') + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for KY (KRS Ch 383 - Rental property; URLTA).';
GO
