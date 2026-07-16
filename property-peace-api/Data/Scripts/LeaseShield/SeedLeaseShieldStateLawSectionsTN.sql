-- Seeds lease_shield.StateLawSections for Tennessee (Tenn. Code Ch 28, Title 66 - Uniform Residential Landlord and Tenant Act).
-- Source: https://law.justia.com/codes/tennessee/title-66/chapter-28/
-- URL pattern: https://law.justia.com/codes/tennessee/title-66/chapter-28/part-{1|2|3|4|5}/section-{66-28-XXX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/tennessee/title-66/chapter-28/';

-- Part from section: 101-108->part-1, 201-208->part-2, 301-308->part-3, 401-408->part-4, 501-523->part-5
MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('TN', '66-28-101', N'Short title', 1),
  ('TN', '66-28-102', N'Application; preemption', 2),
  ('TN', '66-28-103', N'Definitions', 3),
  ('TN', '66-28-104', N'Terms and conditions of rental agreement', 4),
  ('TN', '66-28-105', N'Prohibited provisions', 5),
  ('TN', '66-28-106', N'Security deposits', 6),
  ('TN', '66-28-107', N'Landlord to supply possession', 7),
  ('TN', '66-28-108', N'Landlord to maintain fit premises', 8),
  ('TN', '66-28-201', N'Tenant to maintain dwelling unit', 9),
  ('TN', '66-28-202', N'Access', 10),
  ('TN', '66-28-301', N'Noncompliance by landlord; tenant remedies', 11),
  ('TN', '66-28-302', N'Failure to supply essential services', 12),
  ('TN', '66-28-303', N'Landlord remedies; noncompliance by tenant', 13),
  ('TN', '66-28-304', N'Termination of tenancy', 14),
  ('TN', '66-28-305', N'Landlord remedies; absence or abandonment', 15),
  ('TN', '66-28-401', N'Remedies; tenant holding over', 16),
  ('TN', '66-28-402', N'Action for possession', 17),
  ('TN', '66-28-403', N'Defenses to action for possession', 18),
  ('TN', '66-28-501', N'Retaliatory conduct prohibited', 19),
  ('TN', '66-28-502', N'Early termination; domestic violence', 20),
  ('TN', '66-28-503', N'Early termination; military', 21),
  ('TN', '66-28-504', N'Abandoned property', 22),
  ('TN', '66-28-505', N'Rent paid into court', 23)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + CASE
      WHEN CAST(SUBSTRING(s.SectionCode, 9, 3) AS INT) BETWEEN 101 AND 108 THEN 'part-1'
      WHEN CAST(SUBSTRING(s.SectionCode, 9, 3) AS INT) BETWEEN 201 AND 208 THEN 'part-2'
      WHEN CAST(SUBSTRING(s.SectionCode, 9, 3) AS INT) BETWEEN 301 AND 308 THEN 'part-3'
      WHEN CAST(SUBSTRING(s.SectionCode, 9, 3) AS INT) BETWEEN 401 AND 408 THEN 'part-4'
      ELSE 'part-5'
    END + '/section-' + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + CASE
      WHEN CAST(SUBSTRING(s.SectionCode, 9, 3) AS INT) BETWEEN 101 AND 108 THEN 'part-1'
      WHEN CAST(SUBSTRING(s.SectionCode, 9, 3) AS INT) BETWEEN 201 AND 208 THEN 'part-2'
      WHEN CAST(SUBSTRING(s.SectionCode, 9, 3) AS INT) BETWEEN 301 AND 308 THEN 'part-3'
      WHEN CAST(SUBSTRING(s.SectionCode, 9, 3) AS INT) BETWEEN 401 AND 408 THEN 'part-4'
      ELSE 'part-5'
    END + '/section-' + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for TN (Tenn. Code 66-28 - URLTA).';
GO
