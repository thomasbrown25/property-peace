-- Seeds lease_shield.StateLawSections for South Dakota (SDCL Ch 43-32 - Lease of Real Property).
-- Source: https://law.justia.com/codes/south-dakota/title-43/chapter-32/
-- URL pattern: https://law.justia.com/codes/south-dakota/title-43/chapter-32/section-{43-32-XX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/south-dakota/title-43/chapter-32/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('SD', '43-32-1', N'Definitions', 1),
  ('SD', '43-32-2', N'Application', 2),
  ('SD', '43-32-3', N'Terms and conditions of rental agreement', 3),
  ('SD', '43-32-4', N'Prohibited provisions', 4),
  ('SD', '43-32-5', N'Security deposits', 5),
  ('SD', '43-32-6', N'Landlord to supply possession', 6),
  ('SD', '43-32-7', N'Landlord to maintain fit premises', 7),
  ('SD', '43-32-8', N'Tenant to maintain dwelling unit', 8),
  ('SD', '43-32-9', N'Access', 9),
  ('SD', '43-32-10', N'Abandoned property', 10),
  ('SD', '43-32-11', N'Noncompliance by landlord; tenant remedies', 11),
  ('SD', '43-32-12', N'Rent payment', 12),
  ('SD', '43-32-13', N'Landlord remedies; noncompliance by tenant', 13),
  ('SD', '43-32-14', N'Termination of tenancy', 14),
  ('SD', '43-32-15', N'Landlord remedies; absence or abandonment', 15),
  ('SD', '43-32-16', N'Action for possession', 16),
  ('SD', '43-32-17', N'Retaliatory conduct prohibited', 17),
  ('SD', '43-32-18', N'Early termination; domestic violence', 18),
  ('SD', '43-32-19', N'Early termination; military', 19)
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

PRINT 'lease_shield.StateLawSections seeded for SD (SDCL 43-32 - Lease of Real Property).';
GO
