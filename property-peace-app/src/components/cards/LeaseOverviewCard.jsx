// material-ui
import {
  Box,
  Typography,
  Divider,
  Stack,
  Chip,
  Button,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  alpha
} from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { AccessTime } from '@mui/icons-material';
import { AttachMoneyRounded } from '@mui/icons-material';
import { ErrorOutline } from '@mui/icons-material';
import { formatCurrency, formatDate, formatRentStatus, getRentStatusColor } from 'utils/formatters';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { updateLease } from 'store/lease/lease.action';
import { useNavigate } from 'react-router';

const LeaseOverviewCard = ({ lease, rentRecord, boxShadow }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [openConfirm, setOpenConfirm] = useState(false);

  // Check if lease is a draft (isDrafted = true or signatureStatus === 0)
  const isDraft = lease?.leaseAgreement?.isDrafted === true ||
                  lease?.isDrafted === true || lease?.IsDrafted === true ||
                  lease?.isDrafted === 1 || lease?.IsDrafted === 1 ||
                  lease?.leaseAgreement?.signatureStatus === 0 ||
                  lease?.signatureStatus === 0 || lease?.SignatureStatus === 0;
  
  // Check if lease hasn't started (startDate is in the future)
  const isNotStarted = lease?.startDate && new Date(lease.startDate) > new Date();
  
  // Check if lease has started (startDate is in the past or today)
  const hasStarted = lease?.startDate && new Date(lease.startDate) <= new Date();
  
  // Get payment status from rent record
  const paymentStatus = rentRecord?.status;

  const onEditLease = () => {
    // Implement edit lease functionality
    console.log('Edit Lease clicked');
  };

  const onEndLeaseClick = () => {
    setOpenConfirm(true);
  };

  const handleClose = () => {
    setOpenConfirm(false);
  };

  const handleConfirmEndLease = async () => {
    setOpenConfirm(false);
    const updatedLease = { ...lease, isActive: false };
    await dispatch(updateLease(updatedLease));
  };

  const handleCardClick = (e) => {
    // Only navigate if clicking on the card itself, not on action buttons
    const target = e.target;
    const isActionElement = 
      target.closest('button') || 
      target.closest('[role="button"]') ||
      target.closest('.MuiButton-root');
    
    if (!isActionElement && lease?.id) {
      navigate(`/landlord/leases/${lease.id}`);
    }
  };

  return (
    <>
      <Paper
        variant="outlined"
        onClick={handleCardClick}
        sx={{
          p: 2,
          maxWidth: 600,
          cursor: lease?.id ? 'pointer' : 'default',
          bgcolor: (t) => 
            isNotStarted 
              ? alpha(t.palette.warning.main, 0.04)
              : boxShadow && alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => 
            isNotStarted
              ? `0 0 20px ${alpha(t.palette.warning.main, 0.15)}`
              : boxShadow && `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
          borderLeft: (t) =>
            isNotStarted
              ? `4px solid ${t.palette.warning.main}`
              : 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: lease?.id ? 'translateY(-2px)' : 'none',
            boxShadow: (t) => 
              lease?.id
                ? isNotStarted
                  ? `0 4px 24px ${alpha(t.palette.warning.main, 0.2)}`
                  : `0 4px 24px ${alpha(t.palette.primary.main, 0.2)}`
                : undefined
          }
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle1" fontWeight="bold">
              {lease?.propertyName}
            </Typography>
            {lease?.propertyType?.toLowerCase() !== 'singlefamily' && lease?.unitName && (
              <Chip
                label={lease.unitName}
                variant="outlined"
                color="primary"
                size="small"
              />
            )}
          </Stack>
          {/* Show only one status at a time - priority: Draft > Not Started > Active > Ended > Payment Status */}
          {isDraft ? (
            <Chip label="Draft" color="primary" size="small" variant="filled" sx={{ fontWeight: 700 }} />
          ) : !lease?.isActive ? (
            <Chip label="Ended" color="default" size="small" variant="outlined" />
          ) : lease?.isActive && !isDraft && isNotStarted ? (
            <Chip label="Not Started" color="warning" size="small" variant="filled" sx={{ fontWeight: 700 }} />
          ) : lease?.isActive && !isDraft && hasStarted ? (
            <Chip label="Active" color="success" size="small" variant="filled" sx={{ fontWeight: 700 }} />
          ) : paymentStatus ? (
            <Chip
              label={formatRentStatus(paymentStatus)}
              color={getRentStatusColor(paymentStatus)}
              size="small"
              variant={paymentStatus === 'overdue' ? 'filled' : 'outlined'}
              sx={{ fontWeight: paymentStatus === 'overdue' ? 700 : 500 }}
            />
          ) : null}
        </Stack>

        {/* Lease Duration */}
        <Stack spacing={1} mb={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonth color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Start Date:
            </Typography>
            <Typography variant="body2">{formatDate(lease?.startDate)}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonth color="error" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              End Date:
            </Typography>
            <Typography variant="body2">{formatDate(lease?.endDate)}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <AccessTime color="secondary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Lease Length:
            </Typography>
            <Typography variant="body2">{lease?.leaseLength} months</Typography>
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {/* Rent Information */}
        <Stack spacing={1} mb={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AttachMoneyRounded sx={{ color: 'green' }} />
            <Typography variant="body2" color="text.secondary">
              Rent Amount:
            </Typography>
            <Typography variant="body1" fontWeight="medium" color="success.main">
              {formatCurrency(lease?.rentAmount)}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <AccessTime color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Frequency:
            </Typography>
            <Typography variant="body2">{lease?.rentFrequency}</Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonth sx={{ color: 'orange' }} fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Due Day:
            </Typography>
            <Typography variant="body2">
              {lease?.rentDueDay === 1
                ? '1st'
                : lease?.rentDueDay === 2
                  ? '2nd'
                  : lease?.rentDueDay === 3
                    ? '3rd'
                    : `${lease?.rentDueDay}th`}{' '}
              of each month
            </Typography>
          </Stack>
        </Stack>

        {/* Actions */}
        <Box display="flex" justifyContent="space-between" onClick={(e) => e.stopPropagation()}>
          {isDraft ? (
            <Button 
              size="small" 
              variant="contained" 
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/landlord/leases/${lease.id}`);
              }}
            >
              Finish Lease Setup
            </Button>
          ) : (
            <>
              <Button 
                size="small" 
                variant="outlined" 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/landlord/leases/${lease.id}`);
                }}
              >
                View Lease
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                color="error" 
                onClick={(e) => {
                  e.stopPropagation();
                  onEndLeaseClick();
                }} 
                startIcon={<ErrorOutline />}
              >
                End Lease
              </Button>
            </>
          )}
        </Box>
      </Paper>
      {/* Confirmation Dialog */}
      <Dialog
        open={openConfirm}
        onClose={handleClose}
        sx={{ '& .MuiDialog-paper': { p: 1, border: '1px solid rgba(255, 255, 255, 0.05)' } }}
      >
        <DialogTitle>Confirm Lease Termination</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to end this lease?</Typography>
        </DialogContent>
        <DialogActions sx={{ margin: '0 auto' }}>
          <Button onClick={handleClose} color="info" variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirmEndLease} color="error" variant="contained">
            End Lease
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LeaseOverviewCard;
