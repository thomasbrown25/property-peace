import { alpha, Box, Button, Stack, Typography } from '@mui/material';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

const NAVY = '#061e35';

export default function LeasesHeader({ onCreateLease, onCreateAgreement }) {
  return (
    <>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Leases' }
          ]}
        />
      </Box>
      <Box
        sx={{
          mb: 2.5,
          p: { xs: 2, md: 2.75 },
          borderRadius: 3,
          color: '#fff',
          background: 'linear-gradient(120deg, #061e35 0%, #0b3558 100%)',
          boxShadow: `0 16px 38px ${alpha(NAVY, 0.18)}`
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>
              Leases
            </Typography>
            <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>
              Track lease terms, rent health, renewals, and agreements from one organized workspace.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FileTextOutlined />}
              onClick={onCreateAgreement}
              sx={{
                color: '#fff',
                borderColor: alpha('#fff', 0.35),
                bgcolor: alpha('#fff', 0.06),
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { borderColor: alpha('#fff', 0.65), bgcolor: alpha('#fff', 0.12) }
              }}
            >
              New agreement
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<PlusOutlined />}
              onClick={onCreateLease}
              sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
            >
              Create lease
            </Button>
          </Stack>
        </Stack>
      </Box>
    </>
  );
}

