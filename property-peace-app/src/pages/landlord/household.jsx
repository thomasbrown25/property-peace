import { useMemo } from 'react';
import { Box, Typography, Stack, Divider, Grid, Paper, Button, Chip, CircularProgress, IconButton, alpha } from '@mui/material';
import {
  HomeOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  DollarOutlined,
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from 'utils/formatters';
import { formatDate2, formatDateAndTime } from '../../utils/formatters';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import useFetchPayments from 'hooks/useFetchPayments';
import useFetchTenants from 'hooks/useFetchTenants';
import MainCard from 'components/MainCard';
import { useDrawer } from 'contexts/DrawerContext';
import LeaseAddDrawer from 'components/drawers/LeaseAddDrawer';
import TenantAddDrawer from 'components/drawers/TenantAddDrawer';
import TenantEditDrawer from 'components/drawers/TenantEditDrawer';
import useFetchProperty from 'hooks/useFetchProperty';
import HouseholdEditDrawer from 'components/drawers/HouseholdEditDrawer';
import { formatPhone } from '../../utils/formatters';

export default function HouseholdPage() {
  const drawer = useDrawer();
  const navigate = useNavigate();
  const { propertyId } = useParams();

  const { tenants, isLoading } = useFetchTenants();
  const { payments } = useFetchPayments(propertyId);
  const { summary, rentRecords, loading } = useFetchRentCollection(propertyId);
  useFetchProperty(propertyId);

  const householdTenants = tenants.filter((t) => t.propertyId === Number(propertyId));

  const property = householdTenants[0]?.property || {
    id: propertyId,
    name: householdTenants[0]?.propertyName || 'Unknown Property',
    unitName: householdTenants[0]?.unitName,
    isSingleUnitPortfolio: householdTenants[0]?.propertyType?.toLowerCase() === 'singlefamily',
    isActive: householdTenants.some((t) => t.isActive)
  };

  const propertyDisplay = property?.isSingleUnitPortfolio ? property.name : `${property.name} – ${property.unitName}`;

  const balanceDue = useMemo(() => summary?.balanceDue ?? 0, [summary]);

  const lastPayment = useMemo(() => {
    if (summary?.lastPaymentDate && summary?.lastPaymentAmount) {
      return {
        date: summary.lastPaymentDate,
        amount: summary.lastPaymentAmount
      };
    }

    if (rentRecords?.length) {
      const mostRecent = [...rentRecords].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0];
      return {
        date: mostRecent?.paymentDate,
        amount: mostRecent?.amountPaid
      };
    }

    return { date: null, amount: 0 };
  }, [summary, rentRecords]);

  return (
    <Box>
      {/* --- Header Section --- */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Button startIcon={<ArrowLeftOutlined />} onClick={() => navigate('/landlord/leases')} variant="text" color="inherit">
              Back
            </Button>
            <HomeOutlined style={{ fontSize: 24, color: '#722ed1' }} />
            <Typography variant="h4" fontWeight="bold">
              {propertyDisplay}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" color="primary" startIcon={<EditOutlined />} onClick={drawer.openHouseholdEditDrawer}>
              Edit Household
            </Button>
            <Button variant="contained" color="primary" startIcon={<PlusOutlined />} onClick={drawer.openTenantAddDrawer}>
              Add Tenant
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* --- Main Content --- */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Left Column: Household & Tenants */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              height: '100%',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Household Members
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {isLoading ? (
              <Box textAlign="center" py={4}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Loading tenants...
                </Typography>
              </Box>
            ) : householdTenants.length > 0 ? (
              <Stack spacing={2}>
                {householdTenants.map((tenant) => (
                  <Paper key={tenant.id} variant="outlined" sx={{ p: 2, borderColor: tenant.isActive ? 'success.light' : 'grey.300' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <UserOutlined style={{ color: '#1890ff' }} />
                        <Typography variant="subtitle1">
                          {tenant.firstname} {tenant.lastname}
                        </Typography>
                      </Stack>
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        startIcon={<EditOutlined />}
                        onClick={() => drawer.openTenantEditDrawer(tenant)}
                      >
                        Edit
                      </Button>
                    </Stack>

                    <Stack spacing={1} mt={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PhoneOutlined style={{ color: '#41a541' }} />
                        <Typography variant="body2">{formatPhone(tenant.phoneNumber) || 'N/A'}</Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <MailOutlined style={{ color: '#fa8c16' }} />
                        <Typography variant="body2">{tenant.email || 'N/A'}</Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <CalendarOutlined style={{ color: '#1890ff' }} />
                        <Typography variant="body2">
                          Lease: {formatDate2(tenant.leaseStartDate)} –{' '}
                          {tenant.leaseEndDate ? formatDate2(tenant.leaseEndDate) : 'No lease'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No tenants assigned to this household.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Right Column: Financials */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              height: '100%',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Financial Overview
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {loading ? (
              <Box textAlign="center" py={5}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Loading rent collection data...
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <DollarOutlined style={{ color: '#cf1322' }} />
                  <Typography variant="body2">Balance Due: {formatCurrency(balanceDue)}</Typography>
                </Stack>

                <Divider sx={{ my: 1 }} />

                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarOutlined style={{ color: '#1890ff' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Recent Payments
                  </Typography>
                </Stack>
                {payments?.length ? (
                  payments.slice(0, 5).map((p) => (
                    <Stack key={p.id} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">{formatDateAndTime(p.paymentDate)}</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(p.amount)}
                      </Typography>
                    </Stack>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No payment history available.
                  </Typography>
                )}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
        {householdTenants[0]?.leaseId ? (
          <Button variant="contained" color="primary" onClick={() => navigate(`/landlord/leases/${householdTenants[0]?.leaseId}`)}>
            View Lease Details
          </Button>
        ) : (
          <Button variant="contained" color="primary" onClick={drawer.openLeaseAddDrawer}>
            Add Lease
          </Button>
        )}
      </Stack>
      <LeaseAddDrawer />
      <TenantAddDrawer />
      <TenantEditDrawer />
      <HouseholdEditDrawer propertyId={propertyId} />
    </Box>
  );
}
