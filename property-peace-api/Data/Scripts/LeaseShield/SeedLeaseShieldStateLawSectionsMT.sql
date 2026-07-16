-- Seeds lease_shield.StateLawSections for Montana (MCA Title 70, Ch 24 & 25 - Residential Landlord and Tenant).
-- Source: https://law.justia.com/codes/montana/title-70/chapter-24/ and chapter-25/
-- URL pattern: https://law.justia.com/codes/montana/title-70/chapter-{24|25}/section-{70-XX-XXX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/montana/title-70/chapter-';

-- Chapter 24 (70-24-101 et seq), Chapter 25 (70-25-101 et seq)
MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('MT', '70-24-101', N'Short title', 1),
  ('MT', '70-24-102', N'Definitions', 2),
  ('MT', '70-24-103', N'Application', 3),
  ('MT', '70-24-104', N'Terms and conditions of rental agreement', 4),
  ('MT', '70-24-105', N'Prohibited provisions', 5),
  ('MT', '70-24-106', N'Security deposits', 6),
  ('MT', '70-24-107', N'Landlord to supply possession', 7),
  ('MT', '70-24-108', N'Landlord to maintain fit premises', 8),
  ('MT', '70-24-109', N'Tenant to maintain dwelling unit', 9),
  ('MT', '70-24-110', N'Access', 10),
  ('MT', '70-24-111', N'Noncompliance by landlord; tenant remedies', 11),
  ('MT', '70-24-112', N'Landlord remedies; noncompliance by tenant', 12),
  ('MT', '70-24-113', N'Termination of tenancy', 13),
  ('MT', '70-24-114', N'Landlord remedies; absence or abandonment', 14),
  ('MT', '70-24-115', N'Action for possession', 15),
  ('MT', '70-24-116', N'Retaliatory conduct prohibited', 16),
  ('MT', '70-24-117', N'Early termination; domestic violence', 17),
  ('MT', '70-24-118', N'Early termination; military', 18),
  ('MT', '70-25-101', N'Unlawful detainer', 19),
  ('MT', '70-25-102', N'Complaint; summons', 20),
  ('MT', '70-25-103', N'Judgment; writ of possession', 21)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + SUBSTRING(s.SectionCode, 5, 2) + '/section-' + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + SUBSTRING(s.SectionCode, 5, 2) + '/section-' + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for MT (MCA 70-24, 70-25 - Residential Landlord and Tenant).';
GO
