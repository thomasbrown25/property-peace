-- Seeds lease_shield.StateLawSections for Ohio (ORC Ch 5321 - Landlords and Tenants).
-- Source: https://law.justia.com/codes/ohio/title-53/chapter-5321/
-- URL pattern: https://law.justia.com/codes/ohio/title-53/chapter-5321/section-{5321-XX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/ohio/title-53/chapter-5321/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('OH', '5321.01', N'Definitions', 1),
  ('OH', '5321.02', N'Rental agreement; prohibited provisions', 2),
  ('OH', '5321.03', N'Security deposit', 3),
  ('OH', '5321.04', N'Landlord obligations', 4),
  ('OH', '5321.05', N'Tenant obligations', 5),
  ('OH', '5321.06', N'Access', 6),
  ('OH', '5321.07', N'Landlord remedies; noncompliance by tenant', 7),
  ('OH', '5321.08', N'Termination of periodic tenancy', 8),
  ('OH', '5321.09', N'Abandoned property', 9),
  ('OH', '5321.10', N'Tenant remedies; noncompliance by landlord', 10),
  ('OH', '5321.11', N'Failure to supply essential services', 11),
  ('OH', '5321.12', N'Retaliatory conduct prohibited', 12),
  ('OH', '5321.13', N'Landlord to maintain fit premises', 13),
  ('OH', '5321.14', N'Action for possession', 14),
  ('OH', '5321.15', N'Rent paid into court', 15),
  ('OH', '5321.16', N'Disposition of funds', 16),
  ('OH', '5321.17', N'Early termination; domestic violence', 17),
  ('OH', '5321.18', N'Early termination; military', 18),
  ('OH', '5321.19', N'Effect on municipal ordinances', 19)
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

PRINT 'lease_shield.StateLawSections seeded for OH (ORC 5321 - Landlords and Tenants).';
GO
