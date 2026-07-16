-- Seeds lease_shield.StateLawSections for Michigan (MCL Ch 554 - Act 348 Landlord and Tenant Relationships; Act 454 Truth in Renting).
-- Source: https://law.justia.com/codes/michigan/chapter-554/
-- URL pattern: https://law.justia.com/codes/michigan/chapter-554/statute-act-348-of-1972/section-{554-XXX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/michigan/chapter-554/statute-act-348-of-1972/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('MI', '554.601', N'Definitions', 1),
  ('MI', '554.601b', N'Early termination; domestic violence', 2),
  ('MI', '554.601c', N'Source of income; discrimination prohibited', 3),
  ('MI', '554.602', N'Rental agreement; prohibited provisions', 4),
  ('MI', '554.603', N'Security deposit; receipt', 5),
  ('MI', '554.604', N'Security deposit; disposition; bond', 6),
  ('MI', '554.605', N'Inventory checklist', 7),
  ('MI', '554.606', N'Termination of tenancy; notice', 8),
  ('MI', '554.607', N'Landlord to maintain premises', 9),
  ('MI', '554.608', N'Tenant obligations', 10),
  ('MI', '554.609', N'Access by landlord', 11),
  ('MI', '554.610', N'Abandoned property', 12),
  ('MI', '554.611', N'Action for possession', 13),
  ('MI', '554.612', N'Rent paid into court', 14),
  ('MI', '554.613', N'Retaliatory conduct prohibited', 15),
  ('MI', '554.614', N'Remedies', 16),
  ('MI', '554.615', N'Waiver of rights void', 17),
  ('MI', '554.616', N'Applicability', 18),
  ('MI', '554.634', N'Truth in Renting; disclosure; notice', 19)
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

PRINT 'lease_shield.StateLawSections seeded for MI (MCL 554 - Landlord and Tenant).';
GO
