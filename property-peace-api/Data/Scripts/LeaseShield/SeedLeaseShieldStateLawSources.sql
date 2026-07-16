-- Seeds lease_shield.StateLawSources with official .gov (or state legislature) base URLs
-- for landlord-tenant / residential landlord-tenant law in each state.
-- Run after the AddLeaseShieldTables migration. Uses MERGE: updates existing rows, inserts new ones.
-- ContentUrl: when set, we fetch this page's text for AI context (e.g. NC G.S. 42-46 so late-fee answers use actual statute text).
-- Most URLs are state legislature or .gov; GA, MS, TN use Justia (authoritative state code) where
-- a single official chapter URL was not readily available—replace with .gov links when you have them.

SET NOCOUNT ON;

MERGE lease_shield.StateLawSources AS t
USING (VALUES
  ('AL', 'https://alison.legislature.state.al.us/code-of-alabama', NULL, 'Alabama Code - Landlord and Tenant'),
  ('AK', 'https://www.akleg.gov/basis/statutes.asp#35.03', NULL, 'Alaska Statutes - Landlord and Tenant'),
  ('AZ', 'https://www.azleg.gov/arsDetail/?title=33', NULL, 'Arizona Revised Statutes Title 33 - Property'),
  ('AR', 'https://legislature.arkansas.gov/ArkansasLaw/ArkansasCode?code=18-16', NULL, 'Arkansas Code Title 18 - Landlord and Tenant'),
  ('CA', 'https://leginfo.legislature.ca.gov/faces/codes_displayexpand.xhtml?lawCode=CIV&division=2.&title=5.&part=4.&chapter=2.', NULL, 'California Civil Code - Landlord and Tenant'),
  ('CO', 'https://leg.colorado.gov/sites/default/files/images/olls/crs2023-title-38.pdf', NULL, 'Colorado Revised Statutes Title 38 - Property'),
  ('CT', 'https://www.cga.ct.gov/current/pub/chap_830.htm', NULL, 'Connecticut General Statutes - Landlord and Tenant'),
  ('DE', 'https://delcode.delaware.gov/title25/c055', NULL, 'Delaware Code Title 25 Chapter 55 - Residential Landlord-Tenant Code'),
  ('FL', 'https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/0083.html', NULL, 'Florida Statutes Chapter 83 - Landlord and Tenant'),
  ('GA', 'https://law.justia.com/codes/georgia/title-44/chapter-7/', NULL, 'Georgia Code Title 44 Chapter 7 - Landlord and Tenant'),
  ('HI', 'https://www.capitol.hawaii.gov/hrscurrent/Vol13_Ch0521-0588/HRS0521/0521-0044.htm', NULL, 'Hawaii Revised Statutes Chapter 521 - Landlord-Tenant Code'),
  ('ID', 'https://legislature.idaho.gov/statutesrules/idstat/Title6/T6CH3/', NULL, 'Idaho Statutes Title 6 Chapter 3 - Landlord and Tenant'),
  ('IL', 'https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=2201', NULL, 'Illinois Compiled Statutes - Landlord and Tenant'),
  ('IN', 'https://iga.in.gov/laws/2024/ic/titles/32', NULL, 'Indiana Code Title 32 - Property'),
  ('IA', 'https://www.legis.iowa.gov/law/iowaCode/sections?code=562A', NULL, 'Iowa Code Chapter 562A - Uniform Residential Landlord and Tenant Law'),
  ('KS', 'https://kslegislature.gov/li_2024/b2023_24/statute/058_000_0000_chapter/058_008_0000_article/', NULL, 'Kansas Statutes Chapter 58 - Landlord and Tenant'),
  ('KY', 'https://apps.legislature.ky.gov/law/statutes/chapter.aspx?ch=383', NULL, 'Kentucky Revised Statutes Chapter 383 - Landlord and Tenant'),
  ('LA', 'https://legis.la.gov/legis/Law.aspx?d=78345', NULL, 'Louisiana Revised Statutes - Lease of Things'),
  ('ME', 'https://legislature.maine.gov/statutes/14/title14ch709sec0.html', NULL, 'Maine Revised Statutes Title 14 Chapter 709 - Residential Landlord-Tenant'),
  ('MD', 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=grp', NULL, 'Maryland Code - Real Property'),
  ('MA', 'https://malegislature.gov/Laws/GeneralLaws/PartIII/TitleII/Chapter186', NULL, 'Massachusetts General Laws Chapter 186 - Landlord and Tenant'),
  ('MI', 'https://legislature.mi.gov/doc.aspx?mcl-554-601', NULL, 'Michigan Compiled Laws - Landlord and Tenant'),
  ('MN', 'https://www.revisor.mn.gov/statutes/cite/504B', NULL, 'Minnesota Statutes Chapter 504B - Landlord and Tenant'),
  ('MS', 'https://law.justia.com/codes/mississippi/2022/title-89/chapter-8/', NULL, 'Mississippi Code Title 89 Chapter 8 - Landlord and Tenant'),
  ('MO', 'https://revisor.mo.gov/main/OneChapter.aspx?chapter=535', NULL, 'Missouri Revised Statutes Chapter 535 - Landlord and Tenant'),
  ('MT', 'https://leg.mt.gov/bills/mca/title_0700/chapter_0250/parts_index.html', NULL, 'Montana Code Annotated Title 70 Chapter 25 - Residential Landlord and Tenant'),
  ('NE', 'https://nebraskalegislature.gov/laws/statutes.php?statute=76-1401', NULL, 'Nebraska Revised Statutes Chapter 76 - Landlord and Tenant'),
  ('NV', 'https://www.leg.state.nv.us/NRS/NRS-118A.html', NULL, 'Nevada Revised Statutes Chapter 118A - Landlord and Tenant'),
  ('NH', 'https://gencourt.state.nh.us/rsa/html/540-A/540-A-mrg.htm', NULL, 'New Hampshire RSA Chapter 540-A - Landlord and Tenant'),
  ('NJ', 'https://lis.njleg.state.nj.us/nxt/gateway.dll?f=templates&fn=default.htm&vid=Publish:10.1048/Enu', NULL, 'New Jersey Statutes - Landlord and Tenant'),
  ('NM', 'https://nmonesource.com/nmos/nmsa/en/nav_date.lasso', NULL, 'New Mexico Statutes - Landlord and Tenant'),
  ('NY', 'https://www.nysenate.gov/legislation/laws/RPP', NULL, 'New York Real Property Law'),
  ('NC', 'https://www.ncleg.gov/Laws/GeneralStatuteSections/Chapter42', 'https://www.ncleg.net/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_42-46.html', 'North Carolina General Statutes Chapter 42 - Landlord and Tenant (G.S. 42-46 late fees, authorized fees)'),
  ('ND', 'https://www.legis.nd.gov/cencode/t47.html', NULL, 'North Dakota Century Code Title 47 - Property'),
  ('OH', 'https://codes.ohio.gov/ohio-revised-code/chapter-5321', NULL, 'Ohio Revised Code Chapter 5321 - Landlords and Tenants'),
  ('OK', 'https://www.oscn.net/applications/oscn/index.asp?ftdb=STOKST41&level=1', NULL, 'Oklahoma Statutes - Landlord and Tenant'),
  ('OR', 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html', NULL, 'Oregon Revised Statutes Chapter 90 - Residential Landlord and Tenant'),
  ('PA', 'https://www.legis.state.pa.us/cfdocs/legis/li/uconsCheck.cfm?yr=2014&sessInd=0&act=98', NULL, 'Pennsylvania Landlord and Tenant Act'),
  ('RI', 'https://webserver.rilegislature.gov/Statutes/TITLE34/34-18/34-18-1.htm', NULL, 'Rhode Island General Laws Chapter 34-18 - Residential Landlord and Tenant'),
  ('SC', 'https://www.scstatehouse.gov/coderev/c27.php', NULL, 'South Carolina Code Title 27 - Property and Conveyances'),
  ('SD', 'https://sdlegislature.gov/Statutes/Codified_Laws/DisplayStatute.aspx?Type=Statute&Statute=43-32', NULL, 'South Dakota Codified Laws - Landlord and Tenant'),
  ('TN', 'https://law.justia.com/codes/tennessee/2022/title-66/chapter-28/', NULL, 'Tennessee Code Title 66 Chapter 28 - Residential Landlord and Tenant'),
  ('TX', 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm', NULL, 'Texas Property Code Chapter 92 - Residential Tenancies'),
  ('UT', 'https://le.utah.gov/xcode/Title57/Chapter17/57-17.html', NULL, 'Utah Code Title 57 Chapter 17 - Residential Tenant Rights'),
  ('VT', 'https://legislature.vermont.gov/statutes/chapter/9/041', NULL, 'Vermont Statutes Title 9 Chapter 41 - Residential Rental Agreements'),
  ('VA', 'https://law.lis.virginia.gov/vacode/title55.1/chapter12/', NULL, 'Virginia Code Title 55.1 Chapter 12 - Landlord and Tenant'),
  ('WA', 'https://apps.leg.wa.gov/RCW/default.aspx?cite=59.18', NULL, 'Washington RCW Chapter 59.18 - Residential Landlord-Tenant'),
  ('WV', 'https://code.wvlegislature.gov/37-6A-1/', NULL, 'West Virginia Code Chapter 37-6A - Residential Landlord and Tenant'),
  ('WI', 'https://docs.legis.wisconsin.gov/statutes/statutes/704', NULL, 'Wisconsin Statutes Chapter 704 - Landlord and Tenant'),
  ('WY', 'https://wyoleg.gov/statutes/compress/title01.pdf', NULL, 'Wyoming Statutes - Property')
) AS s(State, BaseUrl, ContentUrl, Description)
ON t.State = s.State
WHEN MATCHED THEN
  UPDATE SET BaseUrl = s.BaseUrl, ContentUrl = s.ContentUrl, Description = s.Description, UpdatedAt = GETUTCDATE()
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, BaseUrl, ContentUrl, Description, UpdatedAt)
  VALUES (s.State, s.BaseUrl, s.ContentUrl, s.Description, GETUTCDATE());

PRINT 'lease_shield.StateLawSources seeded (50 states).';
