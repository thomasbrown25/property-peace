import { Suspense, Component } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';

// project imports
import Loader from './Loader';

// ==============================|| LOADABLE - LAZY LOADING ||============================== //

// Error Boundary for catching dynamic import failures
class LoadableErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    // Check if it's a dynamic import error
    if (error?.message?.includes('Failed to fetch dynamically imported module') || 
        error?.message?.includes('Loading chunk') ||
        error?.name === 'ChunkLoadError') {
      return { hasError: true, error };
    }
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Loadable error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }));
    // Force a page reload to clear any cached module issues
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Failed to Load Module
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              There was an error loading this page. This can happen if the application was recently updated.
            </Typography>
            <Button variant="contained" onClick={this.handleRetry} sx={{ mt: 1 }}>
              Reload Page
            </Button>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

const Loadable = (Component) => (props) => {
  return (
    <LoadableErrorBoundary>
      <Suspense fallback={<Loader />}>
        <Component {...props} />
      </Suspense>
    </LoadableErrorBoundary>
  );
};

export default Loadable;
