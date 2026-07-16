import { Box, Typography, Stack, useTheme, alpha } from '@mui/material';
import { HomeOutlined } from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

export default function PropertiesHeader() {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 1 }}>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Properties' }
        ]}
      />

      {/* Header Row */}
      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <HomeOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" fontWeight={700}>
            Properties
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your property portfolio, view details, and track performance.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

