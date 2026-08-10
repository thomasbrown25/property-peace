import { useEffect, useMemo, useState } from 'react';
import {
  Alert, alpha, Box, Button, Chip, CircularProgress, Collapse, Divider, Drawer,
  FormControl, IconButton, InputLabel, MenuItem, Select, Skeleton, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
  Typography, useMediaQuery, useTheme
} from '@mui/material';
import {
  AccountBalanceWalletOutlined, ArrowDownward, ArrowUpward, CalendarMonthOutlined,
  CheckCircleOutline, Close, DownloadOutlined, ErrorOutline, ExpandMore,
  InfoOutlined, ReceiptLongOutlined, WarningAmberOutlined
} from '@mui/icons-material';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { moneyCenterAPI, downloadMoneyCenterExport, moneyCenterErrorMessage } from 'api/moneyCenter';
import {
  buildMoneyCenterQuery, filterMoneyCenterItems, moneyCenterScopeToSearch,
  normalizeMoneyCenterOverview, normalizeMoneyCenterItemsResponse, formatMoneyCenterDate
} from 'utils/moneyCenter';
import { useSearchParams } from 'react-router-dom';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const PERIODS = [
  ['this-month', 'This month'], ['last-month', 'Last month'], ['ytd', 'YTD'],
  ['last-year', 'Last year'], ['custom', 'Custom']
];
const tone = { cameIn: 'success', wentOut: 'error', obligation: 'warning', excluded: 'default' };
const directionLabel = { cameIn: 'Came in', wentOut: 'Went out', obligation: 'Planned obligation', excluded: 'Excluded' };
const cardSx = { borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', height: '100%' };
const availableMoney = (value, available) => available ? money.format(value) : 'Unavailable';
const availableCount = (value, available) => available ? value : 'Unavailable';

function keyboardAction(action, disabled = false) {
  if (!action || disabled) return {};
  return {
    role: 'button',
    tabIndex: 0,
    onClick: action,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        action();
      }
    }
  };
}

function SectionTitle({ title, subtitle, action }) {
  return <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} mb={2}>
    <Box><Typography variant="h5" fontWeight={750}>{title}</Typography><Typography variant="body2" color="text.secondary">{subtitle}</Typography></Box>
    {action}
  </Stack>;
}

function MetricCard({ label, value, available = true, note, color = 'primary', icon, onClick }) {
  const displayValue = available ? money.format(value) : 'Unavailable';
  const action = available ? onClick : undefined;
  return <MainCard {...keyboardAction(action)} aria-label={`${label}: ${displayValue}. ${note}`} sx={{ ...cardSx, cursor: action ? 'pointer' : 'default', '&:hover': action ? { borderColor: `${color}.main`, transform: 'translateY(-1px)' } : {}, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 }, transition: '150ms' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
      <Box><Typography variant="overline" color="text.secondary" fontWeight={700}>{label}</Typography><Typography variant="h3" mt={0.5} color={`${color}.dark`} fontWeight={800}>{displayValue}</Typography><Typography variant="caption" color="text.secondary">{note}</Typography></Box>
      <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: (theme) => alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.1), color: `${color}.main` }}>{icon}</Box>
    </Stack>
  </MainCard>;
}

function EmptyState({ title, detail }) {
  return <Box textAlign="center" py={5} px={2}><ReceiptLongOutlined color="disabled" sx={{ fontSize: 38 }} /><Typography fontWeight={700} mt={1}>{title}</Typography><Typography variant="body2" color="text.secondary">{detail}</Typography></Box>;
}

