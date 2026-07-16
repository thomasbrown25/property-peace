-- Seeds lease_shield.StateLawSections for Iowa (Ch 562A - Uniform Residential Landlord and Tenant Law).
-- Source: https://law.justia.com/codes/iowa/title-xiv/chapter-562a/
-- URL pattern: https://law.justia.com/codes/iowa/title-xiv/chapter-562a/section-{562a-XX}/ (dot to dash, lowercase).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/iowa/title-xiv/chapter-562a/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('IA', '562A.1', N'Short title', 1),
  ('IA', '562A.2', N'Purposes; rules of construction', 2),
  ('IA', '562A.3', N'Definitions', 3),
  ('IA', '562A.4', N'Notice', 4),
  ('IA', '562A.5', N'Obligation of good faith', 5),
  ('IA', '562A.6', N'Unconscionability', 6),
  ('IA', '562A.7', N'Application of chapter', 7),
  ('IA', '562A.8', N'Exclusions', 8),
  ('IA', '562A.9', N'Terms and conditions of rental agreement', 9),
  ('IA', '562A.10', N'Prohibited provisions in rental agreements', 10),
  ('IA', '562A.11', N'Separation of rents and obligations', 11),
  ('IA', '562A.12', N'Rental deposits', 12),
  ('IA', '562A.13', N'Attorney fees', 13),
  ('IA', '562A.14', N'Landlord to supply possession', 14),
  ('IA', '562A.15', N'Landlord to maintain fit premises', 15),
  ('IA', '562A.16', N'Limitation of liability', 16),
  ('IA', '562A.17', N'Tenant to maintain dwelling unit', 17),
  ('IA', '562A.18', N'Rules and regulations', 18),
  ('IA', '562A.19', N'Access', 19),
  ('IA', '562A.20', N'Tenant to use and occupy', 20),
  ('IA', '562A.21', N'Abandoned property', 21),
  ('IA', '562A.22', N'Noncompliance by landlord; tenant remedies', 22),
  ('IA', '562A.23', N'Failure to supply essential services', 23),
  ('IA', '562A.24', N'Landlord remedies; noncompliance by tenant', 24),
  ('IA', '562A.25', N'Termination of tenancy', 25),
  ('IA', '562A.26', N'Landlord remedies; absence or abandonment', 26),
  ('IA', '562A.27', N'Noncompliance; failure to pay rent', 27),
  ('IA', '562A.28', N'Remedies; tenant holding over', 28),
  ('IA', '562A.29', N'Action for possession', 29),
  ('IA', '562A.30', N'Defenses to action for possession', 30),
  ('IA', '562A.31', N'Rent paid into court', 31),
  ('IA', '562A.32', N'Distribution of funds', 32),
  ('IA', '562A.33', N'Casualty damage', 33),
  ('IA', '562A.34', N'Early termination; domestic violence', 34),
  ('IA', '562A.35', N'Early termination; military', 35),
  ('IA', '562A.36', N'Retaliatory conduct prohibited', 36)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + LOWER(REPLACE(s.SectionCode, '.', '-')) + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + LOWER(REPLACE(s.SectionCode, '.', '-')) + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for IA (Ch 562A - Uniform Residential Landlord and Tenant Law).';
GO
