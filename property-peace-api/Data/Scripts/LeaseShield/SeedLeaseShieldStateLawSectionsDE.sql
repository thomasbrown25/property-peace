-- Seeds lease_shield.StateLawSections for Delaware (Title 25 - Property, Ch 53 & 55).
-- Source: https://law.justia.com/codes/delaware/title-25/
-- URL pattern: https://law.justia.com/codes/delaware/title-25/chapter-{53|55}/section-{SectionCode}/
-- Chapter 53: Landlord Obligations and Tenant Remedies. Chapter 55: Tenant Obligations and Landlord Remedies.
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/delaware/title-25/chapter-';

-- Chapter from section: 53xx -> 53, 55xx -> 55
MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('DE', '5301', N'Landlord obligation; rental agreement', 1),
  ('DE', '5302', N'Tenant remedy; termination at the beginning of term', 2),
  ('DE', '5303', N'Landlord obligation; disclosure', 3),
  ('DE', '5304', N'Landlord obligation; delivery of possession', 4),
  ('DE', '5305', N'Landlord obligations relating to the rental unit', 5),
  ('DE', '5306', N'Landlord obligation; maintenance of common areas', 6),
  ('DE', '5307', N'Landlord obligation; lead-based paint', 7),
  ('DE', '5308', N'Essential services; landlord obligation and tenant remedies', 8),
  ('DE', '5309', N'Tenant remedy; failure to supply essential services', 9),
  ('DE', '5310', N'Tenant remedy; noncompliance by landlord', 10),
  ('DE', '5311', N'Landlord obligation; access', 11),
  ('DE', '5312', N'Abandoned property', 12),
  ('DE', '5313', N'Landlord obligation; retaliatory conduct prohibited', 13),
  ('DE', '5314', N'Early termination; domestic violence, sexual offenses, stalking', 14),
  ('DE', '5315', N'Early termination; military service', 15),
  ('DE', '5316', N'Protection for victims of domestic abuse, sexual offenses and/or stalking', 16),
  ('DE', '5317', N'Landlord obligation; bed bugs', 17),
  ('DE', '5501', N'Tenant obligations; rent', 18),
  ('DE', '5502', N'Landlord remedies for failure to pay rent', 19),
  ('DE', '5503', N'Tenant obligations relating to rental unit; waste', 20),
  ('DE', '5504', N'Tenant obligation; defective conditions', 21),
  ('DE', '5505', N'Tenant obligation relating to defective conditions', 22),
  ('DE', '5506', N'Tenant obligation; notice of extended absence', 23),
  ('DE', '5507', N'Landlord remedies for absence or abandonment', 24),
  ('DE', '5508', N'Landlord remedies; restrictions on subleasing and assignments', 25),
  ('DE', '5509', N'Tenant obligation to permit reasonable access', 26),
  ('DE', '5510', N'Landlord remedy for unreasonable refusal to allow access', 27),
  ('DE', '5511', N'Landlord remedies; noncompliance by tenant', 28),
  ('DE', '5512', N'Landlord remedy; unlawful detainer', 29),
  ('DE', '5513', N'Action for use and occupancy', 30),
  ('DE', '5514', N'Security deposit', 31),
  ('DE', '5515', N'Landlord''s remedies relating to holdover tenants', 32),
  ('DE', '5516', N'Retaliatory acts prohibited', 33),
  ('DE', '5517', N'Tenant obligation; bed bugs', 34),
  ('DE', '5518', N'Application fees', 35)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + CASE WHEN s.SectionCode LIKE '53%' THEN '53' WHEN s.SectionCode LIKE '55%' THEN '55' END + '/section-' + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + CASE WHEN s.SectionCode LIKE '53%' THEN '53' WHEN s.SectionCode LIKE '55%' THEN '55' END + '/section-' + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for DE (Title 25, Ch 53 & 55 - Landlord and Tenant).';
GO
