-- Seeds lease_shield.StateLawSections for New Mexico (NMSA Ch 47, Art 8 - Owner-Resident Relations, 47-8-1 et seq).
-- Source: https://law.justia.com/codes/new-mexico/chapter-47/article-8/
-- URL pattern: https://law.justia.com/codes/new-mexico/chapter-47/article-8/section-{47-8-XX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/new-mexico/chapter-47/article-8/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('NM', '47-8-1', N'Short title', 1),
  ('NM', '47-8-2', N'Definitions', 2),
  ('NM', '47-8-3', N'Application', 3),
  ('NM', '47-8-4', N'Exclusions', 4),
  ('NM', '47-8-5', N'Terms and conditions of rental agreement', 5),
  ('NM', '47-8-6', N'Prohibited provisions', 6),
  ('NM', '47-8-7', N'Security deposits', 7),
  ('NM', '47-8-8', N'Owner to supply possession', 8),
  ('NM', '47-8-9', N'Owner to maintain fit premises', 9),
  ('NM', '47-8-10', N'Resident to maintain dwelling unit', 10),
  ('NM', '47-8-11', N'Access', 11),
  ('NM', '47-8-12', N'Abandoned property', 12),
  ('NM', '47-8-13', N'Noncompliance by owner; resident remedies', 13),
  ('NM', '47-8-14', N'Failure to supply essential services', 14),
  ('NM', '47-8-15', N'Payment of rent', 15),
  ('NM', '47-8-16', N'Owner remedies; noncompliance by resident', 16),
  ('NM', '47-8-17', N'Termination of rental agreement', 17),
  ('NM', '47-8-18', N'Owner remedies; absence or abandonment', 18),
  ('NM', '47-8-19', N'Remedies; resident holding over', 19),
  ('NM', '47-8-20', N'Owner obligations', 20),
  ('NM', '47-8-21', N'Action for possession', 21),
  ('NM', '47-8-22', N'Resident obligations', 22),
  ('NM', '47-8-23', N'Retaliatory conduct prohibited', 23),
  ('NM', '47-8-24', N'Early termination; domestic violence', 24),
  ('NM', '47-8-25', N'Early termination; military', 25),
  ('NM', '47-8-26', N'Waiver void', 26),
  ('NM', '47-8-27', N'Attorney fees', 27)
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

PRINT 'lease_shield.StateLawSections seeded for NM (NMSA 47-8 - Owner-Resident Relations).';
GO
