-- Seeds lease_shield.StateLawSections for Wisconsin (Wis. Stat. Ch 704 - Landlord and Tenant).
-- Source: https://law.justia.com/codes/wisconsin/chapter-704/
-- URL pattern: https://law.justia.com/codes/wisconsin/chapter-704/section-{704-XX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/wisconsin/chapter-704/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('WI', '704.01', N'Definitions', 1),
  ('WI', '704.02', N'Creation of tenancy', 2),
  ('WI', '704.03', N'Termination of tenancy at will', 3),
  ('WI', '704.04', N'Termination of periodic tenancy', 4),
  ('WI', '704.05', N'Termination of tenancy for year', 5),
  ('WI', '704.07', N'Landlord to maintain', 6),
  ('WI', '704.08', N'Tenant to maintain', 7),
  ('WI', '704.09', N'Access', 8),
  ('WI', '704.10', N'Abandoned property', 9),
  ('WI', '704.11', N'Action for possession', 10),
  ('WI', '704.12', N'Rent paid into court', 11),
  ('WI', '704.17', N'Security deposits', 12),
  ('WI', '704.25', N'Retaliatory conduct prohibited', 13),
  ('WI', '704.28', N'Early termination; domestic violence', 14),
  ('WI', '704.29', N'Early termination; military', 15),
  ('WI', '704.44', N'Residential rental agreement; void provisions', 16)
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

PRINT 'lease_shield.StateLawSections seeded for WI (Ch 704 - Landlord and Tenant).';
GO
