import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Alert, Box, CircularProgress, FormControl, InputAdornment, Menu, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Button } from '@mui/material';
import { useDispatch } from 'react-redux';
import { useDrawer } from 'contexts/DrawerContext';
import { setProperty } from 'store/property/property.action';
import TenantAddDrawer from 'components/drawers/TenantAddDrawer';
import ApplicationAddDrawer from 'components/drawers/ApplicationAddDrawer';
import { Link, useNavigate } from 'react-router-dom';
import axiosServices from 'utils/axios';
import useFetchTenants from 'hooks/useFetchTenants';
import listingApi from 'api/listing';
import { getApplicationsByProperty } from 'api/application';
import { isActiveListing } from 'pages/landlord/listing-readiness.mjs';
import { isLeaseDraft } from 'utils/leaseStatus';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import PropertyOverview from './PropertyOverview';
import DocumentsTab from './DocumentsTab';
import PaymentsTab from './PaymentsTab';
import ExpensesTab from './ExpensesTab';
import PropertyOccupancyTab from './PropertyOccupancyTab';
import PropertyLeaseActions from './PropertyLeaseActions';
import { filterPropertyRows, maintenanceTableColumns, maintenanceUnitName, scopePropertyRecords } from './propertyRecords.mjs';

const read = (row, key) => row?.[key] ?? row?.[key[0].toUpperCase() + key.slice(1)];
const displayDate = value => value ? new Date(value).toLocaleDateString() : '—';
const leaseStatus = lease => {
  if (isLeaseDraft(lease) || [0, 'NotSent', 'notsent'].includes(read(lease, 'signatureStatus'))) return 'Draft';
  const now = new Date();
  if (read(lease, 'endDate') && new Date(read(lease, 'endDate')) < now) return 'Expired';
  if (read(lease, 'startDate') && new Date(read(lease, 'startDate')) > now) return 'Scheduled';
  return 'Active';
};
const tenantName = tenant => `${read(tenant, 'firstname') || ''} ${read(tenant, 'lastname') || ''}`.trim() || read(tenant, 'name') || 'Unnamed tenant';

