-- Seeds lease_shield.StateLawSections for Maryland (Real Property Title 8 - Landlord and Tenant, Subtitle 2 Residential Leases).
-- Source: https://law.justia.com/codes/maryland/real-property/title-8/
-- URL pattern: https://law.justia.com/codes/maryland/real-property/title-8/subtitle-2/section-{8-XXX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/maryland/real-property/title-8/subtitle-2/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('MD', '8-201', N'Definitions', 1),
  ('MD', '8-202', N'Application', 2),
  ('MD', '8-203', N'Written lease required', 3),
  ('MD', '8-204', N'Required lease provisions', 4),
  ('MD', '8-205', N'Prohibited provisions', 5),
  ('MD', '8-206', N'Security deposits', 6),
  ('MD', '8-207', N'Landlord obligations', 7),
  ('MD', '8-208', N'Written leases; prohibited provisions; damages', 8),
  ('MD', '8-208.1', N'Retaliatory eviction', 9),
  ('MD', '8-208.2', N'Rent payment records', 10),
  ('MD', '8-208.3', N'Rent payment records; receipts', 11),
  ('MD', '8-209', N'Tenant obligations', 12),
  ('MD', '8-210', N'Access by landlord', 13),
  ('MD', '8-211', N'Early termination; domestic violence', 14),
  ('MD', '8-212', N'Early termination; military', 15)
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

PRINT 'lease_shield.StateLawSections seeded for MD (Real Property Title 8 - Landlord and Tenant).';
GO
