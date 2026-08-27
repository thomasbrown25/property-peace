import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Grid, Stack, Tab, Tabs, Typography } from '@mui/material';
import { CalendarOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import LeadFilters from 'components/lead-crm/LeadFilters';
import LeadTable from 'components/lead-crm/LeadTable';
import LeadDetailDrawer from 'components/lead-crm/LeadDetailDrawer';
import ListingLeadSettings from 'components/lead-crm/ListingLeadSettings';
import ShowingsPanel from 'components/lead-crm/ShowingsPanel';
import listingApi from 'api/listing';
import { getLeads, getShowings } from 'api/leads';
import { getLeadErrorMessage } from 'utils/leads';

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const listingLabel = (listing) => [read(listing, 'propertyName', 'PropertyName'), read(listing, 'unitName', 'UnitName')].filter(Boolean).join(' · ') || `Listing #${read(listing, 'id', 'Id')}`;

export default function Leads() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState({ status: 'all', listingId: '', ownerUserId: '', followUp: 'all' });
  const [leads, setLeads] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [showings, setShowings] = useState([]);
  const [listings, setListings] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showingsLoading, setShowingsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showingsError, setShowingsError] = useState('');
  const [listingsError, setListingsError] = useState('');

  const namedListings = useMemo(() => listings
    .map((listing) => ({ id: read(listing, 'id', 'Id'), label: listingLabel(listing) }))
    .filter((item) => item.id), [listings]);
  const listingLabels = useMemo(() => Object.fromEntries(namedListings.map((item) => [item.id, item.label])), [namedListings]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    setLeads([]);
    try {
      const now = new Date();
      const serverFilters = { ...filters };
      if (filters.followUp === 'overdue') serverFilters.followUpToUtc = now.toISOString();
      if (filters.followUp === 'next7') {
        serverFilters.followUpFromUtc = now.toISOString();
        serverFilters.followUpToUtc = new Date(now.getTime() + 7 * 86400000).toISOString();
      }
      if (filters.followUp === 'none') serverFilters.followUpMissing = true;
      const response = await getLeads(serverFilters);
      setLeads(Array.isArray(response?.items) ? response.items : []);
      setMetrics(response?.metrics || null);
    } catch (requestError) {
      setError(getLeadErrorMessage(requestError, 'Lead workspace unavailable. Nothing is shown until access can be verified.'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadShowings = useCallback(async () => {
    setShowingsLoading(true);
    setShowingsError('');
    setShowings([]);
    try {
      const response = await getShowings();
      setShowings(Array.isArray(response) ? response : []);
    } catch (requestError) {
      setShowingsError(getLeadErrorMessage(requestError, 'Showings unavailable. Nothing is shown until access can be verified.'));
    } finally {
      setShowingsLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => {
    loadShowings();
    listingApi.getListings()
      .then((value) => {
        const unwrapped = value?.data ?? value;
        setListingsError('');
        setListings(Array.isArray(unwrapped) ? unwrapped : unwrapped?.items || []);
      })
      .catch((requestError) => {
        setListings([]);
        setListingsError(getLeadErrorMessage(requestError, 'Listings could not be loaded. Listing filters and setup are unavailable.'));
      });
  }, [loadShowings]);

  const filtersApplied = filters.followUp !== 'all' || filters.status !== 'all' || Boolean(filters.listingId || filters.ownerUserId);

  return <>
    <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Leads & Showings' }]} />
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
      <Box><Typography variant="h3">Leads & Showings</Typography><Typography color="text.secondary">Manage saved inquiries, follow-ups, showing availability, and applications.</Typography></Box>
      <Button startIcon={<ReloadOutlined />} onClick={() => { loadLeads(); loadShowings(); }} disabled={loading || showingsLoading}>Refresh</Button>
    </Stack>
    <Grid container spacing={1.5} sx={{ mb: 2 }}>{[
      ['Total inquiries', metrics?.total ?? '—', <TeamOutlined key="team" />],
      ['Showing reached', metrics?.showings ?? '—', <CalendarOutlined key="calendar" />],
      ['Inquiry → application', metrics ? `${(Number(metrics.inquiryToApplicationRate) * 100).toFixed(1)}%` : '—', <ReloadOutlined key="conversion" />]
    ].map(([label, value, icon]) => <Grid size={{ xs: 12, sm: 4 }} key={label}><Stack direction="row" justifyContent="space-between" sx={{ p: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', borderRadius: 1.5 }}><Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h4">{value}</Typography></Box>{icon}</Stack></Grid>)}</Grid>
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Lead workspace sections"><Tab id="lead-tab-0" aria-controls="lead-panel-0" label="Lead inbox" /><Tab id="lead-tab-1" aria-controls="lead-panel-1" label="Showings" /><Tab id="lead-tab-2" aria-controls="lead-panel-2" label="Listing setup" /></Tabs>
      <Box role="tabpanel" id={`lead-panel-${tab}`} aria-labelledby={`lead-tab-${tab}`} sx={{ p: { xs: 1.5, md: 2.5 }, borderTop: '1px solid', borderColor: 'divider' }}>
        {tab === 0 && <Stack spacing={2}>{listingsError && <Alert severity="warning">{listingsError}</Alert>}<LeadFilters filters={filters} onChange={setFilters} listings={namedListings} />{loading ? <Stack alignItems="center" sx={{ py: 8 }} role="status"><CircularProgress /><Typography sx={{ mt: 1 }}>Loading inquiries…</Typography></Stack> : error ? <Alert severity="error" action={<Button color="inherit" onClick={loadLeads}>Retry</Button>}><strong>Lead workspace unavailable.</strong> {error}</Alert> : !leads.length ? <Alert severity="info">{filtersApplied ? 'No leads match these filters.' : 'No inquiries yet. New public inquiries will appear here after the API accepts them.'}</Alert> : <LeadTable leads={leads} listingLabels={listingLabels} timeZone={timeZone} onOpen={setSelectedLeadId} />}</Stack>}
        {tab === 1 && <Stack spacing={2}><Box><Typography variant="h5">Showings</Typography><Typography variant="body2" color="text.secondary">Review confirmed and completed showings. Add bookable windows in Listing setup; prospects book through verified backend links.</Typography></Box><ShowingsPanel showings={showings} loading={showingsLoading} error={showingsError} timeZone={timeZone} onChanged={() => { loadShowings(); loadLeads(); }} /></Stack>}
        {tab === 2 && (listingsError ? <Alert severity="error"><strong>Listing setup unavailable.</strong> {listingsError}</Alert> : <ListingLeadSettings listings={namedListings} timeZone={timeZone} />)}
      </Box>
    </Box>
    <LeadDetailDrawer leadId={selectedLeadId} open={Boolean(selectedLeadId)} onClose={() => setSelectedLeadId(null)} showings={showings} showingsLoading={showingsLoading} showingsError={showingsError} onChanged={loadLeads} onShowingsChanged={loadShowings} timeZone={timeZone} />
  </>;
}
