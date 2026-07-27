import { Box, Stack, Typography, useTheme } from '@mui/material';
import { CustomerServiceOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import SupportTicketCenter from 'sections/landlord/support/SupportTicketCenter';

// ==============================|| SUPPORT PAGE ||============================== //

export default function SubmitSupportTicket() {
  const theme = useTheme();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
      <Box>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Support' }
          ]}
        />

        <Box
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            borderRadius: 2,
            p: { xs: 3, md: 4 },
            mb: 3
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <CustomerServiceOutlined style={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'white', mb: 0.75 }}>
                Support
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                Have a question or running into an issue? Our team is here to help.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <SupportTicketCenter />
      </Box>
    </motion.div>
  );
}
