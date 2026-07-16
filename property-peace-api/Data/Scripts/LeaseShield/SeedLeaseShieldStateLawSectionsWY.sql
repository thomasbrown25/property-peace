-- Seeds lease_shield.StateLawSections for Wyoming (Wyo. Stat. 1-21-12XX Residential Rental Property; 34-2-128 et seq).
-- Source: https://law.justia.com/codes/wyoming/title-1/chapter-21/article-12/ and title-34/chapter-2/
-- URL pattern: 1-21-12XX: .../article-12/section-{1-21-1201}/ ; 34-2: .../chapter-2/section-{34-2-XXX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @Base1 NVARCHAR(512) = 'https://law.justia.com/codes/wyoming/title-1/chapter-21/article-12/section-';
DECLARE @Base34 NVARCHAR(512) = 'https://law.justia.com/codes/wyoming/title-34/chapter-2/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('WY', '1-21-1201', N'Definitions', 1),
  ('WY', '1-21-1202', N'Application', 2),
  ('WY', '1-21-1203', N'Security deposits', 3),
  ('WY', '1-21-1204', N'Landlord to maintain', 4),
  ('WY', '1-21-1205', N'Tenant obligations', 5),
  ('WY', '1-21-1206', N'Access', 6),
  ('WY', '1-21-1207', N'Abandoned property', 7),
  ('WY', '1-21-1208', N'Termination of tenancy', 8),
  ('WY', '1-21-1209', N'Action for possession', 9),
  ('WY', '1-21-1210', N'Retaliatory conduct prohibited', 10),
  ('WY', '1-21-1211', N'Early termination; domestic violence', 11),
  ('WY', '1-21-1212', N'Early termination; military', 12),
  ('WY', '34-2-128', N'No implied tenancy except by sufferance', 13),
  ('WY', '34-2-129', N'Tenancy at sufferance', 14)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = CASE WHEN s.SectionCode LIKE '1-21-%' THEN @Base1 ELSE @Base34 END + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, CASE WHEN s.SectionCode LIKE '1-21-%' THEN @Base1 ELSE @Base34 END + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for WY (1-21-12XX, 34-2 - Residential Rental Property).';
GO
