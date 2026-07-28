import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import React, { useState } from 'react';
import { useDrawer } from 'contexts/DrawerContext';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Divider, Stack, Chip, Button, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PropertySelect from 'components/PropertySelect';
import { useSelector } from 'react-redux';
import { selectLease } from 'store/lease/lease.selector';
import { selectProperty } from 'store/property/property.selector';

const LeaseViewDrawer = () => {
  const drawer = useDrawer();
  const navigate = useNavigate();
  const lease = useSelector(selectLease);
  const selectedProperty = useSelector(selectProperty);
  const [loading] = useState(false);

  const addLease = () => {
    drawer.closeLeaseViewDrawer();
    drawer.openLeaseAddDrawer();
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

  const handleEditLease = () => {
    drawer.closeLeaseViewDrawer();
    if (lease?.id) {
      navigate(`/landlord/leases/${lease.id}/settings`);
    }
  };

  const NoLeaseComponent = () => (
    <Box textAlign="center" py={6}>
      <CalendarMonthIcon sx={{ fontSize: 48, color: 'gray' }} />
      <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
        No Active Lease
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        This property doesn't have an active lease agreement.
      </Typography>
      <Button variant="contained" onClick={addLease} startIcon={<CalendarMonthIcon />}>
        Add Lease
      </Button>
    </Box>
  );

  const LeaseDetailsComponent = () => (
    <Stack spacing={3}>
      {/* Lease Duration */}
      <Box p={2} border="1px solid" borderColor="divider" borderRadius={1}>
        <Stack direction="row" justifyContent="space-between" mb={2}>
          <Typography variant="subtitle1">Lease Duration</Typography>
          {lease.isActive && <Chip label="Active" color="success" size="small" />}
        </Stack>

        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonthIcon color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Start Date:
            </Typography>
            <Typography variant="body2">{formatDate(lease.startDate)}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonthIcon color="error" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              End Date:
            </Typography>
            <Typography variant="body2">{formatDate(lease.endDate)}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <AccessTimeIcon color="secondary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Lease Length:
            </Typography>
            <Typography variant="body2">{lease.leaseLength} months</Typography>
          </Stack>
        </Stack>
      </Box>

      {/* Rent Information */}
      <Box p={2} border="1px solid" borderColor="divider" borderRadius={1}>
        <Stack direction="row" justifyContent="space-between" mb={2}>
          <Typography variant="subtitle1">Rent Information</Typography>
          {lease.overdueAmount === 0 ? (
            <Chip label="Paid" color="success" size="small" />
          ) : (
            <Chip label="Overdue" color="error" size="small" />
          )}
        </Stack>

        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AttachMoneyIcon sx={{ color: 'green' }} />
            <Typography variant="body2" color="text.secondary">
              Rent Amount:
            </Typography>
            <Typography variant="body1" fontWeight="medium" color="success.main">
              {formatCurrency(lease.rentAmount)}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <AccessTimeIcon color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Frequency:
            </Typography>
            <Typography variant="body2">{lease.rentFrequency}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonthIcon sx={{ color: 'orange' }} fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Due Day:
            </Typography>
            <Typography variant="body2">
              {lease.rentDueDay === 1 ? '1st' : lease.rentDueDay === 2 ? '2nd' : lease.rentDueDay === 3 ? '3rd' : `${lease.rentDueDay}th`}{' '}
              of each month
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={drawer.isOpenLeaseView}
      onClose={drawer.closeLeaseViewDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520, md: 560 },
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
          <Typography variant="h6">Lease Information</Typography>
          <IconButton onClick={drawer.closeLeaseViewDrawer}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />

        {/* Body */}
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
          <Stack spacing={3}>
            {/* Property Selection */}
            <Box>
              <PropertySelect selectedProperty={selectedProperty} placeholder="Choose a property to view lease..." />
            </Box>

            <Divider />

            {/* Lease Content */}
            {selectedProperty ? (
              loading ? (
                <Box textAlign="center" py={5}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Loading lease information...
                  </Typography>
                </Box>
              ) : lease && lease.id ? (
                <LeaseDetailsComponent />
              ) : (
                <NoLeaseComponent />
              )
            ) : (
              <Box textAlign="center" py={5}>
                <Typography variant="body2" color="text.secondary">
                  Please select a property to view lease information.
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Footer */}
        <Divider />
        <Box display="flex" justifyContent="flex-end" gap={1} p={2}>
          <Button variant="outlined" onClick={drawer.closeLeaseViewDrawer}>
            Close
          </Button>
          {selectedProperty && lease && lease.id && (
            <Button variant="contained" onClick={handleEditLease}>
              Edit Lease
            </Button>
          )}
        </Box>
      </Box>
    </ThemeAdaptiveDrawer>
  );
};

export default LeaseViewDrawer;
