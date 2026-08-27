import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';

// material-ui
import { Alert } from '@mui/material';

import FriendlyLoadError from 'components/FriendlyLoadError';

const reloadPage = () => window.location.reload();

// ==============================|| ELEMENT ERROR - COMMON ||============================== //

export default function ErrorBoundary() {
  const error = useRouteError();

  // Check if it's a chunk load error (dynamic import failure)
  const isChunkError =
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Loading chunk') ||
    error?.name === 'ChunkLoadError' ||
    (error?.message && typeof error.message === 'string' && error.message.includes('chunk'));

  if (isChunkError) {
    return <FriendlyLoadError onRetry={reloadPage} fullPage />;
  }

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <Alert color="error">Error 404 - This page doesn't exist!</Alert>;
    }

    if (error.status === 401) {
      return <Alert color="error">Error 401 - You aren't authorized to see this</Alert>;
    }

    if (error.status === 503) {
      return <Alert color="error">Error 503 - Looks like our API is down</Alert>;
    }

    if (error.status === 418) {
      return <Alert color="error">Error 418 - Contact administrator</Alert>;
    }
  }

  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Alert severity="error" sx={{ maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          Unexpected Error
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {error?.message || 'An unexpected error occurred'}
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()} sx={{ mt: 1 }}>
          Reload Page
        </Button>
      </Alert>
    </Box>
  );
}
