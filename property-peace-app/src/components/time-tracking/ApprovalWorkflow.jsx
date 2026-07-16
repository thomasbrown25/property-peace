import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Stack,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { timeEntryAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { formatDate } from 'utils/formatters';

const formatHours = (hours) => {
  if (!hours) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export default function ApprovalWorkflow({ 
  open, 
  onClose, 
  timeEntry,
  onSuccess 
}) {
  const [action, setAction] = useState(null); // 'approve' or 'reject'
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleApprove = async () => {
    if (!timeEntry?.id) return;
    
    try {
      setSubmitting(true);
      setError(null);
      const response = await timeEntryAPI.approveTimeEntry(timeEntry.id);
      
      if (response?.data?.success) {
        openSnackbar({
          open: true,
          message: 'Time entry approved successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        onSuccess?.();
        onClose();
        resetForm();
      } else {
        throw new Error(response?.data?.message || 'Failed to approve time entry');
      }
    } catch (err) {
      console.error('Error approving time entry:', err);
      setError(err?.response?.data?.message || 'Failed to approve time entry');
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to approve time entry',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!timeEntry?.id) return;
    
    if (!rejectReason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const response = await timeEntryAPI.rejectTimeEntry(timeEntry.id, { reason: rejectReason });
      
      if (response?.data?.success) {
        openSnackbar({
          open: true,
          message: 'Time entry rejected successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        onSuccess?.();
        onClose();
        resetForm();
      } else {
        throw new Error(response?.data?.message || 'Failed to reject time entry');
      }
    } catch (err) {
      console.error('Error rejecting time entry:', err);
      setError(err?.response?.data?.message || 'Failed to reject time entry');
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Failed to reject time entry',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setAction(null);
    setRejectReason('');
    setError(null);
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  if (!timeEntry) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Review Time Entry</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {error && (
            <Alert severity="error">{error}</Alert>
          )}

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Staff Member
            </Typography>
            <Typography variant="body1">
              {timeEntry.staffMemberName || 'Unknown'}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Property
            </Typography>
            <Typography variant="body1">
              {timeEntry.propertyName || 'Unknown'}
              {timeEntry.unitName && ` • ${timeEntry.unitName}`}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Date & Time
            </Typography>
            <Typography variant="body1">
              {timeEntry.startTime ? formatDate(timeEntry.startTime) : '-'}
              {timeEntry.startTime && timeEntry.endTime && (
                <>
                  {' • '}
                  {new Date(timeEntry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                  {new Date(timeEntry.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </>
              )}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Hours Worked
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {formatHours(timeEntry.hoursWorked)}
            </Typography>
          </Box>

          {timeEntry.description && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {timeEntry.description}
              </Typography>
            </Box>
          )}

          {timeEntry.notes && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Notes
              </Typography>
              <Typography variant="body1">
                {timeEntry.notes}
              </Typography>
            </Box>
          )}

          <Divider />

          {action === 'reject' && (
            <TextField
              fullWidth
              label="Rejection Reason *"
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                setError(null);
              }}
              multiline
              rows={3}
              error={!!error && !rejectReason.trim()}
              helperText={error && !rejectReason.trim() ? error : 'Please provide a reason for rejection'}
              required
            />
          )}

          {action === null && (
            <Typography variant="body2" color="text.secondary">
              Choose an action below to approve or reject this time entry.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        {action === null ? (
          <>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CloseOutlined />}
              onClick={() => setAction('reject')}
              disabled={submitting}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckOutlined />}
              onClick={handleApprove}
              disabled={submitting}
            >
              Approve
            </Button>
          </>
        ) : action === 'reject' ? (
          <Button
            variant="contained"
            color="error"
            startIcon={submitting ? <CircularProgress size={16} /> : <CloseOutlined />}
            onClick={handleReject}
            disabled={submitting || !rejectReason.trim()}
          >
            {submitting ? 'Rejecting...' : 'Confirm Rejection'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

ApprovalWorkflow.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  timeEntry: PropTypes.object,
  onSuccess: PropTypes.func
};
