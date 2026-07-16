-- Seeds lease_shield.StateLawSections for Alaska (AS 34.03 - Uniform Residential Landlord and Tenant Act).
-- Source: https://touchngo.com/lglcntr/akstats/Statutes/Title34/Chapter03.htm
-- URL pattern: https://touchngo.com/lglcntr/akstats/Statutes/Title34/Chapter03/Section{NNN}.htm (e.g. Section010, Section330)
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://touchngo.com/lglcntr/akstats/Statutes/Title34/Chapter03/Section';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('AK', '34.03.010', N'Purpose and construction', 1),
  ('AK', '34.03.020', N'Terms and conditions of rental agreement', 2),
  ('AK', '34.03.030', N'Effect of unsigned or undelivered rental agreement', 3),
  ('AK', '34.03.040', N'Prohibited provisions in rental agreements', 4),
  ('AK', '34.03.050', N'Separation of rents and obligations to maintain property forbidden', 5),
  ('AK', '34.03.060', N'Sublease and assignment', 6),
  ('AK', '34.03.070', N'Security deposits and prepaid rent', 7),
  ('AK', '34.03.080', N'Disclosure', 8),
  ('AK', '34.03.090', N'Landlord to supply possession of the dwelling unit', 9),
  ('AK', '34.03.100', N'Landlord to maintain fit premises', 10),
  ('AK', '34.03.110', N'Limitation of liability', 11),
  ('AK', '34.03.120', N'Tenant obligations', 12),
  ('AK', '34.03.130', N'Rules and regulations', 13),
  ('AK', '34.03.140', N'Access', 14),
  ('AK', '34.03.150', N'Tenant to use and occupy', 15),
  ('AK', '34.03.160', N'Noncompliance by the landlord; general', 16),
  ('AK', '34.03.170', N'Failure to deliver possession', 17),
  ('AK', '34.03.180', N'Wrongful failure to supply heat, water, hot water or essential services', 18),
  ('AK', '34.03.190', N'Tenant remedies; rent deduction', 19),
  ('AK', '34.03.200', N'Noncompliance with rental agreement; failure to pay rent', 20),
  ('AK', '34.03.210', N'Removal of abandoned or surrendered property', 21),
  ('AK', '34.03.220', N'Landlord remedies; notice to tenant', 22),
  ('AK', '34.03.230', N'Remedy after termination', 23),
  ('AK', '34.03.240', N'Periodic tenancy; holdover', 24),
  ('AK', '34.03.250', N'Landlord and tenant remedies for abuse of access', 25),
  ('AK', '34.03.260', N'Landlord''s action for eviction, rent, damages', 26),
  ('AK', '34.03.270', N'Retaliatory conduct prohibited', 27),
  ('AK', '34.03.280', N'Retaliatory conduct; remedies and limitations', 28),
  ('AK', '34.03.290', N'Effective date; savings', 29),
  ('AK', '34.03.300', N'Severability', 30),
  ('AK', '34.03.310', N'Definitions', 31),
  ('AK', '34.03.320', N'Application', 32),
  ('AK', '34.03.330', N'Application and exclusions', 33),
  ('AK', '34.03.335', N'Exclusions', 34),
  ('AK', '34.03.340', N'Waiver of tenant rights; void', 35),
  ('AK', '34.03.350', N'Early termination; domestic violence', 36),
  ('AK', '34.03.360', N'Early termination; military service', 37),
  ('AK', '34.03.370', N'Repealer', 38),
  ('AK', '34.03.380', N'Short title', 39)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + SUBSTRING(s.SectionCode, 7, 10) + '.htm',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + SUBSTRING(s.SectionCode, 7, 10) + '.htm', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for AK (AS 34.03 - Uniform Residential Landlord and Tenant Act).';
GO
