import { useEffect, useState } from 'react';
import { PlusOutlined, SearchOutlined, DownOutlined } from '@ant-design/icons';
import {
  alpha, Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, InputAdornment, MenuItem, OutlinedInput, Pagination, Select, Stack, Typography, useTheme
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'utils/axios';
import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { managementPageHeaderActionSx } from 'components/headers/managementPageHeaderStyles';

const statuses = ['Held', 'PendingPayment', 'Processing', 'Confirmed', 'Expired', 'Failed', 'RefundRequired', 'Refunded', 'Disputed'];
const label = (status) => status?.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Unknown';
const date = (value) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const money = (cents, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(cents / 100);

export default function BookingsPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setPage(1); }, [query, status, period]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    axios.get('/api/short-stay/bookings', {
      params: { page, ...(query && { search: query }), ...(status !== 'all' && { status }), ...(period !== 'all' && { period }) },
      signal: controller.signal
    }).then(({ data }) => setResult(data)).catch((err) => {
      if (!controller.signal.aborted) setError(err.response?.data?.message || 'Bookings could not be loaded. Try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, query, status, period, reload]);
  const reset = () => { setSearch(''); setQuery(''); setStatus('all'); setPeriod('all'); setPage(1); };
  const filtered = Boolean(search || status !== 'all' || period !== 'all');
  const columns = 'minmax(180px, 1.4fr) minmax(150px, 1.1fr) minmax(170px, 1fr) minmax(110px, .7fr) minmax(95px, .6fr)';

  return <Box sx={{ pb: 3 }}>
    <ManagementPageHeader title="Bookings" showBreadcrumbs={false} actions={
      <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => setAddOpen(true)} sx={managementPageHeaderActionSx}>Add booking</Button>
    } />
    <Box sx={{ mb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1}>
        <OutlinedInput size="small" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Search guests, properties, units, or booking codes" inputProps={{ 'aria-label': 'Search bookings' }}
          startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>}
          sx={{ flex: 1, minWidth: { md: 260 }, borderRadius: 1.75 }} />
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }}>
          <Select size="small" value={status} onChange={(event) => setStatus(event.target.value)} IconComponent={DownOutlined}
            inputProps={{ 'aria-label': 'Filter booking status' }} sx={{ minWidth: 160, borderRadius: 1.75 }}>
            <MenuItem value="all">All statuses</MenuItem>
            {statuses.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
          </Select>
          <Select size="small" value={period} onChange={(event) => setPeriod(event.target.value)} IconComponent={DownOutlined}
            inputProps={{ 'aria-label': 'Filter booking dates' }} sx={{ minWidth: 150, borderRadius: 1.75 }}>
            <MenuItem value="all">All dates</MenuItem><MenuItem value="upcoming">Upcoming stays</MenuItem><MenuItem value="past">Past stays</MenuItem>
          </Select>
        </Stack>
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.4 }}>
        <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>{result.total} bookings</Typography>
        {filtered && <Button size="small" onClick={reset} sx={{ textTransform: 'none' }}>Reset view</Button>}
      </Stack>
    </Box>
    {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setReload((value) => value + 1)}>Retry</Button>}>{error}</Alert>}
    <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3,
      boxShadow: `0 8px 28px ${alpha('#061e35', 0.055)}`, overflow: 'hidden' }}>
      <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: columns, gap: 2, px: 2, py: 1.15,
        bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
        {['Guest', 'Property / unit', 'Stay', 'Status', 'Total'].map((heading) => <Typography key={heading}
          sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{heading}</Typography>)}
      </Box>
      {loading ? <Stack alignItems="center" spacing={1} sx={{ py: 7 }}><CircularProgress size={26} /><Typography color="text.secondary">Loading bookings…</Typography></Stack>
        : error ? <Typography sx={{ p: 4, color: 'text.secondary', textAlign: 'center' }}>Booking list unavailable.</Typography>
        : result.items.length === 0 ? <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={700}>{filtered ? 'No bookings match this view' : 'No bookings yet'}</Typography>
          <Typography color="text.secondary">{filtered ? 'Try a different search or reset the filters.' : 'Short-stay reservations will appear here when they are created.'}</Typography>
          {filtered && <Button variant="outlined" onClick={reset}>Reset filters</Button>}
        </Stack> : result.items.map((booking) => <Box key={booking.id} role="button" tabIndex={0}
          aria-label={`View booking ${booking.publicCode}`} onClick={() => setSelected(booking)}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(booking); } }}
          sx={{ display: { xs: 'block', md: 'grid' }, gridTemplateColumns: columns, alignItems: 'center', gap: 2,
            px: { xs: 1.5, md: 2 }, py: 1.5, cursor: 'pointer', borderTop: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }, '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 } }}>
          <Box><Typography fontWeight={700} noWrap>{booking.guestName?.trim() || 'Guest'}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }} noWrap>{booking.guestEmail}</Typography></Box>
          <Box sx={{ mt: { xs: 1, md: 0 } }}><Typography fontWeight={650} noWrap>{booking.propertyName || 'Property'}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }} noWrap>{booking.unitName || 'Unit'}</Typography></Box>
          <Box sx={{ mt: { xs: 1, md: 0 } }}><Typography fontWeight={650}>{date(booking.checkInDate)} – {date(booking.checkOutDate)}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }}>{booking.guestCount} {booking.guestCount === 1 ? 'guest' : 'guests'}</Typography></Box>
          <Box sx={{ mt: { xs: 1, md: 0 } }}><Chip size="small" label={label(booking.status)} color={booking.status === 'Confirmed' ? 'success' : booking.status === 'Disputed' || booking.status === 'RefundRequired' ? 'error' : 'default'} /></Box>
          <Typography sx={{ mt: { xs: 1, md: 0 }, fontWeight: 700 }}>{money(booking.totalCents, booking.currency)}</Typography>
        </Box>)}
      {!loading && !error && result.total > result.pageSize && <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ p: 2 }}>
        <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>Showing {(page - 1) * result.pageSize + 1}–{Math.min(page * result.pageSize, result.total)} of {result.total}</Typography>
        <Pagination count={Math.ceil(result.total / result.pageSize)} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
      </Stack>}
    </Box>
    <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>Add booking</DialogTitle><DialogContent><Typography>Manual booking creation is not available yet. Existing short-stay reservations appear in this list; setting up a short-stay unit does not create a booking.</Typography></DialogContent>
      <DialogActions><Button onClick={() => setAddOpen(false)}>Close</Button><Button onClick={() => navigate('/landlord/properties')}>View properties</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="xs">
      <DialogTitle>Booking details</DialogTitle><DialogContent>
        {selected && <Stack spacing={1}><Typography>Guest: {selected.guestName?.trim() || 'Guest'} ({selected.guestEmail})</Typography>
          <Typography>Property: {selected.propertyName || 'Property'} · {selected.unitName || 'Unit'}</Typography>
          <Typography>Stay: {date(selected.checkInDate)} – {date(selected.checkOutDate)}</Typography>
          <Typography>Status: {label(selected.status)}</Typography><Typography>Total: {money(selected.totalCents, selected.currency)}</Typography>
          <Typography sx={{ wordBreak: 'break-all' }}>Booking code: {selected.publicCode}</Typography></Stack>}
      </DialogContent><DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
    </Dialog>
  </Box>;
}
