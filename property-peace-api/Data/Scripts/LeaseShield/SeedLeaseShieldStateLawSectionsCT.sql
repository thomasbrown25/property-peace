-- Seeds lease_shield.StateLawSections for Connecticut (C.G.S. Title 47a - Landlord and Tenant).
-- Source: https://law.justia.com/codes/connecticut/title-47a/
-- URL pattern: https://law.justia.com/codes/connecticut/title-47a/chapter-{830|831|832}/section-{SectionCode}/
-- Chapters: 830 (Rights and Responsibilities), 831 (Security Deposits), 832 (Summary Process).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/connecticut/title-47a/chapter-';

-- Chapter: 831 for 47a-21, 47a-22, 47a-22a; 832 for 47a-23 through 47a-42; else 830
MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('CT', '47a-1', N'Definitions', 1),
  ('CT', '47a-2', N'Exemptions; mobile manufactured homes; transient occupancy', 2),
  ('CT', '47a-3', N'Terms of rental agreement', 3),
  ('CT', '47a-4', N'Prohibited provisions in rental agreement', 4),
  ('CT', '47a-4a', N'Separation of rents and obligations forbidden', 5),
  ('CT', '47a-4b', N'Disclosure of lead paint', 6),
  ('CT', '47a-4c', N'Sublease and assignment', 7),
  ('CT', '47a-5', N'Landlord''s name and address', 8),
  ('CT', '47a-6', N'Delivery of possession', 9),
  ('CT', '47a-6a', N'Nonresident landlord; filing of address', 10),
  ('CT', '47a-7', N'Landlord''s responsibilities', 11),
  ('CT', '47a-7a', N'Landlord and tenant responsibilities; bed bug infestations', 12),
  ('CT', '47a-8', N'Tenant''s use of premises', 13),
  ('CT', '47a-9', N'Landlord rules and regulations', 14),
  ('CT', '47a-10', N'Access by landlord', 15),
  ('CT', '47a-11', N'Tenant''s responsibilities', 16),
  ('CT', '47a-11a', N'Tenant''s remedies; failure to supply heat, water, essential services', 17),
  ('CT', '47a-12', N'Abandoned property', 18),
  ('CT', '47a-13', N'Failure of landlord to supply essential services; tenant''s remedies', 19),
  ('CT', '47a-14', N'Noncompliance by landlord; tenant''s remedies', 20),
  ('CT', '47a-15', N'Noncompliance by tenant; landlord''s remedies', 21),
  ('CT', '47a-15a', N'Grace period for rent payment', 22),
  ('CT', '47a-16', N'Retaliatory action by landlord', 23),
  ('CT', '47a-18', N'Action for use and occupancy', 24),
  ('CT', '47a-20', N'Early termination; domestic violence', 25),
  ('CT', '47a-20a', N'Early termination; military service', 26),
  ('CT', '47a-20f', N'Early termination; certain foreclosures', 27),
  ('CT', '47a-21', N'Security deposits', 28),
  ('CT', '47a-22', N'Advance rental or security; escrow; interest', 29),
  ('CT', '47a-22a', N'Security deposits; senior citizens and disabled; interest; installments', 30),
  ('CT', '47a-23', N'Notice to quit possession or occupancy', 31),
  ('CT', '47a-23a', N'Complaint; summary process', 32),
  ('CT', '47a-23b', N'Service of process', 33),
  ('CT', '47a-23c', N'Prohibition on eviction except for good cause; certain tenants', 34),
  ('CT', '47a-23d', N'Summary process; stay of execution', 35),
  ('CT', '47a-24', N'Judgment', 36),
  ('CT', '47a-26', N'Execution; stay', 37),
  ('CT', '47a-31', N'Appeal', 38),
  ('CT', '47a-35', N'Rent paid into court', 39),
  ('CT', '47a-36', N'Abandoned property; disposition', 40),
  ('CT', '47a-41', N'Jurisdiction', 41),
  ('CT', '47a-42', N'Waiver of tenant rights; void', 42),
  ('CT', '47a-42a', N'Summary process; expedited hearing', 43)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + CASE
      WHEN s.SectionCode IN ('47a-21', '47a-22', '47a-22a') THEN '831'
      WHEN s.SectionCode IN ('47a-23', '47a-23a', '47a-23b', '47a-23c', '47a-23d', '47a-24', '47a-26', '47a-31', '47a-35', '47a-36', '47a-41', '47a-42', '47a-42a') THEN '832'
      ELSE '830'
    END + '/section-' + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + CASE
      WHEN s.SectionCode IN ('47a-21', '47a-22', '47a-22a') THEN '831'
      WHEN s.SectionCode IN ('47a-23', '47a-23a', '47a-23b', '47a-23c', '47a-23d', '47a-24', '47a-26', '47a-31', '47a-35', '47a-36', '47a-41', '47a-42', '47a-42a') THEN '832'
      ELSE '830'
    END + '/section-' + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for CT (C.G.S. Title 47a - Landlord and Tenant).';
GO
