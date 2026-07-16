-- Seeds lease_shield.StateLawSections for Minnesota (MS Ch 504B - Landlord and Tenant).
-- Source: https://law.justia.com/codes/minnesota/chapters-500-515b/chapter-504b/
-- URL pattern: https://law.justia.com/codes/minnesota/chapters-500-515b/chapter-504b/section-{504b-XXX}/ (dot to dash, lowercase).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/minnesota/chapters-500-515b/chapter-504b/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('MN', '504B.001', N'Short title', 1),
  ('MN', '504B.101', N'Definitions', 2),
  ('MN', '504B.161', N'Covenant of habitability', 3),
  ('MN', '504B.178', N'Security deposits', 4),
  ('MN', '504B.181', N'Landlord or agent disclosure', 5),
  ('MN', '504B.182', N'Initial and final inspections', 6),
  ('MN', '504B.185', N'Prohibited provisions in rental agreements', 7),
  ('MN', '504B.195', N'Access by landlord', 8),
  ('MN', '504B.205', N'Tenant remedies; failure to supply essential services', 9),
  ('MN', '504B.215', N'Tenant remedies; noncompliance by landlord', 10),
  ('MN', '504B.225', N'Landlord remedies; noncompliance by tenant', 11),
  ('MN', '504B.235', N'Abandoned property', 12),
  ('MN', '504B.245', N'Retaliatory conduct prohibited', 13),
  ('MN', '504B.255', N'Early termination; domestic violence', 14),
  ('MN', '504B.265', N'Early termination; military', 15),
  ('MN', '504B.285', N'Termination of tenancy', 16),
  ('MN', '504B.301', N'Unlawful detainer', 17),
  ('MN', '504B.321', N'Complaint and summons', 18),
  ('MN', '504B.341', N'Answer; trial', 19),
  ('MN', '504B.365', N'Rent paid into court', 20),
  ('MN', '504B.441', N'Residential tenant may not be penalized for complaint', 21)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + LOWER(REPLACE(s.SectionCode, '.', '-')) + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + LOWER(REPLACE(s.SectionCode, '.', '-')) + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for MN (MS Ch 504B - Landlord and Tenant).';
GO
