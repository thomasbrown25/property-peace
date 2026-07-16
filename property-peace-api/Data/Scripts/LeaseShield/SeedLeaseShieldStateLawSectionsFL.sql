-- Seeds lease_shield.StateLawSections for Florida (Ch 83 Part II - Residential Tenancies, 83.40-83.683).
-- Source: https://law.justia.com/codes/florida/title-vi/chapter-83/part-ii/
-- URL pattern: https://law.justia.com/codes/florida/title-vi/chapter-83/part-ii/section-{83-XX}/ (dot to dash in section).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/florida/title-vi/chapter-83/part-ii/section-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('FL', '83.40', N'Short title (Florida Residential Landlord and Tenant Act)', 1),
  ('FL', '83.41', N'Application', 2),
  ('FL', '83.42', N'Exclusions from application of part', 3),
  ('FL', '83.425', N'Preemption', 4),
  ('FL', '83.43', N'Definitions', 5),
  ('FL', '83.44', N'Obligation of good faith', 6),
  ('FL', '83.45', N'Unconscionable rental agreement or provision', 7),
  ('FL', '83.46', N'Rent; duration of tenancies', 8),
  ('FL', '83.47', N'Prohibited provisions in rental agreements', 9),
  ('FL', '83.48', N'Attorney fees', 10),
  ('FL', '83.49', N'Deposit money or advance rent; duty of landlord and tenant', 11),
  ('FL', '83.491', N'Fee in lieu of security deposit', 12),
  ('FL', '83.50', N'Disclosure of landlord''s address', 13),
  ('FL', '83.51', N'Landlord''s obligation to maintain premises', 14),
  ('FL', '83.515', N'Background screening of apartment employees; employment disqualification', 15),
  ('FL', '83.52', N'Tenant''s obligation to maintain dwelling unit', 16),
  ('FL', '83.53', N'Landlord''s access to dwelling unit', 17),
  ('FL', '83.54', N'Enforcement of rights and duties; civil action; criminal offenses', 18),
  ('FL', '83.55', N'Right of action for damages', 19),
  ('FL', '83.56', N'Termination of rental agreement', 20),
  ('FL', '83.57', N'Termination of tenancy without specific term', 21),
  ('FL', '83.58', N'Remedies; tenant holding over', 22),
  ('FL', '83.59', N'Right of action for possession', 23),
  ('FL', '83.60', N'Defenses to action for rent or possession; procedure', 24),
  ('FL', '83.61', N'Disbursement of funds in registry of court; prompt final hearing', 25),
  ('FL', '83.62', N'Restoration of possession to landlord', 26),
  ('FL', '83.63', N'Casualty damage', 27),
  ('FL', '83.64', N'Retaliatory conduct', 28),
  ('FL', '83.67', N'Prohibited practices', 29),
  ('FL', '83.68', N'Orders to enjoin violations of this part', 30),
  ('FL', '83.681', N'Orders to enjoin violations', 31),
  ('FL', '83.682', N'Termination of rental agreement by a servicemember', 32),
  ('FL', '83.683', N'Early termination for victims of domestic violence, dating violence, or stalking', 33)
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

PRINT 'lease_shield.StateLawSections seeded for FL (Ch 83 Part II - Residential Tenancies).';
GO
