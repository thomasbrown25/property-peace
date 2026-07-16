import PropTypes from 'prop-types';
import { useSearchParams, Link as RouterLink, useLocation } from 'react-router-dom';
import { Suspense } from 'react';

// material-ui
import { Grid } from '@mui/material';
import { Alert } from '@mui/material';
import { Typography } from '@mui/material';
import { Link } from '@mui/material';
import { Box } from '@mui/material';
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

// assets
import AuthBackground from './AuthBackground';
import ExclamationCircleOutlined from '@ant-design/icons/ExclamationCircleOutlined';

// ==============================|| AUTHENTICATION - WRAPPER ||============================== //

export default function AuthWrapper({ children, splitScreen = false }) {
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
              {(location.pathname.includes('/register') || location.pathname.includes('/tenant/invite/')) ? (
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
                        color: (t) => t.palette.mode === 'dark' ? '#000000' : '#ffffff'
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
            <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: isRegistrationFlow ? 680 : 400 } }}>
              {children}
            </Box>
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
              background: 'radial-gradient(circle at 82% 76%, rgba(34, 197, 94, 0.18), transparent 28%)',
              zIndex: 0
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
              backgroundSize: '42px 42px',
              maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.72), transparent 88%)',
              zIndex: 0
            }
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                mb: 3,
                px: 1.5,
                py: 0.75,
                borderRadius: 999,
                bgcolor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.34)',
                color: '#22c55e',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.16em',
                textTransform: 'uppercase'
              }}
            >
              Built for independent landlords
            </Box>

            <Typography
              component="h2"
              sx={{
                mb: 2,
                color: '#ffffff',
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                fontSize: { md: 44, lg: 56 }
              }}
            >
              Run rentals with less chasing and <Box component="span" sx={{ color: '#22c55e' }}>more control.</Box>
            </Typography>

            <Typography
              sx={{
                maxWidth: 500,
                mb: 4,
                color: 'rgba(255,255,255,0.74)',
                fontSize: { md: 17, lg: 18 },
                lineHeight: 1.7
              }}
            >
              Property Peace keeps rent, leases, maintenance, documents, and tenant conversations organized in one calm workspace — so your day starts with a clear picture instead of scattered tabs and spreadsheets.
            </Typography>

            <Box sx={{ display: 'grid', gap: 2 }}>
              {[
                {
                  eyebrow: 'Daily command center',
                  title: 'Know what needs attention before tenants text you.',
                  text: 'Morning summaries surface overdue rent, open maintenance, upcoming lease dates, and recent activity.'
                },
                {
                  eyebrow: 'Everything tied together',
                  title: 'One place for properties, people, payments, and paperwork.',
                  text: 'Track the details that usually live across spreadsheets, inboxes, folders, and payment portals.'
                },
                {
                  eyebrow: 'Professional by default',
                  title: 'Give renters a smoother, more credible experience.',
                  text: 'Tenant portals, online payments, applications, invites, and clean communication help small operators look buttoned up.'
                }
              ].map((item, index) => (
                <Box
                  key={item.eyebrow}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 2,
                    p: 2.25,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.07))',
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 20px 55px rgba(0,0,0,0.16)',
                    backdropFilter: 'blur(14px)'
                  }}
                >
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: index === 1 ? 'rgba(66, 202, 119, 0.18)' : 'rgba(255,255,255,0.16)',
                      color: index === 1 ? '#7ee3a3' : '#ffffff',
                      fontWeight: 800,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Box>
                    <Typography sx={{ mb: 0.5, color: '#22c55e', fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                      {item.eyebrow}
                    </Typography>
                    <Typography sx={{ mb: 0.75, color: '#ffffff', fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: 14.5, lineHeight: 1.55 }}>
                      {item.text}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                mt: 4,
                display: 'flex',
                gap: 3,
                color: 'rgba(255,255,255,0.78)',
                fontSize: 13,
                fontWeight: 700
              }}
            >
              <Box><Box component="span" sx={{ color: '#ffffff', fontSize: 24, fontWeight: 900 }}>1–50</Box><br />unit portfolios</Box>
              <Box><Box component="span" sx={{ color: '#ffffff', fontSize: 24, fontWeight: 900 }}>24/7</Box><br />tenant access</Box>
              <Box><Box component="span" sx={{ color: '#ffffff', fontSize: 24, fontWeight: 900 }}>10am</Box><br />daily clarity</Box>
            </Box>
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
        <Grid container justifyContent="center" alignItems="center" sx={{ minHeight: { xs: 'calc(100vh - 200px)', sm: 'calc(100vh - 150px)', md: 'calc(100vh - 150px)' }, py: { xs: 4, md: 6 } }}>
          <Grid sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {!isLoggedIn && authParam && (
              <Box sx={{ maxWidth: { xs: 400, lg: 475 }, margin: { xs: '0 auto 2.5rem', md: '0 auto 3rem' }, '& > *': { flexGrow: 1, flexBasis: '50%' } }}>
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
            <Box sx={{ width: '100%', maxWidth: { xs: '100%', sm: 600 }, display: 'flex', justifyContent: 'center' }}>
              {children}
            </Box>
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
  splitScreen: PropTypes.bool
};
