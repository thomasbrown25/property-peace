-- Seeds lease_shield.StateLawSections for West Virginia (W. Va. Code Ch 37, Art 6 - Landlord and Tenant).
-- Source: https://law.justia.com/codes/west-virginia/chapter-37/article-6/
-- URL pattern: https://law.justia.com/codes/west-virginia/chapter-37/article-6/section-{37-6-XX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/west-virginia/chapter-37/article-6/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('WV', '37-6-1', N'Rights of parties on transfer', 1),
  ('WV', '37-6-2', N'Rent; liability', 2),
  ('WV', '37-6-3', N'Notice to quit', 3),
  ('WV', '37-6-4', N'Termination of tenancy', 4),
  ('WV', '37-6-5', N'Distress for rent', 5),
  ('WV', '37-6-6', N'Abandoned property', 6),
  ('WV', '37-6-7', N'Action for possession', 7),
  ('WV', '37-6-8', N'Judgment; writ of possession', 8),
  ('WV', '37-6-9', N'Appeal', 9),
  ('WV', '37-6-10', N'Rent paid into court', 10),
  ('WV', '37-6-20', N'Security deposits', 11),
  ('WV', '37-6-21', N'Return of deposit', 12),
  ('WV', '37-6-22', N'Retaliatory conduct prohibited', 13),
  ('WV', '37-6-23', N'Early termination; domestic violence', 14),
  ('WV', '37-6-24', N'Early termination; military', 15),
  ('WV', '37-6-30', N'Landlord duties for residential property', 16)
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

PRINT 'lease_shield.StateLawSections seeded for WV (Ch 37 Art 6 - Landlord and Tenant).';
GO
