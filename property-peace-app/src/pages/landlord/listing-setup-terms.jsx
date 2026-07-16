import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  Grid,
  MenuItem,
  alpha,
  useTheme,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton
} from '@mui/material';
import { ArrowLeftOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { NumericFormat } from 'react-number-format';
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { getListingById, setSelectedListing, updateListing } from 'store/listing/listing.action';
import { selectSelectedListing, selectListingLoading } from 'store/listing/listing.selector';
import OccupancyTimelineGraph from 'components/OccupancyTimelineGraph';
import { getUnitAvailabilityCalendar } from 'api/property-portfolio';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';

const LEASE_DURATION_OPTIONS = [
  'Monthly', '2 Months', '3 Months', '4 Months', '5 Months', '6 Months', '7 Months', '8 Months', '9 Months',
  '10 Months', '11 Months', '12 Months', '13 Months', '14 Months', '15 Months', '16 Months', '17 Months',
  '18 Months', '19 Months', '20 Months', '21 Months', '22 Months', '23 Months', '24 Months', 'Contact for details'
];

function rentDueDayLabel(day) {
  if (day == null || day === undefined) return null;
  if (day === -1) return 'Last day of month';
  const n = Number(day);
  if (n < 1 || n > 31) return null;
  const s = n % 10;
  const suffix = n >= 11 && n <= 13 ? 'th' : s === 1 ? 'st' : s === 2 ? 'nd' : s === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

function getFirstRentDueDayFromCalendar(calendarData) {
  if (!calendarData?.units) return null;
  for (const unit of calendarData.units) {
    const periods = unit.leasePeriods || unit.LeasePeriods;
    if (!periods?.length) continue;
    for (const lease of periods) {
      const day = lease.rentDueDay ?? lease.RentDueDay;
      if (day != null) return day;
    }
  }
  return null;
}

export default function ListingSetupTermsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const listing = useSelector(selectSelectedListing);
  const loading = useSelector(selectListingLoading);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [occupancyModalOpen, setOccupancyModalOpen] = useState(false);
  const [occupancyWindowStart, setOccupancyWindowStart] = useState(() => startOfMonth(new Date()));
  const [occupancyCalendarData, setOccupancyCalendarData] = useState(null);
  const [occupancyLoading, setOccupancyLoading] = useState(false);
  const OCCUPANCY_WINDOW_MONTHS = 12;

  const occupancyRentDueLabel = useMemo(() => {
    if (occupancyLoading || !occupancyCalendarData?.units) return null;
    const day = getFirstRentDueDayFromCalendar(occupancyCalendarData);
    return day != null ? rentDueDayLabel(day) : null;
  }, [occupancyLoading, occupancyCalendarData]);

  useEffect(() => {
    if (id) dispatch(getListingById(parseInt(id)));
    return () => dispatch(setSelectedListing(null));
  }, [id, dispatch]);

  // Pre-fill from listing; then from current/previous lease for this property (first unit) if listing has no deposit/date
  useEffect(() => {
    if (!listing) return;
    const fromListing = {
      securityDeposit: listing.securityDeposit ?? '',
      dateAvailable: listing.dateAvailable ? listing.dateAvailable.slice(0, 10) : '',
      minLeaseDuration: listing.minLeaseDuration ?? '',
      maxLeaseDuration: listing.maxLeaseDuration ?? '',
      petsAllowed: listing.petsAllowed ?? false,
      additionalLeaseTermsNotes: listing.additionalLeaseTermsNotes ?? ''
    };
    setFormData(fromListing);

    const propertyId = listing.propertyId;
    if (!propertyId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await axiosServices.get('/api/lease/history');
        const list = res?.data?.data ?? res?.data ?? [];
        const forProperty = Array.isArray(list) ? list.filter((l) => (l.propertyId ?? l.PropertyId) === propertyId) : [];
        if (forProperty.length === 0 || cancelled) return;

        // First unit: prefer listing.unitId if it matches, else use first unit (sort by unitId)
        const sorted = [...forProperty].sort((a, b) => (a.unitId ?? a.UnitId ?? 0) - (b.unitId ?? b.UnitId ?? 0));
        const listingUnitId = listing.unitId ?? listing.UnitId;
        const forUnit = listingUnitId != null ? sorted.filter((l) => (l.unitId ?? l.UnitId) === listingUnitId) : sorted;
        const unitLeases = (forUnit.length > 0 ? forUnit : sorted).filter(
          (l) => l.endDate != null || l.EndDate != null
        );
        if (unitLeases.length === 0 || cancelled) return;

        const active = unitLeases.find((l) => l.isActive === true || l.IsActive === true);
        const best = active ?? unitLeases.sort((a, b) => new Date(b.endDate ?? b.EndDate) - new Date(a.endDate ?? a.EndDate))[0];
        const endDate = best.endDate ?? best.EndDate;
        const depositAmount = best.depositAmount ?? best.DepositAmount;

        const firstOfMonthAfterEnd = endDate ? startOfMonth(addMonths(new Date(endDate), 1)) : null;
        const suggestedDate = firstOfMonthAfterEnd ? format(firstOfMonthAfterEnd, 'yyyy-MM-dd') : '';

        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          securityDeposit: prev.securityDeposit !== '' ? prev.securityDeposit : (depositAmount != null ? String(depositAmount) : ''),
          dateAvailable: prev.dateAvailable !== '' ? prev.dateAvailable : suggestedDate
        }));
      } catch {
        // ignore; listing values already set
      }
    })();
    return () => { cancelled = true; };
  }, [listing]);

  const handleBack = () => navigate(`/landlord/listings/${id}/setup`);

  const fetchOccupancyForWindow = useCallback(
    async (windowStart) => {
      const landlordId = user?.id ?? user?.Id;
      const propertyId = listing?.propertyId;
      if (!landlordId || !propertyId) return;
      setOccupancyLoading(true);
      try {
        const windowEnd = endOfMonth(addMonths(windowStart, OCCUPANCY_WINDOW_MONTHS - 1));
        const data = await getUnitAvailabilityCalendar(landlordId, propertyId, windowStart, windowEnd);
        setOccupancyCalendarData(data);
      } catch {
        setOccupancyCalendarData(null);
      } finally {
        setOccupancyLoading(false);
      }
    },
    [user?.id, user?.Id, listing?.propertyId]
  );

  const openOccupancyModal = () => {
    const start = startOfMonth(new Date());
    setOccupancyWindowStart(start);
    setOccupancyModalOpen(true);
    fetchOccupancyForWindow(start);
  };

  const closeOccupancyModal = () => {
    setOccupancyModalOpen(false);
    setOccupancyCalendarData(null);
  };

  const occupancyPrev12Months = () => {
    const newStart = subMonths(occupancyWindowStart, OCCUPANCY_WINDOW_MONTHS);
    setOccupancyWindowStart(newStart);
    fetchOccupancyForWindow(newStart);
  };

  const occupancyNext12Months = () => {
    const newStart = addMonths(occupancyWindowStart, OCCUPANCY_WINDOW_MONTHS);
    setOccupancyWindowStart(newStart);
    fetchOccupancyForWindow(newStart);
  };

  const handleSave = async () => {
    if (!id || !formData) return;
    setSaving(true);
    try {
      const payload = {
        securityDeposit: formData.securityDeposit ? parseFloat(formData.securityDeposit) : null,
        dateAvailable: formData.dateAvailable || null,
        minLeaseDuration: formData.minLeaseDuration || null,
        maxLeaseDuration: formData.maxLeaseDuration || null,
        petsAllowed: formData.petsAllowed,
        additionalLeaseTermsNotes: formData.additionalLeaseTermsNotes || null
      };
      const result = await dispatch(updateListing(parseInt(id), payload));
      if (result?.success) {
        dispatch(getListingById(parseInt(id)));
        openSnackbar({ open: true, message: 'Lease terms saved', variant: 'alert', alert: { color: 'success' } });
        navigate(`/landlord/listings/${id}/setup`);
      } else throw new Error(result?.message);
    } catch (e) {
      openSnackbar({
        open: true,
        message: e?.response?.data?.message || e?.message || 'Failed to save',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !listing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const propertyDisplay = listing.propertyName || 'Property';
  const unitDisplay = listing.unitName || 'Whole property';
  const addressDisplay = listing.propertyAddress ?? '';

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Listings', path: '/landlord/listings' },
          { label: listing.listingNumber ?? 'Listing' },
          { label: 'Set Up', path: `/landlord/listings/${id}/setup` },
          { label: 'Lease terms' }
        ]}
      />

      <Box
        sx={{
          mb: 4,
          p: 3,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}`,
          boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.04)}`
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack spacing={1} alignItems="flex-start">
            <Button
              variant="text"
              size="small"
              startIcon={<ArrowLeftOutlined style={{ fontSize: 14 }} />}
              onClick={handleBack}
              sx={{
                color: 'text.secondary',
                textTransform: 'none',
                minWidth: 'auto',
                width: 'fit-content',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
              }}
            >
              BACK
            </Button>
            <Typography variant="h4" fontWeight={700}>
              {propertyDisplay} – {unitDisplay}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {addressDisplay}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <MainCard
        title="Lease terms"
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2
        }}
      >
        {formData && (
          <Stack spacing={2} sx={{ maxWidth: 640 }}>
            <Grid container spacing={2}>
              <Grid size={12}>
                <NumericFormat
                  customInput={TextField}
                  fullWidth
                  label="Security deposit"
                  value={formData.securityDeposit}
                  onValueChange={({ floatValue }) => setFormData((p) => ({ ...p, securityDeposit: floatValue ?? '' }))}
                  thousandSeparator
                  prefix="$"
                  decimalScale={2}
                />
              </Grid>
              <Grid size={12}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <TextField
                    fullWidth
                    label="Date available"
                    type="date"
                    value={formData.dateAvailable}
                    onChange={(e) => setFormData((p) => ({ ...p, dateAvailable: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button
                    variant="outlined"
                    onClick={openOccupancyModal}
                    sx={{ textTransform: 'none', whiteSpace: 'nowrap', mt: 1, px: 3, minWidth: 180 }}
                  >
                    View occupancy
                  </Button>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Min lease duration"
                  value={formData.minLeaseDuration}
                  onChange={(e) => setFormData((p) => ({ ...p, minLeaseDuration: e.target.value }))}
                >
                  {LEASE_DURATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  select
                  label="Max lease duration"
                  value={formData.maxLeaseDuration}
                  onChange={(e) => setFormData((p) => ({ ...p, maxLeaseDuration: e.target.value }))}
                >
                  {LEASE_DURATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={12}>
                <Button
                  variant={formData.petsAllowed ? 'contained' : 'outlined'}
                  onClick={() => setFormData((p) => ({ ...p, petsAllowed: !p.petsAllowed }))}
                  sx={{ textTransform: 'none' }}
                >
                  {formData.petsAllowed ? 'Pets allowed' : 'No pets'}
                </Button>
              </Grid>
            </Grid>
            <Box>
              <Typography component="label" variant="body2" fontWeight={500} color="text.primary" sx={{ display: 'block', mb: 1 }}>
                Anything else renters should know about lease terms? (optional)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="Example: Owner pays for sewer and garbage. Renter is responsible for electric and water. First and last month rent due at lease signing. No smoking allowed. Dogs allowed only if under 30 lbs. Certain breed restrictions apply."
                value={formData.additionalLeaseTermsNotes}
                onChange={(e) => setFormData((p) => ({ ...p, additionalLeaseTermsNotes: e.target.value }))}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    
                  }
                }}
              />
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={handleBack}
                sx={{ textTransform: 'uppercase', fontWeight: 700, px: 2, py: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                sx={{ textTransform: 'uppercase', fontWeight: 700, px: 2, py: 1 }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </Stack>
          </Stack>
        )}
      </MainCard>

      {/* Occupancy modal */}
      <Dialog
        open={occupancyModalOpen}
        onClose={closeOccupancyModal}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Occupancy – {listing?.propertyName || 'Property'}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton
                size="small"
                onClick={occupancyPrev12Months}
                aria-label="Previous 12 months"
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <LeftOutlined />
              </IconButton>
              <Typography variant="subtitle1" sx={{ minWidth: 200, textAlign: 'center' }}>
                {format(occupancyWindowStart, 'MMM yyyy')} – {format(addMonths(occupancyWindowStart, OCCUPANCY_WINDOW_MONTHS - 1), 'MMM yyyy')}
              </Typography>
              <IconButton
                size="small"
                onClick={occupancyNext12Months}
                aria-label="Next 12 months"
                sx={{ border: '1px solid', borderColor: 'divider' }}
              >
                <RightOutlined />
              </IconButton>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {occupancyRentDueLabel && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Rent due: <strong>{occupancyRentDueLabel}</strong> of each month
            </Typography>
          )}
          <OccupancyTimelineGraph
            calendarData={occupancyCalendarData}
            loading={occupancyLoading}
            windowStart={occupancyWindowStart}
            windowMonthCount={OCCUPANCY_WINDOW_MONTHS}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
