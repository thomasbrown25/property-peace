-- Seeds lease_shield.StateLawSections for Hawaii (HRS Ch 521 - Residential Landlord-Tenant Code).
-- Source: https://law.justia.com/codes/hawaii/title-28/chapter-521/
-- URL pattern: https://law.justia.com/codes/hawaii/title-28/chapter-521/section-{521-XX}/
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/hawaii/title-28/chapter-521/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('HI', '521-1', N'Short title', 1),
  ('HI', '521-2', N'Purposes; rules of construction', 2),
  ('HI', '521-3', N'Supplementary general principles of law applicable', 3),
  ('HI', '521-4', N'Definitions', 4),
  ('HI', '521-5', N'Notice', 5),
  ('HI', '521-6', N'Obligation of good faith', 6),
  ('HI', '521-7', N'Exclusions from application of chapter', 7),
  ('HI', '521-8', N'Application of chapter', 8),
  ('HI', '521-9', N'Remedies to be liberally administered', 9),
  ('HI', '521-10', N'Waiver of rights', 10),
  ('HI', '521-11', N'Unconscionability', 11),
  ('HI', '521-21', N'Rent; payment; terms', 12),
  ('HI', '521-22', N'Rental agreement', 13),
  ('HI', '521-31', N'Prohibited provisions in rental agreements', 14),
  ('HI', '521-32', N'Separation of rents and obligations to pay property taxes and insurance', 15),
  ('HI', '521-33', N'Limitation of landlord and management liability', 16),
  ('HI', '521-34', N'Attorney''s fees', 17),
  ('HI', '521-35', N'Sublease and assignment', 18),
  ('HI', '521-36', N'Tenant''s use of premises for medical cannabis', 19),
  ('HI', '521-37', N'Tenant''s use of premises for adult use cannabis', 20),
  ('HI', '521-38', N'Discrimination against tenants receiving housing assistance', 21),
  ('HI', '521-39', N'Discrimination against tenants with pets', 22),
  ('HI', '521-41', N'Landlord to supply possession', 23),
  ('HI', '521-42', N'Landlord to maintain fit premises', 24),
  ('HI', '521-43', N'Disclosure', 25),
  ('HI', '521-44', N'Landlord to maintain common areas', 26),
  ('HI', '521-45', N'Limitation of landlord and management liability', 27),
  ('HI', '521-46', N'Security deposits', 28),
  ('HI', '521-51', N'Tenant to maintain dwelling unit', 29),
  ('HI', '521-52', N'Tenant to use properly', 30),
  ('HI', '521-61', N'Landlord''s access to dwelling unit', 31),
  ('HI', '521-62', N'Abandonment; personal property', 32),
  ('HI', '521-63', N'Tenant''s remedies; failure to supply essential services', 33),
  ('HI', '521-64', N'Tenant''s remedies; noncompliance by landlord', 34),
  ('HI', '521-65', N'Landlord''s remedies; noncompliance by tenant', 35),
  ('HI', '521-66', N'Retaliatory evictions and rent increases prohibited', 36),
  ('HI', '521-67', N'Early termination; victims of domestic violence', 37),
  ('HI', '521-68', N'Early termination; military personnel', 38),
  ('HI', '521-71', N'Termination of tenancy; landlord''s remedies for holdover tenants', 39),
  ('HI', '521-72', N'Termination of tenancy; notice', 40),
  ('HI', '521-73', N'Termination of tenancy; notice for cause', 41),
  ('HI', '521-74', N'Retaliatory evictions and rent increases prohibited', 42),
  ('HI', '521-75', N'Action for possession', 43),
  ('HI', '521-76', N'Rent into court', 44),
  ('HI', '521-77', N'Enforcement; penalties', 45)
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

PRINT 'lease_shield.StateLawSections seeded for HI (HRS 521 - Residential Landlord-Tenant Code).';
GO