function RecordsTable({ label, rows, columns: allColumns, showUnitColumn = true, searchFields, getStatus, emptyMessage, loading, error, onAdd, addLabel }) {
  const columns = showUnitColumn ? allColumns : allColumns.filter(column => column.label !== 'Unit');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const navigate = useNavigate();
  const detailColumn = columns.find(column => column.link);
  const statuses = useMemo(() => [...new Set(rows.map(getStatus).filter(Boolean))].sort(), [rows, getStatus]);
  const filtered = useMemo(() => filterPropertyRows(rows, query, status, searchFields, getStatus), [rows, query, status, searchFields, getStatus]);
  useEffect(() => setPage(0), [query, status, rowsPerPage, label]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1));
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);

  return (
    <Box component="section" aria-label={`${label} table`}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ mb: 2 }}>
        <TextField size="small" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`}
          inputProps={{ 'aria-label': `Search ${label.toLowerCase()}` }} fullWidth sx={{ flex: 1, minWidth: 0 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} />
        <FormControl size="small" sx={{ minWidth: 165 }}>
          <Select value={status} onChange={e => setStatus(e.target.value)} inputProps={{ 'aria-label': `Filter ${label.toLowerCase()} by status` }}>
            <MenuItem value="all">All statuses</MenuItem>
            {statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </Select>
        </FormControl>
        {onAdd && <Button variant="contained" startIcon={<PlusOutlined />} onClick={onAdd}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'none' }}>{addLabel}</Button>}
      </Stack>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <Box sx={{ minHeight: { xs: 260, sm: 360 }, display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label={`Loading ${label.toLowerCase()}`} />
      </Box> : (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <TableContainer sx={{ overflowX: 'auto', minHeight: { xs: 260, sm: 360 } }}>
            <Table size="small" aria-label={label}>
              <TableHead><TableRow>{columns.map(column => <TableCell key={column.label}>{column.label}</TableCell>)}</TableRow></TableHead>
              <TableBody sx={{ '&& .MuiTableRow-root > .MuiTableCell-body': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                {filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage).map((row, index) => (
                  <TableRow hover key={read(row, 'id') ?? index} onClick={event => { if (!event.currentTarget.contains(event.target) || event.target.closest('a, button, input, [role="menuitem"]')) return; if (detailColumn && read(row, 'id')) navigate(detailColumn.link(row)); }}
                    onKeyDown={event => { if (event.target !== event.currentTarget) return; if ((event.key === 'Enter' || event.key === ' ') && detailColumn && read(row, 'id')) { event.preventDefault(); navigate(detailColumn.link(row)); } }}
                    tabIndex={detailColumn && read(row, 'id') ? 0 : undefined} role={detailColumn && read(row, 'id') ? 'link' : undefined}
                    aria-label={detailColumn && read(row, 'id') ? `View ${label.toLowerCase()} ${detailColumn.value(row)}` : undefined}
                    sx={{ ...(detailColumn && read(row, 'id') ? { cursor: 'pointer' } : {}) }}>
                    {columns.map(column => <TableCell key={column.label} sx={{ whiteSpace: 'nowrap', ...column.sx?.(row) }}>
                      {column.link && read(row, 'id') ? <Typography component={Link} to={column.link(row)} sx={{ color: 'primary.main', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' } }}>{column.value(row)}</Typography> : column.value(row)}
                    </TableCell>)}
                  </TableRow>
                ))}
                {!filtered.length && <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>{rows.length ? 'No matching records.' : emptyMessage}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={filtered.length} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }} rowsPerPageOptions={[10, 25, 50]} />
        </Paper>
      )}
    </Box>
  );
}

const leaseColumns = [
  { label: 'Lease', value: row => read(row, 'leaseNickname') || `Lease #${read(row, 'id')}`, link: row => `/landlord/leases/${read(row, 'id')}` },
  { label: 'Unit', value: row => read(row, 'unitName') || '—' },
  { label: 'Start', value: row => displayDate(read(row, 'startDate')) },
  { label: 'End', value: row => displayDate(read(row, 'endDate')) },
  { label: 'Status', value: leaseStatus, sx: row => ({ color: leaseStatus(row) === 'Active' ? 'success.main' : 'text.primary' }) }
];
const tenantColumns = [
  { label: 'Tenant', value: tenantName, link: row => `/landlord/tenants/${read(row, 'id')}` },
  { label: 'Unit', value: row => read(row, 'unitName') || '—' },
  { label: 'Email', value: row => read(row, 'email') || '—' },
  { label: 'Lease', value: row => read(row, 'leaseId') ? `#${read(row, 'leaseId')}` : '—' },
  { label: 'Status', value: row => read(row, 'isActive') === false ? 'Inactive' : 'Active' }
];

const listingStatus = row => isActiveListing(row) ? 'Active' : 'Draft';
const applicationStatuses = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Withdrawn', 'On Hold', 'Lease Signed', 'Pending'];
const applicationStatus = row => {
  const status = read(row, 'status');
  return applicationStatuses[status] ?? String(status ?? 'Unknown').replace(/([a-z])([A-Z])/g, '$1 $2');
};
const applicantName = row => `${read(row, 'firstName') || ''} ${read(row, 'lastName') || ''}`.trim() || 'Unnamed applicant';
const listingColumns = [
  { label: 'Listing', value: row => read(row, 'propertyName') || `Listing #${read(row, 'id')}`, link: row => `/landlord/listings/${read(row, 'id')}` },
  { label: 'Unit', value: row => read(row, 'unitName') || '—' },
  { label: 'Monthly rent', value: row => read(row, 'monthlyRent') == null ? '—' : Number(read(row, 'monthlyRent')).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) },
  { label: 'Available', value: row => displayDate(read(row, 'dateAvailable') ?? read(row, 'availableDate')) },
  { label: 'Status', value: listingStatus }
];
const applicationColumns = [
  { label: 'Applicant', value: applicantName, link: row => `/landlord/listings?tab=applications&applicationId=${read(row, 'id')}` },
  { label: 'Unit', value: row => read(row, 'unitName') || '—' },
  { label: 'Email', value: row => read(row, 'email') || '—' },
  { label: 'Move-in date', value: row => displayDate(read(row, 'desiredMoveInDate')) },
  { label: 'Status', value: applicationStatus }
];

