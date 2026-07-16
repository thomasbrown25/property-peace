-- Seeds lease_shield.StateLawSections for South Carolina (S.C. Code Ch 40, Title 27 - Residential Landlord and Tenant Act).
-- Source: https://law.justia.com/codes/south-carolina/title-27/chapter-40/
-- URL pattern: https://law.justia.com/codes/south-carolina/title-27/chapter-40/section-{27-40-XXX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/south-carolina/title-27/chapter-40/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('SC', '27-40-10', N'Short title', 1),
  ('SC', '27-40-20', N'Definitions', 2),
  ('SC', '27-40-30', N'Application', 3),
  ('SC', '27-40-40', N'Exclusions', 4),
  ('SC', '27-40-110', N'Terms and conditions of rental agreement', 5),
  ('SC', '27-40-120', N'Prohibited provisions', 6),
  ('SC', '27-40-130', N'Security deposits', 7),
  ('SC', '27-40-210', N'Landlord to supply possession', 8),
  ('SC', '27-40-220', N'Landlord to maintain fit premises', 9),
  ('SC', '27-40-230', N'Limitation of liability', 10),
  ('SC', '27-40-310', N'Tenant to maintain dwelling unit', 11),
  ('SC', '27-40-320', N'Rules and regulations', 12),
  ('SC', '27-40-410', N'Access', 13),
  ('SC', '27-40-420', N'Abandoned property', 14),
  ('SC', '27-40-510', N'Tenant to maintain dwelling unit', 15),
  ('SC', '27-40-610', N'Noncompliance by landlord; tenant remedies', 16),
  ('SC', '27-40-620', N'Failure to supply essential services', 17),
  ('SC', '27-40-710', N'Noncompliance; failure to pay rent; removal of property', 18),
  ('SC', '27-40-720', N'Noncompliance affecting health and safety', 19),
  ('SC', '27-40-730', N'Termination of tenancy', 20),
  ('SC', '27-40-740', N'Landlord remedies; absence or abandonment', 21),
  ('SC', '27-40-750', N'Remedies; tenant holding over', 22),
  ('SC', '27-40-760', N'Action for possession', 23),
  ('SC', '27-40-770', N'Defenses to action for possession', 24),
  ('SC', '27-40-910', N'Retaliatory conduct prohibited', 25),
  ('SC', '27-40-920', N'Early termination; domestic violence', 26),
  ('SC', '27-40-930', N'Early termination; military', 27)
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

PRINT 'lease_shield.StateLawSections seeded for SC (Title 27 Ch 40 - Residential Landlord and Tenant Act).';
GO
