-- Seeds lease_shield.StateLawSections for Colorado (C.R.S. Title 38, Article 12 - Tenants and Landlords).
-- Source: https://colorado.public.law/statutes/crs_title_38_article_12
-- URL pattern: https://colorado.public.law/statutes/crs_{SectionCode} (e.g. crs_38-12-101)
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://colorado.public.law/statutes/crs_';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('CO', '38-12-101', N'Legislative declaration (security deposits)', 1),
  ('CO', '38-12-102', N'Definitions (Part 1)', 2),
  ('CO', '38-12-103', N'Return of security deposit', 3),
  ('CO', '38-12-104', N'Security deposit; hazardous conditions; gas appliances', 4),
  ('CO', '38-12-105', N'Late fees charged to tenants and mobile home owners', 5),
  ('CO', '38-12-106', N'Pet security deposit', 6),
  ('CO', '38-12-301', N'Local control of rents prohibited', 7),
  ('CO', '38-12-302', N'Preemption', 8),
  ('CO', '38-12-401', N'Victims of unlawful sexual behavior, stalking, domestic violence; early termination', 9),
  ('CO', '38-12-402', N'Victims; change of locks', 10),
  ('CO', '38-12-501', N'Legislative declaration (habitableness)', 11),
  ('CO', '38-12-502', N'Definitions (Part 5)', 12),
  ('CO', '38-12-503', N'Warranty of habitability; notice; landlord obligations', 13),
  ('CO', '38-12-504', N'Tenant''s maintenance of premises', 14),
  ('CO', '38-12-505', N'Uninhabitable residential premises', 15),
  ('CO', '38-12-506', N'Remedies for breach of warranty of habitability', 16),
  ('CO', '38-12-507', N'Retaliatory conduct prohibited', 17),
  ('CO', '38-12-508', N'Unlawful removal of tenant', 18),
  ('CO', '38-12-509', N'Landlord access', 19),
  ('CO', '38-12-510', N'Tenant obligations', 20),
  ('CO', '38-12-511', N'Abandonment; personal property', 21),
  ('CO', '38-12-512', N'Eviction; forcible entry and detainer', 22),
  ('CO', '38-12-601', N'Electric vehicle charging systems', 23),
  ('CO', '38-12-701', N'Notice of rent increase', 24),
  ('CO', '38-12-702', N'Rent increase; limitations', 25),
  ('CO', '38-12-801', N'Written rental agreement', 26),
  ('CO', '38-12-802', N'Rental agreement; required disclosures', 27),
  ('CO', '38-12-803', N'Prohibited provisions in rental agreements', 28),
  ('CO', '38-12-901', N'Rental application fairness; definitions', 29),
  ('CO', '38-12-902', N'Rental application fees', 30),
  ('CO', '38-12-903', N'Denial of application; notice', 31),
  ('CO', '38-12-904', N'Discrimination prohibited', 32),
  ('CO', '38-12-905', N'Enforcement', 33),
  ('CO', '38-12-1001', N'Bed bugs; landlord duties', 34),
  ('CO', '38-12-1002', N'Bed bugs; tenant duties', 35),
  ('CO', '38-12-1003', N'Bed bugs; notice and treatment', 36),
  ('CO', '38-12-1004', N'Bed bugs; cost of treatment', 37),
  ('CO', '38-12-1005', N'Bed bugs; retaliation prohibited', 38),
  ('CO', '38-12-1006', N'Bed bugs; disclosure', 39),
  ('CO', '38-12-1007', N'Bed bugs; definitions', 40),
  ('CO', '38-12-1201', N'Immigrant tenant protection; definitions', 41),
  ('CO', '38-12-1202', N'Immigrant tenant protection; prohibited conduct', 42),
  ('CO', '38-12-1203', N'Immigrant tenant protection; remedies', 43),
  ('CO', '38-12-1204', N'Immigrant tenant protection; disclosure', 44),
  ('CO', '38-12-1205', N'Immigrant tenant protection; enforcement', 45),
  ('CO', '38-12-1301', N'For cause eviction; definitions', 46),
  ('CO', '38-12-1302', N'For cause eviction; required notice', 47),
  ('CO', '38-12-1303', N'For cause eviction; grounds', 48),
  ('CO', '38-12-1304', N'For cause eviction; cure', 49),
  ('CO', '38-12-1305', N'For cause eviction; retaliation', 50),
  ('CO', '38-12-1306', N'For cause eviction; waiver void', 51),
  ('CO', '38-12-1307', N'For cause eviction; enforcement', 52)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + s.SectionCode,
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + s.SectionCode, NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for CO (C.R.S. Title 38, Article 12 - Tenants and Landlords).';
GO
