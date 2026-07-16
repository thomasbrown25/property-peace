-- Seeds lease_shield.StateLawSections for North Carolina (Chapter 42 - Landlord and Tenant).
-- Source: https://www.ncleg.gov/Laws/GeneralStatuteSections/Chapter42
-- URL pattern: https://www.ncleg.net/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_{SectionCode}.html
-- Run after the AddLeaseShieldStateLawSections migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentText and LastFetchedAt remain NULL; populate later via fetch job or RAG pipeline.

SET NOCOUNT ON;

DECLARE @BaseUrl NVARCHAR(256) = 'https://www.ncleg.net/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/';

MERGE lease_shield.StateLawSections AS t
USING (VALUES
  ('NC', '42-1', N'Lessor and lessee not partners', 1),
  ('NC', '42-2', N'Attornment unnecessary on conveyance of reversions, etc.', 2),
  ('NC', '42-3', N'Term forfeited for nonpayment of rent', 3),
  ('NC', '42-4', N'Recovery for use and occupation', 4),
  ('NC', '42-5', N'Rent apportioned, where lease terminated by death', 5),
  ('NC', '42-6', N'Rents, annuities, etc., apportioned, where right to payment terminated by death', 6),
  ('NC', '42-7', N'In lieu of emblements, farm lessee holds out year, with rents apportioned', 7),
  ('NC', '42-8', N'Grantees of reversion and assigns of lease have reciprocal rights under covenants', 8),
  ('NC', '42-9', N'Agreement to rebuild, how construed in case of fire', 9),
  ('NC', '42-10', N'Tenant not liable for accidental damage', 10),
  ('NC', '42-11', N'Willful destruction by tenant misdemeanor', 11),
  ('NC', '42-12', N'Lessee may surrender, where building destroyed or damaged', 12),
  ('NC', '42-13', N'Wrongful surrender to other than landlord misdemeanor', 13),
  ('NC', '42-14', N'Notice to quit in certain tenancies', 14),
  ('NC', '42-14.1', N'Preemption of local regulations', 15),
  ('NC', '42-14.2', N'Death, illness, or conviction of certain crimes not a material fact', 16),
  ('NC', '42-14.3', N'Notice of conversion of manufactured home communities', 17),
  ('NC', '42-14.4', N'Notice to State Bar of attorney default on lease', 18),
  ('NC', '42-14.5', N'Foreseeability not created by criminal record; no duty to screen', 19),
  ('NC', '42-14.6', N'Transient occupancies excluded', 20),
  ('NC', '42-15', N'Landlord''s lien on crops for rents, advances, etc.; enforcement', 21),
  ('NC', '42-15.1', N'Landlord''s lien on crop insurance for rents, advances, etc.; enforcement', 22),
  ('NC', '42-16', N'Rights of tenants', 23),
  ('NC', '42-17', N'Action to settle dispute between parties', 24),
  ('NC', '42-18', N'Tenant''s undertaking on continuance or appeal', 25),
  ('NC', '42-19', N'Crops delivered to landlord on his undertaking', 26),
  ('NC', '42-20', N'Crops sold, if neither party gives undertaking', 27),
  ('NC', '42-21', N'Tenant''s crop not subject to execution against landlord', 28),
  ('NC', '42-22', N'Unlawful seizure by landlord or removal by tenant misdemeanor', 29),
  ('NC', '42-22.1', N'Failure of tenant to account for sales under tobacco marketing cards', 30),
  ('NC', '42-23', N'Terms of agricultural tenancies in certain counties', 31),
  ('NC', '42-24', N'Turpentine and lightwood leases', 32),
  ('NC', '42-25', N'Mining and timberland leases', 33),
  ('NC', '42-25.6', N'Manner of ejectment of residential tenants', 34),
  ('NC', '42-25.7', N'Distress and distraint not permitted', 35),
  ('NC', '42-25.8', N'Contrary lease provisions', 36),
  ('NC', '42-25.9', N'Remedies', 37),
  ('NC', '42-26', N'Tenant holding over may be dispossessed in certain cases', 38),
  ('NC', '42-27', N'Local: Refusal to perform contract ground for dispossession', 39),
  ('NC', '42-28', N'Summons issued by clerk', 40),
  ('NC', '42-29', N'Service of summons', 41),
  ('NC', '42-30', N'Judgment by confession, where plaintiff has proved case, or failure to appear', 42),
  ('NC', '42-31', N'Trial by magistrate', 43),
  ('NC', '42-32', N'Damages assessed to trial', 44),
  ('NC', '42-33', N'Rent and costs tendered by tenant', 45),
  ('NC', '42-34', N'Undertaking on appeal and order staying execution', 46),
  ('NC', '42-34.1', N'Rent pending execution of judgment; post bond pending appeal', 47),
  ('NC', '42-35', N'Restitution of tenant, if case quashed, etc., on appeal', 48),
  ('NC', '42-36', N'Damages to tenant for dispossession, if proceedings quashed, etc.', 49),
  ('NC', '42-36.1', N'Lease or rental of manufactured homes', 50),
  ('NC', '42-36.1A', N'Judgments for possession more than 30 days old', 51),
  ('NC', '42-36.2', N'Notice to tenant of execution of writ for possession of property; storage of evicted tenant''s personal property', 52),
  ('NC', '42-36.3', N'Death of residential tenant; landlord may file affidavit to remove personal property from the dwelling unit', 53),
  ('NC', '42-37.1', N'Defense of retaliatory eviction', 54),
  ('NC', '42-37.2', N'Remedies', 55),
  ('NC', '42-37.3', N'Waiver', 56),
  ('NC', '42-38', N'Application', 57),
  ('NC', '42-39', N'Exclusions', 58),
  ('NC', '42-40', N'Definitions', 59),
  ('NC', '42-41', N'Mutuality of obligations', 60),
  ('NC', '42-42', N'Landlord to provide fit premises', 61),
  ('NC', '42-42.1', N'Water, electricity, and natural gas conservation', 62),
  ('NC', '42-42.2', N'Victim protection - nondiscrimination', 63),
  ('NC', '42-42.3', N'Victim protection - change locks', 64),
  ('NC', '42-43', N'Tenant to maintain dwelling unit', 65),
  ('NC', '42-44', N'General remedies, penalties, and limitations', 66),
  ('NC', '42-45', N'Early termination of rental agreement by military personnel, surviving family members, or lawful representative', 67),
  ('NC', '42-45.1', N'Early termination of rental agreement by victims of domestic violence, sexual assault, or stalking', 68),
  ('NC', '42-45.2', N'Early termination of rental agreement by tenants residing in certain foreclosed property', 69),
  ('NC', '42-46', N'Authorized fees, costs, and expenses', 70),
  ('NC', '42-50', N'Deposits from the tenant', 71),
  ('NC', '42-51', N'Permitted uses of the deposit', 72),
  ('NC', '42-52', N'Landlord''s obligations', 73),
  ('NC', '42-53', N'Pet deposits', 74),
  ('NC', '42-54', N'Transfer of dwelling units', 75),
  ('NC', '42-55', N'Remedies', 76),
  ('NC', '42-56', N'Application of Article', 77),
  ('NC', '42-59', N'Definitions', 78),
  ('NC', '42-59.1', N'Statement of Public Policy', 79),
  ('NC', '42-60', N'Nature of actions and jurisdiction', 80),
  ('NC', '42-61', N'Standard of proof', 81),
  ('NC', '42-62', N'Parties', 82),
  ('NC', '42-63', N'Remedies and judicial orders', 83),
  ('NC', '42-64', N'Affirmative defense or exemption to a complete eviction', 84),
  ('NC', '42-65', N'Obstructing the execution or enforcement of a removal or eviction order', 85),
  ('NC', '42-66', N'Motion to enforce eviction and removal orders', 86),
  ('NC', '42-67', N'Impermissible defense', 87),
  ('NC', '42-68', N'Expedited proceedings', 88),
  ('NC', '42-69', N'Relation to criminal proceedings', 89),
  ('NC', '42-70', N'Discovery', 90),
  ('NC', '42-71', N'Protection of threatened witnesses or affiants', 91),
  ('NC', '42-72', N'Availability of law enforcement resources to plaintiffs or potential plaintiffs', 92),
  ('NC', '42-73', N'Collection of rent', 93),
  ('NC', '42-74', N'Preliminary or emergency relief', 94),
  ('NC', '42-75', N'Cumulative remedies', 95),
  ('NC', '42-76', N'Civil immunity', 96)
) AS s(State, SectionCode, SectionTitle, DisplayOrder)
ON t.State = s.State AND t.SectionCode = s.SectionCode
WHEN MATCHED THEN
  UPDATE SET
    SectionTitle = s.SectionTitle,
    SourceUrl = @BaseUrl + 'GS_' + s.SectionCode + '.html',
    DisplayOrder = s.DisplayOrder
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, SectionCode, SectionTitle, SourceUrl, ContentText, LastFetchedAt, DisplayOrder)
  VALUES (s.State, s.SectionCode, s.SectionTitle, @BaseUrl + 'GS_' + s.SectionCode + '.html', NULL, NULL, s.DisplayOrder);

PRINT 'lease_shield.StateLawSections seeded for NC (Chapter 42).';
GO
