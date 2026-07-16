-- Seeds lease_shield.StateLawSections for Oregon (ORS Ch 90 - Residential Landlord and Tenant).
-- Source: https://law.justia.com/codes/oregon/title-90/
-- URL pattern: https://law.justia.com/codes/oregon/title-90/section-{90-XXX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/oregon/title-90/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('OR', '90.100', N'Short title', 1),
  ('OR', '90.105', N'Definitions', 2),
  ('OR', '90.110', N'Application', 3),
  ('OR', '90.120', N'Terms and conditions of rental agreement', 4),
  ('OR', '90.130', N'Prohibited provisions', 5),
  ('OR', '90.140', N'Security deposits', 6),
  ('OR', '90.150', N'Landlord to supply possession', 7),
  ('OR', '90.160', N'Landlord to maintain fit premises', 8),
  ('OR', '90.170', N'Tenant to maintain dwelling unit', 9),
  ('OR', '90.180', N'Access', 10),
  ('OR', '90.190', N'Abandoned property', 11),
  ('OR', '90.200', N'Noncompliance by landlord; tenant remedies', 12),
  ('OR', '90.210', N'Failure to supply essential services', 13),
  ('OR', '90.220', N'Landlord remedies; noncompliance by tenant', 14),
  ('OR', '90.260', N'Termination of tenancy', 15),
  ('OR', '90.270', N'Landlord remedies; absence or abandonment', 16),
  ('OR', '90.280', N'Remedies; tenant holding over', 17),
  ('OR', '90.300', N'Action for possession', 18),
  ('OR', '90.302', N'Defenses to action for possession', 19),
  ('OR', '90.365', N'Retaliatory conduct prohibited', 20),
  ('OR', '90.367', N'Early termination; domestic violence', 21),
  ('OR', '90.369', N'Early termination; military', 22),
  ('OR', '90.400', N'Rent paid into court', 23),
  ('OR', '90.450', N'Casualty damage', 24)
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

PRINT 'lease_shield.StateLawSections seeded for OR (ORS 90 - Residential Landlord and Tenant).';
GO
