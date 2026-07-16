-- Seeds lease_shield.StateLawSections for Washington (RCW Ch 59.18 - Residential Landlord-Tenant Act).
-- Source: https://law.justia.com/codes/washington/title-59/chapter-59-18/
-- URL pattern: https://law.justia.com/codes/washington/title-59/chapter-59-18/section-{59-18-XXX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/washington/title-59/chapter-59-18/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('WA', '59.18.010', N'Short title', 1),
  ('WA', '59.18.020', N'Definitions', 2),
  ('WA', '59.18.030', N'Application', 3),
  ('WA', '59.18.040', N'Exclusions', 4),
  ('WA', '59.18.050', N'Terms and conditions of rental agreement', 5),
  ('WA', '59.18.060', N'Prohibited provisions', 6),
  ('WA', '59.18.070', N'Security deposits', 7),
  ('WA', '59.18.080', N'Landlord to supply possession', 8),
  ('WA', '59.18.090', N'Landlord to maintain fit premises', 9),
  ('WA', '59.18.100', N'Tenant to maintain dwelling unit', 10),
  ('WA', '59.18.110', N'Access', 11),
  ('WA', '59.18.120', N'Abandoned property', 12),
  ('WA', '59.18.130', N'Noncompliance by landlord; tenant remedies', 13),
  ('WA', '59.18.140', N'Failure to supply essential services', 14),
  ('WA', '59.18.150', N'Landlord remedies; noncompliance by tenant', 15),
  ('WA', '59.18.160', N'Termination of tenancy', 16),
  ('WA', '59.18.170', N'Landlord remedies; absence or abandonment', 17),
  ('WA', '59.18.180', N'Remedies; tenant holding over', 18),
  ('WA', '59.18.200', N'Action for possession', 19),
  ('WA', '59.18.210', N'Defenses to action for possession', 20),
  ('WA', '59.18.230', N'Rent paid into court', 21),
  ('WA', '59.18.240', N'Retaliatory conduct prohibited', 22),
  ('WA', '59.18.250', N'Early termination; domestic violence', 23),
  ('WA', '59.18.260', N'Early termination; military', 24),
  ('WA', '59.18.410', N'Forcible entry or detainer; writ of restitution', 25),
  ('WA', '59.18.900', N'Short title', 26)
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

PRINT 'lease_shield.StateLawSections seeded for WA (RCW 59.18 - Residential Landlord-Tenant Act).';
GO
