import { useEffect, useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { LeftOutlined, RightOutlined, CloseOutlined } from '@ant-design/icons';
import OccupancyTimelineGraph from 'components/OccupancyTimelineGraph';
import { getUnitAvailabilityCalendar } from 'api/property-portfolio';
import useAuth from 'hooks/useAuth';
import { daysInOccupancyMonth } from './occupancyDays.mjs';
import { readOccupancyCalendar, storeOccupancyCalendar } from './occupancyCalendarCache.mjs';

export default function PropertyOccupancyTab({ propertyId, property }) {
  const { user } = useAuth();
  const landlordId = user?.id ?? user?.Id;
  const [windowStart, setWindowStart] = useState(() => startOfMonth(new Date()));
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState(null);
  const [requestAttempt, setRequestAttempt] = useState(0);

  useEffect(() => {
    setSelection(null);
    setCalendar(null);
    if (!landlordId || !propertyId) return;
    const cached = readOccupancyCalendar(landlordId, propertyId, windowStart);
    if (cached) {
      setCalendar(cached);
      setLoading(false);
      setError('');
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => { controller.abort(); reject(new Error('Occupancy request timed out')); }, 20000);
    });
    setLoading(true);
    setError('');
    Promise.race([getUnitAvailabilityCalendar(landlordId, propertyId, windowStart, endOfMonth(addMonths(windowStart, 11)), controller.signal), timeout])
      .then(data => {
        if (cancelled) return;
        if (!Array.isArray(data?.units)) throw new Error('Invalid calendar response');
        // Keep the view property-scoped even if an API response includes other properties.
        const scoped = { ...data, units: data.units.filter(unit => String(unit.propertyId) === String(propertyId)) };
        storeOccupancyCalendar(landlordId, propertyId, windowStart, scoped);
        setCalendar(scoped);
      })
      .catch(() => { if (!cancelled) setError(controller.signal.aborted ? 'Occupancy is taking too long to load. Please retry.' : 'Occupancy could not be loaded. Please try again later.'); })
      .finally(() => { clearTimeout(timeoutId); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; clearTimeout(timeoutId); controller.abort(); };
  }, [landlordId, propertyId, windowStart, requestAttempt]);

  const days = useMemo(() => selection ? daysInOccupancyMonth(selection.unit, selection.month) : [], [selection]);
  const monthLabel = selection ? format(selection.month, 'MMMM yyyy') : '';
  const firstWeekday = selection ? new Date(selection.month.getFullYear(), selection.month.getMonth(), 1).getDay() : 0;

  return (
    <Box component="section" aria-label="Property occupancy">
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Occupancy timeline</Typography>
          <Typography variant="body2" color="text.secondary">Select a unit’s month to view its daily occupancy.</Typography>
        </Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton aria-label="Previous 12 months" onClick={() => setWindowStart(start => addMonths(start, -12))}><LeftOutlined /></IconButton>
          <Typography sx={{ minWidth: 170, textAlign: 'center', fontWeight: 600 }}>
            {format(windowStart, 'MMM yyyy')} – {format(addMonths(windowStart, 11), 'MMM yyyy')}
          </Typography>
          <IconButton aria-label="Next 12 months" onClick={() => setWindowStart(start => addMonths(start, 12))}><RightOutlined /></IconButton>
        </Stack>
      </Stack>
      <Box sx={{ minHeight: { xs: 260, sm: 360 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setRequestAttempt(attempt => attempt + 1)}>Retry</Button>}>{error}</Alert>}
        {loading && <Box sx={{ minHeight: { xs: 260, sm: 360 }, display: 'grid', placeItems: 'center' }}>
          <CircularProgress aria-label="Loading occupancy" />
        </Box>}
        {!loading && !error && <OccupancyTimelineGraph calendarData={calendar} windowStart={windowStart} windowMonthCount={12}
          fallbackPropertyName={property?.name} maxVisibleUnits={10} onMonthClick={(unit, month) => setSelection({ unit, month })} />}
      </Box>
      <Dialog open={Boolean(selection)} onClose={() => setSelection(null)} fullWidth maxWidth="sm" aria-labelledby="occupancy-month-title">
        <DialogTitle id="occupancy-month-title" sx={{ pr: 6 }}>
          {selection?.unit?.unitName || property?.name || 'Unit'} · {monthLabel}
          <IconButton onClick={() => setSelection(null)} aria-label="Close daily occupancy" sx={{ position: 'absolute', right: 8, top: 8 }}><CloseOutlined /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}><Chip label="Occupied" color="success" size="small" /><Chip label="Vacant" color="warning" size="small" /></Stack>
          <Box role="grid" aria-label={`Daily occupancy for ${selection?.unit?.unitName || property?.name || 'unit'} in ${monthLabel}`}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.75 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Typography key={day} align="center" variant="caption" fontWeight={700}>{day}</Typography>)}
            {Array.from({ length: firstWeekday }, (_, index) => <Box key={`blank-${index}`} />)}
            {days.map(({ date, occupied, lease }) => (
              <Box key={date.getDate()} role="gridcell" aria-label={`${format(date, 'MMMM d, yyyy')}: ${occupied ? 'Occupied' : 'Vacant'}${lease?.tenantNames ? ` by ${lease.tenantNames}` : ''}`}
                sx={{ borderRadius: 1, bgcolor: occupied ? 'success.main' : 'warning.main', color: occupied ? 'success.contrastText' : 'warning.contrastText', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {date.getDate()}
              </Box>
            ))}
          </Box>
          {days.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {days.filter(day => day.occupied).length} occupied · {days.filter(day => !day.occupied).length} vacant days
          </Typography>}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
