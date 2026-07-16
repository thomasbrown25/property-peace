-- Seeds lease_shield.StateLawSections for Utah (Utah Code 57-22 - Residential Rental Agreements).
-- Source: https://law.justia.com/codes/utah/title-57/chapter-22/
-- URL pattern: https://law.justia.com/codes/utah/title-57/chapter-22/section-{57-22-XX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/utah/title-57/chapter-22/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('UT', '57-22-1', N'Short title', 1),
  ('UT', '57-22-2', N'Definitions', 2),
  ('UT', '57-22-3', N'Application', 3),
  ('UT', '57-22-4', N'Terms and conditions of rental agreement', 4),
  ('UT', '57-22-5', N'Prohibited provisions', 5),
  ('UT', '57-22-6', N'Security deposits', 6),
  ('UT', '57-22-7', N'Landlord to supply possession', 7),
  ('UT', '57-22-8', N'Landlord to maintain fit premises', 8),
  ('UT', '57-22-9', N'Tenant to maintain dwelling unit', 9),
  ('UT', '57-22-10', N'Access', 10),
  ('UT', '57-22-11', N'Abandoned property', 11),
  ('UT', '57-22-12', N'Noncompliance by landlord; tenant remedies', 12),
  ('UT', '57-22-13', N'Landlord remedies; noncompliance by tenant', 13),
  ('UT', '57-22-14', N'Termination of tenancy', 14),
  ('UT', '57-22-15', N'Landlord remedies; absence or abandonment', 15),
  ('UT', '57-22-16', N'Action for possession', 16),
  ('UT', '57-22-17', N'Retaliatory conduct prohibited', 17),
  ('UT', '57-22-18', N'Early termination; domestic violence', 18),
  ('UT', '57-22-19', N'Early termination; military', 19)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for UT (57-22 - Residential Rental Agreements).';
GO
