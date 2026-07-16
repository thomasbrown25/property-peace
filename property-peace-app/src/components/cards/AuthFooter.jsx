// material-ui
import { Container } from '@mui/material';
import { Link } from '@mui/material';
import { Typography } from '@mui/material';
import { Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

// ==============================|| FOOTER - AUTHENTICATION ||============================== //

export default function AuthFooter() {
  return (
    <Container maxWidth="xl">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 2, justifyContent: { xs: 'center', sm: 'space-between', textAlign: { xs: 'center', sm: 'inherit' } } }}
      >
        {/* Legal links removed - marketing pages deleted */}
      </Stack>
    </Container>
  );
}
