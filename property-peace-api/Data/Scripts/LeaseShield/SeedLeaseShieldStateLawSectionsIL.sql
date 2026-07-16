-- Seeds lease_shield.StateLawSections for Illinois (765 ILCS 705 Landlord and Tenant Act, 735 Rental Property Utility Service, 740 Tenant Utility Payment Disclosure).
-- Source: https://law.justia.com/codes/illinois/chapter-765/
-- URL pattern: https://law.justia.com/codes/illinois/chapter-765/act-765-ilcs-{705|735|740}/section-{sectionNum}/
-- SectionCode format: {act}-{section} (e.g. 705-1, 735-2, 740-5).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/illinois/chapter-765/act-765-ilcs-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('IL', '705-0.01', N'Short title', 1),
  ('IL', '705-1', N'Liability exemptions; negligence', 2),
  ('IL', '705-3', N'Rent payments at business office', 3),
  ('IL', '705-3.5', N'Additional means to pay rent; electronic payment fees', 4),
  ('IL', '705-4', N'Payment by electronic funds transfer', 5),
  ('IL', '705-5', N'Landlord''s duty to mitigate damages', 6),
  ('IL', '705-10', N'Security deposits; interest', 7),
  ('IL', '705-15', N'Disclosure of owner and agent', 8),
  ('IL', '705-20', N'Early termination; victims of domestic or sexual violence', 9),
  ('IL', '705-25', N'Tenant screening reports; application fees', 10),
  ('IL', '735-1', N'Short title', 11),
  ('IL', '735-2', N'Definitions', 12),
  ('IL', '735-3', N'Tenant or utility petition for receiver', 13),
  ('IL', '735-4', N'Receiver; powers and duties', 14),
  ('IL', '735-5', N'Termination of receivership', 15),
  ('IL', '735-6', N'Utility service; landlord liability', 16),
  ('IL', '740-1', N'Short title', 17),
  ('IL', '740-5', N'Disclosure of utility cost allocation', 18),
  ('IL', '740-10', N'Copy of utility bill', 19),
  ('IL', '740-15', N'Excess charges prohibited', 20),
  ('IL', '740-20', N'Enforcement', 21)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + SUBSTRING(s.SectionCode, 1, CHARINDEX('-', s.SectionCode) - 1) + '/section-' + SUBSTRING(s.SectionCode, CHARINDEX('-', s.SectionCode) + 1, 100) + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + SUBSTRING(s.SectionCode, 1, CHARINDEX('-', s.SectionCode) - 1) + '/section-' + SUBSTRING(s.SectionCode, CHARINDEX('-', s.SectionCode) + 1, 100) + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for IL (765 ILCS 705, 735, 740).';
GO
