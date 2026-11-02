import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, FormControl, InputAdornment, MenuItem, Paper, Select, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { SearchOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import axiosServices from 'utils/axios';
import useFetchTenants from 'hooks/useFetchTenants';
import PropertyOverview from './PropertyOverview';
import DocumentsTab from './DocumentsTab';
import IncomeTab from './IncomeTab';
import PropertyOccupancyTab from './PropertyOccupancyTab';
import { filterPropertyRows, maintenanceTableColumns, maintenanceUnitName, scopePropertyRecords } from './propertyRecords.mjs';

const read = (row, key) => row?.[key] ?? row?.[key[0].toUpperCase() + key.slice(1)];
const displayDate = value => value ? new Date(value).toLocaleDateString() : '—';
const leaseStatus = lease => {
  if ([0, 'NotSent', 'notsent'].includes(read(lease, 'signatureStatus'))) return 'Draft';
  const now = new Date();
  if (read(lease, 'endDate') && new Date(read(lease, 'endDate')) < now) return 'Expired';
  if (read(lease, 'startDate') && new Date(read(lease, 'startDate')) > now) return 'Scheduled';
  return 'Active';
};
const tenantName = tenant => `${read(tenant, 'firstname') || ''} ${read(tenant, 'lastname') || ''}`.trim() || read(tenant, 'name') || 'Unnamed tenant';

function RecordsTable({ label, rows, columns, searchFields, getStatus, highlightStatus, emptyMessage, loading, error }) {
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
          inputProps={{ 'aria-label': `Search ${label.toLowerCase()}` }} sx={{ flex: 1, maxWidth: { sm: 360 } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }} />
        <FormControl size="small" sx={{ minWidth: 165 }}>
          <Select value={status} onChange={e => setStatus(e.target.value)} inputProps={{ 'aria-label': `Filter ${label.toLowerCase()} by status` }}>
            <MenuItem value="all">All statuses</MenuItem>
            {statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>
      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <CircularProgress aria-label={`Loading ${label.toLowerCase()}`} /> : (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <TableContainer sx={{ overflowX: 'auto', minHeight: { xs: 260, sm: 360 } }}>
            <Table size="small" aria-label={label}>
              <TableHead><TableRow>{columns.map(column => <TableCell key={column.label}>{column.label}</TableCell>)}</TableRow></TableHead>
              <TableBody>
                {filtered.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage).map((row, index) => (
                  <TableRow hover key={read(row, 'id') ?? index} onClick={event => { if (event.target.closest('a')) return; if (detailColumn && read(row, 'id')) navigate(detailColumn.link(row)); }}
                    onKeyDown={event => { if (event.target !== event.currentTarget) return; if ((event.key === 'Enter' || event.key === ' ') && detailColumn && read(row, 'id')) { event.preventDefault(); navigate(detailColumn.link(row)); } }}
                    tabIndex={detailColumn && read(row, 'id') ? 0 : undefined} role={detailColumn && read(row, 'id') ? 'link' : undefined}
                    aria-label={detailColumn && read(row, 'id') ? `View ${label.toLowerCase()} ${detailColumn.value(row)}` : undefined}
                    sx={theme => ({
                      ...(detailColumn && read(row, 'id') ? { cursor: 'pointer' } : {}),
                      ...(highlightStatus && getStatus(row) === highlightStatus ? {
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        '&.MuiTableRow-hover:hover': { bgcolor: alpha(theme.palette.success.main, 0.16) }
                      } : {})
                    })}>
                    {columns.map(column => <TableCell key={column.label} sx={{ whiteSpace: 'nowrap' }}>
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
  { label: 'Status', value: leaseStatus }
];
const tenantColumns = [
  { label: 'Tenant', value: tenantName, link: row => `/landlord/tenants/${read(row, 'id')}` },
  { label: 'Unit', value: row => read(row, 'unitName') || '—' },
  { label: 'Email', value: row => read(row, 'email') || '—' },
  { label: 'Lease', value: row => read(row, 'leaseId') ? `#${read(row, 'leaseId')}` : '—' },
  { label: 'Status', value: row => read(row, 'isActive') === false ? 'Inactive' : 'Active' }
];

export default function PropertyRecordsTabs({ property, propertyId, rentRecords, maintenances, historyMaintenances, maintenanceError, tab, onTabChange }) {
  const [leases, setLeases] = useState([]);
  const [leaseLoading, setLeaseLoading] = useState(false);
  const [leaseError, setLeaseError] = useState('');
  const { tenants, isLoading: tenantsLoading } = useFetchTenants();

  useEffect(() => {
    if (tab !== 'leases' || !propertyId) return;
    let cancelled = false;
    setLeaseLoading(true);
    setLeaseError('');
    setLeases([]);
    axiosServices.get(`/api/lease/property/${propertyId}`).then(response => {
      if (cancelled) return;
      if (!response.data?.success || !Array.isArray(response.data.data)) throw new Error('Leases could not be loaded.');
      setLeases(response.data.data);
    }).catch(() => { if (!cancelled) setLeaseError('Leases could not be loaded. Try again later.'); })
      .finally(() => { if (!cancelled) setLeaseLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId, tab, property]);

  const scopedTenants = useMemo(() => scopePropertyRecords(tenants, propertyId), [tenants, propertyId]);
  const scopedMaintenance = useMemo(() => scopePropertyRecords([...(maintenances || []), ...(historyMaintenances || [])], propertyId), [maintenances, historyMaintenances, propertyId]);
  const tabs = ['overview', 'leases', 'tenants', 'maintenances', 'finances', 'occupancy', 'documents'];
  const active = tabs.includes(tab) ? tab : 'overview';
  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={active} onChange={(_, value) => onTabChange(value)} variant="scrollable" scrollButtons="auto" aria-label="Property sections">
          <Tab value="overview" label="Overview" /><Tab value="leases" label="Leases" /><Tab value="tenants" label="Tenants" />
          <Tab value="maintenances" label="Maintenances" /><Tab value="finances" label="Finances" /><Tab value="occupancy" label="Occupancy" /><Tab value="documents" label="Documents" />
        </Tabs>
      </Box>
      {active === 'overview' && <PropertyOverview property={property} propertyId={propertyId} rentRecords={rentRecords} />}
      {active === 'leases' && <RecordsTable label="Leases" rows={leases} columns={leaseColumns} searchFields={row => [read(row, 'leaseNickname'), read(row, 'unitName'), read(row, 'id')]} getStatus={leaseStatus} highlightStatus="Active" emptyMessage="No leases for this property." loading={leaseLoading} error={leaseError} />}
      {active === 'tenants' && <RecordsTable label="Tenants" rows={scopedTenants} columns={tenantColumns} searchFields={row => [tenantName(row), read(row, 'email'), read(row, 'unitName')]} getStatus={row => read(row, 'isActive') === false ? 'Inactive' : 'Active'} emptyMessage="No tenants for this property." loading={tenantsLoading} />}
      {active === 'maintenances' && <RecordsTable label="Maintenances" rows={scopedMaintenance} columns={maintenanceTableColumns(property)} searchFields={row => [read(row, 'title'), maintenanceUnitName(row, property), read(row, 'priority')]} getStatus={row => read(row, 'status')} emptyMessage="No maintenance requests for this property." error={maintenanceError} />}
      {active === 'finances' && <IncomeTab propertyId={propertyId} property={property} />}
      {active === 'occupancy' && <PropertyOccupancyTab propertyId={propertyId} property={property} />}
      {active === 'documents' && <DocumentsTab property={property} />}
    </Box>
  );
}
