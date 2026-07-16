-- Updates admin.StateLawSources with curated .gov URLs for state late-fee and security-deposit laws.
-- Run against your database when you want to bulk-update or seed the table.
-- Existing rows are updated by State; new states are inserted.

MERGE admin.StateLawSources AS t
USING (VALUES
  ('AL', 'https://alison.legislature.state.al.us/code-of-alabama', 'https://alison.legislature.state.al.us/code-of-alabama?section=35-9A-201'),
  ('AK', 'https://www.akleg.gov/basis/statutes.asp#35.03', 'https://www.akleg.gov/basis/statutes.asp#34.03.070'),
  ('AZ', 'https://www.azleg.gov/arsDetail/?title=33', 'https://www.azleg.gov/ars/33/01321.htm'),
  ('AR', 'https://law.justia.com/codes/arkansas/title-18/subtitle-2/chapter-16/', 'https://law.justia.com/codes/arkansas/title-18/subtitle-2/chapter-16/subchapter-3/'),
  ('CA', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1947.3', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5'),
  ('CO', 'https://leg.colorado.gov/sites/default/files/images/olls/crs2023-title-38.pdf', 'https://leg.colorado.gov/sites/default/files/images/olls/crs2023-title-38.pdf'),
  ('CT', 'https://www.cga.ct.gov/current/pub/chap_830.htm', 'https://www.cga.ct.gov/current/pub/chap_830.htm#sec_47a-21'),
  ('DE', 'https://delcode.delaware.gov/title25/c055', 'https://delcode.delaware.gov/title25/c055/index.html'),
  ('DC', 'https://code.dccouncil.gov/us/dc/council/code/titles/42/chapters/35', 'https://code.dccouncil.gov/us/dc/council/code/sections/42-3502.17'),
  ('FL', 'https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/0083.html', 'https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/083.49.html'),
  ('GA', 'https://law.justia.com/codes/georgia/title-44/chapter-7/', 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/'),
  ('HI', 'https://www.capitol.hawaii.gov/hrscurrent/Vol13_Ch0521-0588/HRS0521/0521-0044.htm', 'https://www.capitol.hawaii.gov/hrscurrent/Vol13_Ch0521-0588/HRS0521/0521-0044.htm'),
  ('ID', 'https://legislature.idaho.gov/statutesrules/idstat/Title6/T6CH3/Section6-321/', 'https://legislature.idaho.gov/statutesrules/idstat/Title6/T6CH3/Section6-321/'),
  ('IL', 'https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=2201', 'https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=2201'),
  ('IN', 'https://iga.in.gov/laws/2024/ic/titles/32#32-31-3', 'https://iga.in.gov/laws/2024/ic/titles/32#32-31-3'),
  ('IA', 'https://www.legis.iowa.gov/law/iowaCode/sections?code=562A', 'https://www.legis.iowa.gov/law/iowaCode/sections?code=562A.12'),
  ('KS', 'https://kslegislature.gov/li_2024/b2023_24/statute/058_000_0000_chapter/058_008_0000_article/058_008_0016a_section/058_008_0016a_k/', 'https://kslegislature.gov/li_2024/b2023_24/statute/058_000_0000_chapter/058_008_0000_article/'),
  ('KY', 'https://apps.legislature.ky.gov/law/statutes/chapter.aspx?ch=383', 'https://apps.legislature.ky.gov/law/statutes/chapter.aspx?ch=383'),
  ('LA', 'https://legis.la.gov/legis/Law.aspx?d=78345', 'https://legis.la.gov/legis/Law.aspx?d=78345'),
  ('ME', 'https://legislature.maine.gov/statutes/14/title14ch709sec0.html', 'https://legislature.maine.gov/statutes/14/title14ch709sec0.html'),
  ('MD', 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=grp&section=8-203', 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=grp&section=8-203'),
  ('MA', 'https://malegislature.gov/Laws/GeneralLaws/PartIII/TitleII/Chapter186/Section15B', 'https://malegislature.gov/Laws/GeneralLaws/PartIII/TitleII/Chapter186/Section15B'),
  ('MI', 'https://legislature.mi.gov/doc.aspx?mcl-554-602', 'https://legislature.mi.gov/doc.aspx?mcl-554-602'),
  ('MN', 'https://www.revisor.mn.gov/statutes/cite/504B', 'https://www.revisor.mn.gov/statutes/cite/504B.178'),
  ('MS', 'https://law.justia.com/codes/mississippi/2022/title-89/chapter-8/', 'https://law.justia.com/codes/mississippi/2022/title-89/chapter-8/section-89-8-21/'),
  ('MO', 'https://revisor.mo.gov/main/OneChapter.aspx?chapter=535', 'https://revisor.mo.gov/main/OneSection.aspx?section=535.300'),
  ('MT', 'https://leg.mt.gov/bills/mca/title_0700/chapter_0250/parts_index.html', 'https://leg.mt.gov/bills/mca/title_0700/chapter_0250/parts_index.html'),
  ('NE', 'https://nebraskalegislature.gov/laws/statutes.php?statute=76-1416', 'https://nebraskalegislature.gov/laws/statutes.php?statute=76-1416'),
  ('NV', 'https://www.leg.state.nv.us/NRS/NRS-118A.html', 'https://www.leg.state.nv.us/NRS/NRS-118A.html#NRS118ASec240'),
  ('NH', 'https://gencourt.state.nh.us/rsa/html/540-A/540-A-5.htm', 'https://gencourt.state.nh.us/rsa/html/540-A/540-A-5.htm'),
  ('NJ', 'https://lis.njleg.state.nj.us/nxt/gateway.dll?f=templates&fn=default.htm&vid=Publish:10.1048/Enu', 'https://lis.njleg.state.nj.us/nxt/gateway.dll?f=templates&fn=default.htm&vid=Publish:10.1048/Enu'),
  ('NM', 'https://nmonesource.com/nmos/nmsa/en/nav_date.lasso', 'https://nmonesource.com/nmos/nmsa/en/nav_date.lasso'),
  ('NY', 'https://www.nysenate.gov/legislation/laws/RPP', 'https://www.nysenate.gov/legislation/laws/GOB/A7'),
  ('NC', 'https://www.ncleg.gov/Laws/GeneralStatuteSections/Chapter42', 'https://www.ncleg.gov/Laws/GeneralStatuteSections/Chapter42'),
  ('ND', 'https://www.legis.nd.gov/cencode/t47.html', 'https://www.legis.nd.gov/cencode/t47c16.pdf'),
  ('OH', 'https://codes.ohio.gov/ohio-revised-code/chapter-5321', 'https://codes.ohio.gov/ohio-revised-code/section-5321.16'),
  ('OK', 'https://www.oscn.net/applications/oscn/index.asp?ftdb=STOKST41&level=1', 'https://www.oscn.net/applications/oscn/index.asp?ftdb=STOKST41&level=1'),
  ('OR', 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html', 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html'),
  ('PA', 'https://www.legis.state.pa.us/cfdocs/legis/li/uconsCheck.cfm?yr=2014&sessInd=0&act=98', 'https://www.legis.state.pa.us/cfdocs/legis/li/uconsCheck.cfm?yr=2014&sessInd=0&act=98'),
  ('RI', 'https://webserver.rilegislature.gov/Statutes/TITLE34/34-18/34-18-19.htm', 'https://webserver.rilegislature.gov/Statutes/TITLE34/34-18/34-18-19.htm'),
  ('SC', 'https://www.scstatehouse.gov/coderev/c27.php', 'https://www.scstatehouse.gov/coderev/c27.php'),
  ('SD', 'https://sdlegislature.gov/Statutes/Codified_Laws/DisplayStatute.aspx?Type=Statute&Statute=43-32-6.1', 'https://sdlegislature.gov/Statutes/Codified_Laws/DisplayStatute.aspx?Type=Statute&Statute=43-32-6.1'),
  ('TN', 'https://law.justia.com/codes/tennessee/2022/title-66/chapter-28/', 'https://law.justia.com/codes/tennessee/2022/title-66/chapter-28/part-3/section-66-28-301/'),
  ('TX', 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm', 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm'),
  ('UT', 'https://le.utah.gov/xcode/Title57/Chapter17/57-17.html', 'https://le.utah.gov/xcode/Title57/Chapter17/57-17.html'),
  ('VT', 'https://legislature.vermont.gov/statutes/chapter/9/041', 'https://legislature.vermont.gov/statutes/chapter/9/041'),
  ('VA', 'https://law.lis.virginia.gov/vacode/title55.1/chapter12/', 'https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1226/'),
  ('WA', 'https://apps.leg.wa.gov/RCW/default.aspx?cite=59.18', 'https://apps.leg.wa.gov/RCW/default.aspx?cite=59.18.260'),
  ('WV', 'https://code.wvlegislature.gov/37-6A-1/', 'https://code.wvlegislature.gov/37-6A-1/'),
  ('WI', 'https://docs.legis.wisconsin.gov/statutes/statutes/704', 'https://docs.legis.wisconsin.gov/statutes/statutes/704/28'),
  ('WY', 'https://wyoleg.gov/statutes/compress/title01.pdf', 'https://wyoleg.gov/statutes/compress/title01.pdf')
) AS s(State, LateFeeUrl, SecurityDepositUrl)
ON t.State = s.State
WHEN MATCHED THEN
  UPDATE SET LateFeeUrl = s.LateFeeUrl, SecurityDepositUrl = s.SecurityDepositUrl, UpdatedAt = GETUTCDATE()
WHEN NOT MATCHED BY TARGET THEN
  INSERT (State, LateFeeUrl, SecurityDepositUrl, UpdatedAt)
  VALUES (s.State, s.LateFeeUrl, s.SecurityDepositUrl, GETUTCDATE());

PRINT 'StateLawSources updated.';
