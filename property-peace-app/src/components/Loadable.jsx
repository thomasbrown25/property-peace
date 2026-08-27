import { Suspense, Component } from 'react';
// project imports
import FriendlyLoadError from './FriendlyLoadError';
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
    if (
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError'
    ) {
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
      return <FriendlyLoadError onRetry={this.handleRetry} />;
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
