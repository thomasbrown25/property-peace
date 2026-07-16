-- Seeds lease_shield.StateLawSections for North Dakota (N.D.C.C. Ch 47-16 - Leasing of Real Property).
-- Source: https://law.justia.com/codes/north-dakota/title-47/chapter-47-16/
-- URL pattern: https://law.justia.com/codes/north-dakota/title-47/chapter-47-16/section-{47-16-XX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/north-dakota/title-47/chapter-47-16/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('ND', '47-16-01', N'Definitions', 1),
  ('ND', '47-16-02', N'Application', 2),
  ('ND', '47-16-03', N'Terms and conditions of rental agreement', 3),
  ('ND', '47-16-04', N'Prohibited provisions', 4),
  ('ND', '47-16-05', N'Landlord to supply possession', 5),
  ('ND', '47-16-06', N'Landlord to maintain fit premises', 6),
  ('ND', '47-16-07', N'Rent; notice of change', 7),
  ('ND', '47-16-07.1', N'Security deposits', 8),
  ('ND', '47-16-08', N'Tenant to maintain dwelling unit', 9),
  ('ND', '47-16-09', N'Access', 10),
  ('ND', '47-16-10', N'Abandoned property', 11),
  ('ND', '47-16-11', N'Noncompliance by landlord; tenant remedies', 12),
  ('ND', '47-16-12', N'Landlord obligations; repairs', 13),
  ('ND', '47-16-13.1', N'Landlord to maintain', 14),
  ('ND', '47-16-13.2', N'Tenant to maintain', 15),
  ('ND', '47-16-14', N'Landlord remedies; noncompliance by tenant', 16),
  ('ND', '47-16-15', N'Termination of tenancy', 17),
  ('ND', '47-16-16', N'Action for possession', 18),
  ('ND', '47-16-17', N'Retaliatory conduct prohibited', 19),
  ('ND', '47-16-18', N'Early termination; domestic violence', 20),
  ('ND', '47-16-19', N'Early termination; military', 21)
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

PRINT 'lease_shield.StateLawSections seeded for ND (N.D.C.C. 47-16 - Leasing of Real Property).';
GO
