import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

// Deliberately neutral: capability pages must not initialize authenticated shell,
// marketing content, analytics, chat, or third-party identity widgets.
export default function SecureApplicantLayout() {
  return (
    <Box component="main" sx={{ minHeight: '100vh', px: { xs: 2, sm: 3 }, bgcolor: 'background.default' }}>
      <Outlet />
    </Box>
  );
}
