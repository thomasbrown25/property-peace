-- Seeds lease_shield.StateLawSections for Kansas (Ch 58 Art 25 - Residential Landlord and Tenant Act, 58-2540 et seq).
-- Source: https://law.justia.com/codes/kansas/chapter-58/article-25/
-- URL pattern: https://law.justia.com/codes/kansas/chapter-58/article-25/section-{58-25-XXX}/ (comma in statute becomes dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/kansas/chapter-58/article-25/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('KS', '58-2540', N'Title of act', 1),
  ('KS', '58-2550', N'Definitions', 2),
  ('KS', '58-2551', N'Application', 3),
  ('KS', '58-2552', N'Exclusions', 4),
  ('KS', '58-2553', N'Terms and conditions of rental agreement', 5),
  ('KS', '58-2554', N'Prohibited provisions', 6),
  ('KS', '58-2555', N'Rental deposits', 7),
  ('KS', '58-2556', N'Landlord to supply possession', 8),
  ('KS', '58-2557', N'Landlord to maintain fit premises', 9),
  ('KS', '58-2558', N'Tenant to maintain dwelling unit', 10),
  ('KS', '58-2559', N'Access', 11),
  ('KS', '58-2560', N'Abandoned property', 12),
  ('KS', '58-2561', N'Noncompliance by landlord; tenant remedies', 13),
  ('KS', '58-2562', N'Failure to supply essential services', 14),
  ('KS', '58-2563', N'Landlord remedies; noncompliance by tenant', 15),
  ('KS', '58-2564', N'Termination of tenancy', 16),
  ('KS', '58-2565', N'Landlord remedies; absence or abandonment', 17),
  ('KS', '58-2566', N'Remedies; tenant holding over', 18),
  ('KS', '58-2567', N'Action for possession', 19),
  ('KS', '58-2568', N'Defenses to action for possession', 20),
  ('KS', '58-2569', N'Rent paid into court', 21),
  ('KS', '58-2570', N'Distribution of funds', 22),
  ('KS', '58-2571', N'Casualty damage', 23),
  ('KS', '58-2572', N'Retaliatory conduct prohibited', 24),
  ('KS', '58-25,105', N'Terms and conditions; notice of tenant rights', 25)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + REPLACE(s.SectionCode, ',', '-') + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + REPLACE(s.SectionCode, ',', '-') + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for KS (Ch 58 Art 25 - Residential Landlord and Tenant Act).';
GO
