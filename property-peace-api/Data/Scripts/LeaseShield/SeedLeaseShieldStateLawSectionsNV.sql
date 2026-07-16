-- Seeds lease_shield.StateLawSections for Nevada (NRS Ch 118A - Landlord and Tenant: Dwellings).
-- Source: https://law.justia.com/codes/nevada/chapter-118a/
-- URL pattern: https://law.justia.com/codes/nevada/chapter-118a/statute-{118a-XXX}/ (dot to dash, lowercase).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/nevada/chapter-118a/statute-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('NV', '118A.010', N'Definitions', 1),
  ('NV', '118A.020', N'Notice', 2),
  ('NV', '118A.030', N'Application', 3),
  ('NV', '118A.040', N'Exclusions', 4),
  ('NV', '118A.050', N'Good faith', 5),
  ('NV', '118A.100', N'Security deposit; limitations', 6),
  ('NV', '118A.110', N'Disclosure of landlord', 7),
  ('NV', '118A.120', N'Rental agreement; required provisions', 8),
  ('NV', '118A.130', N'Prohibited provisions', 9),
  ('NV', '118A.140', N'Delivery of possession', 10),
  ('NV', '118A.150', N'Landlord to maintain fit premises', 11),
  ('NV', '118A.200', N'Rental agreements; signing; copies', 12),
  ('NV', '118A.210', N'Tenant to maintain dwelling unit', 13),
  ('NV', '118A.220', N'Access by landlord', 14),
  ('NV', '118A.240', N'Noncompliance by landlord; tenant remedies', 15),
  ('NV', '118A.250', N'Failure to supply essential services', 16),
  ('NV', '118A.260', N'Landlord remedies; noncompliance by tenant', 17),
  ('NV', '118A.270', N'Termination of tenancy', 18),
  ('NV', '118A.280', N'Landlord remedies; absence or abandonment', 19),
  ('NV', '118A.290', N'Habitability; no fee for landlord repairs', 20),
  ('NV', '118A.300', N'Remedies; tenant holding over', 21),
  ('NV', '118A.310', N'Action for possession', 22),
  ('NV', '118A.320', N'Retaliatory conduct prohibited', 23),
  ('NV', '118A.330', N'Early termination; domestic violence', 24),
  ('NV', '118A.340', N'Early termination; military', 25),
  ('NV', '118A.350', N'Abandoned property', 26),
  ('NV', '118A.450', N'Abandonment; remedies; presumption', 27)
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

PRINT 'lease_shield.StateLawSections seeded for NV (NRS Ch 118A - Landlord and Tenant: Dwellings).';
GO
