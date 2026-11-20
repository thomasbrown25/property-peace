import { isDetachedSingleUnitType } from 'utils/propertyType';
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
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
  Avatar
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
import { normalizeRentBalance } from 'utils/rentBalance';
import { tenantDocumentAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import TenantLeaseFilter from 'components/filters/TenantLeaseFilter';
import { getLeaseOrganizationId, organizationRequestOptions } from './tenantDocumentScope.mjs';
import { getStatusPillSx } from 'themes/statusPillStyles';

// ==============================|| TENANT - LEASE ||============================== //

function StatCard({ icon, label, value, accent, overdue }) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
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
        <Typography variant="h6" fontWeight={700} color={overdue ? 'error.main' : undefined} sx={{ pl: 0.25 }}>
          {value || '—'}
        </Typography>
      </Stack>
    </Paper>
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
  const userId = user?.id ?? user?.Id;
  const balanceOrganizationId = getLeaseOrganizationId(selectedLease);
  const { data: rentBalance } = useSWR(
    userId && selectedLease?.id && balanceOrganizationId
      ? ['tenant-lease-rent-balance', userId, selectedLease.id, balanceOrganizationId]
      : null,
    async ([, , leaseId, organizationId]) => {
      const { data } = await axiosServices.get('/api/rent-collection/tenant/my-rent', {
        ...organizationRequestOptions(organizationId),
        params: { leaseId }
      });
      const records = data?.data?.rentRecords ?? data?.data?.RentRecords ?? [];
      const leaseRecord = records.find((record) => String(record.leaseId ?? record.LeaseId) === String(leaseId));
      return leaseRecord ? normalizeRentBalance(leaseRecord) : null;
    },
    { shouldRetryOnError: false }
  );

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
    const organizationId = getLeaseOrganizationId(selectedLease);
    if (!selectedLeaseId || !selectedLease || organizationId === undefined || organizationId === null) return;
    if (leaseAgreements[selectedLeaseId] !== undefined) return; // already fetched

    const loadAgreement = async () => {
      setLoadingAgreement(true);
      try {
        const response = await tenantDocumentAPI.getLeaseAgreement(selectedLeaseId, organizationRequestOptions(organizationId));
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
  }, [selectedLeaseId, selectedLease, leaseAgreements]);

  const handleViewLeaseAgreement = async () => {
    const organizationId = getLeaseOrganizationId(selectedLease);
    if (!selectedLease?.id || organizationId === undefined || organizationId === null) return;
    try {
      const response = await tenantDocumentAPI.getLeaseAgreement(selectedLease.id, organizationRequestOptions(organizationId));
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

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2.5, sm: 3 },
            borderRadius: 2,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: 'none'
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
                  <Button variant="contained" href="/tenant/chat" startIcon={<MailOutlined />} sx={{ textTransform: 'none' }}>
                    Message landlord
                  </Button>
                  <Button variant="outlined" href="/tenant/dashboard" sx={{ textTransform: 'none' }}>
                    Back to dashboard
                  </Button>
                </Stack>
          </Stack>
        </Paper>
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

      <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
        <TenantLeaseFilter leases={leases} selectedLeaseId={selectedLeaseId} onChange={setSelectedLeaseId} labelAbove />
      </Box>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
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
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  boxShadow: 'none'
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <StatCard
                    icon={<DollarOutlined style={{ fontSize: 15 }} />}
                    label="Amount Due"
                    value={rentBalance ? formatCurrency(rentBalance.rentDue) : null}
                  />
                  <StatCard
                    icon={<CalendarOutlined style={{ fontSize: 15 }} />}
                    label="Next payment date"
                    value={nextPaymentDate ? formatDate(nextPaymentDate) : 'N/A'}
                  />
                  <StatCard
                    icon={<DollarOutlined style={{ fontSize: 15 }} />}
                    label="Monthly Rent"
                    value={formatCurrency(selectedLease.rentAmount || 0)}
                  />
                  <StatCard
                    icon={<DollarOutlined style={{ fontSize: 15 }} />}
                    label="Overdue Amount"
                    value={rentBalance ? formatCurrency(rentBalance.overdueAmount) : null}
                    overdue={(rentBalance?.overdueAmount ?? 0) > 0}
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
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      boxShadow: 'none'
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

                      <Stack direction="row" spacing={2} justifyContent="space-between">
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Monthly Rent
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatCurrency(selectedLease.rentAmount || 0)}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" color="text.secondary">
                            Rent Due Day
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {selectedLease.rentDueDay
                              ? `${selectedLease.rentDueDay}${getDayOrdinal(selectedLease.rentDueDay)} of month`
                              : '—'}
                          </Typography>
                        </Box>
                      </Stack>
                      {selectedLease.autoRenewLease && (
                        <>
                          <Divider />
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Auto-Renew
                            </Typography>
                            <Box sx={{ mt: 0.25 }}>
                              <Chip label="Enabled" size="small" sx={(chipTheme) => getStatusPillSx(chipTheme, 'success')} />
                            </Box>
                          </Box>
                        </>
                      )}
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
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        boxShadow: 'none'
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
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    boxShadow: 'none'
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
