-- Seeds lease_shield.StateLawSections for Georgia (OCGA Title 44, Ch 7 - Landlord and Tenant, §§ 44-7-1 to 44-7-119).
-- Source: https://law.justia.com/codes/georgia/title-44/chapter-7/
-- URL pattern: https://law.justia.com/codes/georgia/title-44/chapter-7/article-{1-6}/section-{44-7-XX}/
-- Articles: 1 In General (1-24), 2 Security Deposits (30-37), 3 Dispossessory (49-59), 4 Distress (70-82), 5 Croppers (100-103), 6 Abandoned Mobile Home (110-119).
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(512) = 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('GA', '44-7-1', N'Creation of landlord and tenant relationship; rights of tenant', 1),
  ('GA', '44-7-2', N'Rental agreement; disclosure of lead-based paint', 2),
  ('GA', '44-7-3', N'Disclosure of ownership and agents', 3),
  ('GA', '44-7-4', N'Delivery of possession', 4),
  ('GA', '44-7-5', N'Landlord obligation to maintain premises', 5),
  ('GA', '44-7-6', N'Tenant obligation to maintain premises', 6),
  ('GA', '44-7-7', N'Tenancy at will; notice required for termination', 7),
  ('GA', '44-7-9', N'Estoppel to dispute landlord''s title or attorn to another', 8),
  ('GA', '44-7-10', N'Tenant holding over', 9),
  ('GA', '44-7-11', N'When landlord may reenter', 10),
  ('GA', '44-7-12', N'Abandoned personal property', 11),
  ('GA', '44-7-13', N'Landlord''s access to dwelling unit', 12),
  ('GA', '44-7-14', N'Retaliatory conduct prohibited', 13),
  ('GA', '44-7-15', N'Early termination; victims of family violence', 14),
  ('GA', '44-7-16', N'Early termination; military personnel', 15),
  ('GA', '44-7-17', N'Prohibited provisions in rental agreements', 16),
  ('GA', '44-7-18', N'Attorney fees', 17),
  ('GA', '44-7-19', N'Sublease and assignment', 18),
  ('GA', '44-7-20', N'Action for use and occupancy', 19),
  ('GA', '44-7-21', N'Tenant remedies; failure to supply essential services', 20),
  ('GA', '44-7-22', N'Noncompliance by landlord; tenant remedies', 21),
  ('GA', '44-7-23', N'Noncompliance by tenant; landlord remedies', 22),
  ('GA', '44-7-24', N'Waiver of tenant rights; void', 23),
  ('GA', '44-7-30', N'Security deposits; definitions', 24),
  ('GA', '44-7-31', N'Security deposits; escrow or bond', 25),
  ('GA', '44-7-32', N'Security deposits; inspection; list of defects', 26),
  ('GA', '44-7-33', N'Security deposits; return or notice of retention', 27),
  ('GA', '44-7-34', N'Security deposits; grounds for retention', 28),
  ('GA', '44-7-35', N'Security deposits; landlord noncompliance; remedies', 29),
  ('GA', '44-7-36', N'Security deposits; military personnel', 30),
  ('GA', '44-7-37', N'Security deposits; applicability', 31),
  ('GA', '44-7-49', N'Dispossessory proceedings; demand for possession', 32),
  ('GA', '44-7-50', N'Dispossessory; summons and service', 33),
  ('GA', '44-7-51', N'Dispossessory; answer and trial', 34),
  ('GA', '44-7-52', N'Dispossessory; judgment', 35),
  ('GA', '44-7-53', N'Dispossessory; writ of possession', 36),
  ('GA', '44-7-54', N'Dispossessory; appeal', 37),
  ('GA', '44-7-55', N'Dispossessory; payment of rent into court', 38),
  ('GA', '44-7-56', N'Dispossessory; dismissal upon payment', 39),
  ('GA', '44-7-57', N'Dispossessory; distribution of funds', 40),
  ('GA', '44-7-58', N'Dispossessory; default judgment', 41),
  ('GA', '44-7-59', N'Dispossessory; jury trial', 42),
  ('GA', '44-7-70', N'Distress warrant; when issuable', 43),
  ('GA', '44-7-71', N'Distress warrant; application and bond', 44),
  ('GA', '44-7-72', N'Distress warrant; levy', 45),
  ('GA', '44-7-73', N'Distress warrant; replevy', 46),
  ('GA', '44-7-74', N'Distress warrant; sale', 47),
  ('GA', '44-7-75', N'Distress warrant; distribution of proceeds', 48),
  ('GA', '44-7-76', N'Distress warrant; counter affidavit', 49),
  ('GA', '44-7-77', N'Distress warrant; trial', 50),
  ('GA', '44-7-78', N'Distress warrant; judgment', 51),
  ('GA', '44-7-79', N'Distress warrant; appeal', 52),
  ('GA', '44-7-80', N'Distress warrant; double rent', 53),
  ('GA', '44-7-81', N'Distress warrant; exemption', 54),
  ('GA', '44-7-82', N'Distress warrant; waiver', 55)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + CAST(CASE
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 1 AND 24 THEN 1
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 30 AND 37 THEN 2
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 49 AND 59 THEN 3
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 70 AND 82 THEN 4
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 100 AND 103 THEN 5
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 110 AND 119 THEN 6
      ELSE 1
    END AS NVARCHAR(2)) + '/section-' + s.SectionCode + '/',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + CAST(CASE
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 1 AND 24 THEN 1
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 30 AND 37 THEN 2
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 49 AND 59 THEN 3
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 70 AND 82 THEN 4
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 100 AND 103 THEN 5
      WHEN CAST(REVERSE(SUBSTRING(REVERSE(s.SectionCode), 1, CHARINDEX('-', REVERSE(s.SectionCode))-1)) AS INT) BETWEEN 110 AND 119 THEN 6
      ELSE 1
    END AS NVARCHAR(2)) + '/section-' + s.SectionCode + '/', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for GA (OCGA 44-7 - Landlord and Tenant).';
GO
