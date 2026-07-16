import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  alpha,
  useTheme,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Paper,
  Divider
} from '@mui/material';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  TeamOutlined,
  CalendarOutlined,
  DollarOutlined,
  BankOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { formatDate, formatCurrency } from 'utils/formatters';
import useFetchProperties from 'hooks/useFetchProperties';
import { useSelector } from 'react-redux';
import { selectProperties } from 'store/property/property.selector';
import { openSnackbar } from 'api/snackbar';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

export default function LeaseAddendumPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();

  const lease = properties
    ?.flatMap((p) =>
      (p.units || [])
        .filter((u) => u.lease)
        .map((u) => ({ ...u.lease, unit: u, property: p }))
    )
    ?.find((l) => l?.id?.toString() === leaseId);

  const tenants = lease?.tenants || lease?.Tenants || [];
  const landlords = lease?.leaseLandlords || lease?.LeaseLandlords || [];
  const property = lease?.property || lease?.unit?.property;

  const [infoModalOpen, setInfoModalOpen] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form state - pre-filled from lease
  const [originalLeaseDated, setOriginalLeaseDated] = useState(null);
  const [changeLeaseEndDate, setChangeLeaseEndDate] = useState(false);
  const [newLeaseEndDate, setNewLeaseEndDate] = useState(null);
  const [changeMonthlyRent, setChangeMonthlyRent] = useState(false);
  const [newMonthlyRent, setNewMonthlyRent] = useState('');
  const [changeDeposits, setChangeDeposits] = useState(false);
  const [otherAmendments, setOtherAmendments] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(null);

  // Pre-fill from lease
  useEffect(() => {
    if (!lease) return;
    const startDate = lease.startDate || lease.StartDate;
    if (startDate) setOriginalLeaseDated(new Date(startDate));
    const endDate = lease.endDate || lease.EndDate;
    if (endDate) setNewLeaseEndDate(new Date(endDate));
    const rent = lease.rentAmount ?? lease.RentAmount;
    if (rent != null) setNewMonthlyRent(String(rent));
    const dep = lease.depositAmount ?? lease.DepositAmount;
    if (dep != null) setEffectiveDate(new Date(lease.startDate || lease.StartDate || new Date()));
  }, [lease]);

  const handleSoundsGood = () => {
    setInfoModalOpen(false);
  };

  const handleReviewAndESign = () => {
    openSnackbar({
      open: true,
      message: 'Addendum e-sign flow is coming soon. For now, you can create an addendum document and upload it.',
      variant: 'alert',
      alert: { color: 'info' }
    });
    navigate(`/landlord/leases/${leaseId}/upload-document`);
  };

  const getInitials = (firstName, lastName) => {
    const f = (firstName || '').charAt(0);
    const l = (lastName || '').charAt(0);
    return (f + l).toUpperCase() || '?';
  };

  if (!lease) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Leases', path: '/landlord/leases' },
          { label: lease.unit?.property?.name ? `${lease.unit.property.name} - Addendum` : 'Create Addendum' }
        ]}
      />

      {/* Info Modal - Start Your Lease Addendum */}
      <Dialog open={infoModalOpen} onClose={() => {}} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h5" fontWeight={700}>
            Start Your Lease Addendum!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body1" color="text.secondary">
              Use an addendum to make minor changes to your current lease agreement while keeping the rest intact.
            </Typography>
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Most common reasons:
              </Typography>
              <Typography variant="body2" component="div" color="text.secondary">
                • Modifying the lease term
                <br />
                • Changing the rent amount
                <br />
                • Updating a provision mid-lease, like when a tenant gets a pet or you change who is responsible for lawn upkeep
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Stack spacing={1} alignItems="center" textAlign="center">
                  <FileTextOutlined style={{ fontSize: 32, color: theme.palette.primary.main }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Easy to Fill Out
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    We&apos;ll walk you through filling out the addendum.
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Stack spacing={1} alignItems="center" textAlign="center">
                  <SafetyOutlined style={{ fontSize: 32, color: theme.palette.primary.main }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Legal Confidence
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    A flexible document that keeps you covered.
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
                <Stack spacing={1} alignItems="center" textAlign="center">
                  <EditOutlined style={{ fontSize: 32, color: theme.palette.primary.main }} />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Fast to Sign
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Includes e-sign, or simply print & sign in person.
                  </Typography>
                </Stack>
              </Paper>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={handleSoundsGood} sx={{ textTransform: 'uppercase', fontWeight: 700 }}>
            Sounds Good
          </Button>
        </DialogActions>
      </Dialog>

      <Stack spacing={3} sx={{ mt: 3 }}>
        <MainCard
          sx={{
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <IconButton onClick={() => navigate(`/landlord/leases/${leaseId}`)}>
              <ArrowLeftOutlined />
            </IconButton>
            <Typography variant="h4" fontWeight={700}>
              Create Your Lease Agreement Addendum
            </Typography>
          </Stack>

          {/* Here's what you need to know */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 3,
              bgcolor: alpha(theme.palette.info.main, 0.08),
              border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`
            }}
          >
            <Stack direction="row" spacing={2}>
              <Box sx={{ color: theme.palette.info.main, fontSize: 24 }}>ℹ</Box>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  Reference your original lease agreement as you fill out this form. This legal document will amend your lease agreement.
                </Typography>
                <Typography variant="body2">
                  Send the addendum to your tenants to e-sign or choose to print it instead. You may edit the addendum even after you&apos;ve paid, until it&apos;s been signed.
                </Typography>
              </Stack>
            </Stack>
          </Paper>

          {/* People on the lease */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <TeamOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={600}>
                People on the lease
              </Typography>
            </Stack>
            <Stack spacing={2}>
              {tenants.map((t) => (
                <Stack key={t.id || t.Id} direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: theme.palette.warning.main, width: 40, height: 40 }}>
                    {getInitials(t.firstname || t.Firstname, t.lastname || t.Lastname)}
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      Tenant {t.firstname || t.Firstname} {t.lastname || t.Lastname}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t.email || t.Email || 'No email'}
                    </Typography>
                  </Box>
                </Stack>
              ))}
              {landlords.map((ll) => (
                <Stack key={ll.id || ll.Id} direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: theme.palette.success.main, width: 40, height: 40 }}>
                    {getInitials(ll.firstName || ll.firstname, ll.lastName || ll.lastname)}
                  </Avatar>
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {ll.firstName || ll.firstname} {ll.lastName || ll.lastname}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {ll.email || 'No email'}
                    </Typography>
                  </Box>
                  <IconButton size="small">
                    <EditOutlined />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Lease term */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <CalendarOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={600}>
                Lease term
              </Typography>
            </Stack>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                  When was the original lease agreement dated?
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  This is usually found on the top of your lease agreement and probably differs from the lease term start date.
                </Typography>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    value={originalLeaseDated}
                    onChange={setOriginalLeaseDated}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                  Will there be a change to the lease agreement end date?
                </Typography>
                <RadioGroup
                  row
                  value={changeLeaseEndDate ? 'Yes' : 'No'}
                  onChange={(e) => setChangeLeaseEndDate(e.target.value === 'Yes')}
                >
                  <FormControlLabel value="Yes" control={<Radio />} label="Yes" />
                  <FormControlLabel value="No" control={<Radio />} label="No" />
                </RadioGroup>
                {changeLeaseEndDate && (
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="New end date"
                      value={newLeaseEndDate}
                      onChange={setNewLeaseEndDate}
                      sx={{ mt: 2 }}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                )}
              </Box>
            </Stack>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Monthly rent */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <DollarOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={600}>
                Monthly rent
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              Will there be a change to the monthly rent amount?
            </Typography>
            <RadioGroup
              row
              value={changeMonthlyRent ? 'Yes' : 'No'}
              onChange={(e) => setChangeMonthlyRent(e.target.value === 'Yes')}
            >
              <FormControlLabel value="Yes" control={<Radio />} label="Yes" />
              <FormControlLabel value="No" control={<Radio />} label="No" />
            </RadioGroup>
            {changeMonthlyRent && (
              <TextField
                fullWidth
                label="New monthly rent"
                type="number"
                value={newMonthlyRent}
                onChange={(e) => setNewMonthlyRent(e.target.value)}
                sx={{ mt: 2, maxWidth: 200 }}
                InputProps={{ startAdornment: '$' }}
              />
            )}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Deposits */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <BankOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={600}>
                Deposits
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              Will there be a change to any deposit amounts?
            </Typography>
            <RadioGroup
              row
              value={changeDeposits ? 'Yes' : 'No'}
              onChange={(e) => setChangeDeposits(e.target.value === 'Yes')}
            >
              <FormControlLabel value="Yes" control={<Radio />} label="Yes" />
              <FormControlLabel value="No" control={<Radio />} label="No" />
            </RadioGroup>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Other amendments */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <FileTextOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={600}>
                Other amendments
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              Will there be other amendments to the original lease agreement terms?
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              e.g. changes to terms relating to parking, utilities, smoking, etc.
            </Typography>
            <RadioGroup
              row
              value={otherAmendments ? 'Yes' : 'No'}
              onChange={(e) => setOtherAmendments(e.target.value === 'Yes')}
            >
              <FormControlLabel value="Yes" control={<Radio />} label="Yes" />
              <FormControlLabel value="No" control={<Radio />} label="No" />
            </RadioGroup>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Effective date */}
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <CalendarOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="h6" fontWeight={600}>
                Effective date
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              When does this addendum take effect?
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Lease amendments, like rent increases, typically take effect upon the end of the current term.
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                value={effectiveDate}
                onChange={setEffectiveDate}
                format="MM/dd/yyyy"
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
          </Box>

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleReviewAndESign}
            disabled={loading}
            sx={{ textTransform: 'uppercase', fontWeight: 700, py: 1.5 }}
          >
            {loading ? 'Processing...' : 'Review and E-Sign'}
          </Button>
        </MainCard>
      </Stack>
    </Box>
  );
}
