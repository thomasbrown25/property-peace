import { Box, Typography, Stack } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { Fade } from '@mui/material';

// ==============================|| DASHBOARD LOADER ||============================== //

/**
 * Custom loading component specifically for the dashboard.
 * Displays while dashboard components are loading and animating in.
 * Features animated elements and smooth transitions.
 */
export default function DashboardLoader({ visible = true }) {
  const theme = useTheme();

  return (
    <Fade in={visible} timeout={300} unmountOnExit>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'background.paper',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          pointerEvents: visible ? 'auto' : 'none', // Allow clicks through when fading out
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
            animation: '$gradientShift 6s ease infinite',
          },
        }}
      >
        {/* Animated Background Elements */}
        {[...Array(4)].map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 70%)`,
              animation: `$float ${4 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
              top: `${15 + i * 20}%`,
              left: `${10 + i * 25}%`,
              filter: 'blur(15px)',
            }}
          />
        ))}

        {/* Main Content */}
        <Stack spacing={2.5} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
          {/* Animated Icon */}
          <Box
            sx={{
              position: 'relative',
              width: 70,
              height: 70,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 70,
                height: 70,
                borderRadius: '50%',
                border: `2px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                animation: '$pulse 2s ease-in-out infinite',
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 50,
                height: 50,
                borderRadius: '50%',
                border: `3px solid ${theme.palette.primary.main}`,
                borderTopColor: 'transparent',
                animation: '$spin 1s linear infinite',
              },
            }}
          />

          {/* Loading Text */}
          <Stack spacing={0.5} alignItems="center">
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Loading Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Preparing your workspace...
            </Typography>
          </Stack>

          {/* Progress Dots */}
          <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: theme.palette.primary.main,
                  animation: `$bounce 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </Stack>
        </Stack>

        {/* CSS Animations */}
        <Box
          component="style"
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin {
                0% { transform: translate(-50%, -50%) rotate(0deg); }
                100% { transform: translate(-50%, -50%) rotate(360deg); }
              }
              @keyframes pulse {
                0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
                50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
              }
              @keyframes float {
                0%, 100% { transform: translate(0, 0) scale(1); }
                50% { transform: translate(15px, -15px) scale(1.05); }
              }
              @keyframes gradientShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
              }
              @keyframes bounce {
                0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
                40% { transform: scale(1.1); opacity: 1; }
              }
            `,
          }}
        />
      </Box>
    </Fade>
  );
}
