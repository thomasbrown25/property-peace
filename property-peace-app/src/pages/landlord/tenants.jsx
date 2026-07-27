import { Box } from '@mui/material';
import TenantsContent from 'sections/landlord/tenants/TenantsContent';
import TenantAddDrawer from 'components/drawers/TenantAddDrawer';

// ==============================|| TENANTS PAGE ||============================== //

export default function Tenants() {
  return (
    <>
      <Box sx={{ overflow: 'visible' }}>
        <TenantsContent />
      </Box>

      <TenantAddDrawer />
    </>
  );
}
