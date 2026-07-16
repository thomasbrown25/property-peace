-- Seeds lease_shield.StateLawSections for Massachusetts (M.G.L. c. 186 - Estates for years and at will).
-- Source: https://law.justia.com/codes/massachusetts/
-- URL pattern: https://law.justia.com/codes/massachusetts/.../section-{186-XX}/ (section number with dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/massachusetts/part-ii/title-i/chapter-186/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('MA', '186-15', N'Provisions pertaining to non-liability of landlord', 1),
  ('MA', '186-15B', N'Security deposits; entrance; payments; receipts; interest', 2),
  ('MA', '186-15C', N'Last month rent; interest', 3),
  ('MA', '186-16', N'Recovery of possession', 4),
  ('MA', '186-17', N'Notice to quit', 5),
  ('MA', '186-18', N'Action for use and occupation', 6),
  ('MA', '186-19', N'Summary process', 7),
  ('MA', '186-20', N'Stay of execution', 8),
  ('MA', '186-21', N'Rent paid into court', 9),
  ('MA', '186-22', N'Bond for appeal', 10)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + LOWER(s.SectionCode) + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + LOWER(s.SectionCode) + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for MA (M.G.L. c. 186 - Estates for years and at will).';
GO
