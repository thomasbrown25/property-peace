-- Seeds lease_shield.StateLawSections for New Jersey (N.J.S.A. Title 2A - Eviction/possession; Title 46 - Security deposits and landlord-tenant).
-- Source: https://law.justia.com/codes/new-jersey/title-2a/ and title-46/
-- URL pattern: https://law.justia.com/codes/new-jersey/title-{2a|46}/section-{section}/ (colon to dash, lowercase).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @Base2A NVARCHAR(512) = 'https://law.justia.com/codes/new-jersey/title-2a/section-';
DECLARE @Base46 NVARCHAR(512) = 'https://law.justia.com/codes/new-jersey/title-46/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('NJ', '2A:18-53', N'Removal of tenant; jurisdiction', 1),
  ('NJ', '2A:18-54', N'Service of notice', 2),
  ('NJ', '2A:18-55', N'Summary action', 3),
  ('NJ', '2A:18-56', N'Judgment; writ of possession', 4),
  ('NJ', '2A:18-57', N'Stay of execution', 5),
  ('NJ', '2A:18-58', N'Rent paid into court', 6),
  ('NJ', '2A:18-59', N'Appeal', 7),
  ('NJ', '2A:18-61', N'Grounds for removal', 8),
  ('NJ', '2A:18-61.1', N'Good cause required; certain tenants', 9),
  ('NJ', '2A:42-10.1', N'Writ of possession; stays', 10),
  ('NJ', '46:8-19', N'Security deposits; interest; return', 11),
  ('NJ', '46:8-19.1', N'Disclosure of deposit location', 12),
  ('NJ', '46:8-21', N'Wrongful withholding; damages', 13),
  ('NJ', '46:8-21.1', N'Landlord obligations; fit premises', 14),
  ('NJ', '46:8-26', N'Retaliatory eviction', 15),
  ('NJ', '46:8-27', N'Early termination; domestic violence', 16),
  ('NJ', '46:8-28', N'Early termination; military', 17)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = CASE WHEN s.SectionCode LIKE '2A:%' OR s.SectionCode LIKE '2a:%' THEN @Base2A ELSE @Base46 END + LOWER(REPLACE(REPLACE(s.SectionCode, ':', '-'), '.', '-')) + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, CASE WHEN s.SectionCode LIKE '2A:%' OR s.SectionCode LIKE '2a:%' THEN @Base2A ELSE @Base46 END + LOWER(REPLACE(REPLACE(s.SectionCode, ':', '-'), '.', '-')) + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for NJ (N.J.S.A. 2A, 46 - Landlord and tenant).';
GO