function DetailDrawer({ item, onClose }) {
  return <Drawer anchor="right" open={Boolean(item)} onClose={onClose} PaperProps={{ 'aria-labelledby': 'money-detail-title', sx: { width: { xs: '100%', sm: 440 }, p: 3 } }}>
    {item && <><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="overline" color="text.secondary">Source record</Typography><Typography id="money-detail-title" variant="h4">{item.description || item.category}</Typography></Box><IconButton onClick={onClose} aria-label="Close detail"><Close /></IconButton></Stack>
      <Stack gap={2.25} mt={3}>
        <Box><Typography variant="caption" color="text.secondary">Amount</Typography><Typography variant="h3" color={`${tone[item.direction]}.main`}>{money.format(item.amount || 0)}</Typography></Box>
        <Chip label={directionLabel[item.direction] || item.direction} color={tone[item.direction]} sx={{ alignSelf: 'flex-start' }} />
        {[
          ['Date (UTC)', formatMoneyCenterDate(item.occurredAt)], ['Property', item.propertyName || 'Not recorded'], ['Unit', item.unitName || 'Property level'],
          ['Category', item.category], ['Counterparty', item.counterparty || 'Not recorded'], ['Method', item.method || 'Not recorded'],
          ['Reference', item.reference || 'Not recorded'], ['Treatment', item.treatment], ['Source ID', item.sourceId]
        ].map(([label, value]) => <Box key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography></Box>)}
        {item.needsAttention && <Alert severity="warning">This source record needs review.</Alert>}
        {item.sourceType === 'expense' && !item.hasReceipt && <Alert severity="info">No receipt is attached to this expense record.</Alert>}
      </Stack></>}
  </Drawer>;
}

