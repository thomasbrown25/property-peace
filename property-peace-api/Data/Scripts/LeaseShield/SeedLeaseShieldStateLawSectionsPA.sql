-- Seeds lease_shield.StateLawSections for Pennsylvania (68 P.S. 250 - Landlord and Tenant Act of 1951).
-- Source: https://law.justia.com/codes/pennsylvania/
-- URL pattern: https://law.justia.com/codes/pennsylvania/title-68/section-250-XXX/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/pennsylvania/title-68/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('PA', '250.101', N'Short title', 1),
  ('PA', '250.102', N'Definitions', 2),
  ('PA', '250.201', N'Lease; term', 3),
  ('PA', '250.202', N'Rent', 4),
  ('PA', '250.203', N'Security deposits', 5),
  ('PA', '250.204', N'Landlord to maintain', 6),
  ('PA', '250.205', N'Tenant to maintain', 7),
  ('PA', '250.206', N'Access', 8),
  ('PA', '250.301', N'Recovery of possession', 9),
  ('PA', '250.302', N'Notice to quit', 10),
  ('PA', '250.303', N'Summons; complaint', 11),
  ('PA', '250.401', N'Judgment; writ of possession', 12),
  ('PA', '250.402', N'Stay of execution', 13),
  ('PA', '250.403', N'Rent paid into court', 14),
  ('PA', '250.501', N'Ejectment', 15),
  ('PA', '250.511', N'Remedy by ejectment preserved', 16),
  ('PA', '250.511b', N'Retaliatory eviction', 17)
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

PRINT 'lease_shield.StateLawSections seeded for PA (68 P.S. 250 - Landlord and Tenant).';
GO
