-- Seeds lease_shield.StateLawSections for Mississippi (Title 89, Ch 8 - Residential Landlord and Tenant Act, 89-8-1 to 89-8-45).
-- Source: https://law.justia.com/codes/mississippi/title-89/chapter-8/
-- URL pattern: https://law.justia.com/codes/mississippi/title-89/chapter-8/section-{89-8-XX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/mississippi/title-89/chapter-8/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('MS', '89-8-1', N'Short title', 1),
  ('MS', '89-8-3', N'Application of chapter', 2),
  ('MS', '89-8-5', N'Definitions', 3),
  ('MS', '89-8-7', N'Terms and conditions of rental agreement', 4),
  ('MS', '89-8-9', N'Prohibited provisions', 5),
  ('MS', '89-8-11', N'Security deposits', 6),
  ('MS', '89-8-13', N'Right to terminate for breach; abandoned property', 7),
  ('MS', '89-8-15', N'Landlord to supply possession', 8),
  ('MS', '89-8-17', N'Landlord to maintain fit premises', 9),
  ('MS', '89-8-19', N'Tenant to maintain dwelling unit', 10),
  ('MS', '89-8-21', N'Tenant''s security deposit', 11),
  ('MS', '89-8-23', N'Duties of landlord', 12),
  ('MS', '89-8-25', N'Duties of tenant', 13),
  ('MS', '89-8-27', N'Housing authorities; tenant management', 14),
  ('MS', '89-8-29', N'Access', 15),
  ('MS', '89-8-31', N'Noncompliance by landlord; tenant remedies', 16),
  ('MS', '89-8-33', N'Landlord remedies; noncompliance by tenant', 17),
  ('MS', '89-8-35', N'Termination of tenancy', 18),
  ('MS', '89-8-37', N'Residential evictions; default judgment', 19),
  ('MS', '89-8-39', N'Retaliatory conduct prohibited', 20),
  ('MS', '89-8-41', N'Early termination; domestic violence', 21),
  ('MS', '89-8-43', N'Early termination; military', 22)
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

PRINT 'lease_shield.StateLawSections seeded for MS (Title 89 Ch 8 - Residential Landlord and Tenant Act).';
GO
