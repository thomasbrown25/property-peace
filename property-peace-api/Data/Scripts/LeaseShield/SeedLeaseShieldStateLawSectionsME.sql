-- Seeds lease_shield.StateLawSections for Maine (14 M.R.S. Ch 710 - Rental Property).
-- Source: https://law.justia.com/codes/maine/title-14/part-7/chapter-710/
-- URL pattern: https://law.justia.com/codes/maine/title-14/part-7/chapter-710/section-{6021-a}/ (section number; use lowercase for letter suffix).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/maine/title-14/part-7/chapter-710/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('ME', '6021', N'Implied warranty and covenant of habitability', 1),
  ('ME', '6021-A', N'Treatment of bedbug infestation', 2),
  ('ME', '6022', N'Remedies for breach of habitability', 3),
  ('ME', '6023', N'Rental agreements', 4),
  ('ME', '6024', N'Security deposits', 5),
  ('ME', '6025', N'Disclosure of landlord', 6),
  ('ME', '6026', N'Dangerous conditions; minor repairs', 7),
  ('ME', '6027', N'Retaliatory eviction', 8),
  ('ME', '6028', N'Abandoned property', 9),
  ('ME', '6029', N'Early termination; domestic violence', 10),
  ('ME', '6030', N'Early termination; military', 11),
  ('ME', '6031', N'Access by landlord', 12),
  ('ME', '6032', N'Termination of tenancy', 13),
  ('ME', '6033', N'Action for possession', 14),
  ('ME', '6034', N'Rent paid into court', 15)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + LOWER(REPLACE(s.SectionCode, ' ', '')) + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + LOWER(REPLACE(s.SectionCode, ' ', '')) + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for ME (14 M.R.S. Ch 710 - Rental Property).';
GO
