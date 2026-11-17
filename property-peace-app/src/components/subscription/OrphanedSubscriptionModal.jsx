import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Alert } from '@mui/material';
import { WarningAmberOutlined } from '@mui/icons-material';

export default function OrphanedSubscriptionModal({ open, onClose, onFix, subscription }) {
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
          Your existing subscription is missing billing-provider information. Self-service checkout is not available for legacy paid plans.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Contact support to review billing for <strong>{planName}</strong>. Your payment details have not been updated, and no new subscription has been started.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>
          Close
        </Button>
        <Button onClick={onFix} variant="contained" color="primary">
          Contact support
        </Button>
      </DialogActions>
    </Dialog>
  );
}
