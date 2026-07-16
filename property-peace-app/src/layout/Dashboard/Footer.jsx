import { Link as RouterLink } from 'react-router-dom';
// material-ui
import { Link, Stack, Typography } from '@mui/material';

export default function Footer() {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'space-between',
        p: { xs: '16px 0 0', sm: '24px 16px 0px' },
        gap: { xs: 1, sm: 2 },
        width: '100%',
        height: '100%',
        flexWrap: 'nowrap'
      }}
    >
      <Typography
        variant="caption"
        sx={{
          flexShrink: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          fontSize: { xs: '0.65rem', sm: '0.75rem' }
        }}
      >
        &copy; All rights reserved{' '}
        <Link href="https://www.instagram.com/propertypeace.io/" target="_blank" underline="hover">
          Brownstone Hub LLC
        </Link>
      </Typography>
      <Stack
        direction="row"
        sx={{
          gap: { xs: 1, sm: 1.5 },
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexShrink: 0,
          whiteSpace: 'nowrap'
        }}
      >
        <Link href="https://x.com/Thomasbrown1125" target="_blank" variant="caption" color="text.primary" underline="hover">
          X (Twitter)
        </Link>
        <Link href="https://www.instagram.com/propertypeace.io/" target="_blank" variant="caption" color="text.primary" underline="hover">
          Instagram
        </Link>
        {/* Legal links removed - marketing pages deleted */}
      </Stack>
    </Stack>
  );
}
