-- Seeds lease_shield.StateLawSections for Alabama (Title 35, Chapter 9A - Uniform Residential Landlord and Tenant Act).
-- Source: https://alison.legislature.state.al.us/code-of-alabama
-- URL pattern: https://alison.legislature.state.al.us/code-of-alabama?section={SectionCode}
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://alison.legislature.state.al.us/code-of-alabama?section=';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('AL', '35-9A-101', N'Short title', 1),
  ('AL', '35-9A-102', N'Purposes; rules of construction', 2),
  ('AL', '35-9A-103', N'Supplementary principles of law applicable', 3),
  ('AL', '35-9A-104', N'Construction against implicit repeal', 4),
  ('AL', '35-9A-105', N'Administration of remedies; enforcement', 5),
  ('AL', '35-9A-106', N'Settlement of disputed claim or right', 6),
  ('AL', '35-9A-107', N'Terms and conditions of rental agreement', 7),
  ('AL', '35-9A-121', N'Territorial application', 8),
  ('AL', '35-9A-122', N'Exclusions from chapter', 9),
  ('AL', '35-9A-141', N'Definitions', 10),
  ('AL', '35-9A-201', N'Security deposits; prepaid rent', 11),
  ('AL', '35-9A-202', N'Disclosure', 12),
  ('AL', '35-9A-203', N'Delivery of possession', 13),
  ('AL', '35-9A-204', N'Landlord to maintain premises', 14),
  ('AL', '35-9A-301', N'Tenant to maintain dwelling unit', 15),
  ('AL', '35-9A-302', N'Landlord rules and regulations', 16),
  ('AL', '35-9A-401', N'Noncompliance by landlord', 17),
  ('AL', '35-9A-402', N'Failure to deliver possession', 18),
  ('AL', '35-9A-403', N'Self-help for minor defects', 19),
  ('AL', '35-9A-404', N'Wrongful failure to supply heat, water, etc.', 20),
  ('AL', '35-9A-405', N'Tenant remedies; rent deduction', 21),
  ('AL', '35-9A-421', N'Noncompliance with rental agreement; failure to pay rent', 22),
  ('AL', '35-9A-422', N'Removal of abandoned or surrendered property', 23),
  ('AL', '35-9A-423', N'Landlord remedies; notice to tenant', 24),
  ('AL', '35-9A-424', N'Early termination by tenant; domestic violence', 25),
  ('AL', '35-9A-425', N'Early termination; military service', 26),
  ('AL', '35-9A-426', N'Remedy after termination', 27),
  ('AL', '35-9A-441', N'Periodic tenancy; holdover', 28),
  ('AL', '35-9A-442', N'Landlord and tenant remedies for abuse of access', 29),
  ('AL', '35-9A-461', N'Landlord''s action for eviction, rent, monetary damages, or other relief', 30),
  ('AL', '35-9A-501', N'Retaliatory conduct prohibited', 31),
  ('AL', '35-9A-502', N'Retaliatory conduct; remedies', 32),
  ('AL', '35-9A-503', N'Retaliatory conduct; evidence', 33),
  ('AL', '35-9A-504', N'Retaliatory conduct; limitations', 34),
  ('AL', '35-9A-505', N'Retaliatory conduct; waiver', 35),
  ('AL', '35-9A-506', N'Retaliatory conduct; attorney fees', 36),
  ('AL', '35-9A-521', N'Effective date', 37),
  ('AL', '35-9A-522', N'Savings clause', 38),
  ('AL', '35-9A-541', N'Severability', 39),
  ('AL', '35-9A-561', N'Repealer', 40)
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

PRINT 'lease_shield.StateLawSections seeded for AL (Title 35, Chapter 9A - Uniform Residential Landlord and Tenant Act).';
GO
