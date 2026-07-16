-- Seeds lease_shield.StateLawSections for Arizona (ARS Title 33, Chapter 10 - Arizona Residential Landlord and Tenant Act).
-- Source: https://www.azleg.gov/arsDetail/?title=33
-- URL pattern: https://www.azleg.gov/ars/33/0{section}.htm (e.g. 01301.htm, 01314-01.htm for 33-1314.01)
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://www.azleg.gov/ars/33/';

-- Build SourceUrl: 33-1301 -> 01301.htm, 33-1314.01 -> 01314-01.htm
MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('AZ', '33-1301', N'Short title', 1),
  ('AZ', '33-1302', N'Purposes; rules of construction', 2),
  ('AZ', '33-1303', N'Supplementary principles of law', 3),
  ('AZ', '33-1304', N'Construction against implicit repeal', 4),
  ('AZ', '33-1305', N'Administration of remedies; enforcement; notice and pleading', 5),
  ('AZ', '33-1310', N'General definitions', 6),
  ('AZ', '33-1311', N'Territorial application', 7),
  ('AZ', '33-1312', N'Exclusions', 8),
  ('AZ', '33-1313', N'Notice', 9),
  ('AZ', '33-1314', N'Terms and conditions of rental agreement; contact information; property; pets', 10),
  ('AZ', '33-1314.01', N'Utility charges; submetering; ratio utility billing', 11),
  ('AZ', '33-1321', N'Security deposits', 12),
  ('AZ', '33-1322', N'Disclosure and tender of written rental agreement', 13),
  ('AZ', '33-1323', N'Landlord to supply possession; fit premises', 14),
  ('AZ', '33-1324', N'Landlord to maintain fit premises', 15),
  ('AZ', '33-1325', N'Limitation of liability', 16),
  ('AZ', '33-1341', N'Tenant to maintain dwelling unit', 17),
  ('AZ', '33-1342', N'Rules and regulations', 18),
  ('AZ', '33-1343', N'Landlord access', 19),
  ('AZ', '33-1344', N'Tenant to use and occupy', 20),
  ('AZ', '33-1361', N'Noncompliance by the landlord', 21),
  ('AZ', '33-1362', N'Failure to deliver possession', 22),
  ('AZ', '33-1363', N'Wrongful failure to supply heat, water, essential services', 23),
  ('AZ', '33-1364', N'Tenant remedies; rent deduction', 24),
  ('AZ', '33-1365', N'Removal of abandoned or surrendered property', 25),
  ('AZ', '33-1366', N'Noncompliance with rental agreement; failure to pay rent', 26),
  ('AZ', '33-1367', N'Landlord remedies; notice to tenant', 27),
  ('AZ', '33-1368', N'Noncompliance by tenant; failure to pay rent; utility discontinuation', 28),
  ('AZ', '33-1369', N'Remedy after termination', 29),
  ('AZ', '33-1370', N'Periodic tenancy; holdover', 30),
  ('AZ', '33-1371', N'Landlord and tenant remedies for abuse of access', 31),
  ('AZ', '33-1372', N'Landlord''s action for eviction, rent, damages', 32),
  ('AZ', '33-1373', N'Retaliatory conduct prohibited', 33),
  ('AZ', '33-1374', N'Retaliatory conduct; remedies', 34),
  ('AZ', '33-1375', N'Retaliatory conduct; evidence', 35),
  ('AZ', '33-1376', N'Early termination; domestic violence', 36),
  ('AZ', '33-1377', N'Eviction; forcible entry and detainer', 37),
  ('AZ', '33-1378', N'Waiver of tenant rights; void', 38),
  ('AZ', '33-1379', N'Effective date; savings', 39),
  ('AZ', '33-1380', N'Severability', 40),
  ('AZ', '33-1381', N'Short title', 41)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + '0' + REPLACE(SUBSTRING(s.SectionCode, 5, 15), '.', '-') + '.htm',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + '0' + REPLACE(SUBSTRING(s.SectionCode, 5, 15), '.', '-') + '.htm', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for AZ (ARS Title 33, Chapter 10 - Arizona Residential Landlord and Tenant Act).';
GO
