-- Seeds lease_shield.StateLawSections for Arkansas (Title 18, Chapter 17 - Arkansas Residential Landlord-Tenant Act of 2007).
-- Source: https://law.justia.com/codes/arkansas/title-18/subtitle-2/chapter-17/
-- URL pattern: https://law.justia.com/codes/arkansas/title-18/subtitle-2/chapter-17/subchapter-{N}/section-18-17-{XXX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/arkansas/title-18/subtitle-2/chapter-17/';

-- Justia: subchapter digit = first digit of section number (101->1, 301->3, 901->9). SourceUrl = BaseUrl + 'subchapter-' + digit + '/section-18-17-XXX/'
MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('AR', '18-17-101', N'Title', 1),
  ('AR', '18-17-102', N'Purposes; rules of construction', 2),
  ('AR', '18-17-103', N'Supplementary principles of law', 3),
  ('AR', '18-17-104', N'Administration of remedies; enforcement', 4),
  ('AR', '18-17-201', N'Territorial application', 5),
  ('AR', '18-17-202', N'Exclusions', 6),
  ('AR', '18-17-301', N'General definitions', 7),
  ('AR', '18-17-302', N'Notice', 8),
  ('AR', '18-17-303', N'Settlement of disputed claim or right', 9),
  ('AR', '18-17-401', N'Terms and conditions of rental agreement', 10),
  ('AR', '18-17-402', N'Prohibited provisions in rental agreements', 11),
  ('AR', '18-17-403', N'Separation of rents and obligations forbidden', 12),
  ('AR', '18-17-404', N'Sublease and assignment', 13),
  ('AR', '18-17-501', N'Security deposits and prepaid rent', 14),
  ('AR', '18-17-502', N'Implied residential quality standards; landlord to maintain fit premises', 15),
  ('AR', '18-17-601', N'Tenant to maintain dwelling unit', 16),
  ('AR', '18-17-602', N'Rules and regulations; landlord access', 17),
  ('AR', '18-17-701', N'Noncompliance by landlord; tenant remedies', 18),
  ('AR', '18-17-702', N'Failure to deliver possession', 19),
  ('AR', '18-17-703', N'Wrongful failure to supply heat, water, essential services', 20),
  ('AR', '18-17-704', N'Noncompliance with rental agreement; failure to pay rent', 21),
  ('AR', '18-17-705', N'Landlord remedies; notice to tenant', 22),
  ('AR', '18-17-706', N'Removal of abandoned or surrendered property', 23),
  ('AR', '18-17-707', N'Remedy after termination', 24),
  ('AR', '18-17-708', N'Periodic tenancy; holdover', 25),
  ('AR', '18-17-709', N'Landlord and tenant remedies for abuse of access', 26),
  ('AR', '18-17-710', N'Retaliatory conduct prohibited', 27),
  ('AR', '18-17-901', N'Grounds for eviction of tenant', 28),
  ('AR', '18-17-902', N'Eviction proceeding', 29),
  ('AR', '18-17-903', N'Service of process; notice', 30),
  ('AR', '18-17-904', N'Judgment; writ of possession', 31),
  ('AR', '18-17-905', N'Appeal', 32),
  ('AR', '18-17-906', N'Rent paid into court', 33),
  ('AR', '18-17-907', N'Execution of writ', 34),
  ('AR', '18-17-908', N'Personal property; disposition', 35),
  ('AR', '18-17-909', N'Jurisdiction', 36),
  ('AR', '18-17-910', N'Venue', 37),
  ('AR', '18-17-911', N'Waiver of tenant rights; void', 38),
  ('AR', '18-17-912', N'Commercial leases', 39),
  ('AR', '18-17-913', N'Effective date; savings', 40)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + 'subchapter-' + SUBSTRING(s.SectionCode, 8, 1) + '/section-' + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + 'subchapter-' + SUBSTRING(s.SectionCode, 8, 1) + '/section-' + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for AR (Title 18, Chapter 17 - Arkansas Residential Landlord-Tenant Act of 2007).';
GO
