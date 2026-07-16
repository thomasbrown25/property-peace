import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Alert } from '@mui/material';
import { WarningAmberOutlined } from '@mui/icons-material';

export default function OrphanedSubscriptionModal({ open, onClose, onFix, subscription, loading = false }) {
  const handleFix = async () => {
    if (onFix) {
      await onFix();
      // Modal will close when redirect happens, or stay open if error occurs
      // Don't close here - let the parent handle it
    }
  };

  const planName = subscription?.plan?.name || 'your current plan';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberOutlined color="warning" />
          <Typography variant="h6">Subscription Payment Issue</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          There is an issue with your subscription payment information.
        </Alert>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Your subscription exists, but we need to update your payment details. Please click the button below to re-enter your payment information.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You will be taken through the payment setup process for <strong>{planName}</strong>. Once completed, your subscription will be fully activated.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleFix} variant="contained" color="primary" disabled={loading}>
          {loading ? 'Processing...' : 'Update Payment Information'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
