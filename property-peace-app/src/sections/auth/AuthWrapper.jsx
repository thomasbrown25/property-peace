import PropTypes from 'prop-types';
import { useSearchParams, Link as RouterLink, useLocation } from 'react-router-dom';
import { Suspense } from 'react';

// material-ui
import { Grid } from '@mui/material';
import { Alert } from '@mui/material';
import { Typography } from '@mui/material';
import { Link } from '@mui/material';
import { Box } from '@mui/material';
import { Stack } from '@mui/material';
import { Container } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// project imports
import AuthFooter from 'components/cards/AuthFooter';
import Loader from 'components/Loader';
import Header from 'layout/Simple/Header';
import propertyPeaceDark from 'assets/images/logos/property-peace-dark.png';
import propertyPeaceDark2 from 'assets/images/logos/property-peace-dark-2.png';
import { ThemeMode } from 'config';

import useAuth from 'hooks/useAuth';
import { getFocusedAuthShellPresentation } from 'utils/authShellPresentation';

// assets
import AuthBackground from './AuthBackground';
import ExclamationCircleOutlined from '@ant-design/icons/ExclamationCircleOutlined';

// ==============================|| AUTHENTICATION - WRAPPER ||============================== //

export default function AuthWrapper({ children, splitScreen = false, focused = false }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  const authLogo = theme.palette.mode === ThemeMode.DARK ? propertyPeaceDark : propertyPeaceDark2;
  const isRegistrationFlow = location.pathname.includes('/register') || location.pathname.includes('/tenant/invite');

  const [searchParams] = useSearchParams();
  const authParam = searchParams.get('auth') || '';

  let documentationLink = 'https://codedthemes.gitbook.io/mantis/authentication';

  switch (authParam) {
    case 'auth0':
      documentationLink = 'https://codedthemes.gitbook.io/mantis/authentication/switch-to-auth0';
      break;
    case 'firebase':
      documentationLink = 'https://codedthemes.gitbook.io/mantis/authentication/switch-to-firebase';
      break;
    case 'aws':
      documentationLink = 'https://codedthemes.gitbook.io/mantis/authentication/switch-to-aws-cognito';
      break;
    case 'supabase':
      documentationLink = 'https://codedthemes.gitbook.io/mantis/authentication/switch-to-supabase';
      break;
  }

  if (focused) {
    const presentation = getFocusedAuthShellPresentation(theme.palette.mode);
    const focusedLogo = presentation.logoVariant === 'dark' ? propertyPeaceDark : propertyPeaceDark2;

    return (
      <Box sx={{ minHeight: '100svh', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
        {presentation.showDecorativeBackground && <AuthBackground />}
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            px: { xs: 3, sm: 4, md: 6 },
            py: { xs: 2, md: 2.5 }
          }}
        >
          <RouterLink to="/" aria-label="Property Peace home">
            <img src={focusedLogo} alt="Property Peace" style={{ display: 'block', height: 52, width: 'auto' }} />
          </RouterLink>
        </Box>

        <Box
          component="main"
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 3, sm: 4 },
            pt: { xs: 3, md: 4 },
            pb: { xs: 7, md: 12 }
          }}
        >
          <Box sx={{ width: '100%', maxWidth: presentation.contentMaxWidth }}>{children}</Box>
        </Box>
      </Box>
    );
  }
  // Split screen layout for login page
  if (splitScreen) {
    return (
      <Box sx={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Left Side - White Background with Form */}
        <Box
          sx={{
            width: { xs: '100%', md: '50%' },
            minHeight: { xs: '50vh', md: '100vh' },
            bgcolor: 'background.paper', // White background
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1
          }}
        >
          {/* Header with Logo and Sign Up Link */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pt: 1,
              pb: 1,
              px: { xs: 3, sm: 4, md: 6 }
            }}
          >
            {/* Logo - Left */}
            <RouterLink to="/">
              <img src={authLogo} alt="Property Peace" style={{ height: 52, width: 'auto' }} />
            </RouterLink>

            {/* Sign Up/Login Link - Right */}
            <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
              {location.pathname.includes('/register') || location.pathname.includes('/tenant/invite/') ? (
                <>
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'none', md: 'inline' } }}>
                    Already have an account?{' '}
                  </Box>
                  <Link
                    component={RouterLink}
                    to={isLoggedIn ? '/auth/login' : '/login'}
                    sx={{
                      color: 'text.primary',
                      textDecoration: 'none',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      px: 2,
                      py: 0.75,
                      '&:hover': {
                        bgcolor: 'action.hover',
                        borderColor: 'text.secondary',
                        color: 'text.primary'
                      }
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'inline', md: 'none' } }}>
                      Login
                    </Box>
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'none', md: 'inline' } }}>
                      Login
                    </Box>
                  </Link>
                </>
              ) : (
                <>
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'none', md: 'inline' } }}>
                    Don't have an account?{' '}
                  </Box>
                  <Link
                    component={RouterLink}
                    to={isLoggedIn ? '/auth/register' : '/register'}
                    sx={{
                      color: 'primary.main',
                      textDecoration: 'none',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      border: '1px solid',
                      borderColor: 'primary.main',
                      borderRadius: 1,
                      px: 2,
                      py: 0.75,
                      '&:hover': {
                        bgcolor: 'primary.main',
                        color: (t) => (t.palette.mode === 'dark' ? '#000000' : '#ffffff')
                      }
                    }}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </Typography>
          </Box>

          {/* Form Content - Centered */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: { xs: 3, sm: 4, md: 6 },
              pb: { xs: 4, md: 6 }
            }}
          >
            <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: isRegistrationFlow ? 680 : 400 } }}>{children}</Box>
          </Box>
        </Box>

        {/* Right Side - Branded product story */}
        <Box
          sx={{
            width: { xs: '100%', md: '50%' },
            minHeight: { xs: '50vh', md: '100vh' },
            position: 'relative',
            display: { xs: 'none', sm: 'none', md: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            px: { md: 6, lg: 9 },
            py: 8,
            color: '#ffffff',
            background: '#061e35',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 82% 76%, rgba(65, 165, 65, 0.12), transparent 34%)',
              zIndex: 0
            }
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560 }}>
            <Typography
              component="h2"
              sx={{
                mb: 2,
                color: '#ffffff',
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: '-0.025em',
                fontSize: { md: 40, lg: 50 }
              }}
            >
              A calmer way to manage your rentals.
            </Typography>

            <Typography
              sx={{
                maxWidth: 470,
                mb: 3.5,
                color: 'rgba(255,255,255,0.74)',
                fontSize: { md: 17, lg: 18 },
                lineHeight: 1.7
              }}
            >
              Keep properties, rent, maintenance, documents, and tenant communication together in one clear workspace.
            </Typography>

            <Stack spacing={2.25}>
              {[
                'See rent, leases, and maintenance at a glance',
                'Keep documents and conversations organized',
                'Give tenants a simple, professional experience'
              ].map((item) => (
                <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    aria-hidden
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: 'rgba(65, 165, 65,.16)',
                      color: '#78c578',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800
                    }}
                  >
                    ✓
                  </Box>
                  <Typography sx={{ color: 'rgba(255,255,255,.88)', fontSize: 16 }}>{item}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>
      </Box>
    );
  }

  // Original layout for register and other pages
  return (
    <Box sx={{ minHeight: '100vh', position: 'relative' }}>
      <AuthBackground />
      {/* Header with full navbar - same as landing page, but hide auth buttons and navigation links, center logo */}
      <Suspense fallback={<Loader />}>
        <Header hideAuthButtons hideNavigationLinks centerLogo />
      </Suspense>

      {/* Main Content - centered with Container constraint */}
      <Container>
        <Grid
          container
          justifyContent="center"
          alignItems="center"
          sx={{ minHeight: { xs: 'calc(100vh - 200px)', sm: 'calc(100vh - 150px)', md: 'calc(100vh - 150px)' }, py: { xs: 4, md: 6 } }}
        >
          <Grid sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {!isLoggedIn && authParam && (
              <Box
                sx={{
                  maxWidth: { xs: 400, lg: 475 },
                  margin: { xs: '0 auto 2.5rem', md: '0 auto 3rem' },
                  '& > *': { flexGrow: 1, flexBasis: '50%' }
                }}
              >
                <Alert variant="border" color="primary" icon={<ExclamationCircleOutlined />}>
                  <Typography variant="h5">View Only</Typography>
                  <Typography variant="h6">
                    This page is view-only. To make it fully functional, please read the documentation provided{' '}
                    <Link href={documentationLink} target="_blank">
                      here
                    </Link>{' '}
                    after purchasing the theme.
                  </Typography>
                </Alert>
              </Box>
            )}
            <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 600 }, display: 'flex', justifyContent: 'center' }}>{children}</Box>
          </Grid>
        </Grid>
      </Container>

      {/* Footer */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Container>
          <Box sx={{ py: 1, pt: 8 }}>
            <AuthFooter />
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

AuthWrapper.propTypes = {
  children: PropTypes.node,
  splitScreen: PropTypes.bool,
  focused: PropTypes.bool
};
