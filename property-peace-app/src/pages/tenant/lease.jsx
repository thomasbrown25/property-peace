import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Divider,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Avatar,
  FormControl,
  MenuItem,
  Select
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  HomeOutlined,
  CalendarOutlined,
  DollarOutlined,
  FileTextOutlined,
  MailOutlined,
  PhoneOutlined,
  EyeOutlined
} from '@ant-design/icons';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate } from 'utils/formatters';
import { calculateNextPaymentDate } from 'utils/helper-methods';
import { tenantDocumentAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

// ==============================|| TENANT - LEASE ||============================== //

function StatCard({ icon, label, value, accent }) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: alpha(theme.palette.background.paper, 0.7),
        flex: 1
      }}
    >
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color: accent || 'primary.main', lineHeight: 0 }}>{icon}</Box>
          <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h6" fontWeight={700} sx={{ pl: 0.25 }}>
          {value || '—'}
        </Typography>
      </Stack>
    </Paper>
  );
}

function getLeaseLabel(lease) {
  const property = lease?.unit?.property?.name || lease?.propertyName || 'Property';
  const unit = lease?.unit?.name || lease?.unitName;
  const propertyType = lease?.unit?.property?.propertyType?.toLowerCase();
  return propertyType === 'singlefamily' || !unit ? property : `${property} · ${unit}`;
}

