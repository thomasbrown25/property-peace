import { Box, CircularProgress, LinearProgress, Typography, Stack } from '@mui/material';

export default function OrganizationCreatingOverlay() {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'background.paper',
        zIndex: 1300, // Below dialog but above content
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        px: 3
      }}
    >
      {/* Spinner */}
      <CircularProgress size={60} thickness={4} />

      {/* Progress Bar */}
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <LinearProgress />
      </Box>

      {/* Message */}
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4" sx={{ fontWeight: 600, textAlign: 'center' }}>
          Creating Your Organization
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Please wait while we create your organization and set up your default lease template...
        </Typography>
      </Stack>
    </Box>
  );
}