function PropertyLeasingRecords({ kind, propertyId, showUnitColumn, onAdd }) {
  const [result, setResult] = useState({ propertyId: null, rows: [], loading: true, error: '' });
  const label = kind === 'listings' ? 'Listings' : 'Applications';
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setResult({ propertyId, rows: [], loading: true, error: '' });
    const request = kind === 'listings' ? listingApi.getListingsByPropertyId(propertyId) : getApplicationsByProperty(propertyId);
    request.then(response => {
      if (!response?.success || !Array.isArray(response.data)) throw new Error('Records could not be loaded.');
      if (!cancelled) setResult({ propertyId, rows: response.data, loading: false, error: '' });
    }).catch(() => {
      if (!cancelled) setResult({ propertyId, rows: [], loading: false, error: `${label} could not be loaded. Try again later.` });
    });
    return () => { cancelled = true; };
  }, [propertyId, kind, label]);
  const current = result.propertyId === propertyId;
  return <RecordsTable label={label} showUnitColumn={showUnitColumn} onAdd={onAdd} addLabel={kind === 'listings' ? 'Add listing' : 'Add application'} rows={current ? result.rows : []}
    columns={kind === 'listings' ? listingColumns : applicationColumns}
    searchFields={row => kind === 'listings' ? [read(row, 'propertyName'), read(row, 'unitName'), read(row, 'listingNumber'), read(row, 'id')] : [applicantName(row), read(row, 'email'), read(row, 'unitName')]}
    getStatus={kind === 'listings' ? listingStatus : applicationStatus}
    emptyMessage={`No ${kind} for this property.`} loading={!!propertyId && (!current || result.loading)} error={current ? result.error : ''} />;
}

