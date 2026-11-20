import { Box } from '@mui/material';
import { NavLink } from 'react-router-dom';

const tenantPrimaryLinks = [
  { label: 'Home', to: '/tenant/dashboard' },
  { label: 'Payments', to: '/tenant/payments' },
  { label: 'Leases', to: '/tenant/lease' },
  { label: 'Maintenances', to: '/tenant/maintenance' },
  { label: 'Documents', to: '/tenant/documents' }
];

export default function TenantPrimaryNavigation() {
  return (
    <Box
      component="nav"
      aria-label="Tenant primary navigation"
      sx={{
        gridArea: 'navigation',
        display: 'flex',
        justifyContent: 'safe center',
        gap: { xs: 0.5, sm: 2, md: 2.5 },
        alignSelf: 'stretch',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}
    >
      {tenantPrimaryLinks.map(({ label, to }) => (
        <Box
          key={to}
          component={NavLink}
          to={to}
          sx={(theme) => ({
            display: 'inline-flex',
            alignItems: 'center',
            px: { xs: 0.5, sm: 0.75 },
            color: 'inherit',
            fontSize: { xs: 12, sm: 14 },
            fontWeight: 500,
            textDecoration: 'none',
            '&[aria-current="page"]': { fontWeight: 700 },
            '&:hover, &[aria-current="page"]': {
              color: 'inherit',
              textDecoration: 'underline',
              textDecorationThickness: '2px',
              textUnderlineOffset: '6px',
              textDecorationColor: theme.palette.mode === 'dark' ? theme.palette.brand.mint : theme.palette.primary.main
            },
            '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2, borderRadius: 1 }
          })}
        >
          {label}
        </Box>
      ))}
    </Box>
  );
}
