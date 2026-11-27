import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import paymentsArt from 'assets/images/icons/setup-online-payments.png';
import { dismissOnlinePaymentsIntro, hasSeenOnlinePaymentsIntro } from './onlinePaymentsIntroState.mjs';

export default function OnlinePaymentsIntroDialog({ scopeKey }) {
  const [open, setOpen] = useState(() => !hasSeenOnlinePaymentsIntro(scopeKey));
  const dismiss = () => {
    dismissOnlinePaymentsIntro(scopeKey);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      aria-labelledby="online-payments-intro-title"
      aria-describedby="online-payments-intro-description"
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 4, m: { xs: 2, sm: 4 }, width: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 64px)' } } } }}
    >
      <Box sx={{ position: 'relative', bgcolor: 'surface.nested', textAlign: 'center', px: 3, pt: 2.5, pb: 3 }}>
        <IconButton aria-label="Close online rent payments guide" onClick={dismiss} sx={{ position: 'absolute', top: 8, right: 8, width: 44, height: 44 }}>
          <CloseOutlined style={{ fontSize: 18 }} />
        </IconButton>
        <Box component="img" src={paymentsArt} alt="" width={104} height={104} sx={{ display: 'block', mx: 'auto', objectFit: 'contain' }} />
        <DialogTitle id="online-payments-intro-title" sx={{ p: 0, mt: 0.75, fontSize: { xs: '1.4rem', sm: '1.7rem' }, fontWeight: 750, lineHeight: 1.25 }}>
          How online rent payments work
        </DialogTitle>
        <Typography id="online-payments-intro-description" color="text.secondary" sx={{ mt: 0.75 }}>
          Give tenants the option to pay rent through Property Peace.
        </Typography>
      </Box>
      <DialogContent sx={{ px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography component="h3" variant="subtitle1" fontWeight={700}>Set up your Stripe account</Typography>
            <Typography variant="body2" color="text.secondary">
              Property Peace creates a connected Stripe account for your organization. Finish verification with Stripe and link a bank account for payouts. Your setup status and linked bank accounts update here when you return.
            </Typography>
          </Box>
          <Box>
            <Typography component="h3" variant="subtitle1" fontWeight={700}>Collect rent and receive payouts</Typography>
            <Typography variant="body2" color="text.secondary">
              Once online payments are enabled, tenants can pay eligible rent in their portal. Stripe processes each payment, and your payout settings determine which linked bank account receives the funds.
            </Typography>
          </Box>
          <Box>
            <Typography component="h3" variant="subtitle1" fontWeight={700}>Find payment history</Typography>
            <Typography variant="body2" color="text.secondary">
              In Property Peace, go to Finances, then Payments. Choose Stripe transactions to see online payments. After setup, choose Manage in Stripe on the Stripe tab to review activity and payouts in the Stripe Dashboard.
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box component="strong" sx={{ color: 'text.primary' }}>Already use Stripe?</Box>{' '}
            Choose <Box component="span" fontWeight={700}>Connect existing Stripe account</Box> during setup to authorize an eligible Stripe account.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2.5, sm: 4 }, pt: 0, pb: 2.5, flexWrap: 'wrap', gap: 1 }}>
        <Button component={RouterLink} to="/landlord/finances?tab=payments&paymentView=stripe" onClick={dismiss} sx={{ minHeight: 44, textTransform: 'none' }}>
          View payment history
        </Button>
        <Button variant="contained" onClick={dismiss} sx={{ minHeight: 44, textTransform: 'none' }}>Got it</Button>
      </DialogActions>
    </Dialog>
  );
}
