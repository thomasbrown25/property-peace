import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { activeLandlordPrimaryLink, landlordPrimaryLinks } from 'utils/landlordPrimaryNavigation';
import TopNavigation from './TopNavigation';

// Centered page links, not dashboard tabs: each item goes to its own
// destination and the current page is indicated with a quiet underline.
export default function LandlordPrimaryNavigation() {
  const { pathname, search } = useLocation();
  const active = activeLandlordPrimaryLink(pathname, search);
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const trialExpired = subscriptionStatus?.isTrialActive &&
    (subscriptionStatus.trialDaysRemaining == null || subscriptionStatus.trialDaysRemaining <= 0);

  return (
    <Box
      component="nav" aria-label="Landlord primary navigation"
      sx={{
        display: { xs: 'none', lg: 'flex' },
        alignItems: 'center',
        justifyContent: 'center',
        gap: { lg: 2.5, xl: 3 },
        height: '100%',
        whiteSpace: 'nowrap'
      }}
    >
      {landlordPrimaryLinks.map(({ label, to }) => (
        <Box
          key={label}
          component={RouterLink}
          to={to}
          onClick={trialExpired ? (event) => event.preventDefault() : undefined}
          aria-disabled={trialExpired || undefined}
          tabIndex={trialExpired ? -1 : undefined}
          aria-current={active === label ? 'page' : undefined}
          sx={(theme) => ({
            display: 'inline-flex',
            alignItems: 'center',
            alignSelf: 'stretch',
            px: 0.25,
            color: 'inherit',
            fontSize: { lg: 13, xl: 14 },
            fontWeight: active === label ? 700 : 500,
            lineHeight: 1,
            textDecoration: 'none',
            transition: 'color 150ms ease',
            '&:hover': { color: 'inherit', textDecoration: 'none' },
            '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -6, borderRadius: 1 }
          })}
        >
          <Box
            component="span"
            sx={(theme) => ({
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: -6,
                height: 2,
                backgroundColor: theme.palette.mode === 'dark' ? theme.palette.brand.mint : theme.palette.primary.main,
                opacity: active === label ? 1 : 0
              }
            })}
          >
            {label}
          </Box>
        </Box>
      ))}
      <TopNavigation />
    </Box>
  );
}
