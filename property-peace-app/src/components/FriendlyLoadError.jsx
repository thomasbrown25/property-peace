import PropTypes from 'prop-types';
import { Box, Button, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

import propertyPeaceMark from 'assets/images/logos/logo.png';

export default function FriendlyLoadError({ onRetry, fullPage = false }) {
  return (
    <Box
      role="alert"
      aria-live="polite"
      sx={{
        minHeight: fullPage ? '100vh' : { xs: 420, sm: 520 },
        px: { xs: 2, sm: 3 },
        py: { xs: 5, sm: 7 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(fullPage && { bgcolor: 'background.default' })
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 560,
          px: { xs: 3, sm: 6 },
          py: { xs: 4.5, sm: 5.5 },
          textAlign: 'center',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          boxShadow: (theme) => `0 18px 50px ${alpha(theme.palette.brand.forest, theme.palette.mode === 'dark' ? 0.3 : 0.1)}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0 0 auto',
            height: 4,
            background: (theme) => `linear-gradient(90deg, ${theme.palette.brand.forest} 0%, ${theme.palette.brand.teal} 62%, ${theme.palette.brand.mint} 100%)`
          }
        }}
      >
        <Box
          component="img"
          src={propertyPeaceMark}
          alt="Property Peace bird carrying an olive branch"
          sx={{
            display: 'block',
            width: { xs: 150, sm: 180 },
            height: 'auto',
            mx: 'auto',
            mb: 2.5,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? theme.palette.brand.ivory : 'transparent',
            borderRadius: 2,
            p: (theme) => theme.palette.mode === 'dark' ? 1.5 : 0
          }}
        />

        <Typography variant="h3" component="h1" sx={{ color: 'text.primary', fontSize: { xs: '1.5rem', sm: '1.8rem' }, mb: 1.25 }}>
          Sorry, we ran into an issue
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 3, lineHeight: 1.7 }}>
          We couldn’t load this page right now. Please try again, and we’ll get you back to managing your properties.
        </Typography>
        <Button
          variant="contained"
          onClick={onRetry}
          color="primary"
          sx={{
            minWidth: 132,
            px: 3,
            py: 1.15,
            borderRadius: 1.5
          }}
        >
          Try again
        </Button>
      </Box>
    </Box>
  );
}

FriendlyLoadError.propTypes = {
  onRetry: PropTypes.func.isRequired,
  fullPage: PropTypes.bool
};
