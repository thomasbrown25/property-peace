-- Seeds lease_shield.StateLawSections for Vermont (9 V.S.A. Ch 137 - Residential Rental Agreements).
-- Source: https://law.justia.com/codes/vermont/title-9/chapter-137/
-- URL pattern: https://law.justia.com/codes/vermont/title-9/chapter-137/section-{4451}/ (section numbers 4451 et seq).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/vermont/title-9/chapter-137/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('VT', '4451', N'Definitions', 1),
  ('VT', '4452', N'Application', 2),
  ('VT', '4453', N'Terms and conditions of rental agreement', 3),
  ('VT', '4454', N'Prohibited provisions', 4),
  ('VT', '4455', N'Security deposits', 5),
  ('VT', '4456', N'Landlord to supply possession', 6),
  ('VT', '4457', N'Landlord to maintain fit premises', 7),
  ('VT', '4458', N'Tenant to maintain dwelling unit', 8),
  ('VT', '4459', N'Access', 9),
  ('VT', '4460', N'Abandoned property', 10),
  ('VT', '4461', N'Noncompliance by landlord; tenant remedies', 11),
  ('VT', '4462', N'Failure to supply essential services', 12),
  ('VT', '4463', N'Landlord remedies; noncompliance by tenant', 13),
  ('VT', '4464', N'Termination of tenancy', 14),
  ('VT', '4465', N'Landlord remedies; absence or abandonment', 15),
  ('VT', '4466', N'Action for possession', 16),
  ('VT', '4467', N'Retaliatory conduct prohibited', 17),
  ('VT', '4468', N'Early termination; domestic violence', 18),
  ('VT', '4469', N'Early termination; military', 19)
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

PRINT 'lease_shield.StateLawSections seeded for VT (9 V.S.A. Ch 137 - Residential Rental Agreements).';
GO
