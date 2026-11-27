import { Link as RouterLink } from 'react-router-dom';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import { alpha, Box, Button, ButtonBase, Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography } from '@mui/material';
import AppIcon from 'components/AppIcon';
import celebrationArt from 'assets/images/signup-celebration.png';
import { ONLINE_PAYMENT_SETUP_PATH } from 'utils/onlinePaymentTabs';

const options = [
  {
    title: 'Set up online payments',
    description: 'Give tenants the option to pay rent online.',
    href: ONLINE_PAYMENT_SETUP_PATH
  },
  {
    title: 'Ask questions',
    description: 'Get in touch with Property Peace support.',
    href: '/landlord/support/ticket'
  }
];

export default function OwnerWelcomeDialog({ onClose }) {
  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="owner-welcome-title"
      aria-describedby="owner-welcome-intro"
      slotProps={{ paper: { sx: { m: { xs: 2, sm: 4 }, width: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 64px)' }, borderRadius: 4 } } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Stack
          alignItems="center"
          sx={(theme) => ({
            position: 'relative',
            px: { xs: 3, sm: 5 },
            pt: { xs: 2, sm: 2.5 },
            pb: { xs: 3, sm: 4 },
            textAlign: 'center',
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08)
          })}
        >
          <IconButton aria-label="Close welcome" onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8, width: 44, height: 44 }}>
            <CloseOutlined style={{ fontSize: 18 }} />
          </IconButton>
          <Box component="img" src={celebrationArt} alt="" width={144} height={144} sx={{ display: 'block', width: { xs: 112, sm: 144 }, height: 'auto' }} />
          <DialogTitle id="owner-welcome-title" sx={{ p: 0, fontSize: { xs: '1.5rem', sm: '1.875rem' }, fontWeight: 750, lineHeight: 1.2 }}>
            Welcome to Property Peace!
          </DialogTitle>
          <Typography id="owner-welcome-intro" color="text.secondary" sx={{ mt: 1.25, maxWidth: '37ch' }}>
            Your account is ready. Add a property to start managing your rentals.
          </Typography>
          <Button
            component={RouterLink}
            to="/landlord/properties/add?from=signup"
            replace
            variant="contained"
            startIcon={<AppIcon name="house" size={18} />}
            sx={{ mt: 2.5, minHeight: 44, px: 2.5, textTransform: 'none' }}
          >
            Add your first property
          </Button>
        </Stack>
        <Stack sx={{ px: { xs: 2.5, sm: 4 }, pt: 2.5, pb: 2 }}>
          <Divider sx={{ typography: 'body2', color: 'text.secondary' }}>Or</Divider>
          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
            {options.map((option) => (
              <ButtonBase
                key={option.href}
                component={RouterLink}
                to={option.href}
                replace
                sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5,
                  p: 1.75, textAlign: 'left', textDecoration: 'none', color: 'text.primary', border: '1px solid',
                  borderColor: 'divider', borderRadius: 2, '&:hover': { bgcolor: 'action.hover' },
                  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 }
                }}
              >
                <span>
                  <Typography component="span" variant="body2" fontWeight={700} sx={{ display: 'block' }}>{option.title}</Typography>
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{option.description}</Typography>
                </span>
                <AppIcon name="arrowRight" size={16} style={{ marginTop: 2 }} />
              </ButtonBase>
            ))}
          </Box>
          <Button onClick={onClose} sx={{ mt: 1, alignSelf: 'center', minHeight: 44, textTransform: 'none' }}>View dashboard</Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
