import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Stack,
  Divider,
  Grid,
  Paper,
  Button,
  Card,
  CardContent,
  Chip,
  alpha,
  useTheme,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  ArrowLeftOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { selectProperties } from 'store/property/property.selector';
import { formatCurrency } from 'utils/formatters';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchPayments from 'hooks/useFetchPayments';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import { useModal } from 'contexts/ModalContext';
import PaymentModal from 'components/drawers/PaymentModal';
import PaymentHistoryTable from 'sections/landlord/rent-collection/PaymentHistoryTable';
import axiosServices from 'utils/axios';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { normalizeRentBalance } from 'utils/rentBalance';

export default function LeasePaymentHistory() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const modal = useModal();
  const { propertiesRefetch } = useFetchProperties();
  const properties = useSelector(selectProperties);

  // Find the lease from properties
  const lease = useMemo(() => {
    if (!properties) return null;
    return properties
      ?.flatMap((p) =>
        (p.units || [])
          .filter((u) => u.lease)
          .map((u) => ({
            ...u.lease,
            unit: u,
            propertyName: p.name,
            propertyId: p.id,
            unitId: u.id
          }))
      )
      ?.find((l) => l?.id?.toString() === leaseId);
  }, [properties, leaseId]);

  // Fetch rent collection data
  const { rentRecords, refetch: refetchRentCollection } = useFetchRentCollection(null, true);

  // Find the rent record for this lease
  const rentRecord = useMemo(() => {
    if (!rentRecords || !leaseId) return null;
    return rentRecords.find((r) => r.leaseId === parseInt(leaseId) || r.id === parseInt(leaseId));
  }, [rentRecords, leaseId]);

  // Timespan filter state - default to last 6 months
  const getDefaultTimespan = () => {
    const now = new Date();
    const last6Months = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    return {
      timespan: '6months',
      dateFrom: last6Months,
      dateTo: now
    };
  };
  const [timespanFilter, setTimespanFilter] = useState(getDefaultTimespan());
  const [dateFrom, setDateFrom] = useState(() => {
    const now = new Date();
    const last6Months = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    return last6Months.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Update dateFrom/dateTo when timespan filter changes
  useEffect(() => {
    if (timespanFilter?.dateFrom && timespanFilter?.dateTo) {
      setDateFrom(timespanFilter.dateFrom.toISOString().split('T')[0]);
      setDateTo(timespanFilter.dateTo.toISOString().split('T')[0]);
    }
  }, [timespanFilter]);

  // Fetch deposits for this lease
  const [deposits, setDeposits] = useState([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);

  // Fetch payments for this lease
  const { payments, refetch: refetchPayments } = useFetchPayments(lease?.id);
  
  // Filter payments by date range
  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    let filtered = [...payments];
    
    if (dateFrom) {
      const startDate = new Date(dateFrom);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((payment) => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate >= startDate;
      });
    }
    
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((payment) => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate <= endDate;
      });
    }
    
    return filtered;
  }, [payments, dateFrom, dateTo]);

  // Filter deposits by date range
  const filteredDeposits = useMemo(() => {
    if (!deposits) return [];
    let filtered = [...deposits];
    
    if (dateFrom) {
      const startDate = new Date(dateFrom);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((deposit) => {
        if (!deposit.receivedDate) return false;
        const depositDate = new Date(deposit.receivedDate);
        return depositDate >= startDate;
      });
    }
    
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((deposit) => {
        if (!deposit.receivedDate) return false;
        const depositDate = new Date(deposit.receivedDate);
        return depositDate <= endDate;
      });
    }
    
    return filtered;
  }, [deposits, dateFrom, dateTo]);

  const fetchDeposits = useCallback(async () => {
    if (!leaseId) return;
    setLoadingDeposits(true);
    try {
      const response = await axiosServices.get(`/api/deposit/lease/${leaseId}`);
      if (response.data && response.data.success) {
        setDeposits(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
      setDeposits([]);
    } finally {
      setLoadingDeposits(false);
    }
  }, [leaseId]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  const { rentDue: balanceDue, overdueAmount, rentDueIsOverdue: isOverdue } = useMemo(
    () => normalizeRentBalance(rentRecord),
    [rentRecord]
  );

  // Check if deposit has been paid
  const depositPaid = useMemo(() => {
    if (!lease?.depositAmount || lease.depositAmount === 0) return null;
    if (loadingDeposits) return null; // Return null while loading
    if (!deposits || deposits.length === 0) return false;
    return deposits.some((d) => d.receivedDate && !d.refundedDate);
  }, [deposits, lease?.depositAmount, loadingDeposits]);

  // Handle payment updated
  const handlePaymentUpdated = useCallback(() => {
    refetchRentCollection();
    refetchPayments();
    fetchDeposits();
    propertiesRefetch();
  }, [refetchRentCollection, refetchPayments, fetchDeposits, propertiesRefetch]);

  if (!lease) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  const propertyDisplay = lease.unit?.property?.propertyType?.toLowerCase() === 'singlefamily'
    ? lease.propertyName
    : `${lease.propertyName}${lease.unitName ? ` - ${lease.unitName}` : ''}`;

  return (
    <Box>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        links={[
          { title: 'Leases', to: '/landlord/leases' },
          { title: propertyDisplay, to: `/landlord/leases/${leaseId}` },
          { title: 'Payment History' }
        ]}
      />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="text"
              startIcon={<ArrowLeftOutlined />}
              onClick={() => navigate(`/landlord/leases/${leaseId}`)}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              Back
            </Button>
            <DollarOutlined style={{ fontSize: 24, color: '#41a541' }} />
            <Typography variant="h4" fontWeight="bold">
              Payment History
            </Typography>
          </Stack>
          <Button
            size="small"
            variant="text"
            startIcon={<DollarOutlined style={{ fontSize: 16 }} />}
            onClick={() => navigate('/landlord/finances?tab=payments')}
            sx={{
              color: 'primary.main',
              textTransform: 'none',
              flexShrink: 0,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            View All Payments
          </Button>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ml: 7 }}>
          {propertyDisplay}
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        {/* Financial Summary Cards */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.04)}`
            }}
          >
            <Stack spacing={2}>
              {/* Balance Due Card */}
              <Card
                variant="outlined"
                sx={{
                  bgcolor: (theme) => alpha(theme.palette.background.paper, 0.5),
                  border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <DollarOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Balance Due
                      </Typography>
                    </Stack>
                    <Typography variant="h6" fontWeight={700} color="text.primary">
                      {formatCurrency(balanceDue)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              {/* Overdue Amount Card */}
              {overdueAmount > 0 && (
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: alpha('#cf1322', 0.05),
                    border: (theme) => `1px solid ${alpha('#cf1322', 0.2)}`
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: (theme) => alpha('#cf1322', 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <DollarOutlined style={{ fontSize: 18, color: '#cf1322' }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Overdue Amount
                        </Typography>
                      </Stack>
                      <Typography variant="h6" fontWeight={700} color="error.main">
                        {formatCurrency(overdueAmount)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Deposit Status Card */}
              {lease.depositAmount > 0 && (
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: loadingDeposits
                      ? alpha(theme.palette.background.paper, 0.5)
                      : alpha(theme.palette.warning.main, 0.05),
                    border: (theme) =>
                      loadingDeposits
                        ? `1px solid ${alpha(theme.palette.divider, 0.1)}`
                        : `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: (theme) =>
                              loadingDeposits
                                ? alpha(theme.palette.background.paper, 0.5)
                                : alpha(theme.palette.warning.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {loadingDeposits ? (
                            <CircularProgress size={18} />
                          ) : (
                            <DollarOutlined style={{ fontSize: 18, color: '#faad14' }} />
                          )}
                        </Box>
                        <Stack>
                          <Typography variant="body2" color="text.secondary">
                            Deposit Amount
                          </Typography>
                          {loadingDeposits ? (
                            <Box sx={{ mt: 0.5, height: 20, display: 'flex', alignItems: 'center' }}>
                              <CircularProgress size={12} />
                            </Box>
                          ) : depositPaid !== null ? (
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                              <Chip
                                label={depositPaid ? 'Paid' : 'Not Paid'}
                                color={depositPaid ? 'success' : 'warning'}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                              {deposits.some(d => d.receivedDate && !d.heldInEscrow) && (
                                <Tooltip title="This deposit is not marked as held in escrow. Most states legally require security deposits to be held in a separate trust account.">
                                  <Chip
                                    label="Not in escrow"
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem', cursor: 'help' }}
                                  />
                                </Tooltip>
                              )}
                            </Stack>
                          ) : null}
                        </Stack>
                      </Stack>
                      <Typography variant="h6" fontWeight={700} color={loadingDeposits ? 'text.secondary' : 'warning.main'}>
                        {formatCurrency(lease.depositAmount || 0)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Record Payment Button */}
              {rentRecord && (
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  fullWidth
                  startIcon={<CheckCircleOutlined />}
                  onClick={() => modal.openPaymentModal(rentRecord)}
                  sx={{
                    boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.3)}`,
                    '&:hover': {
                      boxShadow: `0 6px 16px ${alpha(theme.palette.success.main, 0.4)}`,
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.3s ease',
                    py: 1
                  }}
                >
                  Record a payment
                </Button>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Payment History Table */}
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Timespan Filter */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Timespan</InputLabel>
                <Select
                  value={timespanFilter?.timespan || '6months'}
                  label="Timespan"
                  onChange={(e) => {
                    const now = new Date();
                    let startDate;
                    const value = e.target.value;
                    
                    if (value === 'custom') {
                      // For custom, keep current dates
                      startDate = timespanFilter?.dateFrom || new Date(dateFrom);
                      setTimespanFilter({
                        timespan: 'custom',
                        dateFrom: startDate,
                        dateTo: timespanFilter?.dateTo || new Date(dateTo)
                      });
                    } else {
                      // For 6 months
                      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                      const newFilter = {
                        timespan: value,
                        dateFrom: startDate,
                        dateTo: now
                      };
                      setTimespanFilter(newFilter);
                    }
                  }}
                >
                  <MenuItem value="6months">Last 6 months</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>
              
              {/* Custom date pickers - show when custom is selected */}
              {timespanFilter?.timespan === 'custom' && (
                <>
                  <TextField
                    size="small"
                    type="date"
                    label="From Date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      const newDate = new Date(e.target.value);
                      setTimespanFilter(prev => ({
                        ...prev,
                        dateFrom: newDate
                      }));
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 160 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarOutlined style={{ fontSize: 16 }} />
                        </InputAdornment>
                      )
                    }}
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="To Date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      const newDate = new Date(e.target.value);
                      setTimespanFilter(prev => ({
                        ...prev,
                        dateTo: newDate
                      }));
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 160 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarOutlined style={{ fontSize: 16 }} />
                        </InputAdornment>
                      )
                    }}
                  />
                </>
              )}
            </Stack>
          </Paper>
          
          <PaymentHistoryTable
            payments={filteredPayments}
            deposits={filteredDeposits}
            onPaymentUpdated={handlePaymentUpdated}
          />
        </Grid>
      </Grid>

      {/* Payment Modal */}
      <PaymentModal
        open={modal.openPayment}
        rent={modal.selectedRent}
        onClose={modal.closePaymentModal}
        defaultAmount={rentRecord?.rentAmount}
      />
    </Box>
  );
}

