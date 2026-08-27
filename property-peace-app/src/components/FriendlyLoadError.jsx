import PropTypes from 'prop-types';
import { Box, Button, Typography } from '@mui/material';

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
        justifyContent: 'center'
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
          boxShadow: '0 18px 50px rgba(6, 30, 53, 0.08)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0 0 auto',
            height: 4,
            background: 'linear-gradient(90deg, #061e35 0%, #16b364 100%)'
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
            mb: 2.5
          }}
        />

        <Typography variant="h3" component="h1" sx={{ color: '#061e35', fontSize: { xs: '1.5rem', sm: '1.8rem' }, mb: 1.25 }}>
          Sorry, we ran into an issue
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 3, lineHeight: 1.7 }}>
          We couldn’t load this page right now. Please try again, and we’ll get you back to managing your properties.
        </Typography>
        <Button
          variant="contained"
          onClick={onRetry}
          sx={{
            minWidth: 132,
            bgcolor: '#061e35',
            color: '#fff',
            px: 3,
            py: 1.15,
            borderRadius: 1.5,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#0b3458', boxShadow: '0 8px 20px rgba(6, 30, 53, 0.18)' }
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
