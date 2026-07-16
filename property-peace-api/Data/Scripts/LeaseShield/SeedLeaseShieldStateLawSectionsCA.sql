-- Seeds lease_shield.StateLawSections for California (Civil Code Division 3, Part 4, Title 5, Chapter 2 - Hiring of Real Property).
-- Source: https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=CIV
-- URL pattern: https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum={SectionCode}
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('CA', '1940', N'Application of chapter; persons hiring dwelling units', 1),
  ('CA', '1940.05', N'Immigration or citizenship status', 2),
  ('CA', '1940.1', N'Residential hotel occupancy; move-out or reregistration', 3),
  ('CA', '1940.2', N'Unlawful acts to influence tenant to vacate', 4),
  ('CA', '1940.3', N'Immigration or citizenship status of tenant', 5),
  ('CA', '1940.4', N'Political signs; posting or display', 6),
  ('CA', '1940.41', N'Personal micromobility devices', 7),
  ('CA', '1941', N'Landlord duty to maintain habitable dwelling', 8),
  ('CA', '1941.1', N'Affirmative standard characteristics; untenantable', 9),
  ('CA', '1941.2', N'Tenant obligations; landlord duty limitations', 10),
  ('CA', '1941.3', N'Landlord obligations; running water, hot water, heat', 11),
  ('CA', '1941.4', N'Garbage receptacles', 12),
  ('CA', '1941.5', N'Landlord access for repairs', 13),
  ('CA', '1941.6', N'Clothes dryer venting', 14),
  ('CA', '1942', N'Tenant repair and deduct; uninhabitable conditions', 15),
  ('CA', '1942.3', N'Rent withholding; habitability', 16),
  ('CA', '1942.4', N'Rent or notice to pay or quit; substandard conditions', 17),
  ('CA', '1942.5', N'Retaliation for exercise of tenant rights', 18),
  ('CA', '1942.6', N'Retaliation; reporting to immigration authorities', 19),
  ('CA', '1942.7', N'Retaliation; tenant on month-to-month', 20),
  ('CA', '1942.8', N'Retaliation; tenant on fixed term', 21),
  ('CA', '1943', N'Furniture or furnishings', 22),
  ('CA', '1944', N'Landlord lien; personal property', 23),
  ('CA', '1945', N'Holdover; acceptance of rent; renewal', 24),
  ('CA', '1946', N'Termination of hiring; notice', 25),
  ('CA', '1946.1', N'Termination; month-to-month; 30 or 60 days', 26),
  ('CA', '1946.2', N'Termination; just cause; no-fault', 27),
  ('CA', '1947', N'Rent increase notice; periodic tenancy', 28),
  ('CA', '1947.3', N'Rent control; notice of increase', 29),
  ('CA', '1947.7', N'Rent increase; 90-day notice; 10 percent', 30),
  ('CA', '1947.10', N'Rent increase; 90-day notice; 5 percent', 31),
  ('CA', '1947.11', N'Rent increase; 90-day notice; inflation', 32),
  ('CA', '1947.12', N'Rent increase; 90-day notice; low-income', 33),
  ('CA', '1950.5', N'Security deposit; itemized statement; deductions', 34),
  ('CA', '1950.6', N'Security deposit; interest; disclosure', 35),
  ('CA', '1950.7', N'Security deposit; pre-tenancy checklist', 36),
  ('CA', '1951', N'Abandonment; landlord remedies', 37),
  ('CA', '1951.2', N'Abandonment; personal property', 38),
  ('CA', '1951.4', N'Termination; damages; rent after breach', 39),
  ('CA', '1951.5', N'Liquidated damages; lease termination', 40),
  ('CA', '1952', N'Unlawful detainer; landlord remedies', 41),
  ('CA', '1952.5', N'Unlawful detainer; notice', 42),
  ('CA', '1953', N'Waiver of tenant rights; void', 43),
  ('CA', '1954', N'Landlord entry; notice; consent', 44),
  ('CA', '1954.02', N'Landlord entry; showing to prospective tenants', 45),
  ('CA', '1954.05', N'Assignment for benefit of creditors; occupancy', 46),
  ('CA', '1954.06', N'Landlord entry; additional provisions', 47),
  ('CA', '1954.07', N'Rental payment reporting; consumer reporting', 48),
  ('CA', '1954.071', N'Rental payment reporting; tenant election', 49)
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

PRINT 'lease_shield.StateLawSections seeded for CA (Civil Code Chapter 2 - Hiring of Real Property).';
GO