export default function MoneyCenter() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [search, setSearch] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [propertyCatalog, setPropertyCatalog] = useState([]);
  const [itemsResponse, setItemsResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [itemsError, setItemsError] = useState('');
  const [filter, setFilter] = useState({});
  const [detail, setDetail] = useState(null);
  const [showCalc, setShowCalc] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [catalogError, setCatalogError] = useState('');
  const requestedPeriod = search.get('period') || 'this-month';
  const period = PERIODS.some(([value]) => value === requestedPeriod) ? requestedPeriod : 'this-month';
  const params = useMemo(() => buildMoneyCenterQuery(search), [search, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setItemsError(''); setCatalogError(''); setFilter({}); setDetail(null);
    const scoped = Boolean(params.propertyId || params.unitId);
    const portfolioParams = { ...params, propertyId: undefined, unitId: undefined };
    Promise.allSettled([
      moneyCenterAPI.overview(params, controller.signal),
      moneyCenterAPI.items(params, controller.signal),
      scoped ? moneyCenterAPI.overview(portfolioParams, controller.signal) : Promise.resolve(null)
    ]).then(([summary, activity, catalog]) => {
      if (controller.signal.aborted) return;
      if (summary.status === 'rejected') {
        setError(moneyCenterErrorMessage(summary.reason));
        setOverview(normalizeMoneyCenterOverview(null));
      }
      else {
        const normalized = normalizeMoneyCenterOverview(summary.value);
        setOverview(normalized);
        if (!scoped) setPropertyCatalog(normalized.properties);
      }
      if (catalog.status === 'fulfilled' && catalog.value) {
        setPropertyCatalog(normalizeMoneyCenterOverview(catalog.value).properties);
      } else if (catalog.status === 'rejected') {
        setCatalogError(moneyCenterErrorMessage(catalog.reason));
        if (summary.status === 'fulfilled') {
          setPropertyCatalog((current) => {
            const merged = new Map(current.map((property) => [Number(property.propertyId), property]));
            normalizeMoneyCenterOverview(summary.value).properties.forEach((property) => merged.set(Number(property.propertyId), property));
            return [...merged.values()];
          });
        }
      }
      if (activity.status === 'rejected') { setItemsError(moneyCenterErrorMessage(activity.reason)); setItemsResponse(null); }
      else setItemsResponse(normalizeMoneyCenterItemsResponse(activity.value));
      setLoading(false);
    });
    return () => controller.abort();
  }, [params.from, params.to, params.propertyId, params.unitId, params.upcomingDays, reloadKey]);

  const scope = (changes) => setSearch(moneyCenterScopeToSearch(search, changes), { replace: true });
  const setPeriod = (next) => {
    const updated = new URLSearchParams(search); updated.set('period', next);
    if (next !== 'custom') { updated.delete('from'); updated.delete('to'); }
    setSearch(updated, { replace: true });
  };
  const applyCustom = (key, value) => { const next = new URLSearchParams(search); next.set('period', 'custom'); next.set(key, value); setSearch(next, { replace: true }); };
  const allItems = useMemo(() => {
    const merged = new Map();
    // Recent overview records are a fallback; the dedicated items response is authoritative.
    (overview?.recentItems || []).forEach((item) => merged.set(item.sourceId, item));
    (itemsResponse?.items || []).forEach((item) => merged.set(item.sourceId, item));
    return [...merged.values()].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  }, [itemsResponse, overview?.recentItems]);
  const filteredItems = useMemo(() => filterMoneyCenterItems(allItems, filter), [allItems, filter]);
  const units = propertyCatalog.find((x) => Number(x.propertyId) === Number(params.propertyId))?.units || [];
  const attentionTotal = overview ? [
    ['uncategorizedCount', overview.attention.uncategorizedCount],
    ['missingReceiptCount', overview.attention.missingReceiptCount],
    ['overdueObligationCount', overview.attention.overdueObligationCount],
    ['settlementCount', overview.attention.settlementCount]
  ].reduce((total, [key, value]) => total + (overview.attentionAvailability[key] ? value : 0), 0) : 0;
  const attentionIsPartial = overview ? Object.values(overview.attentionAvailability).some((available) => !available) : false;
  const activityIsTruncated = Boolean(itemsResponse && itemsResponse.totalCount > itemsResponse.items.length);
  const customFrom = search.get('from') || '';
  const customThrough = search.get('to') || '';
  const customRangeValid = /^\d{4}-\d{2}-\d{2}$/.test(customFrom) && /^\d{4}-\d{2}-\d{2}$/.test(customThrough) && customFrom <= customThrough;

  const exportCsv = async () => {
    setExportError('');
    setExporting(true);
    try { downloadMoneyCenterExport(await moneyCenterAPI.export(params)); }
    catch (e) { setExportError(moneyCenterErrorMessage(e)); }
    finally { setExporting(false); }
  };

  if (loading) return <Box><PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Money Center' }]} /><Skeleton height={90} /><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>{[1, 2, 3, 4].map((x) => <Skeleton key={x} variant="rounded" height={150} />)}</Box><Stack role="status" aria-live="polite" alignItems="center" mt={5}><CircularProgress size={26} /><Typography color="text.secondary" mt={1}>Loading recorded money activity…</Typography></Stack></Box>;
  if (error && itemsError) return <Box><PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Money Center' }]} /><Alert severity="error" action={<Button color="inherit" onClick={() => setReloadKey((value) => value + 1)}>Try again</Button>}><Typography fontWeight={700}>Money Center is unavailable</Typography>{error}</Alert></Box>;

  return <Box pb={5}>
    <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Money Center' }]} />
    <Box sx={{ p: { xs: 2, md: 3 }, mb: 2.5, borderRadius: 2, color: 'common.white', background: `linear-gradient(120deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})` }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
        <Box><Typography variant="h2" color="inherit" fontWeight={800}>Know what happened with your money.</Typography><Typography sx={{ opacity: 0.86, maxWidth: 720, mt: 0.75 }}>Recorded property activity, obligations, and records that need your attention—without pretending this is a bank balance.</Typography></Box>
        <Chip icon={<CalendarMonthOutlined />} label={`${formatMoneyCenterDate(overview.from)} – ${formatMoneyCenterDate(new Date(new Date(overview.to).valueOf() - 1))}`} sx={{ bgcolor: alpha('#fff', 0.2), color: 'common.white', alignSelf: 'flex-start', '& .MuiChip-icon': { color: 'common.white' } }} />
      </Stack>
    </Box>

    <MainCard sx={{ ...cardSx, mb: 2.5 }}><Stack direction={{ xs: 'column', lg: 'row' }} gap={2} alignItems={{ lg: 'center' }}>
      <FormControl size="small" sx={{ minWidth: 155 }}><InputLabel id="money-property-label">Property</InputLabel><Select labelId="money-property-label" id="money-property" label="Property" value={params.propertyId || ''} onChange={(e) => scope({ propertyId: e.target.value || undefined })}><MenuItem value="">Portfolio</MenuItem>{propertyCatalog.map((p) => <MenuItem key={p.propertyId} value={p.propertyId}>{p.name}</MenuItem>)}</Select></FormControl>
      <FormControl size="small" sx={{ minWidth: 145 }} disabled={!params.propertyId}><InputLabel id="money-unit-label">Unit</InputLabel><Select labelId="money-unit-label" id="money-unit" label="Unit" value={params.unitId || ''} onChange={(e) => scope({ unitId: e.target.value || undefined })}><MenuItem value="">All units</MenuItem>{units.map((u) => <MenuItem key={u.unitId} value={u.unitId}>{u.name}</MenuItem>)}</Select></FormControl>
      <FormControl size="small" sx={{ minWidth: 145 }}><InputLabel id="money-period-label">Period</InputLabel><Select labelId="money-period-label" id="money-period" label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}</Select></FormControl>
      {period === 'custom' && <><TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={search.get('from') || ''} onChange={(e) => applyCustom('from', e.target.value)} /><TextField size="small" type="date" label="Through" InputLabelProps={{ shrink: true }} value={search.get('to') || ''} onChange={(e) => applyCustom('to', e.target.value)} /></>}
      <Typography variant="caption" color="text.secondary" sx={{ ml: { lg: 'auto' } }}>Dates are requested as half-open UTC boundaries.</Typography>
    </Stack></MainCard>

    {error && <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setReloadKey((value) => value + 1)}>Retry summary</Button>}><Typography fontWeight={700}>Summary totals are unavailable</Typography>{error} The activity records that loaded successfully remain available below.</Alert>}
    {period === 'custom' && !customRangeValid && <Alert severity="info" sx={{ mb: 2 }}>Enter a valid From and Through date. Until then, recorded activity for the current month through now is shown.</Alert>}
    {catalogError && <Alert severity="warning" sx={{ mb: 2 }}>The complete portfolio list could not be refreshed. Available property choices are shown. {catalogError}</Alert>}

    {overview.isPartial && <Alert severity="warning" sx={{ mb: 2 }}>Some Money Center fields were unavailable. Available recorded values are shown; missing sections are not estimated.</Alert>}
    {overview.dataQuality.warnings.length > 0 && <Alert severity="info" sx={{ mb: 2 }} icon={<InfoOutlined />}><Typography fontWeight={700}>Know the limits of this view</Typography>{overview.dataQuality.warnings.join(' ')}</Alert>}

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 2, mb: 2.5 }}>
      <MetricCard label="Came in" value={overview.cameIn} available={overview.fieldAvailability.cameIn} note={overview.fieldAvailability.cameInDetail ? `${overview.cameInDetail.count} finalized record${overview.cameInDetail.count === 1 ? '' : 's'}` : 'Record count unavailable'} color="success" icon={<ArrowUpward />} onClick={() => setFilter({ direction: 'cameIn' })} />
      <MetricCard label="Due now" value={overview.dueNow} available={overview.fieldAvailability.dueNow} note="Scheduled rent still due · view calculation" color="warning" icon={<CalendarMonthOutlined />} onClick={() => setShowCalc(true)} />
      <MetricCard label="Went out" value={overview.wentOut} available={overview.fieldAvailability.wentOut} note={overview.fieldAvailability.wentOutDetail ? `${overview.wentOutDetail.count} paid expense${overview.wentOutDetail.count === 1 ? '' : 's'}` : 'Record count unavailable'} color="error" icon={<ArrowDownward />} onClick={() => setFilter({ direction: 'wentOut' })} />
      <MetricCard label="Recorded net cash flow" value={overview.recordedNetCashFlow} available={overview.fieldAvailability.recordedNetCashFlow} note="Came in minus went out" color={overview.recordedNetCashFlow >= 0 ? 'primary' : 'error'} icon={<AccountBalanceWalletOutlined />} onClick={() => setFilter({})} />
    </Box>

    <MainCard sx={{ ...cardSx, mb: 2.5 }}><Button aria-expanded={showCalc} aria-controls="money-calculation-details" endIcon={<ExpandMore sx={{ transform: showCalc ? 'rotate(180deg)' : 'none' }} />} onClick={() => setShowCalc(!showCalc)}>How these numbers are calculated</Button><Collapse id="money-calculation-details" in={showCalc}><Divider sx={{ my: 2 }} />{overview.sectionAvailability.explanations ? <Stack gap={1}>{overview.explanations.map((x) => <Stack key={x} direction="row" gap={1}><InfoOutlined fontSize="small" color="primary" /><Typography variant="body2">{x}</Typography></Stack>)}</Stack> : <Alert severity="warning">Calculation explanations are unavailable. No explanation has been inferred.</Alert>}</Collapse></MainCard>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.4fr) minmax(320px, .6fr)' }, gap: 2.5, mb: 2.5 }}>
      <MainCard sx={cardSx}><SectionTitle title="Property and unit cash flow" subtitle="Only activity recorded directly to each property or unit; nothing is arbitrarily allocated." />{!overview.sectionAvailability.properties ? <EmptyState title="Property cash flow unavailable" detail="No property totals are inferred from the missing response section." /> : overview.properties.length === 0 ? <EmptyState title="No property cash flow recorded" detail="No came-in or went-out records were returned for this scope." /> : <Stack divider={<Divider flexItem />}>
        {overview.properties.map((property) => <Box key={property.propertyId} py={1.5}><Stack direction="row" justifyContent="space-between" aria-label={`Show ${property.name} money activity`} {...keyboardAction(() => scope({ propertyId: property.propertyId }))} sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}><Box><Typography fontWeight={750}>{property.name || 'Unnamed property'}</Typography><Typography variant="caption" color="text.secondary">{availableMoney(property.cameIn, property.fieldAvailability.cameIn)} in · {availableMoney(property.wentOut, property.fieldAvailability.wentOut)} out</Typography></Box><Typography fontWeight={750}>{availableMoney(property.recordedNetCashFlow, property.fieldAvailability.recordedNetCashFlow)}</Typography></Stack>{property.unitsAvailable ? property.units.map((unit) => <Stack key={unit.unitId} direction="row" justifyContent="space-between" ml={2} mt={1} p={1} bgcolor="action.hover" aria-label={`Show ${property.name || 'property'}, ${unit.name || 'unit'} money activity`} {...keyboardAction(() => scope({ propertyId: property.propertyId, unitId: unit.unitId }))} sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}><Typography variant="body2">{unit.name || 'Unnamed unit'}</Typography><Typography variant="body2" fontWeight={650}>{availableMoney(unit.recordedNetCashFlow, unit.fieldAvailability.recordedNetCashFlow)}</Typography></Stack>) : <Typography variant="caption" color="warning.main" ml={2}>Unit breakdown unavailable</Typography>}</Box>)}
      </Stack>}</MainCard>
      <MainCard sx={cardSx}><SectionTitle title="Needs attention" subtitle={`${attentionTotal} available review signal${attentionTotal === 1 ? '' : 's'}${attentionIsPartial ? '; some counts unavailable' : ''}`} />{[
        ['Uncategorized', overview.attention.uncategorizedCount, 'uncategorized', 'uncategorizedCount'], ['Missing receipts', overview.attention.missingReceiptCount, 'missingReceipt', 'missingReceiptCount'],
        ['Overdue obligations', overview.attention.overdueObligationCount, 'overdue', 'overdueObligationCount'], ['Settlement exceptions', overview.attention.settlementCount, 'settlement', 'settlementCount']
      ].map(([label, value, key, availabilityKey]) => {
        const available = overview.attentionAvailability[availabilityKey];
        const actionable = available && value > 0;
        return <Stack key={label} direction="row" alignItems="center" justifyContent="space-between" p={1.25} mb={1} aria-label={actionable ? `Show ${value} ${label.toLowerCase()}` : undefined} {...keyboardAction(() => setFilter({ attention: key }), !actionable)} sx={{ border: '1px solid', borderColor: actionable ? 'warning.main' : 'divider', cursor: actionable ? 'pointer' : 'default', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}><Stack direction="row" gap={1} alignItems="center">{!available ? <ErrorOutline color="disabled" /> : actionable ? <WarningAmberOutlined color="warning" /> : <CheckCircleOutline color="success" />}<Typography variant="body2" fontWeight={650}>{label}</Typography></Stack><Chip size="small" label={availableCount(value, available)} /></Stack>;
      })}</MainCard>
    </Box>

    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.5, mb: 2.5 }}>
      <MainCard sx={cardSx}><SectionTitle title="Category breakdown" subtitle="Uncategorized records stay visible until reviewed." />{!overview.sectionAvailability.categories ? <EmptyState title="Category breakdown unavailable" detail="No category totals are inferred from the missing response section." /> : overview.categories.length === 0 ? <EmptyState title="No categories in this period" detail="Category totals appear after recorded activity exists." /> : overview.categories.map((category) => <Stack key={category.category} direction="row" justifyContent="space-between" alignItems="center" p={1.25} mb={1} aria-label={`Filter activity by ${category.category}`} {...keyboardAction(() => setFilter({ category: category.category }))} sx={{ border: '1px solid', borderColor: category.category.toLowerCase() === 'uncategorized' ? 'warning.main' : 'divider', cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}><Box><Typography fontWeight={700}>{category.category}</Typography><Typography variant="caption" color="text.secondary">{category.fieldAvailability.count ? `${category.count} record${category.count === 1 ? '' : 's'}` : 'Record count unavailable'}</Typography></Box><Box textAlign="right"><Typography variant="body2" color="success.dark">{category.fieldAvailability.cameIn ? `+${money.format(category.cameIn)}` : 'Came in unavailable'}</Typography><Typography variant="body2" color="error.dark">{category.fieldAvailability.wentOut ? `−${money.format(category.wentOut)}` : 'Went out unavailable'}</Typography></Box></Stack>)}</MainCard>
      <MainCard sx={cardSx}><SectionTitle title="Recorded vs planned obligations" subtitle="Planned amounts have not gone out and are shown separately." /><Stack gap={2}><Box p={2} bgcolor="action.hover"><Typography variant="caption" color="text.secondary">Recorded net cash flow</Typography><Typography variant="h3">{overview.fieldAvailability.recordedNetCashFlow ? money.format(overview.recordedNetCashFlow) : 'Unavailable'}</Typography></Box><Box p={2} bgcolor={alpha(theme.palette.warning.main, .12)} aria-label={overview.fieldAvailability.upcomingObligations ? 'Filter activity by upcoming planned obligations' : undefined} {...keyboardAction(() => setFilter({ direction: 'obligation' }), !overview.fieldAvailability.upcomingObligations)} sx={{ cursor: overview.fieldAvailability.upcomingObligations ? 'pointer' : 'default', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}><Typography variant="caption" color="text.secondary">Upcoming planned obligations {overview.fieldAvailability.upcomingDetail ? `(${overview.upcomingDetail.count})` : '(count unavailable)'}</Typography><Typography variant="h3" color="text.primary">{overview.fieldAvailability.upcomingObligations ? money.format(overview.upcomingObligations) : 'Unavailable'}</Typography></Box><Divider /><Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={700}>Projected after upcoming</Typography><Typography variant="caption" color="text.secondary">Not a bank balance</Typography></Box><Typography variant="h4">{overview.fieldAvailability.projectedAfterUpcoming ? money.format(overview.projectedAfterUpcoming) : 'Unavailable'}</Typography></Stack></Stack></MainCard>
    </Box>

    <MainCard sx={{ ...cardSx, mb: 2.5 }}><Box aria-live="polite"><SectionTitle title="Activity drill-down" subtitle={Object.keys(filter).length ? `${filteredItems.length} matching loaded source records` : activityIsTruncated ? `Showing ${itemsResponse.items.length} of ${itemsResponse.totalCount} source records` : `${itemsResponse?.totalCount ?? allItems.length} source records`} action={Object.keys(filter).length ? <Button onClick={() => setFilter({})}>Clear filter</Button> : null} /></Box>{itemsError && <Alert severity="warning" sx={{ mb: 2 }}>Full activity could not be loaded: {itemsError} Only recent overview items are shown below, when available.</Alert>}{itemsResponse?.isPartial && !itemsError && <Alert severity="warning" sx={{ mb: 2 }}>Some activity response fields were unavailable. Only the source records received are shown.</Alert>}{activityIsTruncated && <Alert severity="info" sx={{ mb: 2 }}>This drill-down is limited to {itemsResponse.items.length} records. The accountant-review CSV includes every source record in the selected period.</Alert>}{filteredItems.length === 0 ? <EmptyState title={itemsError ? 'No recent activity available' : 'No matching activity'} detail={itemsError ? 'The complete activity request failed, so this is not confirmation that the period has no records.' : 'There are no real source records for this selection and period.'} /> : mobile ? <Stack gap={1}>{filteredItems.map((item) => <Box key={item.sourceId} p={1.5} border="1px solid" borderColor="divider" aria-label={`Open details for ${item.description || item.category || 'money activity'}`} {...keyboardAction(() => setDetail(item))} sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>{item.description || item.category}</Typography><Typography color={`${tone[item.direction]}.main`} fontWeight={700}>{money.format(item.amount)}</Typography></Stack><Typography variant="caption" color="text.secondary">{formatMoneyCenterDate(item.occurredAt)} · {item.propertyName}{item.unitName ? ` · ${item.unitName}` : ''}</Typography></Box>)}</Stack> : <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Property / unit</TableCell><TableCell>Record</TableCell><TableCell>Treatment</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead><TableBody>{filteredItems.map((item) => <TableRow hover key={item.sourceId} aria-label={`Open details for ${item.description || item.category || 'money activity'}`} {...keyboardAction(() => setDetail(item))} sx={{ cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}><TableCell>{formatMoneyCenterDate(item.occurredAt)}</TableCell><TableCell>{item.propertyName}<Typography variant="caption" display="block" color="text.secondary">{item.unitName || 'Property level'}</Typography></TableCell><TableCell>{item.description || item.category}{item.needsAttention && <Tooltip title="Needs attention"><ErrorOutline color="warning" fontSize="small" sx={{ ml: 1, verticalAlign: 'middle' }} /></Tooltip>}</TableCell><TableCell><Chip size="small" label={directionLabel[item.direction] || item.treatment} color={tone[item.direction]} /></TableCell><TableCell align="right"><Typography fontWeight={700}>{money.format(item.amount)}</Typography></TableCell></TableRow>)}</TableBody></Table></TableContainer>}</MainCard>

    <MainCard sx={cardSx}><SectionTitle title="Tax preparation checklist" subtitle="Preparation signals from operational records—not a tax-readiness or filing determination." action={<Button variant="contained" startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadOutlined />} disabled={exporting || (period === 'custom' && !customRangeValid)} onClick={exportCsv}>Accountant-review CSV</Button>} />{exportError && <Alert severity="error" sx={{ mb: 2 }}>The CSV could not be prepared: {exportError}</Alert>}<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>{!overview.sectionAvailability.taxPreparationChecklist ? <EmptyState title="Tax preparation checklist unavailable" detail="Checklist status is not inferred from other Money Center values." /> : overview.taxPreparationChecklist.map((item) => <Box key={item.key} p={1.5} border="1px solid" borderColor={item.complete ? 'success.light' : 'warning.light'}><Stack direction="row" gap={1}>{item.complete ? <CheckCircleOutline color="success" /> : <WarningAmberOutlined color="warning" />}<Box><Typography fontWeight={700}>{item.label}</Typography><Typography variant="body2" color="text.secondary">{item.explanation}</Typography>{item.attentionCount > 0 && <Chip size="small" color="warning" label={`${item.attentionCount} to review`} sx={{ mt: 1 }} />}</Box></Stack></Box>)}</Box><Alert severity="info" sx={{ mt: 2 }}>The CSV contains source IDs and cash-basis treatment for professional review. Verify it against source documents and external statements.</Alert></MainCard>
    <DetailDrawer item={detail} onClose={() => setDetail(null)} />
  </Box>;
}
