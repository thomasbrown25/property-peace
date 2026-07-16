-- Seeds lease_shield.StateLawSections for Indiana (IC Title 32, Article 31 - Landlord-Tenant Relations).
-- Source: https://law.justia.com/codes/indiana/title-32/article-31/
-- URL pattern: https://law.justia.com/codes/indiana/title-32/article-31/chapter-{1|3|5|7|...}/section-{32-31-X-X}/
-- Chapters: 1 General Provisions, 3 Security Deposits, 5 Rental Agreement Provisions, 7 Enforcement, etc.
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/indiana/title-32/article-31/chapter-';

-- Chapter is third segment of SectionCode (e.g. 32-31-1-6 -> 1)
MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('IN', '32-31-1-1', N'Application of chapter', 1),
  ('IN', '32-31-1-2', N'Month-to-month tenancy', 2),
  ('IN', '32-31-1-3', N'Year-to-year tenancy', 3),
  ('IN', '32-31-1-4', N'Tenancy at will', 4),
  ('IN', '32-31-1-5', N'Notice to quit', 5),
  ('IN', '32-31-1-6', N'Rent; refusal or neglect to pay', 6),
  ('IN', '32-31-1-7', N'Notice to quit; form', 7),
  ('IN', '32-31-1-8', N'Service of notice', 8),
  ('IN', '32-31-1-9', N'Conveyance of property; attornment', 9),
  ('IN', '32-31-1-10', N'Subleasing', 10),
  ('IN', '32-31-1-11', N'Remedies', 11),
  ('IN', '32-31-1-12', N'Disclosure; flood hazard area', 12),
  ('IN', '32-31-1-13', N'Disclosure; military installation', 13),
  ('IN', '32-31-1-14', N'Local regulation of rental rates', 14),
  ('IN', '32-31-1-15', N'Law enforcement assistance; notice', 15),
  ('IN', '32-31-1-16', N'Early termination; military service', 16),
  ('IN', '32-31-1-17', N'Early termination; victims of domestic or sexual violence', 17),
  ('IN', '32-31-1-18', N'Prohibited practices', 18),
  ('IN', '32-31-1-19', N'Retaliatory conduct', 19),
  ('IN', '32-31-1-20', N'Landlord access', 20),
  ('IN', '32-31-1-21', N'Abandoned property', 21),
  ('IN', '32-31-1-22', N'Applicability', 22),
  ('IN', '32-31-3-1', N'Applicability', 23),
  ('IN', '32-31-3-1.1', N'Validity of certain rental agreements', 24),
  ('IN', '32-31-3-2', N'Cooperative housing association defined', 25),
  ('IN', '32-31-3-3', N'Landlord defined', 26),
  ('IN', '32-31-3-4', N'Rental unit defined', 27),
  ('IN', '32-31-3-5', N'Security deposit defined', 28),
  ('IN', '32-31-3-6', N'Use of security deposit', 29),
  ('IN', '32-31-3-7', N'Return of deposit; itemized list', 30),
  ('IN', '32-31-3-8', N'Liability for withheld deposit', 31),
  ('IN', '32-31-3-9', N'Notice of damage', 32),
  ('IN', '32-31-3-10', N'Sale of property', 33),
  ('IN', '32-31-3-11', N'Jurisdiction', 34),
  ('IN', '32-31-3-12', N'Waiver void', 35),
  ('IN', '32-31-3-13', N'Rent defined', 36),
  ('IN', '32-31-3-14', N'Rental agreement defined', 37),
  ('IN', '32-31-3-15', N'Tenant defined', 38),
  ('IN', '32-31-3-16', N'Owner defined', 39),
  ('IN', '32-31-3-17', N'Person defined', 40),
  ('IN', '32-31-3-18', N'Refund of deposit', 41),
  ('IN', '32-31-3-19', N'Applicability', 42),
  ('IN', '32-31-5-1', N'Applicability', 43),
  ('IN', '32-31-5-2', N'Waiver void', 44),
  ('IN', '32-31-5-3', N'Dwelling unit defined', 45),
  ('IN', '32-31-5-4', N'Landlord obligations', 46),
  ('IN', '32-31-5-5', N'Prohibited provisions in rental agreements', 47),
  ('IN', '32-31-5-6', N'Tenant remedies', 48),
  ('IN', '32-31-5-7', N'Attorney fees', 49)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + PARSENAME(REPLACE(s.SectionCode, '-', '.'), 2) + '/section-' + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + PARSENAME(REPLACE(s.SectionCode, '-', '.'), 2) + '/section-' + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for IN (IC 32-31 - Landlord-Tenant Relations).';
GO
