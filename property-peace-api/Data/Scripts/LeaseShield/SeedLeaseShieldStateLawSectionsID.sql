-- Seeds lease_shield.StateLawSections for Idaho (Title 6, Ch 3 - Forcible Entry and Unlawful Detainer).
-- Source: https://law.justia.com/codes/idaho/title-6/chapter-3/
-- URL pattern: https://law.justia.com/codes/idaho/title-6/chapter-3/section-{6-XXX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/idaho/title-6/chapter-3/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('ID', '6-301', N'Forcible entry defined', 1),
  ('ID', '6-302', N'Forcible detainer defined', 2),
  ('ID', '6-303', N'Unlawful detainer defined', 3),
  ('ID', '6-304', N'Complaint; contents', 4),
  ('ID', '6-305', N'Summons; service', 5),
  ('ID', '6-306', N'Answer; time to appear', 6),
  ('ID', '6-307', N'Default; judgment', 7),
  ('ID', '6-308', N'Trial; continuance', 8),
  ('ID', '6-309', N'Judgment for plaintiff', 9),
  ('ID', '6-310', N'Writ of restitution', 10),
  ('ID', '6-311', N'Stay of execution; bond', 11),
  ('ID', '6-312', N'Appeal', 12),
  ('ID', '6-313', N'Rent paid into court', 13),
  ('ID', '6-314', N'Jurisdiction', 14),
  ('ID', '6-315', N'Forcible entry or detainer; treble damages', 15),
  ('ID', '6-316', N'Unlawful detainer; damages', 16),
  ('ID', '6-317', N'Treble damages', 17),
  ('ID', '6-318', N'Abandoned personal property', 18),
  ('ID', '6-319', N'Notice of belief of abandonment', 19),
  ('ID', '6-320', N'Action for damages and specific performance by tenant', 20),
  ('ID', '6-321', N'Security deposits', 21)
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

PRINT 'lease_shield.StateLawSections seeded for ID (Title 6 Ch 3 - Forcible Entry and Unlawful Detainer).';
GO
