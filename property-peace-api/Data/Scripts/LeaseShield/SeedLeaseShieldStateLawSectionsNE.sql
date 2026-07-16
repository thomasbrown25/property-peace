-- Seeds lease_shield.StateLawSections for Nebraska (Neb. Rev. Stat. Ch 76, Art 14 - Uniform Residential Landlord and Tenant Act, 76-1401 et seq).
-- Source: https://law.justia.com/codes/nebraska/chapter-76/
-- URL pattern: https://law.justia.com/codes/nebraska/chapter-76/statute-{76-14-XXX}/ (comma to dash in section code).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/nebraska/chapter-76/statute-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('NE', '76-14,101', N'Noncompliance by tenant; landlord rights', 1),
  ('NE', '76-14,102', N'Definitions', 2),
  ('NE', '76-14,103', N'Application', 3),
  ('NE', '76-14,104', N'Termination of tenancy; action for possession', 4),
  ('NE', '76-14,105', N'Violation of access rights; remedies', 5),
  ('NE', '76-14,106', N'Terms and conditions of rental agreement', 6),
  ('NE', '76-14,107', N'Prohibited provisions', 7),
  ('NE', '76-14,108', N'Security deposits', 8),
  ('NE', '76-14,109', N'Landlord to supply possession', 9),
  ('NE', '76-14,110', N'Landlord to maintain fit premises', 10),
  ('NE', '76-14,111', N'Tenant to maintain dwelling unit', 11),
  ('NE', '76-14,112', N'Access', 12),
  ('NE', '76-14,113', N'Abandoned property', 13),
  ('NE', '76-14,114', N'Noncompliance by landlord; tenant remedies', 14),
  ('NE', '76-14,115', N'Failure to supply essential services', 15),
  ('NE', '76-14,116', N'Landlord remedies; absence or abandonment', 16),
  ('NE', '76-14,117', N'Remedies; tenant holding over', 17),
  ('NE', '76-14,118', N'Defenses to action for possession', 18),
  ('NE', '76-14,119', N'Rent paid into court', 19),
  ('NE', '76-14,120', N'Casualty damage', 20),
  ('NE', '76-14,121', N'Retaliatory conduct prohibited', 21)
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

PRINT 'lease_shield.StateLawSections seeded for NE (Ch 76 Art 14 - URLTA).';
GO
