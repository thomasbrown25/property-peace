import PropTypes from 'prop-types';
import * as React from 'react';
import { Link as RouterLink } from 'react-router-dom';

// material-ui
import { useTheme } from '@emotion/react';
import { AppBar } from '@mui/material';
import { useMediaQuery } from '@mui/material';
import { useScrollTrigger } from '@mui/material';
import { Button } from '@mui/material';
import { Chip } from '@mui/material';
import { Container } from '@mui/material';
import { Link } from '@mui/material';
import { Stack } from '@mui/material';
import { Toolbar } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Paper } from '@mui/material';
import { Grid } from '@mui/material';

// project imports
import Logo from 'components/logo';
import AnimateButton from 'components/@extended/AnimateButton';

import useAuth from 'hooks/useAuth';
import useConfig from 'hooks/useConfig';
import { APP_DEFAULT_PATH, ThemeMode } from 'config';

// ==============================|| COMPONENTS - APP BAR ||============================== //

// elevation scroll
function ElevationScroll({ children, window }) {
  const theme = useTheme();
  const { mode } = useConfig();
  const isDarkMode = mode === ThemeMode.DARK;

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 10,
    target: window ? window() : undefined
  });

  // Light background for light mode, dark background for dark mode
  const backColorScroll = isDarkMode ? theme.palette.grey[800] : theme.palette.grey[50];

  return React.cloneElement(children, {
    style: {
      background: trigger ? backColorScroll : 'transparent',
      backdropFilter: trigger && !isDarkMode ? 'blur(10px)' : 'none',
      backgroundColor: trigger ? (isDarkMode ? backColorScroll : 'rgba(255, 255, 255, 0.9)') : 'transparent'
    }
  });
}

// Mapping of feature names to slugs for navigation
const featureSlugMap = {
  'AI-Powered Automation': 'ai-copilot',
  'Online Rent Collection': 'rent-collection',
  'Digital Lease Signing': 'lease-management',
  'Maintenance Tracking': 'maintenance-tracking',
  'Financial Reporting': 'financial-reports',
  'Tenant Management': 'property-management',
  'Property Management': 'property-management',
  'Document Management': 'document-management',
  'Property Accounting': 'financial-reports',
  'Collect Rent Online': 'payment-processing',
  'Maintenance Requests': 'maintenance-tracking',
  'Tenant Portal': 'real-time-communication',
  'Rental Applications': 'rental-applications'
};

export default function Header({ hideAuthButtons = false, hideNavigationLinks = false, centerLogo = false }) {
  const { isLoggedIn } = useAuth();
  const { mode } = useConfig();
  const isDarkMode = mode === ThemeMode.DARK;
  const textColor = isDarkMode ? 'white' : 'text.primary';

  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = React.useState(false);
  const featuresDropdownRef = React.useRef(null);
  const featuresLinkRef = React.useRef(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        featuresDropdownRef.current &&
        !featuresDropdownRef.current.contains(event.target)
      ) {
        setFeaturesDropdownOpen(false);
      }
    };

    if (featuresDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [featuresDropdownOpen]);

  return (
    <ElevationScroll>
      <AppBar sx={{ bgcolor: 'transparent', color: textColor, boxShadow: 'none' }}>
        <Container 
          maxWidth="xl"
          sx={{
            px: { xs: 3, sm: 4, md: 6, lg: 8 }
          }}
        >
          <Toolbar 
            sx={{ 
              px: 0,
              py: { xs: 0.5, md: 0.75 }, 
              minHeight: { xs: 48, md: 56 },
              height: { xs: 48, md: 56 },
              position: 'relative' 
            }}
          >
            {/* Left: Logo - visible on all screens */}
            <Stack 
              direction="row" 
              sx={{ 
                alignItems: 'center', 
                flexGrow: centerLogo ? 0 : 1,
                position: centerLogo ? 'absolute' : 'relative',
                left: centerLogo ? '50%' : 'auto',
                transform: centerLogo ? 'translateX(-50%)' : 'none'
              }}
            >
              <Typography sx={{ textAlign: 'left', display: 'inline-block' }}>
                <Logo reverse to="/" />
              </Typography>
              <Chip
                label={import.meta.env.VITE_APP_VERSION}
                variant="outlined"
                size="small"
                color="secondary"
                slotProps={{ label: { sx: { px: 0.5 } } }}
                sx={{ 
                  mt: 0.5, 
                  ml: 1, 
                  fontSize: '0.725rem', 
                  height: 20,
                  display: { xs: 'none', sm: 'inline-flex' }
                }}
              />
            </Stack>
            {/* Center Navigation - Features menu removed (marketing pages deleted) */}
            {!hideNavigationLinks && false && (
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                display: { xs: 'none', md: 'flex' },
                gap: 1
              }}
            >
              {/* Features menu removed - marketing pages deleted */}
            </Box>
            )}

            {/* Right Navigation - visible on all screens */}
            {!hideAuthButtons && (
              <Box 
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  ml: 'auto',
                  '& .header-link': { px: { xs: 1, md: 2 }, '&:hover': { color: 'primary.main' } } 
                }}
              >
                {/* Desktop: Show all links */}
                <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
                  <Link className="header-link" color={textColor} component={RouterLink} to="/landlord/dashboard" underline="none">
                    {isLoggedIn && 'My Dashboard'}
                  </Link>
                  <Link
                    className="header-link"
                    color={textColor}
                    component={RouterLink}
                    to={isLoggedIn ? APP_DEFAULT_PATH : '/login'}
                    underline="none"
                  >
                    {isLoggedIn ? 'Sign Out' : 'Login'}
                  </Link>
                  {!isLoggedIn && (
                    <AnimateButton>
                      <Button component={RouterLink} to="/register" disableElevation color="primary" variant="contained">
                        Start free
                      </Button>
                    </AnimateButton>
                  )}
                </Box>
                {/* Mobile: Show only login/register button */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1 }}>
                  {!isLoggedIn && (
                    <Button 
                      component={RouterLink} 
                      to="/login" 
                      size="small"
                      sx={{ color: textColor, minWidth: 'auto', px: 1.5 }}
                    >
                      Login
                    </Button>
                  )}
                  {!isLoggedIn && (
                    <Button 
                      component={RouterLink} 
                      to="/register" 
                      disableElevation 
                      color="primary" 
                      variant="contained"
                      size="small"
                      sx={{ minWidth: 'auto', px: 1.5 }}
                    >
                      Start free
                    </Button>
                  )}
                  {isLoggedIn && (
                    <Button 
                      component={RouterLink} 
                      to={APP_DEFAULT_PATH}
                      size="small"
                      sx={{ color: textColor, minWidth: 'auto', px: 1.5 }}
                    >
                      Dashboard
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>
    </ElevationScroll>
  );
}

ElevationScroll.propTypes = { children: PropTypes.any, window: PropTypes.any };

Header.propTypes = { 
  hideAuthButtons: PropTypes.bool,
  hideNavigationLinks: PropTypes.bool,
  centerLogo: PropTypes.bool
};
