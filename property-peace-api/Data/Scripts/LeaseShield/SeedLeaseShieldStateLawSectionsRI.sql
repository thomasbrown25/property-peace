-- Seeds lease_shield.StateLawSections for Rhode Island (R.I. Gen. L. Ch 34-18 - Residential Landlord and Tenant Act).
-- Source: https://law.justia.com/codes/rhode-island/title-34/chapter-34-18/
-- URL pattern: https://law.justia.com/codes/rhode-island/title-34/chapter-34-18/section-{34-18-XX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/rhode-island/title-34/chapter-34-18/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('RI', '34-18-1', N'Short title', 1),
  ('RI', '34-18-2', N'Definitions', 2),
  ('RI', '34-18-3', N'Application', 3),
  ('RI', '34-18-4', N'Exclusions', 4),
  ('RI', '34-18-5', N'Terms and conditions of rental agreement', 5),
  ('RI', '34-18-6', N'Prohibited provisions', 6),
  ('RI', '34-18-7', N'Security deposits', 7),
  ('RI', '34-18-8', N'Landlord to supply possession', 8),
  ('RI', '34-18-9', N'Landlord to maintain fit premises', 9),
  ('RI', '34-18-10', N'Tenant to maintain dwelling unit', 10),
  ('RI', '34-18-11', N'Access', 11),
  ('RI', '34-18-12', N'Abandoned property', 12),
  ('RI', '34-18-13', N'Noncompliance by landlord; tenant remedies', 13),
  ('RI', '34-18-14', N'Failure to supply essential services', 14),
  ('RI', '34-18-15', N'Landlord remedies; noncompliance by tenant', 15),
  ('RI', '34-18-16', N'Effect of unsigned or undelivered rental agreement', 16),
  ('RI', '34-18-17', N'Termination of tenancy', 17),
  ('RI', '34-18-18', N'Landlord remedies; absence or abandonment', 18),
  ('RI', '34-18-19', N'Remedies; tenant holding over', 19),
  ('RI', '34-18-20', N'Action for possession', 20),
  ('RI', '34-18-21', N'Defenses to action for possession', 21),
  ('RI', '34-18-22', N'Landlord to maintain premises', 22),
  ('RI', '34-18-23', N'Rent paid into court', 23),
  ('RI', '34-18-24', N'Retaliatory conduct prohibited', 24),
  ('RI', '34-18-25', N'Early termination; domestic violence', 25),
  ('RI', '34-18-26', N'Early termination; military', 26)
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

PRINT 'lease_shield.StateLawSections seeded for RI (Ch 34-18 - Residential Landlord and Tenant Act).';
GO
