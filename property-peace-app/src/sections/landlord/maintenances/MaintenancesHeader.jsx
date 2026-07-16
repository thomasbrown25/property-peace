import { Box, Typography, Stack, useTheme, alpha } from '@mui/material';
import { ToolOutlined } from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

export default function MaintenancesHeader() {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 4 }}>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Maintenance Requests' }
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
          <ToolOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" fontWeight={700}>
            Maintenance Requests
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track and manage maintenance requests, repairs, and property issues.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

