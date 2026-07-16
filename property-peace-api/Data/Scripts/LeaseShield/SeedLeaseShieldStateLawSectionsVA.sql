-- Seeds lease_shield.StateLawSections for Virginia (Va. Code Title 55.1, Ch 12 - Virginia Residential Landlord and Tenant Act).
-- Source: https://law.justia.com/codes/virginia/title-55-1/chapter-12/
-- URL pattern: https://law.justia.com/codes/virginia/title-55-1/chapter-12/section-{55-1-XXXX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/virginia/title-55-1/chapter-12/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('VA', '55.1-1200', N'Definitions', 1),
  ('VA', '55.1-1201', N'Application', 2),
  ('VA', '55.1-1202', N'Exclusions', 3),
  ('VA', '55.1-1203', N'Terms and conditions of rental agreement', 4),
  ('VA', '55.1-1204', N'Prohibited provisions', 5),
  ('VA', '55.1-1205', N'Security deposits', 6),
  ('VA', '55.1-1206', N'Landlord to supply possession', 7),
  ('VA', '55.1-1207', N'Landlord to maintain fit premises', 8),
  ('VA', '55.1-1208', N'Tenant to maintain dwelling unit', 9),
  ('VA', '55.1-1209', N'Access', 10),
  ('VA', '55.1-1210', N'Abandoned property', 11),
  ('VA', '55.1-1211', N'Noncompliance by landlord; tenant remedies', 12),
  ('VA', '55.1-1212', N'Failure to supply essential services', 13),
  ('VA', '55.1-1213', N'Landlord remedies; noncompliance by tenant', 14),
  ('VA', '55.1-1214', N'Termination of tenancy', 15),
  ('VA', '55.1-1215', N'Landlord remedies; absence or abandonment', 16),
  ('VA', '55.1-1216', N'Remedies; tenant holding over', 17),
  ('VA', '55.1-1217', N'Action for possession', 18),
  ('VA', '55.1-1218', N'Defenses to action for possession', 19),
  ('VA', '55.1-1219', N'Rent paid into court', 20),
  ('VA', '55.1-1220', N'Retaliatory conduct prohibited', 21),
  ('VA', '55.1-1221', N'Early termination; domestic violence', 22),
  ('VA', '55.1-1222', N'Early termination; military', 23)
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

PRINT 'lease_shield.StateLawSections seeded for VA (Title 55.1 Ch 12 - VRLTA).';
GO
