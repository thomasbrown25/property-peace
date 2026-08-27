import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import SupportTicketCenter from 'sections/landlord/support/SupportTicketCenter';

// ==============================|| SUPPORT PAGE ||============================== //

export default function SubmitSupportTicket() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
      <Box>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Support' }
          ]}
        />

        <Box sx={{ mb: 3 }}>
          <Typography component="h1" variant="h3" sx={{ fontWeight: 750 }}>
            Support
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
            Have a question or running into an issue? Our team is here to help.
          </Typography>
        </Box>

        <SupportTicketCenter />
      </Box>
    </motion.div>
  );
}
