import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
// material-ui
import { styled } from '@mui/material/styles';
import { Container } from '@mui/material';
import { CardMedia } from '@mui/material';
import { Divider } from '@mui/material';
import { Grid } from '@mui/material';
import { Link } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';

// third-party
import { motion } from 'framer-motion';

// project imports
import useConfig from 'hooks/useConfig';
import { ThemeDirection, ThemeMode } from 'config';
import { getImageUrl, ImagePath } from 'utils/getImageUrl';

// assets

import logo from 'assets/images/logos/logo-with-text.png';
import logoDark from 'assets/images/logos/logo-with-text-darkmode.png';

// link - custom style
const FooterLink = styled(Link)(({ theme, isdark }) => ({
  color: isdark === 'true' ? theme.palette.secondary[400] : theme.palette.text.primary,
  opacity: isdark === 'true' ? 0.8 : 0.7,
  fontSize: '0.875rem',
  fontWeight: 400,
  cursor: 'pointer',
  '&:hover': { 
    color: theme.palette.primary.main,
    opacity: 1
  },
  '&:active': { 
    color: theme.palette.primary.main,
    opacity: 1
  }
}));

export default function FooterBlock({ isFull }) {
  const { presetColor, mode } = useConfig();
  const isDarkMode = mode === ThemeMode.DARK;
  const textColor = isDarkMode ? 'common.white' : 'text.primary';
  const bgColor = isDarkMode ? 'grey.A700' : 'grey.50';
  const bottomBgColor = isDarkMode ? 'grey.800' : 'grey.100';

  const linkSX = {
    color: textColor,
    fontSize: '1.1rem',
    fontWeight: 400,
    opacity: '0.6',
    cursor: 'pointer',
    '&:hover': {
      opacity: '1'
    }
  };

  // Features section removed - marketing pages deleted

  return (
    <>
      {isFull && (
        <Box
          sx={(theme) => ({
            position: 'relative',
            bgcolor: bgColor,
            zIndex: 10,
            mt: { xs: 0, md: 8 },
            pt: { xs: 8, sm: 7.5, md: 10 },
            pb: { xs: 2.5, md: 10 },
            overflow: 'visible',
            '&:after': {
              content: '""',
              position: 'absolute',
              width: '100%',
              height: '80%',
              bottom: 0,
              left: 0,
              background: isDarkMode
                ? (theme.direction === ThemeDirection.RTL
                    ? `linear-gradient(transparent 100%, rgb(31, 31, 31) 70%)`
                    : `linear-gradient(180deg, transparent 0%, ${theme.palette.grey.A700} 70%)`)
                : (theme.direction === ThemeDirection.RTL
                    ? `linear-gradient(transparent 100%, rgba(240, 240, 240, 0.8) 70%)`
                    : `linear-gradient(180deg, transparent 0%, ${theme.palette.grey[50]} 70%)`)
            }
          })}
        >
         
 
        </Box>
      )}
      <Box sx={{ pt: isFull ? 0 : 10, pb: 10, bgcolor: bgColor, position: 'relative', zIndex: 10 }}>
        <Container>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, translateY: 550 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 150,
                  damping: 30
                }}
              >
                <Grid container spacing={2}>
                  <Grid size={12}>
                    <CardMedia component="img" image={isDarkMode ? logoDark : logo} alt="Property Peace logo" sx={{ width: 'auto', maxWidth: 200, height: 'auto' }} />
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 400, color: textColor }}>
                      Smarter property management for everyday landlords. Manage rentals, tenants, leases, and maintenance—all in one simple dashboard.
                    </Typography>
                  </Grid>
                </Grid>
              </motion.div>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Grid container spacing={{ xs: 5, md: 2 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack sx={{ gap: { xs: 3, md: 5 } }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 500,
                        color: textColor
                      }}
                    >
                      Resources
                    </Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink component={RouterLink} to="/" underline="none" isdark={isDarkMode.toString()}>
                        Home
                      </FooterLink>
                      <FooterLink component={RouterLink} to="/register" underline="none" isdark={isDarkMode.toString()}>
                        Get Started
                      </FooterLink>
                      <FooterLink href="mailto:support@brownstonehub.com" underline="none" isdark={isDarkMode.toString()}>
                        Support
                      </FooterLink>
                      <FooterLink href="mailto:contact@brownstonehub.com" underline="none" isdark={isDarkMode.toString()}>
                        Contact Us
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack sx={{ gap: { xs: 3, md: 5 } }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 500,
                        color: textColor
                      }}
                    >
                      Legal
                    </Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      {/* Legal pages removed - marketing pages deleted */}
                    </Stack>
                  </Stack>
                </Grid>
                {/* Features section removed - marketing pages deleted */}
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Stack sx={{ gap: { xs: 3, md: 5 } }}>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 500,
                        color: textColor
                      }}
                    >
                      Company
                    </Typography>
                    <Stack sx={{ gap: { xs: 1.5, md: 2.5 } }}>
                      <FooterLink href="https://www.brownstonehub.com" target="_blank" underline="none" isdark={isDarkMode.toString()}>
                        About Us
                      </FooterLink>
                      <FooterLink href="https://x.com/BrownstoneHubCo" target="_blank" underline="none" isdark={isDarkMode.toString()}>
                        X (Twitter)
                      </FooterLink>
                      <FooterLink href="https://www.instagram.com/propertypeace.io/" target="_blank" underline="none" isdark={isDarkMode.toString()}>
                        Instagram
                      </FooterLink>
                      <FooterLink href="mailto:info@brownstonehub.com" underline="none" isdark={isDarkMode.toString()}>
                        Email Us
                      </FooterLink>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>
      <Divider sx={{ borderColor: isDarkMode ? 'grey.700' : 'grey.300' }} />
      <Box
        sx={{ py: 1.5, pb: { xs: 7.5, sm: 1.5 }, bgcolor: bottomBgColor }}
      >
        <Container>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle2" sx={{ color: textColor, opacity: 0.8, textAlign: { xs: 'center', sm: 'left' } }}>
                © {new Date().getFullYear()} Brownstone Hub LLC. All rights reserved.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {/* Legal links removed - marketing pages deleted */}
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}

FooterBlock.propTypes = { isFull: PropTypes.bool };
