import { Box, Typography, Stack, useTheme, alpha } from '@mui/material';
import { AccountBookOutlined } from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

export default function GeneralLedgerHeader() {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 4 }}>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Accounting' }
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
          <AccountBookOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" fontWeight={700}>
            Accounting
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Comprehensive accounting tools for managing your financial records
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
