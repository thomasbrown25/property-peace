import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

// project imports
import MainRoutes from './MainRoutes';
import LoginRoutes from './LoginRoutes';
import ErrorBoundary from './ErrorBoundary';
import Loadable from 'components/Loadable';

const MaintenancePage = Loadable(lazy(() => import('pages/maintenance')));
const MobileSignupChallenge = lazy(() => import('pages/auth/jwt/mobile-signup-challenge'));

// ==============================|| ROUTING RENDER ||============================== //

// Get base path - must match Vite's base configuration
const getBasePath = () => {
  const baseName = import.meta.env.VITE_APP_BASE_NAME?.trim();
  // Vite's base path defaults to '/' if not set or empty
  return baseName && baseName !== '' && baseName !== '/' ? baseName : '/';
};

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Navigate to="/login" replace />,
      errorElement: <ErrorBoundary />
    },
    {
      path: '/maintenance',
      element: <MaintenancePage />,
      errorElement: <ErrorBoundary />
    },
    {
      path: '/mobile-signup-challenge',
      element: <Suspense fallback={<div>Loading security check…</div>}><MobileSignupChallenge /></Suspense>,
      errorElement: <ErrorBoundary />
    },
    LoginRoutes,
    MainRoutes
  ],
  { 
    // Set basename to match Vite's base path (always '/' in production)
    // This ensures router and chunk loading paths are consistent
    basename: getBasePath() !== '/' ? getBasePath() : undefined
  }
);

export default router;
