-- Seeds lease_shield.StateLawSections for Louisiana (RS Title 9 - Civil Code Ancillaries, landlord-tenant 9:3251 et seq).
-- Source: https://law.justia.com/codes/louisiana/revised-statutes/title-9/
-- URL pattern: https://law.justia.com/codes/louisiana/revised-statutes/title-9/rs-{9-XXXX}/ (colon to dash in section).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/louisiana/revised-statutes/title-9/rs-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('LA', '9:3251', N'Short title; residential lease', 1),
  ('LA', '9:3252', N'Definitions', 2),
  ('LA', '9:3253', N'Application', 3),
  ('LA', '9:3254', N'Terms and conditions of rental agreement', 4),
  ('LA', '9:3255', N'Prohibited provisions', 5),
  ('LA', '9:3256', N'Security deposits', 6),
  ('LA', '9:3257', N'Landlord to supply possession', 7),
  ('LA', '9:3258', N'Lessor right to own, control, use property', 8),
  ('LA', '9:3259', N'Landlord to maintain fit premises', 9),
  ('LA', '9:3259.3', N'Privilege for unpaid rent; abandoned property', 10),
  ('LA', '9:3260', N'Tenant to maintain dwelling unit', 11),
  ('LA', '9:3261', N'Access', 12),
  ('LA', '9:3261.1', N'Early termination; domestic abuse victims', 13),
  ('LA', '9:3261.2', N'Early termination; sexual assault victims', 14),
  ('LA', '9:3262', N'Noncompliance by landlord; tenant remedies', 15),
  ('LA', '9:3263', N'Landlord remedies; noncompliance by tenant', 16),
  ('LA', '9:3264', N'Termination of tenancy', 17),
  ('LA', '9:3265', N'Landlord remedies; absence or abandonment', 18),
  ('LA', '9:3266', N'Action for possession', 19),
  ('LA', '9:3267', N'Retaliatory conduct prohibited', 20)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + REPLACE(s.SectionCode, ':', '-') + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + REPLACE(s.SectionCode, ':', '-') + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for LA (RS Title 9 - Residential landlord-tenant).';
GO
