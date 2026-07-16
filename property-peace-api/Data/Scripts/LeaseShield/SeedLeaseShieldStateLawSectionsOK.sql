-- Seeds lease_shield.StateLawSections for Oklahoma (Okla. Stat. Title 41 - Landlord and Tenant).
-- Source: https://law.justia.com/codes/oklahoma/title-41/
-- URL pattern: https://law.justia.com/codes/oklahoma/title-41/section-{41-XXX}/ (dot to dash for subsections).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/oklahoma/title-41/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('OK', '41-101', N'Short title', 1),
  ('OK', '41-102', N'Definitions', 2),
  ('OK', '41-103', N'Application', 3),
  ('OK', '41-104', N'Exclusions', 4),
  ('OK', '41-105', N'Terms and conditions of rental agreement', 5),
  ('OK', '41-106', N'Prohibited provisions', 6),
  ('OK', '41-107', N'Security deposits', 7),
  ('OK', '41-108', N'Landlord to supply possession', 8),
  ('OK', '41-109', N'Landlord to maintain fit premises', 9),
  ('OK', '41-110', N'Tenant to maintain dwelling unit', 10),
  ('OK', '41-111', N'Access', 11),
  ('OK', '41-112', N'Abandoned property', 12),
  ('OK', '41-113', N'Rental agreements', 13),
  ('OK', '41-113.2', N'Assistance animal; reasonable accommodation', 14),
  ('OK', '41-114', N'Noncompliance by landlord; tenant remedies', 15),
  ('OK', '41-115', N'Landlord remedies; noncompliance by tenant', 16),
  ('OK', '41-116', N'Termination of tenancy', 17),
  ('OK', '41-117', N'Landlord remedies; absence or abandonment', 18),
  ('OK', '41-118', N'Action for possession', 19),
  ('OK', '41-119', N'Retaliatory conduct prohibited', 20),
  ('OK', '41-120', N'Early termination; domestic violence', 21),
  ('OK', '41-121', N'Early termination; military', 22)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + REPLACE(s.SectionCode, '.', '-') + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + REPLACE(s.SectionCode, '.', '-') + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for OK (Title 41 - Landlord and Tenant).';
GO
