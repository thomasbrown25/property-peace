-- Seeds lease_shield.StateLawSections for Missouri (RSMo Ch 535 - Landlord-Tenant Actions).
-- Source: https://law.justia.com/codes/missouri/title-xxxvi/chapter-535/
-- URL pattern: https://law.justia.com/codes/missouri/title-xxxvi/chapter-535/section-{535-XXX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/missouri/title-xxxvi/chapter-535/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('MO', '535.010', N'Recovery of possession when rent not paid', 1),
  ('MO', '535.020', N'Procedure to recover possession', 2),
  ('MO', '535.030', N'Summons; service', 3),
  ('MO', '535.040', N'Judgment', 4),
  ('MO', '535.050', N'Appeal', 5),
  ('MO', '535.060', N'Rent paid into court', 6),
  ('MO', '535.070', N'Execution', 7),
  ('MO', '535.080', N'Stay of execution', 8),
  ('MO', '535.090', N'Abandoned property', 9),
  ('MO', '535.100', N'Landlord obligations', 10),
  ('MO', '535.110', N'Tenant obligations', 11),
  ('MO', '535.120', N'Retaliatory conduct prohibited', 12),
  ('MO', '535.150', N'Early termination; domestic violence', 13),
  ('MO', '535.160', N'Early termination; military', 14),
  ('MO', '535.185', N'Disclosure of managing agent and owner', 15),
  ('MO', '535.200', N'Landlord-tenant court; St. Louis', 16),
  ('MO', '535.300', N'Security deposits', 17),
  ('MO', '535.350', N'Wrongful withholding; damages', 18)
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

PRINT 'lease_shield.StateLawSections seeded for MO (RSMo Ch 535 - Landlord-Tenant Actions).';
GO
