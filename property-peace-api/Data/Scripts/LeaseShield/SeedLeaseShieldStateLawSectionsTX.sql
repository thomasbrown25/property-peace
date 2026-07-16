-- Seeds lease_shield.StateLawSections for Texas (Tex. Prop. Code Ch 92 - Residential Tenancies).
-- Source: https://law.justia.com/codes/texas/property-code/title-8/chapter-92/
-- URL pattern: https://law.justia.com/codes/texas/property-code/title-8/chapter-92/section-{92-XXX}/ (dot to dash).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/texas/property-code/title-8/chapter-92/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('TX', '92.001', N'Definitions', 1),
  ('TX', '92.002', N'Application', 2),
  ('TX', '92.003', N'Landlord to furnish dwelling', 3),
  ('TX', '92.004', N'Landlord to repair', 4),
  ('TX', '92.005', N'Notice to landlord', 5),
  ('TX', '92.006', N'Landlord liability and tenant remedies', 6),
  ('TX', '92.0061', N'Landlord duty; security', 7),
  ('TX', '92.008', N'Landlord remedies', 8),
  ('TX', '92.009', N'Tenant remedies', 9),
  ('TX', '92.010', N'Abandoned property', 10),
  ('TX', '92.011', N'Landlord to disclose', 11),
  ('TX', '92.012', N'Retaliatory eviction', 12),
  ('TX', '92.013', N'Early termination; military', 13),
  ('TX', '92.014', N'Early termination; domestic violence', 14),
  ('TX', '92.031', N'Security deposit', 15),
  ('TX', '92.032', N'Return of deposit', 16),
  ('TX', '92.033', N'Retention of deposit', 17),
  ('TX', '92.051', N'Landlord access', 18),
  ('TX', '92.052', N'Removal of property', 19),
  ('TX', '92.053', N'Removal of exclusionary device', 20),
  ('TX', '92.056', N'Landlord liability and tenant remedies; notice and repair', 21)
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

PRINT 'lease_shield.StateLawSections seeded for TX (Prop. Code Ch 92 - Residential Tenancies).';
GO