export default function PropertyRecordsTabs({ property, propertyId, rentRecords, rentLoading, rentError, maintenances, historyMaintenances, maintenanceError, tab, onTabChange, onLeaseDeleted }) {
  const showUnitColumn = !isDetachedSingleUnitType(read(property, 'propertyType'));
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const navigate = useNavigate();
  const addRecord = kind => {
    dispatch(setProperty(property));
    if (kind === 'leases') navigate(`/landlord/leases/builder?propertyId=${encodeURIComponent(propertyId)}`);
    else if (kind === 'tenants') drawer.openTenantAddDrawer();
    else if (kind === 'maintenances') drawer.openMaintenanceAddDrawer({ propertyId });
    else if (kind === 'listings') drawer.openListingAddDrawer();
    else if (kind === 'applications') drawer.openApplicationAddDrawer();
  };
  const [leases, setLeases] = useState([]);
  const [leaseLoading, setLeaseLoading] = useState(false);
  const [leaseError, setLeaseError] = useState('');
  const handleLeaseDeleted = async id => {
    setLeases(current => current.filter(lease => String(read(lease, 'id')) !== String(id)));
    await onLeaseDeleted?.(id);
  };
  const propertyLeaseColumns = [...leaseColumns, {
    label: 'Actions', value: lease => <PropertyLeaseActions key={`${propertyId}-${read(lease, 'id')}`} lease={lease} onDeleted={handleLeaseDeleted} />
  }];
  const { tenants, isLoading: tenantsLoading } = useFetchTenants();

  useEffect(() => {
    if (tab !== 'leases' || !propertyId) return;
    let cancelled = false;
    setLeaseLoading(true);
    setLeaseError('');
    setLeases([]);
    axiosServices.get(`/api/lease/property/${propertyId}/all`).then(response => {
      if (cancelled) return;
      if (!response.data?.success || !Array.isArray(response.data.data)) throw new Error('Leases could not be loaded.');
      setLeases(response.data.data);
    }).catch(() => { if (!cancelled) setLeaseError('Leases could not be loaded. Try again later.'); })
      .finally(() => { if (!cancelled) setLeaseLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId, tab, property]);

  const scopedTenants = useMemo(() => scopePropertyRecords(tenants, propertyId), [tenants, propertyId]);
  const scopedMaintenance = useMemo(() => scopePropertyRecords([...(maintenances || []), ...(historyMaintenances || [])], propertyId), [maintenances, historyMaintenances, propertyId]);
  const tabs = ['overview', 'leases', 'tenants', 'payments', 'maintenances', 'listings', 'applications', 'expenses', 'documents', 'settings'];
  const requestedTab = tab === 'finances' ? 'payments' : tab;
  const active = tabs.includes(requestedTab) ? requestedTab : 'overview';
  // Keep Tenants and Leases separate: each has its own search, actions and URL tab id.
  const moreSections = [
    { id: 'listings', label: 'Listings' }, { id: 'applications', label: 'Applications' },
    { id: 'expenses', label: 'Expenses' }, { id: 'documents', label: 'Documents' },
    { id: 'settings', label: 'Settings' }
  ];
  const activeMore = moreSections.find(section => section.id === active);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const previousTab = useRef({ propertyId, active });
  const reduceMotion = useReducedMotion();
  const direction = previousTab.current.propertyId === propertyId
    ? Math.sign(tabs.indexOf(active) - tabs.indexOf(previousTab.current.active)) || 1
    : 1;
  useEffect(() => { previousTab.current = { propertyId, active }; }, [propertyId, active]);
  const panelMotion = {
    enter: side => ({ x: side * 36, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: side => ({ x: side * -36, opacity: 0, position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' })
  };
  return (
    <Box sx={{ mt: 0 }}>
      <Box sx={theme => ({ mt: 0.5, mb: 2.5, position: 'relative', isolation: 'isolate', width: '100%',
        '&::after': { content: '""', position: 'absolute', right: 0, bottom: 0, left: 0, height: '1px',
          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.22 : 0.12), pointerEvents: 'none', zIndex: 0 },
        '& .MuiTabs-root': { minHeight: 42 },
        '& .MuiTab-root': { minHeight: 42, px: 1.25, mr: 1.5, borderRadius: 1.5, textTransform: 'none',
          fontSize: '0.875rem', fontWeight: 700, color: 'text.secondary',
          transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], { duration: theme.transitions.duration.shorter }),
          '&:hover': { color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
            boxShadow: theme.palette.mode === 'dark' ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.24)}` : 'none' },
          '&.Mui-selected': { color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.04) } },
        '& .MuiTabs-indicator': { zIndex: 1, height: 2, borderRadius: 2, backgroundColor: 'primary.main' }
      })}>
        <Tabs value={activeMore ? 'more' : active} onChange={(_, value) => { if (value !== 'more') onTabChange(value); }} variant="scrollable" scrollButtons="auto" aria-label="Property sections">
          <Tab value="overview" label="Overview" /><Tab value="tenants" label="Tenants" /><Tab value="leases" label="Leases" /><Tab value="payments" label="Payments" />
          <Tab value="maintenances" label="Maintenance" />
          <Tab id="property-more-tab" value="more" label={activeMore ? `More: ${activeMore.label}` : 'More'}
            aria-haspopup="menu" aria-controls={moreAnchor ? 'property-more-menu' : undefined} aria-expanded={Boolean(moreAnchor)}
            onClick={event => setMoreAnchor(event.currentTarget)}
            onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setMoreAnchor(event.currentTarget); } }} />
        </Tabs>
        <Menu id="property-more-menu" anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}
          MenuListProps={{ 'aria-labelledby': 'property-more-tab' }}>
          {moreSections.map(section => <MenuItem key={section.id} selected={active === section.id}
            onClick={() => { setMoreAnchor(null); onTabChange(section.id); }}>{section.label}</MenuItem>)}
        </Menu>
      </Box>
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence initial={false} custom={direction}>
          <motion.div key={`${propertyId}-${active}`} custom={direction} variants={panelMotion}
            initial={reduceMotion ? false : 'enter'} animate="center" exit={reduceMotion ? { opacity: 0, position: 'absolute', top: 0, left: 0, right: 0, pointerEvents: 'none' } : 'exit'}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeInOut' }}
            role="tabpanel" aria-label={`${active[0].toUpperCase()}${active.slice(1)}`}>
      {active === 'overview' && <PropertyOverview property={property} propertyId={propertyId} rentRecords={rentRecords} />}
      {active === 'leases' && <RecordsTable label="Leases" showUnitColumn={showUnitColumn} onAdd={() => addRecord('leases')} addLabel="Create lease" rows={leases} columns={propertyLeaseColumns} searchFields={row => [read(row, 'leaseNickname'), read(row, 'unitName'), read(row, 'id')]} getStatus={leaseStatus} emptyMessage="No leases for this property." loading={leaseLoading} error={leaseError} />}
      {active === 'tenants' && <RecordsTable label="Tenants" showUnitColumn={showUnitColumn} onAdd={() => addRecord('tenants')} addLabel="Add tenant" rows={scopedTenants} columns={tenantColumns} searchFields={row => [tenantName(row), read(row, 'email'), read(row, 'unitName')]} getStatus={row => read(row, 'isActive') === false ? 'Inactive' : 'Active'} emptyMessage="No tenants for this property." loading={tenantsLoading} />}
      {active === 'maintenances' && <RecordsTable label="Maintenance" onAdd={() => addRecord('maintenances')} addLabel="Add maintenance" rows={scopedMaintenance} columns={maintenanceTableColumns(property)} searchFields={row => [read(row, 'title'), maintenanceUnitName(row, property), read(row, 'priority')]} getStatus={row => read(row, 'status')} emptyMessage="No maintenance requests for this property." error={maintenanceError} />}
      {active === 'listings' && <PropertyLeasingRecords key="listings" kind="listings" propertyId={propertyId} showUnitColumn={showUnitColumn} onAdd={() => addRecord('listings')} />}
      {active === 'applications' && <PropertyLeasingRecords key="applications" kind="applications" propertyId={propertyId} showUnitColumn={showUnitColumn} onAdd={() => addRecord('applications')} />}
      {active === 'occupancy' && <PropertyOccupancyTab propertyId={propertyId} property={property} />}
      {active === 'payments' && <PaymentsTab propertyId={propertyId} property={property} rentRecords={rentRecords} rentLoading={rentLoading} rentError={rentError} />}
      {active === 'expenses' && <ExpensesTab propertyId={propertyId} property={property} />}
      {active === 'documents' && <DocumentsTab property={property} />}
      {active === 'settings' && <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h5" sx={{ mb: 0.5 }}>Property details</Typography>
            <Typography color="text.secondary">Manage this property's name, address, and details.</Typography>
          </Box>
          <Button variant="outlined" disabled={!read(property, 'id')} onClick={() => {
            dispatch(setProperty(property));
            drawer.openPropertyEditDrawer();
          }} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}>Edit property</Button>
        </Stack>
      </Paper>}
          </motion.div>
        </AnimatePresence>
      </Box>
      {drawer.isOpenTenantAdd && <TenantAddDrawer />}
      {drawer.isOpenApplicationAdd && <ApplicationAddDrawer />}
    </Box>
  );
}