function LeaseListItem({ lease, selected, onClick }) {
  const theme = useTheme();
  const isActive = lease.isActive;
  const normalizedPropertyType = String(lease.propertyType || lease.PropertyType || lease.unit?.property?.propertyType || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const unitName = lease.unitName || lease.UnitName || lease.unit?.name || '';
  const normalizedUnitName = String(unitName).toLowerCase().replace(/[^a-z0-9]/g, '');
  const showUnitName = unitName && normalizedPropertyType !== 'singlefamily' && normalizedUnitName !== 'unit1';

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        borderRadius: 1.5,
        border: `1.5px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
        transition: 'all 0.15s',
        '&:hover': {
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.action.hover, 0.5),
          border: `1.5px solid ${selected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.4)}`
        }
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          src={lease.propertyImageUrl || undefined}
          sx={{
            width: 42,
            height: 42,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            flexShrink: 0,
            fontSize: 18
          }}
        >
          {!lease.propertyImageUrl && <HomeOutlined />}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
              {lease.propertyName || 'Property'}
            </Typography>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: isActive ? 'success.main' : 'text.disabled',
                flexShrink: 0
              }}
            />
          </Stack>
          {showUnitName && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {unitName}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

export default function TenantLease() {
  const theme = useTheme();
  const { user } = useAuth();
  const [leases, setLeases] = useState([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaseAgreements, setLeaseAgreements] = useState({});
  const [loadingAgreement, setLoadingAgreement] = useState(false);

  const selectedLease = useMemo(() => leases.find((l) => l.id === selectedLeaseId) || null, [leases, selectedLeaseId]);

  const nextPaymentDate = useMemo(() => {
    if (!selectedLease?.rentDueDay || !selectedLease?.startDate) return null;
    return calculateNextPaymentDate(selectedLease.startDate, selectedLease.rentDueDay, selectedLease.endDate);
  }, [selectedLease?.rentDueDay, selectedLease?.startDate, selectedLease?.endDate]);

  // Fetch all leases
  useEffect(() => {
    const fetchLeases = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axiosServices.get('/api/lease/tenant/my-leases');
        if (response.data?.success && response.data?.data) {
          const all = response.data.data;
          setLeases(all);
          // Auto-select first active lease, or just the first one
          const active = all.find((l) => l.isActive) || all[0];
          if (active) setSelectedLeaseId(active.id);
        } else {
          const message = response.data?.message || response.data?.errors || '';
          const normalizedMessage = String(message).toLowerCase();
          const isNoLeaseYet = normalizedMessage.includes('lease') && normalizedMessage.includes('not found');
          if (isNoLeaseYet) {
            setLeases([]);
            setSelectedLeaseId(null);
          } else {
            setError(message || 'Failed to load lease information');
          }
        }
      } catch (err) {
        const status = err?.response?.status || err?.status;
        const message = err?.response?.data?.message || err?.response?.data?.errors || err?.message || '';
        const normalizedMessage = String(message).toLowerCase();
        const isNoLeaseYet = status === 404 || (normalizedMessage.includes('lease') && normalizedMessage.includes('not found'));

        if (isNoLeaseYet) {
          setLeases([]);
          setSelectedLeaseId(null);
        } else {
          setError(message || 'Failed to load lease information');
        }
      } finally {
        setLoading(false);
      }
    };

    if (user?.Id || user?.id) fetchLeases();
  }, [user]);

  // Load lease agreement when selected lease changes
  useEffect(() => {
    if (!selectedLeaseId) return;
    if (leaseAgreements[selectedLeaseId] !== undefined) return; // already fetched

    const loadAgreement = async () => {
      setLoadingAgreement(true);
      try {
        const response = await tenantDocumentAPI.getLeaseAgreement(selectedLeaseId);
        setLeaseAgreements((prev) => ({
          ...prev,
          [selectedLeaseId]: response.success && response.data ? response.data : null
        }));
      } catch {
        setLeaseAgreements((prev) => ({ ...prev, [selectedLeaseId]: null }));
      } finally {
        setLoadingAgreement(false);
      }
    };

    loadAgreement();
  }, [selectedLeaseId]);

  const handleViewLeaseAgreement = async () => {
    if (!selectedLease?.id) return;
    try {
      const response = await tenantDocumentAPI.getLeaseAgreement(selectedLease.id);
      if (response.success && response.data?.blobUrl) {
        window.open(response.data.blobUrl, '_blank');
      } else {
        openSnackbar({ open: true, message: 'Unable to view lease agreement', variant: 'alert', alert: { color: 'error' } });
      }
    } catch {
      openSnackbar({ open: true, message: 'Failed to view lease agreement', variant: 'alert', alert: { color: 'error' } });
    }
  };

  // ── Loading / Error / Empty states ───────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          My Lease
        </Typography>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!leases.length) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
          <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.65rem', sm: '2.125rem' } }}>
            My Lease
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Your lease details will appear here once your landlord assigns a lease to your account.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: { xs: 0, md: 2.5 }, flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
          <Paper
            variant="outlined"
            sx={{
              display: { xs: 'none', md: 'block' },
              width: 260,
              flexShrink: 0,
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              overflow: 'hidden',
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Leases
              </Typography>
            </Box>
            <Box sx={{ p: 1 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  border: `1.5px dashed ${alpha(theme.palette.divider, 0.35)}`,
                  bgcolor: alpha(theme.palette.action.hover, 0.35)
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                    <HomeOutlined />
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700}>
                      No lease yet
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Waiting for landlord
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Paper>

          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 2.5, sm: 3 },
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
              }}
            >
              <Stack spacing={2.25} alignItems="flex-start">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileTextOutlined style={{ fontSize: 24 }} />
                </Box>

                <Box>
                  <Typography variant="h5" fontWeight={800} gutterBottom>
                    Your lease is not ready yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 620 }}>
                    Your account is active, but a lease has not been assigned to you yet. Once your landlord creates or uploads your lease,
                    you’ll be able to review terms, documents, rent details, and payment dates here.
                  </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  <Button variant="contained" href="/tenant/messages" startIcon={<MailOutlined />} sx={{ textTransform: 'none' }}>
                    Message landlord
                  </Button>
                  <Button variant="outlined" href="/tenant/dashboard" sx={{ textTransform: 'none' }}>
                    Back to dashboard
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── Derived display values ────────────────────────────────────────────────────

  const leaseAgreement = selectedLease ? (leaseAgreements[selectedLease.id] ?? null) : null;
  const signatureSent =
    selectedLease?.signatureStatus !== 0 && selectedLease?.signatureStatus !== 'NotSent' && selectedLease?.signatureStatus !== 'notsent';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        px: { xs: 0, sm: 0 }
      }}
    >
      {/* Page header */}
      <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.65rem', sm: '2.125rem' } }}>
          My Lease
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          View your lease details and agreements.
        </Typography>
      </Box>

      {/* Mobile lease selector */}
      <Paper
        variant="outlined"
        sx={{
          display: { xs: 'block', md: 'none' },
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.72),
          boxShadow: (t) => `0 10px 28px ${alpha(t.palette.primary.main, 0.1)}`
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Select lease
            </Typography>
            <Chip
              size="small"
              label={`${leases.length} ${leases.length === 1 ? 'Lease' : 'Leases'}`}
              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }}
            />
          </Stack>
          <FormControl fullWidth size="small">
            <Select
              value={selectedLeaseId || ''}
              onChange={(event) => setSelectedLeaseId(Number(event.target.value))}
              displayEmpty
              sx={{
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.background.default, 0.42),
                '& .MuiSelect-select': { py: 1.1, fontWeight: 650 }
              }}
            >
              {leases.map((lease) => (
                <MenuItem key={lease.id} value={lease.id}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: lease.isActive ? 'success.main' : 'text.disabled',
                        flexShrink: 0
                      }}
                    />
                    <Typography variant="body2" noWrap>
                      {getLeaseLabel(lease)}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Desktop two-column layout; mobile uses selector + full-width details */}
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 0, md: 2.5 },
          flex: 1,
          minHeight: 0,
          alignItems: 'flex-start'
        }}
      >
        {/* ── Left: Lease List ────────────────────────────────────────────────── */}
        <Paper
          variant="outlined"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: 260,
            flexShrink: 0,
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.6),
            overflow: 'hidden',
            position: 'sticky',
            top: 0,
            boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
          }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {leases.length} {leases.length === 1 ? 'Lease' : 'Leases'}
            </Typography>
          </Box>
          <Stack spacing={0.5} sx={{ p: 1 }}>
            {leases.map((lease) => (
              <LeaseListItem
                key={lease.id}
                lease={lease}
                selected={lease.id === selectedLeaseId}
                onClick={() => setSelectedLeaseId(lease.id)}
              />
            ))}
          </Stack>
        </Paper>

        {/* ── Right: Lease Detail ─────────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          {!selectedLease ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <Typography variant="body2" color="text.secondary">
                Select a lease to view details
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2.5}>
              {/* Property Stats */}
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  bgcolor: alpha(theme.palette.background.paper, 0.6),
                  boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <StatCard
                    icon={<DollarOutlined style={{ fontSize: 15 }} />}
                    label="Monthly Rent"
                    value={formatCurrency(selectedLease.rentAmount || 0)}
                  />
                  <StatCard
                    icon={<DollarOutlined style={{ fontSize: 15 }} />}
                    label="Security Deposit"
                    value={formatCurrency(selectedLease.depositAmount || 0)}
                  />
                  <StatCard
                    icon={<CalendarOutlined style={{ fontSize: 15 }} />}
                    label="Next Payment"
                    value={nextPaymentDate ? formatDate(nextPaymentDate) : 'N/A'}
                  />
                  <StatCard
                    icon={<CalendarOutlined style={{ fontSize: 15 }} />}
                    label="Lease Ends"
                    value={selectedLease.endDate ? formatDate(selectedLease.endDate) : 'Ongoing'}
                  />
                </Stack>
              </Paper>

              {/* Details row */}
              <Grid container spacing={2.5}>
                {/* Lease Terms */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: 2,
                      height: '100%',
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      bgcolor: alpha(theme.palette.background.paper, 0.6),
                      boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Lease Terms
                      </Typography>
                    </Stack>

                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, sm: 0 }} justifyContent="space-between">
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Start Date
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatDate(selectedLease.startDate)}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                          <Typography variant="caption" color="text.secondary">
                            End Date
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {selectedLease.endDate ? formatDate(selectedLease.endDate) : 'Ongoing'}
                          </Typography>
                        </Box>
                      </Stack>

                      <Divider />

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, sm: 0 }} justifyContent="space-between">
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Lease Length
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {selectedLease.leaseLength || 12} months
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                          <Typography variant="caption" color="text.secondary">
                            Frequency
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {selectedLease.rentFrequency || 'Monthly'}
                          </Typography>
                        </Box>
                      </Stack>

                      <Divider />

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, sm: 0 }} justifyContent="space-between">
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Rent Due Day
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {selectedLease.rentDueDay
                              ? `${selectedLease.rentDueDay}${getDayOrdinal(selectedLease.rentDueDay)} of month`
                              : '—'}
                          </Typography>
                        </Box>
                        {selectedLease.autoRenewLease && (
                          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                            <Typography variant="caption" color="text.secondary">
                              Auto-Renew
                            </Typography>
                            <Typography variant="body2" fontWeight={600} color="success.main">
                              Enabled
                            </Typography>
                          </Box>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>

                {/* Landlord Info */}
                {(selectedLease.landlordName || selectedLease.landlordEmail || selectedLease.landlordPhone) && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: { xs: 2, sm: 2.5 },
                        borderRadius: 2,
                        height: '100%',
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.6),
                        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          Landlord
                        </Typography>
                      </Stack>

                      <Stack spacing={2}>
                        {selectedLease.landlordName && (
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              sx={{
                                width: 38,
                                height: 38,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                color: 'primary.main',
                                fontSize: 16,
                                fontWeight: 700
                              }}
                            >
                              {selectedLease.landlordName.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {selectedLease.landlordName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Property Manager
                              </Typography>
                            </Box>
                          </Stack>
                        )}

                        {(selectedLease.landlordEmail || selectedLease.landlordPhone) && (
                          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
                            {selectedLease.landlordEmail && (
                              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                <MailOutlined style={{ fontSize: 14, color: theme.palette.text.secondary, marginTop: 3, flexShrink: 0 }} />
                                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                                  {selectedLease.landlordEmail}
                                </Typography>
                              </Stack>
                            )}
                            {selectedLease.landlordPhone && (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <PhoneOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                                <Typography variant="body2" color="text.secondary">
                                  {selectedLease.landlordPhone}
                                </Typography>
                              </Stack>
                            )}
                          </Stack>
                        )}
                      </Stack>
                    </Paper>
                  </Grid>
                )}
              </Grid>

              {/* Lease Agreement */}
              {signatureSent && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    bgcolor: alpha(theme.palette.background.paper, 0.6),
                    boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      Lease Agreement
                    </Typography>
                  </Stack>

                  {loadingAgreement ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : leaseAgreement ? (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <FileTextOutlined style={{ fontSize: 22, color: theme.palette.primary.main }} />
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {leaseAgreement.fileName || 'Lease Agreement'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {leaseAgreement.description || 'Signed lease agreement document'}
                            {leaseAgreement.createdAt && ` · ${formatDate(leaseAgreement.createdAt)}`}
                          </Typography>
                        </Box>
                      </Stack>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<EyeOutlined />}
                        onClick={handleViewLeaseAgreement}
                        sx={{ borderRadius: 1.5, textTransform: 'none', flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
                      >
                        View
                      </Button>
                    </Stack>
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                      <Typography variant="body2">
                        No lease agreement document available yet. Contact your landlord if you need a copy.
                      </Typography>
                    </Alert>
                  )}
                </Paper>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// Helper – ordinal suffix for rent due day
function getDayOrdinal(day) {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
