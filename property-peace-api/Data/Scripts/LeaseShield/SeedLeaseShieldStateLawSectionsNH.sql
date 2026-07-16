-- Seeds lease_shield.StateLawSections for New Hampshire (RSA Ch 540-A - Prohibited Practices and Security Deposits; Ch 540 - Ejectment).
-- Source: https://law.justia.com/codes/new-hampshire/title-lv/chapter-540-a/
-- URL pattern: https://law.justia.com/codes/new-hampshire/title-lv/chapter-540-a/section-{540-a-X}/ (colon to dash, lowercase).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @Base540A NVARCHAR(512) = 'https://law.justia.com/codes/new-hampshire/title-lv/chapter-540-a/section-';
DECLARE @Base540  NVARCHAR(512) = 'https://law.justia.com/codes/new-hampshire/title-lv/chapter-540/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('NH', '540-A:1', N'Definitions', 1),
  ('NH', '540-A:2', N'General prohibition', 2),
  ('NH', '540-A:3', N'Security deposits', 3),
  ('NH', '540-A:3-a', N'Testing for lead in drinking water', 4),
  ('NH', '540-A:4', N'Prohibited practices', 5),
  ('NH', '540-A:5', N'Remedies', 6),
  ('NH', '540-A:6', N'Retaliatory conduct', 7),
  ('NH', '540-A:7', N'Landlord access', 8),
  ('NH', '540:1', N'Ejectment; action', 9),
  ('NH', '540:2', N'Notice to quit', 10),
  ('NH', '540:3', N'Service of notice', 11),
  ('NH', '540:4', N'Possession; summary proceeding', 12),
  ('NH', '540:5', N'Rent paid into court', 13),
  ('NH', '540:6', N'Execution', 14)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = CASE WHEN s.SectionCode LIKE '540-A%' THEN @Base540A ELSE @Base540 END + LOWER(REPLACE(s.SectionCode, ':', '-')) + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, CASE WHEN s.SectionCode LIKE '540-A%' THEN @Base540A ELSE @Base540 END + LOWER(REPLACE(s.SectionCode, ':', '-')) + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for NH (RSA 540-A, 540 - Prohibited practices; ejectment).';
GO
