-- Seeds lease_shield.StateLawSections for New York (Real Property Law RPP; Real Property Actions and Proceedings RPA).
-- Source: https://law.justia.com/codes/new-york/rpp/ and .../rpa/
-- URL pattern: RPP https://law.justia.com/codes/new-york/rpp/article-X/section-{227}/ ; RPA article-7 for summary proceeding.
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseRPP NVARCHAR(512) = 'https://law.justia.com/codes/new-york/rpp/section-';
DECLARE @BaseRPA NVARCHAR(512) = 'https://law.justia.com/codes/new-york/rpa/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('NY', 'RPP-223-b', N'Retaliation by landlord against tenant', 1),
  ('NY', 'RPP-227', N'When tenant may surrender premises', 2),
  ('NY', 'RPP-235-b', N'Warranty of habitability', 3),
  ('NY', 'RPP-235-c', N'Failure to provide essential services', 4),
  ('NY', 'RPP-235-d', N'Landlord access', 5),
  ('NY', 'RPP-235-e', N'Security deposits', 6),
  ('NY', 'RPP-236', N'Unlawful removal of tenant', 7),
  ('NY', 'RPA-701', N'Summary proceeding to recover possession', 8),
  ('NY', 'RPA-702', N'Grounds for proceeding', 9),
  ('NY', 'RPA-711', N'When petition may be made', 10),
  ('NY', 'RPA-712', N'Notice to quit', 11),
  ('NY', 'RPA-713', N'When landlord may recover', 12),
  ('NY', 'RPA-731', N'Rent paid into court', 13),
  ('NY', 'RPA-749', N'Execution of warrant', 14),
  ('NY', 'RPA-751', N'Stay of execution', 15)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = CASE WHEN s.SectionCode LIKE 'RPP-%' THEN @BaseRPP ELSE @BaseRPA END + SUBSTRING(s.SectionCode, 6, 50) + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, CASE WHEN s.SectionCode LIKE 'RPP-%' THEN @BaseRPP ELSE @BaseRPA END + SUBSTRING(s.SectionCode, 6, 50) + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for NY (RPP, RPA - Landlord and tenant).';
GO
